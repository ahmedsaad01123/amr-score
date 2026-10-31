// Reassessment alarm controller. Everything it touches is injected (clock,
// timers, storage, audio, wake lock), so it can be tested with a fake clock.

import { S, fmt } from "./strings.js";
import { alarmHours, dueRounds, formatClock } from "./engine.js";

const STORAGE_KEY = "safer-score.alarm.v1";
const TICK_MS = 500;
const REPEAT_MELODY_MS = 4000;
const AUTO_SILENCE_MS = 120000;

export function createAlarm({ rules, storage, now, scheduler, audio, keepAwake, releaseAwake, formatTime, onChange }) {
  const rounds = rules.reassessment.rounds;
  const minutes = rules.reassessment.intervalMinutes;
  const intervalMs = minutes * 60000;
  const hours = alarmHours(rules);

  let startAt = null;
  let fired = 0;
  let ringing = false;
  let tick = null;
  let melodyTimer = null;
  let silenceTimer = null;

  restore();
  if (startAt !== null) {
    startTick();
    awake();
  }

  function restore() {
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      const valid =
        saved &&
        Number.isFinite(saved.startAt) &&
        saved.startAt <= now() &&
        Number.isInteger(saved.fired) &&
        saved.fired >= 0 &&
        saved.fired < rounds;
      if (valid) {
        startAt = saved.startAt;
        fired = saved.fired;
      }
    } catch {
      /* unreadable state: start clean */
    }
  }

  function save() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(startAt !== null ? { startAt, fired } : null));
    } catch {
      /* storage may be unavailable */
    }
  }

  function awake() {
    try {
      Promise.resolve(keepAwake()).catch(() => {});
    } catch {
      /* wake lock unsupported */
    }
  }

  function release() {
    try {
      releaseAwake?.();
    } catch {
      /* ignore */
    }
  }

  function startTick() {
    scheduler.clearInterval(tick);
    tick = scheduler.setInterval(update, TICK_MS);
  }

  function stopTick() {
    scheduler.clearInterval(tick);
    tick = null;
  }

  function startRing() {
    ringing = true;
    audio.melody();
    scheduler.clearInterval(melodyTimer);
    melodyTimer = scheduler.setInterval(() => audio.melody(), REPEAT_MELODY_MS);
    scheduler.clearTimeout(silenceTimer);
    silenceTimer = scheduler.setTimeout(stop, AUTO_SILENCE_MS);
  }

  function update() {
    if (startAt !== null) {
      const due = dueRounds(startAt, now(), intervalMs, rounds);
      if (due > fired) {
        fired = due;
        startRing();
      }
      if (fired >= rounds) {
        startAt = null;
        stopTick();
        release();
      }
      save();
    }
    onChange();
  }

  function stop() {
    ringing = false;
    scheduler.clearInterval(melodyTimer);
    scheduler.clearTimeout(silenceTimer);
    update();
  }

  function start() {
    audio.unlock();
    if (ringing) stop();
    fired = 0;
    startAt = now();
    save();
    awake();
    startTick();
    update();
  }

  function cancel() {
    startAt = null;
    fired = 0;
    stopTick();
    save();
    release();
    stop();
  }

  function testSound() {
    audio.unlock();
    audio.melody();
  }

  function onVisible() {
    if (startAt !== null) awake();
  }

  function view() {
    const running = startAt !== null;
    let clock;
    let round;
    let startLabel = fmt(S.alarmStart, { hours });
    if (running) {
      const next = startAt + (fired + 1) * intervalMs;
      clock = formatClock(next - now());
      round = fmt(S.alarmRunning, { n: fired + 1, rounds, time: formatTime(next) });
    } else if (fired >= rounds) {
      clock = "00:00";
      round = fmt(S.alarmDone, { hours });
      startLabel = fmt(S.alarmRestart, { hours });
    } else {
      clock = formatClock(intervalMs);
      round = fmt(S.alarmIdle, { rounds, minutes });
    }
    if (ringing) round = fmt(S.alarmRinging, { fired, rounds });
    return { clock, round, startLabel, showStart: !running, showCancel: running, showStop: ringing, ringing };
  }

  return { start, cancel, stop, testSound, onVisible, update, view, isRunning: () => startAt !== null };
}
