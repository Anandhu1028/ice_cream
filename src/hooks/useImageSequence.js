import { useEffect } from "react";
import { publicAsset } from "../utils/publicAsset";

export const FRAME_COUNT = 190;

export const SEQUENCES = [
  { id: "hero", folder: "hero", start: 0, duration: 1.08, background: "#d8a2ac", rgb: [216, 162, 172], focalX: 0.72 },
  { id: "hero2", folder: "hero2", start: 0.96, duration: 1.1, background: "#4b281e", rgb: [75, 40, 30], focalX: 0.75 },
  { id: "hero3", folder: "hero3", start: 1.94, duration: 1.06, background: "#efe2c7", rgb: [239, 226, 199], focalX: 0.75 },
];

export const STORY_DURATION = Math.max(...SEQUENCES.map((scene) => scene.start + scene.duration));

const IS_MOBILE = typeof window !== "undefined" && window.innerWidth <= 760;
const MAX_CACHE = IS_MOBILE ? 75 : 180;
const MAX_INFLIGHT = IS_MOBILE ? 6 : 10;
const PRELOAD_AHEAD = IS_MOBILE ? 16 : 26;
const PRELOAD_BEHIND = IS_MOBILE ? 8 : 14;

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
    return publicAsset(`frames-webp/${folder}/frame_${pad}.webp`);
  }
  return publicAsset(`frames/${folder}/frame_${pad}.png`);
}

export const POSTERS = {
  hero: frameSrc("hero", 120),
  hero2: frameSrc("hero2", 100),
  hero3: frameSrc("hero3", 20),
};

export function frameAtTime(scene, time) {
  const progress = Math.max(0, Math.min(1, (time - scene.start) / scene.duration));
  return Math.round(progress * (FRAME_COUNT - 1)) + 1;
}

function samplesAtTime(time) {
  const boundedTime = Math.max(0, Math.min(STORY_DURATION, time));

  for (let index = 0; index < SEQUENCES.length - 1; index += 1) {
    const previous = SEQUENCES[index];
    const next = SEQUENCES[index + 1];
    const transitionStart = next.start;
    const transitionEnd = previous.start + previous.duration;

    if (boundedTime >= transitionStart && boundedTime <= transitionEnd) {
      return {
        samples: [
          { scene: previous, frame: frameAtTime(previous, boundedTime) },
          { scene: next, frame: frameAtTime(next, boundedTime) },
        ],
        mix: (boundedTime - transitionStart) / (transitionEnd - transitionStart),
      };
    }
  }

  let scene = SEQUENCES[0];
  for (const candidate of SEQUENCES) {
    if (boundedTime >= candidate.start) scene = candidate;
  }
  return { samples: [{ scene, frame: frameAtTime(scene, boundedTime) }], mix: 0 };
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
  let lastPaintScene = "";
  let lastPreloadSignature = "";
  let lastGood = null;
  let raf = 0;
  let pendingTime = null;
  let direction = 1;
  let requestOrder = 0;
  let criticalPreloadCount = 0;

  // Progressive preloader state
  let progressiveIndex = 0;
  let progressiveTimer = 0;
  const allFrameTargets = [];
  for (const seq of SEQUENCES) {
    for (let f = 1; f <= FRAME_COUNT; f += 1) {
      allFrameTargets.push({ folder: seq.folder, frame: f });
    }
  }

  function isCriticalFrame(job) {
    return criticalPreloadCount > 0 && job.folder === "hero" && job.frame <= 8;
  }

  function touch(key) {
    const index = lru.indexOf(key);
    if (index !== -1) lru.splice(index, 1);
    lru.push(key);
  }

  function protectedKeys() {
    const keys = new Set();
    for (const sample of current.samples) {
      for (let delta = -PRELOAD_BEHIND; delta <= PRELOAD_AHEAD; delta += 1) {
        const frame = Math.max(1, Math.min(FRAME_COUNT, sample.frame + direction * delta));
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

  function mixColor(from, to, amount) {
    const channels = from.rgb.map((value, index) =>
      Math.round(value + (to.rgb[index] - value) * amount)
    );
    return `rgb(${channels.join(",")})`;
  }

  function requestPaint() {
    if (attached && !raf) raf = requestAnimationFrame(flushSeek);
  }

  function resolveJob(job, value) {
    if (job.settled) return;
    job.settled = true;
    job.resolve(value);
  }

  function cancelActiveJob(job) {
    if (job.cancelled) return;
    job.cancelled = true;
    if (inflight.get(job.key) === job) inflight.delete(job.key);
    if (job.img) {
      job.img.onload = null;
      job.img.onerror = null;
      job.img.removeAttribute("src");
    }
    resolveJob(job, null);
  }

  function paint() {
    if (!attached || !ctx || !canvas) return;

    const resolved = current.samples.map((sample) => ({
      sample,
      found: nearestImage(sample),
    }));
    const transition = resolved.length === 2 && current.mix > 0 && current.mix < 1;
    const activeIndex = resolved.length === 2 && current.mix >= 1 ? 1 : 0;
    const visible = transition ? resolved : [resolved[activeIndex]];
    const missing = visible.some(({ found }) => !found);

    if (missing) {
      if (!lastGood) {
        ctx.fillStyle = current.samples[activeIndex].scene.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lastPaintScene = current.samples[activeIndex].scene.folder;
        return;
      }
      if (lastGood.key === lastPaintKey) return;
      ctx.globalAlpha = 1;
      ctx.fillStyle = lastGood.sample.scene.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCover(lastGood.img, lastGood.sample.scene);
      lastPaintKey = lastGood.key;
      lastPaintScene = lastGood.sample.scene.folder;
      return;
    }

    if (transition) {
      const first = resolved[0].found;
      const second = resolved[1].found;
      const paintKey = `${first.key}|${second.key}|${Math.round(current.mix * 1000)}`;
      if (paintKey === lastPaintKey) return;

      ctx.globalAlpha = 1;
      ctx.fillStyle = mixColor(resolved[0].sample.scene, resolved[1].sample.scene, current.mix);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      drawCover(first.img, resolved[0].sample.scene);
      ctx.globalAlpha = current.mix;
      drawCover(second.img, resolved[1].sample.scene);
      lastGood = {
        sample: resolved[current.mix >= 0.5 ? 1 : 0].sample,
        ...(current.mix >= 0.5 ? second : first),
      };
      lastPaintScene = "";
      lastPaintKey = paintKey;
    } else {
      const { sample, found } = resolved[activeIndex];
      if (found.key === lastPaintKey) return;
      if (lastPaintScene !== sample.scene.folder) {
        ctx.fillStyle = sample.scene.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.globalAlpha = 1;
      drawCover(found.img, sample.scene);
      lastGood = { sample, ...found };
      lastPaintScene = sample.scene.folder;
      lastPaintKey = found.key;
    }
    ctx.globalAlpha = 1;
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
    if (queue.length > 60) {
      queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
      queue.splice(40).forEach((job) => {
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
      // Do not saturate network if active user scrubbing is underway
      if (inflight.size >= 4 || queue.length >= 8) {
        progressiveTimer = window.setTimeout(scheduleProgressivePreload, 150);
        return;
      }

      let enqueued = 0;
      while (progressiveIndex < allFrameTargets.length && enqueued < 4) {
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
          progressiveTimer = window.requestIdleCallback(scheduleProgressivePreload, { timeout: 200 });
        } else {
          progressiveTimer = window.setTimeout(scheduleProgressivePreload, 35);
        }
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      progressiveTimer = window.requestIdleCallback(run, { timeout: 200 });
    } else {
      progressiveTimer = window.setTimeout(run, 50);
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
      addTarget(sample.scene.folder, sample.frame, 0);
      for (let step = 1; step <= PRELOAD_AHEAD; step += 1) {
        const frame = sample.frame + direction * step;
        if (frame >= 1 && frame <= FRAME_COUNT) {
          addTarget(sample.scene.folder, frame, step);
        }
      }
      for (let step = 1; step <= PRELOAD_BEHIND; step += 1) {
        const frame = sample.frame - direction * step;
        if (frame >= 1 && frame <= FRAME_COUNT) {
          addTarget(sample.scene.folder, frame, PRELOAD_AHEAD + step);
        }
      }
    }

    // Near scene transitions, preload initial frames of adjacent scene
    for (let index = 0; index < SEQUENCES.length - 1; index += 1) {
      const scene = SEQUENCES[index];
      if (time >= scene.start + scene.duration * 0.7 && time < SEQUENCES[index + 1].start) {
        for (let frame = 1; frame <= 10; frame += 1) {
          addTarget(SEQUENCES[index + 1].folder, frame, PRELOAD_AHEAD + PRELOAD_BEHIND + frame);
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
      lastPaintScene = "";
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
    const targets = [1, 2, 3, 4, 5, 6, 7, 8].map((frame) => ({ folder: "hero", frame }));
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
        for (let frame = 9; frame <= 18; frame += 1) {
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
