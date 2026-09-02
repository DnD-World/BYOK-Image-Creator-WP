---
title: If you're a developer
nav_order: 5
---

# If you're a developer

React 18 + Vite + TypeScript. No backend, no state library, no build magic.
About 16,000 lines. Everything durable is a CSV or a `localStorage` key.

---

## Run it from source

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest, 349 tests
npm run typecheck  # tsc --noEmit
npm run build      # vite build
```

All three of the last ones run in CI on every push and pull request.

Package it:

```bash
node scripts/build-exe.js   # Electron installer + portable, into release/
npm run tauri:build         # Tauri, ~10 MB
```

---

## The one rule that explains the layout

**`src/lib/engines.mjs` is the single source of truth for routing, prices and
network calls, and it must stay DOM-free.**

It is plain ESM with no imports from React, no `window`, no `document`. That
is what lets the browser app and the MCP server run *literally the same code*
rather than two implementations that drift apart. Every time this rule was
bent, the two behaved differently and a user found it before a test did.

If you need something browser-only, it goes in `src/lib/providers.ts`, which
wraps `engines.mjs` and adds key pools, cooldowns and settings migration.

---

## Layout

```
src/
├─ App.tsx              orchestrator: the queue runner, folder doors,
│                       batches, wizard wiring
├─ types.ts             statuses, categories, kinds, aspects
├─ index.css            the whole design system
├─ lib/
│  ├─ engines.mjs       ← model registry, routing, generateBytes, 429
│  │                      rotation. DOM-free. Types in engines.d.mts
│  ├─ providers.ts      browser wrapper: key pools, cooldowns, usage,
│  │                      settings shape and migration
│  ├─ paidGuard.ts      what a run will cost, and which credit pays for it
│  ├─ testConnection.ts per-engine "does this actually work?" checks
│  ├─ styleCatalogue.ts 34 styles, and which engines can do each
│  ├─ csv.ts            RFC 4180 parser + full-schema read/write
│  ├─ validate.ts       the seven filename rules, and their auto-fixes
│  ├─ warp.ts           homography maths for the four-corner text warp
│  ├─ textLayer.ts      text layers, auto-shrink to fit
│  ├─ sheets.ts         sprite / turnaround / viseme sheet planning
│  ├─ vectorAssets.ts   SVG + Lottie via a code model, with sanitising
│  ├─ preview.ts        seeded procedural plates (the practice forge)
│  ├─ output.ts         folder linking, ZIP, blob helpers
│  └─ batches.ts        wizard setups, recipes, batch registry
├─ components/          one file per view; ui.tsx is the primitives
└─ market/              Emberfair, the storefront this was built for
scripts/
├─ mcp-server.js        the agent API — 8 tools over stdio
└─ build-exe.js         vite → icons → electron-builder
electron/main.js        desktop shell
```

---

## How a picture gets made

1. **`resolveRoute(row, settings)`** in `engines.mjs` turns a row into
   `{ engine, apiModel, def }`. The row's `model` column wins; the settings
   default is the fallback.
2. **A key is chosen** from the healthy pool for that engine. Free Gemini keys
   are ordered before paid ones, always.
3. **`generateBytes()`** makes the request and returns bytes.
4. On **`429`**, that key is benched until `exhaustedUntil` and the *same row*
   retries immediately with the next key. Only when the whole pool is resting
   does the row park with a `retry_at`.
5. Success caches the blob in memory, writes it to the linked folder, and
   updates the row.

The queue runner in `App.tsx` hands rows out one at a time to N lanes
(1–6, your choice). A slow picture never blocks the others, and Stop lands
within one request.

---

## Adding an engine

1. Add an entry to `MODELS` in `engines.mjs` — id, label, engine, price,
   free allowance, and traits (can it spell? can it do an infographic?).
2. Add a branch to `generateBytes()`.
3. Teach `explainFailure()` what that provider's errors actually mean. This
   matters more than it sounds: providers routinely return `429` for "you have
   no money", which tells the user to wait for a reset that will never come.
4. Add a check in `testConnection.ts`. **It must make a real generation
   call.** Listing models is free and proves nothing — a credit-less Google
   key lists all fifty models and then refuses every request.
5. If it is free, add it to `FREE_ENGINES` in `paidGuard.ts` so it is never
   gated.
6. Write a test.

---

## The CORS trap

Cloudflare's API sends **no CORS headers at all**, so the browser cannot call
it directly. There is a proxy in two places that must stay in step:

- `vite.config.js` — `/cf-api` → `https://api.cloudflare.com` for `npm run dev`
- `electron/main.js` — `proxyToCloudflare()` for the desktop build

`cloudflareUrl()` in `engines.mjs` picks between the proxy path and the direct
URL based on `inBrowser()`. If you add a provider and "could not reach it"
appears only in the browser, this is why — it is not the user's internet.

---

## Tests

`vitest`, in `tests/`. 349 of them across 18 files.

Anything touching **the CSV, filenames, money, or the engines** needs a test.
Those four are where a bug is silent and expensive rather than loud and
obvious.

`csv-parity.test.ts` is worth knowing about: it pins that the app and the MCP
server read and write the manifest identically. When they drift, an agent and
a human working on the same file corrupt each other's rows.

---

## Conventions

- **No `console.log` in shipped code.** Feedback goes through toasts and the
  forge console.
- **No `alert` / `confirm`.** Ever.
- **Comments explain *why*, never *what*.** A comment saying what the line
  does is noise; a comment saying that Cloudflare rejects `seed` and here is
  the date it was confirmed against a live account saves the next person two
  hours.
- **Plain English in the UI.** No jargon in anything a user reads. "The key is
  valid, but its project has no credit" beats "429 RESOURCE_EXHAUSTED".
- **Free first.** Every paid engine needs a keyless fallback path.

Full version: [STANDARDS.md](https://github.com/Stravelakis/image-forge/blob/master/STANDARDS.md).

---

## Where to go next

- [The manifest schema](manifest.md)
- [Wiring agents to it](vibe-coding.md)
- [Known traps and their causes](troubleshooting.md)
