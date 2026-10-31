// UI for the SAFER Score. All dependencies come in through `env`, so the same
// code runs in the browser and in the jsdom tests.

import { S, fmt } from "./strings.js";
import { alarmHours, doseFor, ettFor, evaluate, legendParts } from "./engine.js";
import { createAlarm } from "./alarm.js";
import { makeDom } from "./dom.js";
import { drawQr } from "./qr.js";

export function mountFatal({ doc, root, detail }) {
  const { h } = makeDom(doc);
  root.replaceChildren(
    h(
      "div",
      { class: "wrap", role: "alert" },
      h("header", {}, h("h1", {}, S.fatalTitle), h("p", { class: "sub" }, S.fatalBody)),
      detail ? h("p", { class: "legend" }, String(detail)) : null,
    ),
  );
}

export function mountApp(env) {
  const { doc, root, rules } = env;
  const dom = makeDom(doc);
  const { h, svg, rich } = dom;

  const items = rules.score.items;
  const minutes = rules.reassessment.intervalMinutes;
  const hours = alarmHours(rules);

  const selection = {};
  let surfactantId = null;
  let repeat = false;
  let qrDrawn = false;

  /* ---------------- header ---------------- */
  const qrBtn = h(
    "button",
    { class: "qrbtn", id: "qrBtn", type: "button", "aria-expanded": "false", "aria-controls": "qrPanel" },
    svg(
      "svg",
      { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "aria-hidden": "true" },
      svg("rect", { x: 3, y: 3, width: 7, height: 7 }),
      svg("rect", { x: 14, y: 3, width: 7, height: 7 }),
      svg("rect", { x: 3, y: 14, width: 7, height: 7 }),
      svg("path", { d: "M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3" }),
    ),
    S.qrButton,
  );
  const qrHolder = h("div", { id: "qr" });
  const qrPanel = h(
    "div",
    { class: "qrpanel hidden", id: "qrPanel" },
    qrHolder,
    h("p", {}, h("b", {}, `${S.appTitle} (${S.appAlt})`), h("br"), S.qrCaption),
  );

  const header = h(
    "header",
    {},
    h(
      "div",
      { class: "brand" },
      h("img", { src: "icons/icon.svg", width: 56, height: 56, alt: S.logoAlt }),
      h(
        "div",
        {},
        h("h1", {}, `${S.appTitle} `, h("span", { class: "alt" }, "(", h("em", {}, "SAFER"), " Score)")),
        h("div", { class: "by" }, S.by),
      ),
      qrBtn,
    ),
    qrPanel,
    h("p", { class: "sub" }, fmt(S.subtitle, { hours })),
  );

  /* ---------------- verdict bar ---------------- */
  const totalEl = h("span", { id: "total" }, "0");
  const verdictEl = h("div", { class: "verdict warn", id: "verdict" });
  const whyEl = h("div", { class: "why", id: "why" });
  const fillEl = h("i", { id: "fill" });
  const markEl = h("b", { id: "mark" });
  const noteEl = h("div", { class: "note", id: "note", hidden: true }, rules.note.text);
  const result = h(
    "section",
    { class: "result", "aria-live": "polite" },
    h("div", { class: "total" }, totalEl, h("small", {}, `/${rules.score.max}`)),
    verdictEl,
    whyEl,
    h("div", { class: "scale" }, fillEl, markEl),
    noteEl,
  );

  /* ---------------- score items ---------------- */
  const ptsEls = {};
  const optionEls = {};
  const itemsBox = h("div", { id: "items" });
  for (const it of items) {
    ptsEls[it.id] = h("span", { class: "pts", id: `p-${it.id}` });
    optionEls[it.id] = it.options.map((o, i) =>
      h(
        "button",
        { type: "button", id: `${it.id}-${i}`, "data-item": it.id, "data-i": i, "aria-pressed": "false" },
        o.label,
        h("span", {}, fmt(S.pointsUnit, { p: o.points })),
      ),
    );
    itemsBox.append(
      h(
        "div",
        { class: "item" },
        h(
          "div",
          { class: "item-head" },
          h("b", {}, h("span", { class: "ltr" }, it.letter), it.name, it.hint ? h("span", { class: "hint" }, it.hint) : null),
          ptsEls[it.id],
        ),
        h("div", { class: "seg", role: "group", "aria-label": it.name }, ...optionEls[it.id]),
      ),
    );
  }
  itemsBox.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-item]");
    if (!b) return;
    const key = b.dataset.item;
    const i = Number(b.dataset.i);
    if (selection[key] === i) delete selection[key];
    else selection[key] = i;
    render();
  });

  let latest = evaluate(rules, selection);
  function render() {
    latest = evaluate(rules, selection);
    for (const it of items) {
      optionEls[it.id].forEach((btn, j) => btn.setAttribute("aria-pressed", String(selection[it.id] === j)));
      const p = latest.points[it.id];
      ptsEls[it.id].textContent = p === null ? S.noPoints : fmt(S.pointsUnit, { p });
    }
    totalEl.textContent = String(latest.total);
    verdictEl.className = `verdict ${latest.kind}`;
    verdictEl.textContent = latest.verdict;
    whyEl.textContent = latest.why;
    fillEl.style.width = `${latest.fillPct}%`;
    fillEl.style.background = latest.give ? "var(--crit)" : "var(--warn)";
    markEl.style.left = `calc(${latest.markPct}% - 1px)`;
    noteEl.hidden = !latest.noteVisible;
  }

  /* ---------------- reassessment alarm ---------------- */
  const roundEl = h("span", { class: "round", id: "round" });
  const clockEl = h("div", { class: "clock", id: "clock" });
  const startBtn = h("button", { class: "btn primary", id: "tStart", type: "button" });
  const stopBtn = h("button", { class: "btn stop", id: "tStop", type: "button", hidden: true }, S.alarmStop);
  const cancelBtn = h("button", { class: "btn", id: "tCancel", type: "button", hidden: true }, S.alarmCancel);
  const logBtn = h("button", { class: "btn", id: "logBtn", type: "button" }, S.recordScore);
  const testBtn = h("button", { class: "btn", id: "tTest", type: "button" }, S.testSound);
  const logEl = h("ul", { class: "log", id: "log" });
  const timerCard = h(
    "div",
    { class: "item timer", id: "timerCard" },
    h(
      "div",
      { class: "tline" },
      h("div", {}, h("b", {}, S.alarmTitle), h("span", { class: "hint" }, fmt(S.alarmHint, { minutes, hours }))),
      roundEl,
    ),
    h("div", { class: "tline mt10" }, clockEl),
    h("div", { class: "btns" }, startBtn, stopBtn, cancelBtn, logBtn, testBtn),
    logEl,
  );

  function renderAlarm() {
    const v = alarm.view();
    clockEl.textContent = v.clock;
    roundEl.textContent = v.round;
    startBtn.textContent = v.startLabel;
    startBtn.hidden = !v.showStart;
    cancelBtn.hidden = !v.showCancel;
    stopBtn.hidden = !v.showStop;
    timerCard.classList.toggle("ringing", v.ringing);
  }

  const alarm = createAlarm({
    rules,
    storage: env.storage,
    now: env.now,
    scheduler: env.scheduler,
    audio: env.audio,
    keepAwake: env.keepAwake,
    releaseAwake: env.releaseAwake,
    formatTime: env.formatTime,
    onChange: renderAlarm,
  });

  startBtn.addEventListener("click", () => alarm.start());
  stopBtn.addEventListener("click", () => alarm.stop());
  cancelBtn.addEventListener("click", () => alarm.cancel());
  testBtn.addEventListener("click", () => alarm.testSound());
  logBtn.addEventListener("click", () => {
    logEl.prepend(
      h(
        "li",
        {},
        h("span", { class: "t" }, env.formatTime(env.now())),
        h("span", { class: "s" }, String(latest.total)),
        h("span", {}, latest.logLabel),
      ),
    );
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "visible") alarm.onVisible();
  });
  doc.addEventListener("pointerdown", () => env.audio.unlock(), { once: true });

  /* ---------------- dose and ETT ---------------- */
  const weightInput = h("input", {
    id: "wt",
    type: "number",
    inputmode: "decimal",
    min: "0.3",
    max: "5",
    step: "0.01",
    placeholder: S.weightPlaceholder,
  });
  const gaInput = h("input", {
    id: "gaw",
    type: "number",
    inputmode: "numeric",
    min: String(rules.ett.gaInputRange[0]),
    max: String(rules.ett.gaInputRange[1]),
    step: "1",
    placeholder: S.gaPlaceholder,
  });
  const surfButtons = rules.surfactants.map((s) =>
    h(
      "button",
      { type: "button", "data-s": s.id, "aria-pressed": "false" },
      s.name,
      h("b", { class: "trade" }, s.trade),
      h("span", {}, `${s.initialMgPerKg} mg/kg · ${s.mgPerMl} mg/mL`),
    ),
  );
  const sType = h("div", { class: "seg", id: "sType", role: "group", "aria-label": S.surfactantType }, ...surfButtons);
  const initialBtn = h("button", { type: "button", "data-rep": "0", "aria-pressed": "true" }, S.initialDose);
  const repeatBtn = h("button", { type: "button", "data-rep": "1", "aria-pressed": "false" }, S.repeatDose);
  const sWhich = h("div", { class: "seg", id: "sWhich", role: "group", "aria-label": `${S.initialDose} / ${S.repeatDose}` }, initialBtn, repeatBtn);

  const doseV = h("div", { class: "v", id: "doseV" });
  const doseD = h("div", { class: "d", id: "doseD" });
  const ettV = h("div", { class: "v", id: "ettV" });
  const ettD = h("div", { class: "d", id: "ettD" });
  const doseCard = h(
    "div",
    { class: "item", id: "doseCard" },
    h("div", { class: "item-head" }, h("b", {}, S.doseTitle)),
    h(
      "div",
      { class: "row" },
      h("label", { for: "wt" }, S.weightLabel),
      weightInput,
      h("label", { for: "gaw" }, S.gaLabel),
      gaInput,
    ),
    h("p", { class: "sublbl" }, S.surfactantType),
    sType,
    h("p", { class: "sublbl" }, S.doseKind),
    sWhich,
    h(
      "div",
      { class: "dgrid" },
      h("div", { class: "stat" }, h("div", { class: "k" }, S.surfactantDose), doseV, doseD),
      h("div", { class: "stat" }, h("div", { class: "k" }, S.ettDepth), ettV, ettD),
    ),
    h("div", { class: "xray" }, rich(rules.xrayCheck)),
  );

  sType.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    surfactantId = b.dataset.s;
    calcDose();
  });
  sWhich.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    repeat = b.dataset.rep === "1";
    calcDose();
  });
  weightInput.addEventListener("input", calcDose);
  gaInput.addEventListener("input", calcDose);

  function calcDose() {
    const weightKg = parseFloat(weightInput.value);
    const gaWeeks = parseInt(gaInput.value, 10);
    surfButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === surfactantId)));
    initialBtn.setAttribute("aria-pressed", String(!repeat));
    repeatBtn.setAttribute("aria-pressed", String(repeat));
    const dose = doseFor(rules, { weightKg, surfactantId, repeat });
    doseV.textContent = dose.value;
    doseD.textContent = dose.detail;
    const ett = ettFor(rules, { weightKg, gaWeeks });
    ettV.textContent = ett.value;
    ettD.textContent = ett.detail;
  }

  /* ---------------- reset, legend, about ---------------- */
  const resetBtn = h("button", { class: "btn", id: "reset", type: "button" }, S.clearAll);
  resetBtn.addEventListener("click", () => {
    for (const key of Object.keys(selection)) delete selection[key];
    weightInput.value = "";
    gaInput.value = "";
    calcDose();
    logEl.replaceChildren();
    render();
  });

  const legendText = legendParts(rules);
  const legend = h(
    "div",
    { class: "legend" },
    h("p", {}, rich(legendText.score)),
    h("p", {}, rich(legendText.max)),
    h("p", {}, legendText.silverman),
    h("p", {}, rich(legendText.doses)),
    h("p", {}, `${S.keepOpen} ${rules.disclaimer}`),
  );

  const reviewer = rules.lastReviewedBy ? `${rules.lastReviewedBy}${rules.lastReviewedAt ? `, ${rules.lastReviewedAt}` : ""}` : S.aboutNotReviewed;
  const about = h(
    "footer",
    { class: "about", id: "about" },
    h("b", {}, S.about),
    h("p", {}, fmt(S.aboutRules, { version: rules.version, status: rules.status })),
    h("p", {}, fmt(S.aboutReviewed, { who: reviewer })),
    h("p", {}, S.aboutOffline),
  );

  /* ---------------- QR ---------------- */
  qrBtn.addEventListener("click", () => {
    const isHidden = qrPanel.classList.contains("hidden");
    qrPanel.classList.toggle("hidden");
    qrBtn.setAttribute("aria-expanded", String(isHidden));
    if (isHidden && !qrDrawn && env.qrcode) {
      qrHolder.replaceChildren(drawQr(dom, env.qrcode, env.pageUrl()));
      qrDrawn = true;
    }
  });

  /* ---------------- mount ---------------- */
  root.replaceChildren(h("div", { class: "wrap" }, header, result, itemsBox, timerCard, doseCard, resetBtn, legend, about));
  render();
  calcDose();
  alarm.update();

  return { alarm, rules, getSelection: () => ({ ...selection }) };
}
