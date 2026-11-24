import { useEffect } from "react";

/**
 * Scroll film for the three SCOOPY sequences.
 *
 * Files are 1280×720 PNGs and often 0.6–1.2MB each, so the player keeps a
 * small decoded cache and preloads only the frames around the playhead.
 * Quality stays at the original resolution.
 *
 * If these files ever need to weigh less, convert them offline to WebP at
 * quality 90 and keep this exact naming. Do not scale them below 1280×720 —
 * the canvas is already capped so a laptop is not asked to decode all 570.
 */

export const FRAME_COUNT = 190;

export const SEQUENCES = [
  { id: "hero", folder: "hero" },
  { id: "hero2", folder: "hero2" },
  { id: "hero3", folder: "hero3" },
];

export const TOTAL_FRAMES = SEQUENCES.length * FRAME_COUNT;

const MAX_CACHE = 20;
const MAX_INFLIGHT = 3;
const PRELOAD_AHEAD = 8;
const PRELOAD_BEHIND = 3;

const cache = new Map();
const failed = new Set();
const warned = new Set();
const lru = [];

export function frameSrc(folder, frame) {
  return `/frames/${folder}/frame_${String(frame).padStart(6, "0")}.png`;
}

export function resolveFrame(globalIndex) {
  const index = Math.max(
    0,
    Math.min(TOTAL_FRAMES - 1, Math.round(Number(globalIndex) || 0))
  );
  const scene = Math.floor(index / FRAME_COUNT);
  const frame = index - scene * FRAME_COUNT + 1;
  return {
    index,
    scene,
    folder: SEQUENCES[scene].folder,
    frame,
  };
}

export const POSTERS = {
  home: frameSrc("hero", 120),
  about: frameSrc("hero2", 100),
  menu: frameSrc("hero3", 20),
};

function createSequencePlayer() {
  const inflight = new Map();
  const queue = [];

  let canvas = null;
  let ctx = null;
  let attached = false;
  let current = resolveFrame(0);
  let lastSeekIndex = -1;
  let lastPaintKey = "";
  let lastGood = null;
  let raf = 0;
  let pendingFrame = null;
  let direction = 1;

  function touch(key) {
    const index = lru.indexOf(key);
    if (index !== -1) lru.splice(index, 1);
    lru.push(key);
  }

  function protectedKeys() {
    const keys = new Set();
    for (let delta = -PRELOAD_BEHIND; delta <= PRELOAD_AHEAD; delta += 1) {
      const spec = resolveFrame(current.index + delta);
      keys.add(`${spec.folder}:${spec.frame}`);
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

  function nearestImage(spec) {
    const exact = readCached(spec.folder, spec.frame);
    if (exact) return exact;

    for (let distance = 1; distance < FRAME_COUNT; distance += 1) {
      const before = spec.frame - distance;
      const after = spec.frame + distance;
      if (before >= 1) {
        const img = readCached(spec.folder, before);
        if (img) return img;
      }
      if (after <= FRAME_COUNT) {
        const img = readCached(spec.folder, after);
        if (img) return img;
      }
    }

    if (spec.scene > 0) {
      const previous = SEQUENCES[spec.scene - 1].folder;
      const bridge = readCached(previous, FRAME_COUNT) || readCached(previous, FRAME_COUNT - 1);
      if (bridge) return bridge;
    }

    return null;
  }

  function drawContained(img) {
    const width = canvas.width;
    const height = canvas.height;
    const imageRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = width / height;
    let drawWidth;
    let drawHeight;

    if (canvasRatio > imageRatio) {
      drawHeight = height;
      drawWidth = height * imageRatio;
    } else {
      drawWidth = width;
      drawHeight = width / imageRatio;
    }

    const dx = (width - drawWidth) * 0.62;
    const verticalAlignment = canvasRatio < 0.75 ? 0.08 : 0.5;
    const dy = (height - drawHeight) * verticalAlignment;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#f6c3d2";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
  }

  function paint() {
    if (!attached || !ctx || !canvas) return;
    const found = nearestImage(current);
    const img = found?.img || lastGood;
    if (!img) {
      ctx.fillStyle = "#f6c3d2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const key = found?.key || "last";
    if (key === lastPaintKey) return;
    drawContained(img);
    lastGood = img;
    lastPaintKey = key;
  }

  function pump() {
    queue.sort((a, b) => a.priority - b.priority);
    while (inflight.size < MAX_INFLIGHT && queue.length > 0) {
      const job = queue.shift();
      if (cache.has(job.key) || failed.has(job.key)) {
        job.resolve(cache.get(job.key) || null);
        continue;
      }
      if (inflight.has(job.key)) continue;

      inflight.set(job.key, job.promise);
      const img = new Image();
      img.decoding = "async";
      if (job.priority <= 2 && "fetchPriority" in img) img.fetchPriority = "high";

      img.onload = () => {
        const commit = () => {
          if (!img.naturalWidth) {
            failed.add(job.key);
            inflight.delete(job.key);
            job.resolve(null);
            pump();
            return;
          }
          cache.set(job.key, img);
          touch(job.key);
          inflight.delete(job.key);
          evict();
          paint();
          job.resolve(img);
          pump();
        };
        if (typeof img.decode === "function") img.decode().then(commit).catch(commit);
        else commit();
      };

      img.onerror = () => {
        failed.add(job.key);
        inflight.delete(job.key);
        if (!warned.has(job.key)) {
          warned.add(job.key);
          console.warn(`Missing animation frame ${job.folder}/frame_${String(job.frame).padStart(6, "0")}.png`);
        }
        paint();
        job.resolve(null);
        pump();
      };

      img.src = frameSrc(job.folder, job.frame);
    }
  }

  function requestFrame(folder, frame, priority = 10) {
    const key = `${folder}:${frame}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (failed.has(key)) return Promise.resolve(null);
    if (inflight.has(key)) return inflight.get(key);

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
    queue.push({ folder, frame, key, priority, promise, resolve });
    if (queue.length > 40) {
      queue.sort((a, b) => a.priority - b.priority);
      queue.splice(24).forEach((job) => job.resolve(null));
    }
    pump();
    return promise;
  }

  function preloadAround(spec) {
    requestFrame(spec.folder, spec.frame, 0);
    for (let step = 1; step <= PRELOAD_AHEAD; step += 1) {
      const ahead = resolveFrame(spec.index + direction * step);
      requestFrame(ahead.folder, ahead.frame, step);
    }
    for (let step = 1; step <= PRELOAD_BEHIND; step += 1) {
      const behind = resolveFrame(spec.index - direction * step);
      requestFrame(behind.folder, behind.frame, PRELOAD_AHEAD + step);
    }
    if (spec.frame >= FRAME_COUNT - 18 && spec.scene < SEQUENCES.length - 1) {
      const next = resolveFrame((spec.scene + 1) * FRAME_COUNT);
      requestFrame(next.folder, next.frame, 2);
    }
  }

  function flushSeek() {
    raf = 0;
    if (pendingFrame == null) return;
    const spec = resolveFrame(pendingFrame);
    pendingFrame = null;
    if (spec.index === lastSeekIndex) return;
    direction = spec.index >= lastSeekIndex ? 1 : -1;
    lastSeekIndex = spec.index;
    current = spec;
    preloadAround(spec);
    paint();
  }

  function seek(globalFrame) {
    pendingFrame = globalFrame;
    if (!raf) raf = requestAnimationFrame(flushSeek);
  }

  function resize() {
    if (!canvas?.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const pixelRatioCap = window.innerWidth <= 760 ? 1.35 : 1.75;
    const ratio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    let width = Math.round(cssWidth * ratio);
    let height = Math.round(cssHeight * ratio);
    const cap = 1440;
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
    }
    paint();
  }

  function attach(nextCanvas) {
    canvas = nextCanvas;
    ctx = nextCanvas.getContext("2d", { alpha: false });
    attached = true;
    resize();
  }

  function detach() {
    attached = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas = null;
    ctx = null;
  }

  function preloadCritical(onProgress) {
    const frames = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let done = 0;
    const tasks = frames.map((frame, index) =>
      requestFrame("hero", frame, index).then((img) => {
        done += 1;
        onProgress?.(done / frames.length);
        return img;
      })
    );
    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = window.setTimeout(() => resolve("timeout"), 12000);
    });

    return Promise.race([Promise.all(tasks), timeout]).then((value) => {
      const loaded = Array.isArray(value) ? value.filter(Boolean).length : done;
      requestFrame("hero2", 1, 4);
      requestFrame("hero3", 1, 5);
      for (let frame = 11; frame <= 22; frame += 1) requestFrame("hero", frame, 14);
      seek(current.index);
      return { loaded };
    }).finally(() => window.clearTimeout(timeoutId));
  }

  return {
    attach,
    detach,
    resize,
    seek,
    preloadCritical,
  };
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
    const observer = new ResizeObserver(() => player.resize());
    if (parent) observer.observe(parent);
    window.addEventListener("resize", player.resize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", player.resize);
      player.detach();
    };
  }, [canvasRef, enabled, player]);

  return player;
}
