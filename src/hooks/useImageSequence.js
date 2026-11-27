import { useEffect } from "react";
import { publicAsset } from "../utils/publicAsset";

export const FRAME_COUNT = 190;

export const SEQUENCES = [
  { id: "hero", folder: "hero", start: 0, duration: 1, startFrame: 42, endFrame: 190, background: "#9f646f", focalX: 0.74 },
  { id: "hero2", folder: "hero2", start: 1, duration: 1, startFrame: 1, endFrame: 190, background: "#5b0b14", focalX: 0.74 },
  { id: "hero3", folder: "hero3", start: 2, duration: 1, startFrame: 1, endFrame: 190, background: "#d8b08c", focalX: 0.74 },
];

export const STORY_DURATION = Math.max(...SEQUENCES.map((scene) => scene.start + scene.duration));

const IS_MOBILE = typeof window !== "undefined" && window.innerWidth <= 760;
const MAX_CACHE = IS_MOBILE ? 360 : 600;
const MAX_INFLIGHT = IS_MOBILE ? 10 : 18;
const PRELOAD_AHEAD = IS_MOBILE ? 18 : 28;
const PRELOAD_BEHIND = IS_MOBILE ? 8 : 14;
const FRAME_ASSET_VERSION = "rv-20261127-q82";

const CAN_USE_WEBP = (() => {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch {
    return true;
  }
})();

const cache = new Map();
const failed = new Set();
const warned = new Set();
const lru = [];

export function frameSrc(folder, frame, usePng = false) {
  const pad = String(frame).padStart(6, "0");
  if (!usePng && CAN_USE_WEBP) {
    return `${publicAsset(`frames-webp/${folder}/frame_${pad}.webp`)}?v=${FRAME_ASSET_VERSION}`;
  }
  return `${publicAsset(`frames/${folder}/frame_${pad}.png`)}?v=${FRAME_ASSET_VERSION}`;
}

export const POSTERS = {
  hero: frameSrc("hero", 120),
  hero2: frameSrc("hero2", 100),
  hero3: frameSrc("hero3", 20),
};

export function frameAtTime(scene, time) {
  const startFrame = scene.startFrame ?? 1;
  const endFrame = scene.endFrame ?? FRAME_COUNT;
  const progress = Math.max(0, Math.min(1, (time - scene.start) / scene.duration));
  return Math.round(progress * (endFrame - startFrame)) + startFrame;
}

function samplesAtTime(time) {
  const boundedTime = Math.max(0, Math.min(STORY_DURATION, time));
  let scene = SEQUENCES[0];
  for (const candidate of SEQUENCES) {
    if (boundedTime >= candidate.start) scene = candidate;
  }
  return { samples: [{ scene, frame: frameAtTime(scene, boundedTime) }] };
}

function createSequencePlayer() {
  const inflight = new Map();
  const queue = [];

  let canvas = null;
  let ctx = null;
  let attached = false;
  let current = samplesAtTime(0);
  let currentTime = 0;
  let lastSeekTime = -1;
  let lastPaintKey = "";
  let lastPreloadSignature = "";
  let lastGood = null;
  let raf = 0;
  let pendingTime = null;
  let direction = 1;
  let requestOrder = 0;
  let criticalPreloadCount = 0;

  // Progressive preloader state: load keyframes across all scenes first (stride 4, then 2, then 1)
  let progressiveIndex = 0;
  let progressiveTimer = 0;
  const allFrameTargets = [];
  const addedTargets = new Set();
  for (const stride of [4, 2, 1]) {
    for (const seq of SEQUENCES) {
      const startFrame = seq.startFrame ?? 1;
      const endFrame = seq.endFrame ?? FRAME_COUNT;
      for (let f = startFrame; f <= endFrame; f += stride) {
        const key = `${seq.folder}:${f}`;
        if (!addedTargets.has(key)) {
          addedTargets.add(key);
          allFrameTargets.push({ folder: seq.folder, frame: f });
        }
      }
    }
  }

  function touch(key) {
    const index = lru.indexOf(key);
    if (index !== -1) lru.splice(index, 1);
    lru.push(key);
  }

  function protectedKeys() {
    const keys = new Set();
    for (const sample of current.samples) {
      const startFrame = sample.scene.startFrame ?? 1;
      const endFrame = sample.scene.endFrame ?? FRAME_COUNT;
      for (let delta = -PRELOAD_BEHIND; delta <= PRELOAD_AHEAD; delta += 1) {
        const frame = Math.max(startFrame, Math.min(endFrame, sample.frame + direction * delta));
        keys.add(`${sample.scene.folder}:${frame}`);
      }
    }
    return keys;
  }

  function evict() {
    const protect = protectedKeys();
    let spins = 0;
    while (cache.size > MAX_CACHE && lru.length > 0 && spins < lru.length + 2) {
      spins += 1;
      const oldest = lru.shift();
      if (!oldest || !cache.has(oldest)) continue;
      if (protect.has(oldest)) {
        lru.push(oldest);
        continue;
      }
      cache.delete(oldest);
    }
  }

  function readCached(folder, frame) {
    const key = `${folder}:${frame}`;
    const img = cache.get(key);
    if (!img) return null;
    touch(key);
    return { img, key };
  }

  function nearestImage(sample) {
    const exact = readCached(sample.scene.folder, sample.frame);
    if (exact) return exact;

    // Search closest decoded frame in cache
    let closest = null;
    let minDistance = Infinity;

    for (const [key, img] of cache.entries()) {
      if (!key.startsWith(sample.scene.folder + ":")) continue;
      const separator = key.lastIndexOf(":");
      const frameNum = Number(key.slice(separator + 1));
      const dist = Math.abs(frameNum - sample.frame);
      if (dist < minDistance) {
        minDistance = dist;
        closest = { img, key };
        if (dist === 1) break;
      }
    }

    if (closest) return closest;
    if (lastGood && lastGood.sample?.scene?.folder === sample.scene.folder) {
      return { img: lastGood.img, key: lastGood.key };
    }
    return null;
  }

  function drawCover(img, scene) {
    const width = canvas.width;
    const height = canvas.height;
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;
    const focalX = scene?.focalX ?? 0.5;
    const dx = (width - drawWidth) * focalX;
    const dy = (height - drawHeight) * 0.5;

    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
  }

  function requestPaint() {
    if (attached && !raf) raf = requestAnimationFrame(flushSeek);
  }

  function resolveJob(job, value) {
    if (job.settled) return;
    job.settled = true;
    job.resolve(value);
  }

  function paint() {
    if (!attached || !ctx || !canvas) return;

    const sample = current.samples[0];
    const found = nearestImage(sample);

    if (!found) {
      if (!lastGood) {
        ctx.fillStyle = sample.scene.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }
      if (lastGood.key === lastPaintKey) return;
      ctx.globalAlpha = 1;
      drawCover(lastGood.img, lastGood.sample.scene);
      lastPaintKey = lastGood.key;
      return;
    }

    if (found.key === lastPaintKey) return;
    ctx.globalAlpha = 1;
    drawCover(found.img, sample.scene);
    lastGood = { sample, ...found };
    lastPaintKey = found.key;
  }

  function pump() {
    queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
    while (inflight.size < MAX_INFLIGHT && queue.length > 0) {
      const job = queue.shift();
      if (job.cancelled || job.settled) continue;
      if (cache.has(job.key) || failed.has(job.key)) {
        resolveJob(job, cache.get(job.key) || null);
        continue;
      }
      if (inflight.has(job.key)) {
        resolveJob(job, null);
        continue;
      }

      inflight.set(job.key, job);
      const img = new Image();
      job.img = img;
      img.decoding = "async";
      if (job.priority <= 2 && "fetchPriority" in img) img.fetchPriority = "high";

      const isCurrentJob = () => !job.cancelled && inflight.get(job.key) === job;
      const fail = () => {
        if (!isCurrentJob()) return;
        failed.add(job.key);
        inflight.delete(job.key);
        if (!warned.has(job.key)) {
          warned.add(job.key);
          console.warn(`Unable to load animation frame ${job.key}`);
        }
        requestPaint();
        resolveJob(job, null);
        pump();
      };

      const commit = () => {
        if (!isCurrentJob()) return;
        if (!img.naturalWidth) {
          fail();
          return;
        }
        cache.set(job.key, img);
        touch(job.key);
        inflight.delete(job.key);
        evict();
        requestPaint();
        resolveJob(job, img);
        pump();
      };

      img.onload = () => {
        if (typeof img.decode === "function") {
          img.decode().then(commit).catch(() => {
            if (img.naturalWidth > 0) {
              commit();
            } else {
              fail();
            }
          });
        } else {
          commit();
        }
      };

      img.onerror = () => {
        if (!job.usedFallback) {
          job.usedFallback = true;
          img.src = frameSrc(job.folder, job.frame, true);
          return;
        }
        fail();
      };

      img.src = frameSrc(job.folder, job.frame);
    }
  }

  function requestFrame(folder, frame, priority = 10) {
    const key = `${folder}:${frame}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (failed.has(key)) return Promise.resolve(null);
    const active = inflight.get(key);
    if (active) {
      active.priority = Math.min(active.priority, priority);
      if (active.priority <= 2 && active.img && "fetchPriority" in active.img) {
        active.img.fetchPriority = "high";
      }
      return active.promise;
    }

    const queued = queue.find((item) => item.key === key);
    if (queued) {
      queued.priority = Math.min(queued.priority, priority);
      pump();
      return queued.promise;
    }

    let resolve = () => {};
    const promise = new Promise((res) => {
      resolve = res;
    });
    queue.push({
      folder,
      frame,
      key,
      priority,
      order: requestOrder,
      promise,
      resolve,
      settled: false,
      cancelled: false,
      img: null,
      usedFallback: false,
    });
    requestOrder += 1;

    // Prune stale queue entries only if queue is excessively large
    if (queue.length > 100) {
      queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
      queue.splice(70).forEach((job) => {
        if (job.priority > 20) {
          job.cancelled = true;
          resolveJob(job, null);
        }
      });
    }
    pump();
    return promise;
  }

  function scheduleProgressivePreload() {
    if (progressiveTimer) return;
    const run = () => {
      progressiveTimer = 0;
      // Yield to active scrubbing if queue/inflight is busy
      if (inflight.size >= MAX_INFLIGHT - 2 || queue.length >= 20) {
        progressiveTimer = window.setTimeout(scheduleProgressivePreload, 80);
        return;
      }

      let enqueued = 0;
      const batchSize = IS_MOBILE ? 6 : 10;
      while (progressiveIndex < allFrameTargets.length && enqueued < batchSize) {
        const target = allFrameTargets[progressiveIndex];
        progressiveIndex += 1;
        const key = `${target.folder}:${target.frame}`;
        if (!cache.has(key) && !inflight.has(key) && !queue.some((j) => j.key === key)) {
          requestFrame(target.folder, target.frame, 85);
          enqueued += 1;
        }
      }

      if (progressiveIndex < allFrameTargets.length) {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          progressiveTimer = window.requestIdleCallback(scheduleProgressivePreload, { timeout: 120 });
        } else {
          progressiveTimer = window.setTimeout(scheduleProgressivePreload, 16);
        }
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      progressiveTimer = window.requestIdleCallback(run, { timeout: 120 });
    } else {
      progressiveTimer = window.setTimeout(run, 16);
    }
  }

  function preloadAround(time, state) {
    const targets = new Map();
    const addTarget = (folder, frame, priority) => {
      const key = `${folder}:${frame}`;
      const currentPriority = targets.get(key);
      if (currentPriority == null || priority < currentPriority) {
        targets.set(key, priority);
      }
    };

    for (const sample of state.samples) {
      const startFrame = sample.scene.startFrame ?? 1;
      const endFrame = sample.scene.endFrame ?? FRAME_COUNT;
      addTarget(sample.scene.folder, sample.frame, 0);
      for (let step = 1; step <= PRELOAD_AHEAD; step += 1) {
        const frame = sample.frame + direction * step;
        if (frame >= startFrame && frame <= endFrame) {
          addTarget(sample.scene.folder, frame, step);
        }
      }
      for (let step = 1; step <= PRELOAD_BEHIND; step += 1) {
        const frame = sample.frame - direction * step;
        if (frame >= startFrame && frame <= endFrame) {
          addTarget(sample.scene.folder, frame, PRELOAD_AHEAD + step);
        }
      }
    }

    // Near scene transitions, preload initial frames of upcoming scene and trailing frames of previous scene
    for (let index = 0; index < SEQUENCES.length - 1; index += 1) {
      const scene = SEQUENCES[index];
      const nextScene = SEQUENCES[index + 1];
      const nextStart = nextScene.startFrame ?? 1;
      if (time >= scene.start + scene.duration * 0.55 && time < nextScene.start) {
        for (let offset = 0; offset < 18; offset += 1) {
          addTarget(nextScene.folder, nextStart + offset, PRELOAD_AHEAD + PRELOAD_BEHIND + offset + 1);
        }
      }
      const prevEnd = scene.endFrame ?? FRAME_COUNT;
      if (time >= nextScene.start && time <= nextScene.start + nextScene.duration * 0.25) {
        for (let offset = 0; offset < 12; offset += 1) {
          addTarget(scene.folder, prevEnd - offset, PRELOAD_AHEAD + PRELOAD_BEHIND + offset + 1);
        }
      }
    }

    // Boost priority of queued and in-flight targets matching the playhead
    for (const job of queue) {
      const priority = targets.get(job.key);
      if (priority != null) {
        job.priority = priority;
      }
    }

    for (const job of inflight.values()) {
      const priority = targets.get(job.key);
      if (priority != null) {
        job.priority = priority;
        if (job.priority <= 2 && job.img && "fetchPriority" in job.img) {
          job.img.fetchPriority = "high";
        }
      }
    }

    for (const [key, priority] of targets) {
      const separator = key.lastIndexOf(":");
      requestFrame(key.slice(0, separator), Number(key.slice(separator + 1)), priority);
    }
  }

  function flushSeek() {
    raf = 0;
    if (pendingTime != null) {
      const time = Math.max(0, Math.min(STORY_DURATION, pendingTime));
      pendingTime = null;
      if (time !== lastSeekTime) {
        direction = time >= lastSeekTime ? 1 : -1;
        lastSeekTime = time;
        currentTime = time;
        current = samplesAtTime(time);
        const signature = `${direction}:${current.samples
          .map(({ scene, frame }) => `${scene.folder}:${frame}`)
          .join("|")}`;
        if (signature !== lastPreloadSignature) {
          lastPreloadSignature = signature;
          preloadAround(time, current);
        }
      }
    }
    paint();
  }

  function seek(time) {
    pendingTime = time;
    if (!raf) raf = requestAnimationFrame(flushSeek);
  }

  function resize() {
    if (!canvas?.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const pixelRatioCap = IS_MOBILE ? 1.35 : 1.5;
    const ratio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    let width = Math.round(cssWidth * ratio);
    let height = Math.round(cssHeight * ratio);
    const cap = window.innerWidth <= 760 ? 1440 : 2048;
    const edge = Math.max(width, height);
    if (edge > cap) {
      const scale = cap / edge;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      lastPaintKey = "";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    }
    paint();
  }

  function attach(nextCanvas) {
    canvas = nextCanvas;
    ctx = nextCanvas.getContext("2d", { alpha: false, desynchronized: true });
    attached = true;
    resize();
    seek(currentTime);
  }

  function detach() {
    attached = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    pendingTime = null;
    canvas = null;
    ctx = null;
  }

  function preloadCritical(onProgress = () => {}) {
    const heroStart = SEQUENCES[0].startFrame ?? 1;
    const targets = Array.from({ length: 16 }, (_, index) => ({
      folder: "hero",
      frame: heroStart + index,
    }));
    criticalPreloadCount += 1;
    let settled = 0;
    let loaded = 0;
    let timedOut = false;
    const reportProgress = () => {
      onProgress(timedOut ? 1 : settled / targets.length);
    };
    const tasks = targets.map(({ folder, frame }, index) =>
      requestFrame(folder, frame, index).then((img) => {
        settled += 1;
        if (img) loaded += 1;
        reportProgress();
        return img;
      })
    );
    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        reportProgress();
        resolve("timeout");
      }, 8000);
    });

    return Promise.race([Promise.all(tasks), timeout])
      .then((value) => {
        if (value === "timeout") {
          console.warn("Critical hero frames timed out; continuing with available frames.");
        } else {
          reportProgress();
        }
        for (let frame = heroStart + 16; frame <= heroStart + 32; frame += 1) {
          requestFrame("hero", frame, 12);
        }
        seek(currentTime);
        return { loaded, total: targets.length, timedOut };
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        criticalPreloadCount = Math.max(0, criticalPreloadCount - 1);
        preloadAround(currentTime, current);
        scheduleProgressivePreload();
      });
  }

  return { attach, detach, resize, seek, preloadCritical };
}

let singleton;

export function getSequencePlayer() {
  if (!singleton) singleton = createSequencePlayer();
  return singleton;
}

export function useImageSequence(canvasRef, enabled = true) {
  const player = getSequencePlayer();

  useEffect(() => {
    if (!enabled) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    player.attach(canvas);
    const parent = canvas.parentElement;
    let resizeRaf = 0;
    const scheduleResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        player.resize();
      });
    };
    const observer = new ResizeObserver(scheduleResize);
    if (parent) observer.observe(parent);
    window.addEventListener("resize", scheduleResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      player.detach();
    };
  }, [canvasRef, enabled, player]);

  return player;
}
