// Pure calculation engine for the SAFER Score. No DOM, no storage, no clock.
// Every clinical number comes from the rules object (shared/rules.json).

import { S, fmt } from "./strings.js";

const SUPPORTED_SCHEMA = 1;

/* ------------------------------------------------------------------ */
/* Rules validation: fail loudly, never fall back to guessed values.   */
/* ------------------------------------------------------------------ */

function fail(msg) {
  throw new Error(`Invalid rules: ${msg}`);
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string" && v.length > 0;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function validateRules(r) {
  if (!isObj(r)) fail("rules must be an object");
  if (r.schema !== SUPPORTED_SCHEMA) fail(`unsupported schema ${r.schema}`);
  if (!isStr(r.version)) fail("version missing");
  if (!isStr(r.status)) fail("status missing");
  if (!isStr(r.disclaimer)) fail("disclaimer missing");
  if (!isStr(r.xrayCheck)) fail("xrayCheck missing");
  if (!isStr(r.legend?.silverman)) fail("legend.silverman missing");

  const sc = r.score;
  if (!isObj(sc) || !Array.isArray(sc.items) || sc.items.length === 0) fail("score.items missing");
  if (!Number.isInteger(sc.cutoff) || !Number.isInteger(sc.max)) fail("score cutoff/max must be integers");
  const itemIds = new Set();
  let maxSum = 0;
  for (const it of sc.items) {
    if (!isStr(it.id) || !isStr(it.letter) || !isStr(it.name) || !isStr(it.shortName)) fail("item fields missing");
    if (itemIds.has(it.id)) fail(`duplicate item id ${it.id}`);
    itemIds.add(it.id);
    if (!Array.isArray(it.options) || it.options.length < 2) fail(`item ${it.id} needs 2+ options`);
    const optIds = new Set();
    let best = -Infinity;
    for (const o of it.options) {
      if (!isStr(o.id) || !isStr(o.label)) fail(`option fields missing in ${it.id}`);
      if (optIds.has(o.id)) fail(`duplicate option id ${o.id} in ${it.id}`);
      optIds.add(o.id);
      if (!Number.isInteger(o.points) || o.points < 0) fail(`bad points for ${it.id}/${o.id}`);
      best = Math.max(best, o.points);
    }
    maxSum += best;
  }
  if (maxSum !== sc.max) fail(`score.max ${sc.max} does not match the sum of item maxima ${maxSum}`);
  if (sc.cutoff < 1 || sc.cutoff > sc.max) fail("score.cutoff out of range");

  const L = r.labels;
  for (const k of ["give", "reassess", "none", "whyGive", "whyReassess", "whyMissing", "whyNone", "logGive", "logReassess"]) {
    if (!isStr(L?.[k])) fail(`labels.${k} missing`);
  }

  const n = r.note;
  if (!isObj(n) || !isStr(n.text) || typeof n.whenBelowCutoff !== "boolean") fail("note invalid");
  const optionsOf = (id) => new Set(sc.items.find((i) => i.id === id)?.options.map((o) => o.id) ?? []);
  for (const id of n.fio2Options ?? []) if (!optionsOf("fio2").has(id)) fail(`note refers to unknown fio2 option ${id}`);
  for (const id of n.supportOptions ?? []) if (!optionsOf("resp").has(id)) fail(`note refers to unknown support option ${id}`);
  if (!n.fio2Options?.length || !n.supportOptions?.length) fail("note option lists missing");

  const ra = r.reassessment;
  if (!Number.isInteger(ra?.rounds) || ra.rounds < 1) fail("reassessment.rounds invalid");
  if (!isNum(ra?.intervalMinutes) || ra.intervalMinutes <= 0) fail("reassessment.intervalMinutes invalid");

  if (!Array.isArray(r.surfactants) || r.surfactants.length === 0) fail("surfactants missing");
  const sIds = new Set();
  for (const s of r.surfactants) {
    if (!isStr(s.id) || !isStr(s.name) || !isStr(s.trade) || !isStr(s.vials)) fail("surfactant fields missing");
    if (sIds.has(s.id)) fail(`duplicate surfactant id ${s.id}`);
    sIds.add(s.id);
    for (const k of ["mgPerMl", "initialMgPerKg", "repeatMgPerKg"]) {
      if (!isNum(s[k]) || s[k] <= 0) fail(`surfactant ${s.id}.${k} invalid`);
    }
    if (s.mlPerKg !== undefined && (!isNum(s.mlPerKg) || s.mlPerKg <= 0)) fail(`surfactant ${s.id}.mlPerKg invalid`);
  }

  const e = r.ett;
  if (!isObj(e)) fail("ett missing");
  for (const k of ["gaInputRange", "gaLookupClamp"]) {
    if (!Array.isArray(e[k]) || e[k].length !== 2 || !e[k].every(isNum) || e[k][0] > e[k][1]) fail(`ett.${k} invalid`);
  }
  if (!isNum(e.weightOffsetCm)) fail("ett.weightOffsetCm invalid");
  if (!Array.isArray(e.gaTable) || e.gaTable.length === 0) fail("ett.gaTable missing");
  let prevTo = null;
  for (const row of e.gaTable) {
    if (!isNum(row.fromWeeks) || !isNum(row.toWeeks) || !isNum(row.depthCm) || row.fromWeeks > row.toWeeks) fail("ett.gaTable row invalid");
    if (prevTo !== null && row.fromWeeks !== prevTo + 1) fail("ett.gaTable must be contiguous and ascending");
    prevTo = row.toWeeks;
  }
  if (e.gaTable[0].fromWeeks > e.gaLookupClamp[0] || e.gaTable.at(-1).toWeeks < e.gaLookupClamp[1]) {
    fail("ett.gaTable does not cover gaLookupClamp");
  }
  for (const k of ["tubeByWeightKg", "tubeByGaWeeks"]) {
    const rows = e[k];
    if (!Array.isArray(rows) || rows.length === 0) fail(`ett.${k} missing`);
    if (!rows.every((x) => isStr(x.sizeMm))) fail(`ett.${k} sizes invalid`);
    const last = rows.at(-1);
    if (last.below !== undefined || last.upTo !== undefined) fail(`ett.${k} must end with a catch-all row`);
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Score                                                               */
/* ------------------------------------------------------------------ */

// selection: { [itemId]: optionIndex } ; a missing key means "not scored".
export function evaluate(rules, selection) {
  const { items, cutoff, max } = rules.score;
  const L = rules.labels;
  const points = {};
  let total = 0;
  let done = 0;
  for (const it of items) {
    const idx = selection[it.id];
    if (idx === undefined) {
      points[it.id] = null;
      continue;
    }
    const p = it.options[idx].points;
    points[it.id] = p;
    total += p;
    done += 1;
  }

  const give = total >= cutoff;
  const minutes = rules.reassessment.intervalMinutes;
  let kind = give ? "crit" : "warn";
  let verdict = give ? L.give : fmt(L.reassess, { minutes });
  let why = give ? fmt(L.whyGive, { total, cutoff }) : fmt(L.whyReassess, { total, cutoff });
  if (done < items.length) why += fmt(L.whyMissing, { missing: items.length - done });
  if (done === 0) {
    kind = "neutral";
    verdict = fmt(L.none, { count: items.length });
    why = L.whyNone;
  }

  return {
    total,
    done,
    give,
    kind,
    verdict,
    why,
    points,
    fillPct: (total / max) * 100,
    markPct: (cutoff / max) * 100,
    noteVisible: noteApplies(rules, selection, give),
    logLabel: give ? L.logGive : L.logReassess,
  };
}

function noteApplies(rules, selection, give) {
  const n = rules.note;
  if (n.whenBelowCutoff && give) return false;
  const chosen = (itemId) => {
    const it = rules.score.items.find((i) => i.id === itemId);
    const idx = selection[itemId];
    return idx === undefined ? null : it.options[idx].id;
  };
  return n.fio2Options.includes(chosen("fio2")) && n.supportOptions.includes(chosen("resp"));
}

/* ------------------------------------------------------------------ */
/* Surfactant dose                                                     */
/* ------------------------------------------------------------------ */

export const mlPerKgOf = (s, mgPerKg) => s.mlPerKg || mgPerKg / s.mgPerMl;

// input: { weightKg: number|NaN, surfactantId: string|null, repeat: boolean }
export function doseFor(rules, { weightKg, surfactantId, repeat }) {
  const s = rules.surfactants.find((x) => x.id === surfactantId);
  if (!s) return { value: S.noPoints, detail: S.doseChooseType, ok: false };
  if (!(weightKg > 0)) return { value: S.noPoints, detail: S.doseEnterWeight, ok: false };
  const mgPerKg = repeat ? s.repeatMgPerKg : s.initialMgPerKg;
  const mg = weightKg * mgPerKg;
  const mlkg = mlPerKgOf(s, mgPerKg);
  const ml = weightKg * mlkg;
  return {
    ok: true,
    value: `${ml.toFixed(2)} mL`,
    detail: fmt(S.doseDetail, {
      mg: Math.round(mg),
      mgkg: mgPerKg,
      mlkg: mlkg.toFixed(2),
      vials: s.vials,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* ETT depth and tube size                                             */
/* ------------------------------------------------------------------ */

function depthByGa(ett, ga) {
  const [lo, hi] = ett.gaLookupClamp;
  const g = Math.max(lo, Math.min(hi, ga));
  const row = ett.gaTable.find((x) => g >= x.fromWeeks && g <= x.toWeeks);
  return row ? row.depthCm : null;
}

function pickTube(rows, value) {
  for (const row of rows) {
    if (row.below !== undefined) {
      if (value < row.below) return row.sizeMm;
    } else if (row.upTo !== undefined) {
      if (value <= row.upTo) return row.sizeMm;
    } else {
      return row.sizeMm;
    }
  }
  return null;
}

export function tubeSize(rules, weightKg, gaWeeks) {
  if (weightKg > 0) return pickTube(rules.ett.tubeByWeightKg, weightKg);
  if (gaWeeks > 0) return pickTube(rules.ett.tubeByGaWeeks, gaWeeks);
  return null;
}

// input: { weightKg: number|NaN, gaWeeks: number|NaN }
export function ettFor(rules, { weightKg, gaWeeks }) {
  const e = rules.ett;
  const [inLo, inHi] = e.gaInputRange;
  const fromGa = gaWeeks >= inLo && gaWeeks <= inHi ? depthByGa(e, gaWeeks) : null;
  const fromWeight = weightKg > 0 ? weightKg + e.weightOffsetCm : null;
  const size = tubeSize(rules, weightKg, gaWeeks);
  if (fromGa === null && fromWeight === null) return { value: S.noPoints, detail: S.ettEnter, ok: false };

  const main = fromGa !== null ? fromGa : fromWeight;
  let detail = fromGa !== null ? fmt(S.ettFromTable, { ga: gaWeeks }) : fmt(S.ettFromWeight, { offset: e.weightOffsetCm });
  if (fromGa !== null && fromWeight !== null) {
    detail += fmt(S.ettBoth, { offset: e.weightOffsetCm, cm: fromWeight.toFixed(1) });
  }
  if (size) detail += fmt(S.ettTube, { mm: size });
  return { ok: true, value: `${main.toFixed(1)} cm`, detail };
}

/* ------------------------------------------------------------------ */
/* Legend text generated from the rules (no duplicated clinical numbers) */
/* ------------------------------------------------------------------ */

const trimNum = (x) => String(Number(x.toFixed(2)));

export function legendParts(rules) {
  const { cutoff, max, items } = rules.score;
  const minutes = rules.reassessment.intervalMinutes;
  const hours = (rules.reassessment.rounds * minutes) / 60;

  const parts = items
    .map((it) => {
      const pts = it.options.map((o) => o.points);
      return `${it.shortName} ${Math.min(...pts)}–${Math.max(...pts)}`;
    })
    .join(" · ");

  const doses = rules.surfactants
    .map((s) => {
      const first = `${trimNum(mlPerKgOf(s, s.initialMgPerKg))} mL/kg`;
      if (s.repeatMgPerKg !== s.initialMgPerKg) {
        const again = `${trimNum(mlPerKgOf(s, s.repeatMgPerKg))} mL/kg`;
        return `${s.name.toLowerCase()} (${s.trade}) ${s.initialMgPerKg} mg/kg initial (${first}), ${s.repeatMgPerKg} mg/kg repeat (${again})`;
      }
      return `${s.name.toLowerCase()} (${s.trade}) ${s.initialMgPerKg} mg/kg (${first})`;
    })
    .join("; ");

  return {
    score: fmt(S.legendScore, { cutoff, minutes, hours }),
    max: fmt(S.legendMax, { max, parts: `${parts}.` }),
    silverman: rules.legend.silverman,
    doses: fmt(S.legendDoses, { doses, offset: rules.ett.weightOffsetCm }),
  };
}

/* ------------------------------------------------------------------ */
/* Alarm helpers (pure)                                                */
/* ------------------------------------------------------------------ */

export const alarmHours = (rules) => (rules.reassessment.rounds * rules.reassessment.intervalMinutes) / 60;

export function dueRounds(startAt, now, intervalMs, rounds) {
  return Math.min(rounds, Math.floor((now - startAt) / intervalMs));
}

export function formatClock(ms) {
  const v = Math.max(0, ms);
  const m = Math.floor(v / 60000);
  const s = Math.floor((v % 60000) / 1000);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
