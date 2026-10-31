# AGENTS.md — SAFER Score (Amr Score)

Instructions for AI coding agents working on this repository.
Read this file fully, then read `PROGRESS.md` before doing anything.

---

## 1. What we are building

**SAFER Score** (a.k.a. *Amr Score*) is a bedside decision-support tool for deciding whether to give **surfactant** to a **preterm baby with respiratory distress** during the first 2 hours of life.

- Clinical owner and author of the idea: **Amr**.
- Developer / project owner: **Ahmed**.
- Deliverables:
  1. A **website** (installable PWA, works offline).
  2. An **Android + iOS app** (Flutter, single codebase).
  3. One **shared rules file** that both use, so clinical changes are made in one place.

The original working prototype is a single self-contained file:
`reference/amr-score-safer.html` (vanilla HTML + CSS + JS). It is the **source of truth for v0 behavior**. **Never edit it.**

---

## 2. Golden rule: fidelity first, changes second

1. **Phase 1 = faithful port.** Reproduce the v0 behavior of the reference file exactly (same scores, same cutoff, same doses, same ETT depths, same alarm timing). Do **not** "improve" clinical logic while porting.
2. Clinical or scoring changes (see §7 "Known issues") are **separate, versioned changes** that need **Amr's explicit approval** recorded in `PROGRESS.md`.
3. If something in the reference looks wrong, **do not silently fix it**. Add it to `PROGRESS.md → Open questions` and continue with the faithful behavior.

---

## 3. Architecture

```
safer-score/
├─ AGENTS.md
├─ PROGRESS.md
├─ reference/
│  └─ amr-score-safer.html        # read-only original
├─ shared/
│  ├─ rules.json                  # ALL clinical data (see §4)
│  ├─ rules.schema.json           # schema/validation for rules.json
│  └─ test-vectors.json           # input -> expected output, used by BOTH web and app tests
├─ web/                           # website / PWA
└─ app/                           # Flutter app (Android + iOS)
```

### Principles
- **Rules are data, not code.** No score values, cutoffs, doses, concentrations or ETT tables may be hard-coded in UI code. They live only in `shared/rules.json`, which has a `version` field and a `lastReviewedBy` / `lastReviewedAt` field.
- **One calculation engine per platform, same test vectors.** The JS engine (web) and the Dart engine (app) must both pass `shared/test-vectors.json` with identical results.
- **Offline-first.** The core tool must work with no network at all.
- **No backend in v1.** Everything runs on the device. A backend is optional and out of scope until Amr and Ahmed decide (see `PROGRESS.md → Decisions`).

---

## 4. Clinical data of the v0 reference (extract into `shared/rules.json`)

Reproduce these values **exactly**. Verify against the reference file, which wins on any discrepancy.

### Score (max 12, cutoff 6)
| Item | Options → points |
|---|---|
| **S** Steroid (antenatal) | Given > 24 h → 0 · Not given or < 24 h → 1 |
| **A** Age (gestational) | < 28 wk → 3 · 28–32 wk → 2 · 32–35 wk → 1 · > 35 wk → 0 |
| **F** FiO₂ | < 30% → 0 · 30–40% → 1 · > 40% → 2 |
| **E** Effort (respiratory distress) | None → 0 · Mild → 1 · Moderate → 2 · Severe → 3 (Silverman-Andersen hint: mild 1–3, moderate 4–6, severe ≥ 7) |
| **R** Respiratory support | None → 0 · HFNC → 1 · CPAP 6–7 → 1 · CPAP 8 → 2 · Ventilation → 3 |

- Total ≥ 6 → **"Give surfactant"**; total < 6 → **"Reassess in 30 min"**.
- Items are tap-to-select, tapping the selected option again clears it.
- Verdict states: no item scored → neutral "Score the 5 items"; otherwise show total and how many items are not scored.
- **FiO₂ note:** shown when total < 6 **and** FiO₂ option is "30–40%" or "> 40%" **and** support is "CPAP 6–7" or "CPAP 8": *"FiO₂ > 30% on CPAP: European Consensus recommends surfactant at this level."*

### Reassessment alarm
- 4 reminders, 30 minutes apart (2 hours total), with a gentle melody and vibration.
- Start / Cancel / Stop alarm / Test sound / "Record score" (adds time, score, and "Give surfactant" or "Reassess" to a log).
- Keep the screen awake while running. State survives app/page restarts.
- Alarm auto-silences after 2 minutes if not stopped.

### Surfactant dose (weight in kg, initial or repeat)
| Product (trade) | mg/mL | Initial mg/kg | Repeat mg/kg | Vials |
|---|---|---|---|---|
| Poractant alfa (Curosurf) | 80 | 200 | 100 | 1.5 mL, 3 mL |
| Beractant (Survanta) | 25 | 100 | 100 | 4 mL, 8 mL |
| Calfactant (Infasurf) | 35 | 105 | 105 | 3 mL, 6 mL |
| Bovactant (Alveofact) | 45 | 50 | 50 | 1.2 mL (fixed **1.2 mL/kg**) |

Dose mL = weight × (mg/kg ÷ mg/mL), except Bovactant which uses 1.2 mL/kg. Display: mL (2 decimals), mg (rounded), mg/kg, mL/kg, vials.

### ETT depth at the lip and tube size
- **Gestational-age table (NRP)**, GA clamped to 23–43 wk for lookup, input accepted 22–44:
  23–24 → 5.5 cm · 25–26 → 6.0 · 27–29 → 6.5 · 30–32 → 7.0 · 33–34 → 7.5 · 35–37 → 8.0 · 38–40 → 8.5 · 41–43 → 9.0
- If GA is not entered: **weight + 6 cm**. If both are entered, show the GA-table value as main and weight + 6 as secondary.
- Tube size: by weight if given (< 1 kg → 2.5 mm · ≤ 2 kg → 3.0 · else 3.5), otherwise by GA (< 28 wk → 2.5 · ≤ 34 wk → 3.0 · else 3.5).
- Always show the X-ray check text: tip at T1–T2, mid-trachea, ~1 cm above the carina; if at/below carina, pull back first.

### Disclaimers (must stay visible)
"Draft score, not yet validated; use with clinical judgement and unit protocol." Keep this wording (or a version approved by Amr) on both web and app.

---

## 5. Tech constraints and preferences

- **Ahmed's style: build from scratch, minimal dependencies.** Prefer platform APIs over packages.
- **Web:**
  - PHP 8.4 (strict types) for serving pages if a server layer is needed; otherwise static files.
  - Vanilla JavaScript (ES modules), no framework, no bundler required.
  - Vendor any third-party script locally (no CDN at runtime) so the PWA works fully offline. Self-host fonts.
  - PWA: `manifest.json`, service worker with precache of all assets, installable.
  - Accessible: keyboard and screen-reader friendly, `aria-pressed` on option buttons, `prefers-color-scheme` + `prefers-reduced-motion` respected, safe-area insets handled.
- **App (Flutter):**
  - Null-safe, Material 3, light and dark themes.
  - Packages must be justified in `PROGRESS.md → Decisions`. Expected: `flutter_local_notifications` + `timezone` (scheduled reminders that ring with the app closed; exact alarms on Android), `wakelock_plus`, a local store for the log/alarm state (SQLite or `shared_preferences`).
  - Handle Android 13+ notification permission and exact-alarm permission, and iOS notification permission; show a clear explanation if denied.
  - Core logic in pure Dart (no Flutter imports) so it is unit-testable.
- **Language:** **English only.** No Arabic, no RTL layout, no localization framework. Keep all user-facing strings in one constants file (web) / one strings file (app) rather than scattered inline, so the text is easy to review with Amr.
- **Code quality:** small functions, no dead code, meaningful names, comments only where intent is non-obvious.

---

## 6. Safety, privacy and compliance rules

1. **No patient identifiers.** Never add fields for name, MRN, DOB, photos, or free text that could identify a patient. The log stores only time, score, and the verdict.
2. **No analytics, tracking or network calls** that include any user input. No third-party SDKs that phone home.
3. **Fail visibly.** If rules cannot load or fail validation, show a blocking error. Never fall back to guessed values.
4. **Never show a reassuring verdict on partial data.** Keep the "N item(s) not scored" indicator; do not remove it.
5. Every build must display the **rules version** (e.g. in an "About" screen) so a result can be traced to a rule set.
6. App Store / Play Store: this is clinical decision-support software. Keep disclaimer, references, and an About screen; do not claim diagnostic or regulatory approval.

---

## 7. Known issues in v0 (do NOT fix without Amr's approval)

Record each in `PROGRESS.md` and implement only after approval, as a new `rules.json` version with updated test vectors.

1. **Overlapping bins:** GA "28–32" vs "32–35" (and "> 35"), FiO₂ "30–40%" vs "> 40%" / "< 30%". Boundary values are ambiguous (e.g. exactly 32 wk, exactly 30%). Proposed: 28–31+6, 32–34+6, ≥ 35; FiO₂ 21–29, 30–40, > 40.
2. **Partial scoring:** a total < 6 with unscored items shows "Reassess" as if complete. Proposed: explicit "incomplete" state until all 5 items are scored.
3. **FiO₂ on CPAP rule:** European consensus (FiO₂ > 0.30 on CPAP ≥ 6) is only a note, not a trigger that overrides the total. Decide whether it should be a standalone rule.
4. **CPAP units** ("6–7", "8") are not labeled (cmH₂O).
5. **Steroid item** merges "not given" and "given < 24 h"; no distinction of complete vs partial course.
6. **Cutoff = 6 and weights are unvalidated.** Needs a retrospective validation (ROC against actual surfactant need / CPAP failure) with Amr before any real clinical claims.
7. **Alveofact:** mg is computed from 50 mg/kg while mL uses 1.2 mL/kg, so mg and mL do not match 45 mg/mL exactly.
8. **Record-score log** is not persisted across reloads and has no date.
9. **Web alarm** only works while the page is open and the screen is on. (The Flutter app solves this with local notifications.)

---

## 8. How to work (agent workflow)

1. Read `AGENTS.md`, then `PROGRESS.md`. Pick the **first unchecked task** of the current phase only.
2. Work on **one task at a time**. Keep changes small and reviewable.
3. After each task: run tests, then **update `PROGRESS.md`** (tick the box, add a dated Changelog line, note any decision or open question).
4. When something is ambiguous (especially clinical), **stop and add it to `Open questions`** instead of guessing.
5. Do not add features that are not in `PROGRESS.md`. Propose them in `Open questions`.
6. Do not modify `reference/` or weaken/delete tests to make them pass.
7. Commit messages: imperative, scoped (e.g. `engine: add ETT depth lookup`, `app: schedule reassessment notifications`).

### Definition of done (for any task)
- Behaves identically to the reference for the same inputs (until an approved rules change).
- `shared/test-vectors.json` passes on the platform you touched.
- No hard-coded clinical values in UI code.
- Works offline; UI is English only; works in light and dark mode.
- `PROGRESS.md` updated.

### Tests (required)
- **Engine unit tests:** score total, verdict at the cutoff boundary (5 vs 6), unscored items, FiO₂ note condition, each surfactant initial/repeat, Bovactant special case, ETT by GA / by weight / both, GA clamping, tube size by weight and by GA.
- **Test vectors:** at least 30 cases covering every option of every item and every boundary above, generated by running the reference file once and recorded as expected output.
- **Alarm logic:** pure functions for "which reminder is due at time T" tested with fake clocks.
