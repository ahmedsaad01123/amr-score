# SAFER Score (Amr Score)

Bedside decision-support tool for deciding whether to give **surfactant** to a **preterm baby with respiratory distress** during the first 2 hours of life.

- Clinical owner: **Amr**
- Developer: **Ahmed**

## Project Structure

```
safer-score/
├─ AGENTS.md              # Instructions for AI coding agents
├─ PROGRESS.md            # Living tracker of work progress
├─ README.md              # This file
├─ reference/
│  └─ amr-score-safer.html  # Original prototype (read-only)
├─ shared/
│  ├─ rules.json            # Clinical data (versioned)
│  ├─ rules.schema.json     # JSON Schema for validation
│  ├─ test-vectors.json     # Test cases for both platforms
│  ├─ engine.js             # Pure calculation engine (JS)
│  ├─ strings.js            # UI text constants
│  ├─ dom.js                # DOM helpers
│  ├─ alarm.js              # Alarm controller
│  ├─ app.js                # Shared UI logic
│  └─ qr.js                 # QR code generator wrapper
├─ web/                    # Website / PWA
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js                # Web entry point
│  ├─ manifest.json         # PWA manifest
│  ├─ sw.js                 # Service worker
│  ├─ icons/
│  └─ vendor/
│     └─ qrcode.min.js      # Self-hosted QR library
└─ app/                    # Flutter app (Android + iOS)
   (to be created)
```

## Running the Web Application

### Development

The web app uses vanilla JavaScript ES modules and requires no build step.

1. **Serve the files** (HTTP server required for ES modules):
   ```bash
   # Using Python 3
   cd web
   python -m http.server 8000

   # Using Node.js (with http-server)
   npx http-server web -p 8000

   # Using PHP
   php -S localhost:8000 -t web
   ```

2. **Open in browser**:
   ```
   http://localhost:8000
   ```

### Production Build

For production, you may want to:
- Minify CSS and JS
- Optimize images
- Set up proper HTTPS

## Running Tests

### Web Tests (JavaScript)

**Prerequisites**: Node.js 18+ with `npm`

1. **Install test dependencies** (to be added to package.json):
   ```bash
   npm install --save-dev vitest jsdom
   ```

2. **Run tests**:
   ```bash
   npx vitest
   ```

The test suite:
- Validates `rules.json` against the schema
- Runs all test vectors from `shared/test-vectors.json`
- Tests the pure engine functions (score, dose, ETT)
- Tests alarm logic with fake clocks

### Flutter Tests (Dart)

**Prerequisites**: Flutter SDK

1. **Navigate to app directory**:
   ```bash
   cd app
   ```

2. **Run tests**:
   ```bash
   flutter test
   ```

The Flutter test suite uses the **same** `shared/test-vectors.json` to ensure parity with the web implementation.

## Phase Status

Current phase: **Phase 0 — Setup and extraction**

- [x] Create repo structure
- [x] Copy reference HTML
- [x] Extract clinical data to `shared/rules.json`
- [x] Write `shared/rules.schema.json`
- [x] Generate `shared/test-vectors.json`
- [x] Create web/ directory structure
- [ ] Document how to run tests (this file)
- [ ] Begin Phase 1: Web PWA implementation

See `PROGRESS.md` for detailed progress tracking.

## Key Principles

1. **Rules are data, not code** - All clinical values live in `shared/rules.json`
2. **Faithful port first** - Phase 1 reproduces v0 behavior exactly
3. **Clinical changes require approval** - See AGENTS.md §7
4. **Offline-first** - Core tool works without network
5. **No patient identifiers** - Privacy and safety first
6. **English only** - No localization in v1

## Safety & Compliance

- Draft score, not yet validated
- Use with clinical judgement and unit protocol
- No patient data leaves the device
- No analytics or tracking
- Always shows rules version for traceability

## License

(To be determined by Amr and Ahmed)
