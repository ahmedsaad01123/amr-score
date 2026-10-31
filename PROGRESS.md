# PROGRESS.md — SAFER Score

Living tracker. The agent reads this first and updates it after every task.
See `AGENTS.md` for rules. Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.

**Current phase:** Phase 1 — Web (faithful port, PWA)
**Rules version:** v0 (faithful copy of reference, extracted and validated)
**Last updated:** 2026-10-31

---

## Phase 0 — Setup and extraction
- [x] Create repo structure (`reference/`, `shared/`, `web/`, `app/`)
- [x] Copy `amr-score-safer.html` into `reference/` (read-only, never edit)
- [x] Extract all clinical data into `shared/rules.json` exactly as in the reference (`version: "0"`, `lastReviewedBy`, `lastReviewedAt`)
- [x] Write `shared/rules.schema.json` and a validation step
- [x] Generate `shared/test-vectors.json` (≥ 30 cases, all options + boundaries) by running the reference logic
- [x] Document how to run web tests and Flutter tests (README section)

## Phase 1 — Web (faithful port, PWA)
- [ ] JS calculation engine (score, verdict, FiO₂ note, dose, ETT depth, tube size) loading `rules.json`
- [ ] Engine passes all test vectors
- [ ] UI port: sticky verdict bar, 5 scored items, dose and ETT card, X-ray check text, legend, disclaimer
- [ ] Reassessment alarm (4 × 30 min), melody, vibration, wake lock, restore state after reload
- [ ] "Record score" log
- [ ] Self-host fonts and any third-party script (no CDN); QR share feature kept or dropped (ask Ahmed)
- [ ] PWA: manifest, icons, service worker with full precache, offline verified
- [ ] English-only UI, light/dark, a11y pass
- [ ] About screen with rules version and disclaimer
- [ ] Parity check against `reference/` on all test vectors

## Phase 2 — Flutter app (Android + iOS)
- [ ] Project setup, Material 3, light/dark, English-only strings in one strings file
- [ ] Pure Dart engine passing the **same** `test-vectors.json`
- [ ] Load and validate `rules.json` from assets, show blocking error on failure
- [ ] Score screen + verdict bar + FiO₂ note
- [ ] Dose and ETT screen
- [ ] Reassessment alarm via scheduled local notifications (works with app closed), including Android 13+ notification permission and exact-alarm permission, iOS permission
- [ ] Wake lock while the reassessment screen is active
- [ ] Local log of recorded scores (time, score, verdict; no patient identifiers)
- [ ] About screen (rules version, disclaimer, references)
- [ ] Test on a real Android device and a real iPhone
- [ ] Store readiness: app icons, screenshots, privacy policy (no data collected), clinical disclaimer

## Phase 3 — Clinical revisions (blocked until Amr approves each item)
Each item becomes a new `rules.json` version with updated test vectors and a Changelog entry.
- [ ] 1. Fix overlapping bins (GA, FiO₂)
- [ ] 2. "Incomplete" state when not all items are scored
- [ ] 3. FiO₂ > 0.30 on CPAP ≥ 6 as a standalone rule or kept as a note
- [ ] 4. Label CPAP units (cmH₂O)
- [ ] 5. Split steroid options (none / partial / complete course)
- [ ] 6. Persist the log with date
- [ ] 7. Reconcile Alveofact mg vs mL display
- [ ] 8. Validation study plan for the cutoff and weights (owner: Amr)

## Phase 4 — Optional (only if Amr and Ahmed decide)
- [ ] Shared unit log / backend API in PHP 8.4 (no patient identifiers, authentication, audit)
- [ ] Remote `rules.json` updates with version check and signature
- [ ] Anonymous aggregated statistics for validation (requires ethics/legal review)

---

## Decisions
| Date | Decision | By |
|---|---|---|
| 2026-10-31 | Website first as a PWA, then a Flutter app for Android + iOS | Ahmed |
| 2026-10-31 | Clinical data lives only in `shared/rules.json`; UI never hard-codes it | Ahmed |
| 2026-10-31 | Phase 1–2 are a faithful port of v0; clinical changes wait for Amr's approval | Ahmed |
| 2026-10-31 | No backend in v1; all data stays on the device | Ahmed |
| 2026-10-31 | UI is English only (no Arabic, no RTL, no localization framework) | Ahmed |

## Open questions
Ask Ahmed (technical) or Amr (clinical). Add new ones here instead of guessing.

- [ ] (Amr) Individual calculator only, or a shared unit log across staff? Decides whether a backend is needed.
- [ ] (Amr) Approve the Phase 3 clinical changes, one by one.
- [ ] (Amr) Who owns the store accounts, name of the app, and ownership/licensing of the code?
- [ ] (Amr) Required references and wording of the clinical disclaimer for the stores.
- [ ] (Ahmed) Keep the QR share feature?
- [ ] (Ahmed) Local store for the app log: SQLite or `shared_preferences`?

## Changelog
- 2026-10-31 — Project initialized. `AGENTS.md` and `PROGRESS.md` created. Reference prototype received from Amr.
- 2026-10-31 — Plan revised: English-only UI; Arabic/RTL removed from AGENTS.md and PROGRESS.md.
- 2026-10-31 — Shared engine code already present: `shared/engine.js`, `shared/strings.js`, `shared/dom.js`, `shared/alarm.js`, `shared/app.js`, `shared/qr.js`, `shared/rules.json`, `shared/rules.schema.json`. Missing `shared/qr.js` added.
- 2026-10-31 — Phase 0 completed: `shared/test-vectors.json` generated with 50+ test cases covering all score options, boundaries, dose calculations, and ETT logic. `web/` directory created with PWA files (index.html, style.css, app.js, manifest.json, sw.js, icons/, vendor/qrcode.min.js). `README.md` created with build and test instructions.
