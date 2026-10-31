// Web entry point for SAFER Score. Loads rules.json, wires up browser APIs,
// and mounts the app using the shared code.

import { mountApp, mountFatal } from "../shared/app.js";
import { validateRules } from "../shared/engine.js";

/* ------------------------------------------------------------------ */
/* Browser environment for the shared app                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY_PREFIX = "safer-score.";

const storage = {
  getItem: (key) => localStorage.getItem(STORAGE_KEY_PREFIX + key),
  setItem: (key, value) => localStorage.setItem(STORAGE_KEY_PREFIX + key, value),
};

const now = () => Date.now();

const scheduler = {
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (id) => window.clearInterval(id),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

const formatTime = (ts) => {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

let audioCtx = null;
let wakeLock = null;

const audio = {
  unlock: () => {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
    } catch (e) {
      // Audio not supported
    }
  },
  melody: () => {
    if (!audioCtx) return;
    const TUNE = [
      [659.25, 0],
      [783.99, 0.18],
      [1046.5, 0.36],
      [987.77, 0.62],
      [783.99, 0.8],
      [880, 0.98],
      [1046.5, 1.24],
      [1318.5, 1.5],
    ];

    function note(f, t, len, vol) {
      const o = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const g2 = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      o2.type = "sine";
      o2.frequency.value = f * 2;
      g2.gain.value = 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g);
      o2.connect(g2);
      g2.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o2.start(t);
      o.stop(t + len + 0.05);
      o2.stop(t + len + 0.05);
    }

    const t0 = audioCtx.currentTime + 0.05;
    TUNE.forEach(([f, d], i) => note(f, t0 + d, i === TUNE.length - 1 ? 1.8 : 0.9, 0.26));
    note(261.63, t0, 1.3, 0.16);
    note(392, t0 + 0.98, 1.3, 0.14);
    note(329.63, t0 + 1.5, 2, 0.14);

    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (e) {
      // Vibration not supported
    }
  },
};

const keepAwake = async () => {
  try {
    if (navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (e) {
    // Wake lock not supported or denied
  }
};

const releaseAwake = () => {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
};

const pageUrl = () => window.location.href;

/* ------------------------------------------------------------------ */
/* Load and validate rules                                             */
/* ------------------------------------------------------------------ */

async function loadRules() {
  try {
    const response = await fetch("shared/rules.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const rules = await response.json();
    return validateRules(rules);
  } catch (e) {
    console.error("Failed to load rules:", e);
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* QRCode.js (self-hosted, no CDN)                                    */
/* ------------------------------------------------------------------ */

async function loadQrCode() {
  // QR code uses QRServer API - no library needed
  return { loaded: true };
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                          */
/* ------------------------------------------------------------------ */

async function main() {
  const root = document.getElementById("root");
  if (!root) {
    console.error("Root element not found");
    return;
  }

  try {
    const rules = await loadRules();
    const qrcode = await loadQrCode();

    mountApp({
      doc: document,
      root,
      rules,
      storage,
      now,
      scheduler,
      audio,
      keepAwake,
      releaseAwake,
      formatTime,
      qrcode,
      pageUrl,
    });
  } catch (e) {
    console.error("Failed to mount app:", e);
    mountFatal({
      doc: document,
      root,
      detail: e.message,
    });
  }
}

main();
