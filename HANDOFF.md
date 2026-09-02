# ⚒ Image Forge — Engineering Handoff

> **Read this before touching anything.** It maps every subsystem, explains the
> non-obvious decisions, and ends with copy-paste recipes for the changes you're
> most likely to make. Everything here is true as of **v1.0.0**.

---

## 1. Orientation (60 seconds)

Image Forge is a **standalone, manifest-driven image pipeline**. A CSV
(`marketplace-images.csv`) is the single source of truth: rows describe
pictures, a queue runner turns them into PNGs, files land organized on disk,
and a separate (optional) step hands them to WordPress/Imagify.

It was built *for* a D&D marketplace (Emberfair, included as an alternate
entry point) and is deliberately decoupled *from* it: **no WordPress, no SQL,
no framework required to run the forge.**

**Design philosophy, in three lines:**
1. The manifest is the API — anything that reads/writes the CSV is a citizen.
2. Free first — every paid path has a keyless fallback.
3. One decision per step, plain English — a ten-year-old runs a batch.

---

## 2. Run it

```bash
npm install
npm run dev                 # browser app → http://localhost:5173
npm run typecheck           # tsc --noEmit (build does NOT typecheck!)
npm run build               # vite build → dist/
node scripts/build-exe.js   # Electron → release/ (installer + portable)
npm run tauri:icons         # once — derives src-tauri/icons/*
npm run tauri:build         # Tauri → src-tauri/target/release/bundle/
node scripts/mcp-server.js  # the agent API (stdio)
```

⚠️ `vite build` **does not run tsc**. Always `npm run typecheck` before
committing — CI isn't set up yet (good first PR: GitHub Actions running
`typecheck` + `build`).

---

## 3. Architecture at a glance

```
                        ┌────────────────────────────────────────────┐
                        │                  App.tsx                   │
                        │  rows (manifest) · settings · batches ·    │
                        │  strike loop · folder doors · toasts/log   │
                        └───────┬───────────────┬───────────────┬────┘
                                │               │               │
              ┌─────────────────▼──┐   ┌────────▼────────┐  ┌───▼──────────┐
              │   providers.ts     │   │    output.ts    │  │  tauriFs.ts  │
              │ resolveRoute ·     │   │ FS Access ·     │  │ Tauri dialog │
              │ key pools · 429    │   │ subfolders ·    │  │ + fs plugin  │
              │ rotation · cooldown│   │ ZIP · rasterize │  │ (fallback →  │
              │ scribe/factory chat│   │                 │  │  output.ts)  │
              └─────────┬──────────┘   └─────────────────┘  └──────────────┘
                        │
          ┌─────────────┼──────────────┬───────────────┐
          ▼             ▼              ▼               ▼
     simulated     pollinations    imagen 4.x      openai-compatible
     (preview.ts)  (keyless GET)  (Gemini predict) (/images/generations)
```

The UI is a **view switch** (`TopMenu.View`) rendered by `App.tsx`:
`workbench · wizard · factory · lib-images · lib-styles · lib-templates ·
lib-batches · settings · docs · agents`. Settings has 9 sub-sections; the
whole thing sits on `Sidebar` (workbench only). `market/MarketApp.tsx` is a
parallel entry point toggled by `App`'s `mode` state — it shares **the same
procedural plates and entity IDs** as the manifest (see §9).

---

## 4. Module map

| file | owns | key exports |
|---|---|---|
| `types.ts` | vocabulary | `Status`, `Category`, `KindDef`/`KINDS` (12 worlds), `AspectKey`, `STYLES`, `STATUS_META`, `CATEGORY_META` |
| `lib/csv.ts` | the contract | `parseCsv` (RFC-4180 state machine), `rowsToCsv`/`rowsFromCsv` (forgiving: missing cols, `generating→pending`), `FULL_COLUMNS` |
| `lib/validate.ts` | the law | `validateFilename` (7 rules), `autoFixFilename`, `styleDriftCount`, `violationCount` |
| `lib/providers.ts` | engines & brains | `ForgeSettings`, `DEFAULT_SETTINGS`, `normalizeSettings` (migration), `MODELS`, `resolveRoute`, `generateReal`, `RateLimitError`, `cooldownHoursFor`, `bumpUsage`, `SCRIBE_SYSTEMS`, `scribeChat` |
| `lib/preview.ts` | practice forge | `renderPreview(row) → raw SVG string`, seeded per filename+seed; per-category scenes (shopfronts, item icons, street events, portraits) |
| `lib/output.ts` | bytes out | `pickOutputFolder`, `ensureSubfolders`, `writeImageFile`, `buildZipBlob`, `svgToPngBlob`, IndexedDB handle persistence |
| `lib/tauriFs.ts` | native door | `isTauri`, `tauriPickFolder`, `tauriWriteImage/Text`, localStorage path persistence |
| `lib/batches.ts` | the wizard's memory | `BatchSetup`, `SavedSetup`, `Batch`, `factoryToRows`, offline `generateIdeas`, load/save for setups+batches |
| `lib/seed.ts` | first-run demo | 8 rows, all `kind: "dnd"` |
| `lib/version.ts` | identity | `APP_VERSION` (keep in sync with `package.json`!) |
| `components/ui.tsx` | kit | ~30 inline SVG icons (no icon lib), `Btn`, chips, `CodeBlock`, `CopyBtn`, `ToastHost` (supports action buttons), `useRevealObserver` |
| `components/effects.tsx` | atmosphere | `DotField`, `EmberField`, `StarField` (canvases), `BorderGlow` (mask-composite trick), `CursorFX` — all honor `prefers-reduced-motion` |
| `App.tsx` | everything stateful | the strike loop lives here (~line 230) |
| `market/*` | Emberfair | `MarketApp` + `data.ts` (shops/wares/events/npcs keyed to shop_id 12–14, item_id 543–544, event 201–202) |

---

## 5. Data model

```ts
interface ManifestRow {
  id; filename; prompt; negative_prompt?; note?;
  category: "shop"|"item"|"event"|"npc";
  kind?: string;            // one of 12 KINDS ids; drives tag + flavor + negative default
  rating?: "like"|"dislike";
  item_id; shop_id; event_id;           // foreign keys into YOUR app
  style; aspect_ratio; seed;
  model;                    // "" = default engine from settings
  status: "pending"|"generating"|"done"|"failed"|"skipped"|"imported";
  error; generated_at; imported_attachment_id;
  retry_at?;                // ISO — cooldown parked rows carry
  preview?;                 // in-memory only: raw SVG or dataURL — NEVER persisted
}
```

**Persistence:**

| store | key | contents |
|---|---|---|
| localStorage | `image-forge-manifest-v1` | rows (minus `preview`), styleLock, appendStyle — **debounced 350 ms** |
| localStorage | `image-forge-settings-v1` | `ForgeSettings` (always through `normalizeSettings`) |
| localStorage | `image-forge-setups-v1` / `-batches-v1` | recipes / batch registry |
| localStorage | `emberfair-v1` | market progress |
| IndexedDB | `image-forge` → `kv.dir` | the `FileSystemDirectoryHandle` |
| localStorage | `image-forge-tauri-folder` | Tauri folder path string |
| disk | `%APPDATA%\Image Forge` | desktop-shell data (Electron/Tauri) |

**In-memory only:** `imagesRef` (`Map<filename, Blob>`) — plates don't survive
a reload by design; "doors" (folder/ZIP/PNG) are how bytes escape.

---

## 6. Engine internals (the part everyone gets wrong)

`resolveRoute(row, settings)` → `{ engine, apiModel, def }`:
**the row's `model` column wins**; only if blank does `settings.provider`
decide. That's why one manifest can mix `imagen-4-ultra` shop fronts with
keyless `flux` icons.

**Key rotation** happens inside `generateReal(row, settings, signal, exhaust, cooldownMs)`:
1. filter the pool to keys with `exhaustedUntil <= now`,
2. try the row,
3. on 429 → `RateLimitError(pool, keyId, retryAt)` — `App.tsx`'s `strike()`
   catches it, benches the key via the `exhaust` callback, and parks the row
   with `retry_at = now + cooldownHoursFor(modelId)`.
4. A watcher effect (20 s interval, `settings.autoRetry`) silently re-queues
   rows whose `retry_at` passed.

**Cooldowns** are user-editable per model (`settings.cooldowns[id]`), default
24 h for the daily-quota Imagens. `usage` tracks per-model/per-day counters
(reset on date change — see `bumpUsage`/`usedToday`).

**Simulated engine**: `strike()` branches before `generateReal` — it sleeps,
rolls a fail chance, and renders `preview.ts`. Real engines return
`{ dataUrl, blob }`; the blob goes to `imagesRef` + the folder door, the
dataURL becomes the preview.

---

## 7. Output doors (3, in priority order in `saveToFolder`)

1. **Tauri native** (`isTauri()`) — dialog picker + fs plugin writes. No
   permission re-prompts, works where the browser API can't.
2. **Browser File System Access** — `showDirectoryPicker`, handle in IndexedDB,
   permission re-confirm once per session (the `pendingName` state). **Blocked
   in sandboxed iframes** — that's the #1 support question; the error surfaces
   inline in Settings → Folders.
3. **ZIP** (`buildZipBlob`) — universal fallback, always works.

All three produce the identical tree: `shops/ items/ events/ npcs/` +
optionally a refreshed `marketplace-images.csv` (`writeCsvOnSync`).

Procedural previews must be rasterized (`svgToPngBlob` wraps the raw SVG in a
data-URL — raw strings won't load into `Image`). Real engine outputs are
already blobs.

---

## 8. UI conventions

- **No icon library** — every glyph is an inline SVG component in `ui.tsx`.
  Add yours there; keep stroke style (1.6 px, round caps).
- **Feedback**: `pushToast(kind, msg, action?)` + `pushLog(msg, kind)` (forge
  console strip). Never `alert/confirm/prompt`.
- **Destructive actions**: double-confirm pattern (see Reset in Advanced) or
  toast-with-undo (see `deleteRow`).
- **Design tokens** live in `index.css` `@theme`: `ink/coal/panel/line`,
  `cream/parch/dust`, `ember/moss/blood/potion/lagoon`; fonts Alfa Slab One
  (display) / Instrument Sans (body) / JetBrains Mono. Motion classes:
  `rise-in · develop · breathe · shimmer · stripes-live · sway · flicker-*`.
  The accent palette (`ACCENTS` in types) rewires `--color-ember*` at runtime.

---

## 9. The Emberfair connection (don't "clean it up")

`market/data.ts` entities intentionally match `seed.ts`: shop_id **12–14**,
item_id **543–544**, events **201–202**, filenames `shop_blacksmith.png` etc.
`MarketApp` renders **the same `renderPreview` plates**, so art generated by
the forge *is* the market's art. Roadmap item: replace the seed plates with
real generated images looked up by filename from the manifest.

---

## 10. Recipes for common changes

**Add a world kind** → append to `KINDS` in `types.ts` (`id, label, tag,
blurb, flavor, negative`). Filename tag, prompt seasoning, negative default
and wizard card all light up automatically.

**Add an engine** → add a `ProviderId` + `PROVIDER_META`, register its models
in `MODELS` (`engine` field ties them together), add a case to
`generateReal`, a key-pool field in `ForgeSettings` (+ default +
`normalizeSettings` entry), and a card in `WizardView` step 5.

**Add a style** → users do this in-app (Library → Visual styles, optionally
AI-crafted via `SCRIBE_SYSTEMS.styleCrafter`). Built-ins live in `STYLES`;
custom ones in `settings.customStyles`. **Both lists must be checked anywhere
a style block resolves** — the v1.0 bug was exactly forgetting the custom list.

**Add a settings section** → extend the `SettingsSection` unions in **both**
`SettingsView.tsx` and `TopMenu.tsx` (they're separate types!), add the rail
entry + menu item + section JSX, thread any new callbacks through `App.tsx`.

**Change the CSV schema** → `FULL_COLUMNS` + `rowsToCsv` + `rowsFromCsv`
(always forgiving: `get()` defaults, unknown columns ignored) + this file.

---

## 11. Known sharp edges

- **`vite build` skips typecheck** — run `npm run typecheck`.
- **Thin test suite.** `npm test` (vitest) covers `csv.ts`, `validate.ts`,
  `engines.mjs` and the MCP tool surface; the React components have none.
- **Pollinations** is slow (5–40 s) and occasionally CORS-flaky; that's why
  the simulated engine exists and why requests are sequential, not parallel.
- **localStorage** has a ~5 MB ceiling — the 350 ms debounce helps; if
  manifests grow huge, migrate to IndexedDB (`idb-keyval`).
- **Preview sandboxes** block File System Access → folder linking fails there
  by design; ZIP is the escape hatch.
- **Electron vs Tauri divergence**: keep `tauriFs.ts` and `output.ts` behavior
  identical when changing folder semantics.
- The two `SettingsSection` unions and the `APP_VERSION`/`package.json` pair
  are manually synced — grep before assuming.

---

## 12. Where to take it next (prioritized)

1. **Component tests** — CI (.github/workflows/ci.yml) already gates
   typecheck + vitest + build; the UI layer is still untested.
2. **Code signing** for the installers (cert purchase → `win.certificateFile`
   in `build-exe.js` / `certificateThumbprint` in `tauri.conf.json`).
3. **A `forge` CLI** wrapping `mcp-server.js` so the pipeline runs headless
   (`forge run --limit 10`), which also unlocks n8n exec nodes without MCP.
4. **OAuth Google Drive** as door #4 (`@tauri-apps/plugin-http` or a tiny
   Electron preload token dance).
5. **Scheduled runs** — a `setInterval` already re-queues cooled rows; a
   "strike nightly at 02:00" toggle is a small step from there.
6. **Reconnect Emberfair** to real generated plates (filename lookup +
   `imported` status gate).

---

## 13. Questions the author anticipates

- *Why not a backend?* The manifest-is-API philosophy: any filesystem +
  spreadsheet is already integration. Agents get MCP instead of REST.
- *Why sequential generation?* Free tiers punish concurrency; sequential +
  key rotation maximizes throughput on the quotas that exist.
- *Why does `strike()` live in App, not a lib?* It mutates three stores
  (rows, settings pools, imagesRef) and talks to toasts/log — it's the
  orchestrator. Pure parts (routing, requests, math) are all in
  `providers.ts` and unit-testable.
- *Is Emberfair dead weight?* No — it's the demand side of the pipeline and
  the proof that the forge's IDs and plates are real-world usable.

---

*Last verified against v1.0.0 — if this file and the code disagree, the code
wins, and please fix this file.*
