<div align="center">

# ⚒ IMAGE FORGE

### *manifest in · images out · zero WordPress required*

A standalone, manifest-driven AI image pipeline — built for a D&D marketplace,
deliberately decoupled from it, ready to feed any project with organized art.

[![build](https://img.shields.io/badge/build-passing-8cb56f?style=for-the-badge)](#)
[![version](https://img.shields.io/badge/v1.0.0-f2a33c?style=for-the-badge&label=release)](#)
[![engines](https://img.shields.io/badge/engines-4_wired_%2B_15_catalogued-56b8a5?style=for-the-badge)](#)
[![keys](https://img.shields.io/badge/keys-rotating_pools-e2593f?style=for-the-badge)](#)
[![platforms](https://img.shields.io/badge/browser_%C2%B7_electron_%C2%B7_tauri-b18ce0?style=for-the-badge&label=runs%20on)](#)
[![agents](https://img.shields.io/badge/MCP-Claude_%C2%B7_Hermes_%C2%B7_n8n-cdbc9f?style=for-the-badge)](#)

</div>

---

## The pipeline this repo implements

```
 ┌────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ 1. build   │   │ 2. arrange   │   │ 3. run the   │   │ 4. review &  │
 │ your ideas │──▶│ prompts in   │──▶│ forge — free │──▶│ redo failures│
 │ (wizard/AI)│   │ the manifest │   │ or with keys │   │ with notes   │
 └────────────┘   └──────────────┘   └──────┬───────┘   └──────┬───────┘
                                             │                  │
 ┌────────────┐   ┌──────────────┐   ┌──────▼───────┐   ┌──────▼───────┐
 │ 9. your    │   │ 8. store     │   │ 7. Imagify   │   │ 6. import to │
 │ frontend   │◀──│ attachment   │◀──│ optimizes    │◀──│ WP Media (or │
 │ uses URLs  │   │ ids in SQL   │   │ everything   │   │ your own DB) │
 └────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
        ▲
        └── or skip 6–9 entirely: keep the PNGs, keep the CSV, done.
```

Steps 1–5 are this app. Steps 6–9 are *your* project — the forge even writes
the WP-CLI script for step 6.

---

## What you actually get

**⚡ The Wizard** — nine steps, one decision each, explained like you're ten.
Name the batch → pick a **world** (12 flavors: D&D, cyberpunk, sci-fi,
cottagecore, gothic, steampunk, pirate, mythology, old west, modern, anime, or
plain generic) → list the pictures (AI writes them, or paste/upload a CSV) →
pick a look → pick a painter → pick a shape → pick a home → extras → review in
an accordion. Saved setups become one-click **recipes** for the next batch.

**🎨 Engines, per row** — the `model` column routes *each row* to its own painter:

| model id | engine | what it costs | free allowance |
|---|---|---|---|
| `cloudflare-flux` | Cloudflare Workers AI | **free** | ~690 images/day, resets midnight UTC, no card |
| `flux` · `turbo` | Pollinations | **free** | unlimited, but one every ~5s, and it needs a free token |
| `nano-banana-2-lite` | Google | $0.034 · batch $0.017 | none |
| `nano-banana-2` | Google | $0.067 · batch $0.034 | none |
| `nano-banana` | Google | $0.039 · batch $0.019 | none — **Google switches it off 2 Oct 2026** |
| `gemini-3-pro-image` | Google | $0.134 · batch $0.067 | none |
| `dall-e-3` · `gpt-image-1` | any OpenAI-compatible endpoint | ~$0.04 | none |
| *(practice forge)* | procedural, offline, deterministic | free | infinite |

> Prices checked against the providers on **2 September 2026**. "Batch" is Google's
> half price for pictures you are willing to wait for — see below.
>
> **Two things changed under this app in August 2026.** Google retired every
> Imagen endpoint on **17 August**, and with it the old free ~25/day allowance;
> image generation moved to a new API and there is no free Google tier any more.
> Pollinations started refusing anonymous requests with a bot check. Both are
> handled: old manifests are migrated automatically, and Settings → Advanced →
> Repair moves any leftover row onto a current model.

**⏳ Batch jobs — the same pictures for half the money** — hand a pile of rows to
Google in one go and collect them later. Press **Batch · half price**, then
**Check batches** when you come back. Google's target is 24 hours; in practice it
is usually well under an hour. The job survives closing the app.

**🔑 Key pools with rotation** — add as many keys as you like per engine.
On a 429 the current key rests and the next one retries the *same row*
immediately. A row only parks (with an editable per-model cooldown — 24h
default for the daily-quota models) when the whole pool rests. Expired
cooldowns re-queue themselves automatically.

**📁 Files, organized** — every finished image lands in
`shops/ items/ events/ npcs/` via three doors: a **linked folder** (native in
the desktop builds, File System Access in Chrome/Edge — point it at your
Google Drive sync folder for free cloud sync), a **ZIP** with the full
structure + CSV, or row-by-row **Save PNG**.

**🖼 Libraries** — every picture (like/dislike, mark failed + write a note →
redo folds your note into the new prompt), visual styles (5 built-in + your
own, the text model can invent new ones), saved recipes, and previous batches
with live progress and per-batch CSV export.

**✍️ The Scribe** — any OpenAI-compatible chat model rewrites briefs into full
prompts ending in the locked style block, forges rule-perfect filenames,
suggests styles, and emits WordPress-ready `title/alt/caption` JSON. Its
instructions are editable in Settings → Text prompts.

**🎭 The law of the forge** — seven filename rules enforced live with one-click
auto-fix; one visual language per batch with drift warnings; negative prompts
auto-filled per world flavor.

**🖥 Three ways to run it** — browser, an Electron installer/portable exe
(~200 MB, double-click `make-installer.bat`), or Tauri (~10 MB,
`npm run tauri:build`). Plus **Emberfair**, the D&D night-market storefront
this was all built for, one click away.

**🤖 An agent API** — `scripts/mcp-server.js` speaks MCP over stdio, so
Claude Code, Hermes, LangChain and n8n can read the manifest, add ideas and
*generate real images for free* (see below). It runs the same engines the app
does, so an agent gets keyless Pollinations out of the box and Imagen / DALL-E
as soon as you hand it keys.

---

## Quickstart

```bash
npm install
npm run dev          # browser → http://localhost:5173   (or double-click start-forge.bat)
```

**Package it:**

```bash
node scripts/build-exe.js          # Electron → release\ (installer + portable)
npm run tauri:icons && npm run tauri:build   # Tauri → src-tauri\target\…\bundle\
```

**Connect an agent:**

```bash
claude mcp add image-forge node scripts/mcp-server.js
# then: "use the forge to make the pending images" — it will.
```

With no keys the agent generates through keyless Pollinations. To give it the
same keyed engines the app uses, point it at a backup exported from
**Settings → Advanced → Backup**, or set the keys in its environment:

```bash
node scripts/mcp-server.js --settings ./image-forge-backup-2026-09-01.json
# or: GEMINI_API_KEYS=key1,key2 node scripts/mcp-server.js
```

| Variable | What it does |
|---|---|
| `GEMINI_API_KEY` / `GEMINI_API_KEYS` | Imagen keys (comma-separated, rotated on 429) |
| `OPENAI_API_KEY` / `OPENAI_API_KEYS` | keys for any OpenAI-compatible endpoint |
| `OPENAI_BASE_URL`, `OPENAI_IMAGE_MODEL` | point at Together, OpenRouter, a local WebUI… |
| `FORGE_PROVIDER` | force `pollinations` / `imagen` / `openai` |

A row's `model` column still wins over all of it, exactly as in the app.

Full plain-language walkthrough: **[GUIDE.md](GUIDE.md)** ·
handing the repo to someone else: **[HANDOFF.md](HANDOFF.md)** ·
Windows packaging: **[WINDOWS-EXE.md](WINDOWS-EXE.md)** · Tauri: **[TAURI.md](TAURI.md)**

---

## The manifest — the whole contract

```csv
id,filename,prompt,negative_prompt,note,category,kind,style,aspect_ratio,seed,model,status,error,generated_at,imported_attachment_id
1,shop_cyber_noodle_bar.png,"rain-slick noodle stall, neon steam…",text watermark,make it rainier,shop,cyberpunk,claymation,16:9,41,imagen-4-ultra,pending,,,
```

| column | meaning |
|---|---|
| `filename` | **the only required column** — seven rules enforced (lowercase, no spaces, underscores, `category_` prefix, `.png`, unique…) |
| `prompt` / `negative_prompt` | what to paint, what to avoid (negatives auto-fill per world) |
| `category` | `shop · item · event · npc` → decides the output subfolder |
| `kind` | world flavor → filename tag + prompt/negative seasoning |
| `model` | per-row engine; blank = the default engine in Settings |
| `status` | `pending → generating → done → imported` (+ `failed`, `skipped`) |
| `note` | your "make it better" instruction — becomes part of the redo prompt |
| `rating` | `like` / `dislike` from the image library |
| `item_id · shop_id · event_id` | foreign keys back into *your* app's SQL |
| `imported_attachment_id` | filled by the WordPress import step |

Import forgives missing columns and mid-generation rows. Export as **CSV or XLSX**.

---

## Project map

```
src/
├─ App.tsx                 forge orchestrator: queue runner, rotation, folder doors,
│                          batches, wizard wiring + the market⇄forge switch
├─ market/                 Emberfair — the D&D night market this feeds
├─ types.ts                statuses, categories, 12 kinds, aspects, styles
├─ index.css               the whole design system (tokens, motion, effects)
├─ lib/
│  ├─ csv.ts               RFC-4180 parser + full-schema read/write
│  ├─ engines.mjs          THE image engines — model registry, routing, 429
│  │                       rotation. DOM-free plain ESM so the MCP server
│  │                       runs the exact same code (types: engines.d.mts)
│  ├─ providers.ts         browser wrapper over engines.mjs + key pools,
│  │                       cooldowns, usage, scribe + factory chat,
│  │                       settings shape & migration
│  ├─ preview.ts           seeded procedural plates (the "practice forge")
│  ├─ output.ts            folder linking, subfolder routing, ZIP, blob helpers
│  ├─ tauriFs.ts           Tauri-native folder picker/writer (browser fallback)
│  ├─ batches.ts           wizard setups, recipes, batch registry, idea generator
│  ├─ validate.ts          the seven filename rules + auto-fix
│  └─ seed.ts · version.ts
├─ components/
│  ├─ WizardView · PromptFactory · ManifestView · LibraryViews
│  ├─ SettingsView (9 sections incl. Advanced) · ScribeDrawer · WpImportModal
│  ├─ TopMenu · Sidebar · DocsView · AgentsView
│  ├─ ui.tsx               icon set, chips, buttons, toasts, code blocks
│  └─ effects.tsx          DotField · EmberField · StarField · BorderGlow · CursorFX
scripts/
├─ mcp-server.js           the agent API (6 tools, stdio, same engines as the app)
├─ build-exe.js            vite → icon → electron-builder → release/
├─ tauri-icons.js          emblem → full Tauri icon set
└─ publish-github.bat      one-click git init → push
electron/main.js           desktop shell: 127.0.0.1 server (secure context!),
                           menus, "where is my data?", external links
src-tauri/                 Tauri v2 shell: dialog + fs + shell plugins
build/installer.nsh        NSIS hook: "also delete my data?" on uninstall
```

---

## Under the hood, in one breath

`App.tsx` owns the manifest (`rows`) and runs a **sequential strike loop**:
each row resolves its route (`model` column → engine/model/apiId), a key is
picked from the healthy pool, the request flies, and on success the image is
cached in memory, previewed, and — if a folder is linked — written to disk.
429s bench the key and retry with the next; exhaustion parks the row under a
cooldown. Everything text-shaped persists to `localStorage`
(`image-forge-manifest-v1`, `-settings-v1`, `-setups-v1`, `-batches-v1`);
folder handles persist in IndexedDB; desktop data lives in
`%APPDATA%\Image Forge`. No backend, no accounts, nothing leaves your machine
except the requests to the engines you choose.

---

## House rules for contributors

- **The manifest is the API.** Any tool that reads/writes the CSV is a
  first-class citizen — that's the whole philosophy.
- **One decision per UI step**, plain English, no jargon — a ten-year-old
  should be able to run a batch.
- **Free first.** Every paid engine must have a keyless fallback path
  (Pollinations for images, the offline idea generator for text).
- No `console.log` in shipped code; feedback flows through toasts + the
  forge console. No `alert/confirm` — ever.
- Verify with `npm test`, `npm run typecheck` and `npm run build` — all three
  run in CI on every push and PR (.github/workflows/ci.yml). Tests live in
  `tests/`; anything touching the CSV, filenames or the engines needs one.

---

## Roadmap

- [x] manifest + status lifecycle · seven filename rules · five styles
- [x] four engines, per-row routing, key pools, 429 rotation, cooldowns
- [x] wizard · recipes · prompt factory · 12 world kinds · negative prompts
- [x] folder auto-save · ZIP · WP-CLI + REST import · undo · variants · XLSX
- [x] Electron installer + Tauri shell · MCP agent API
- [ ] **code signing** (kills the SmartScreen warning — needs a certificate)
- [ ] **OAuth Google Drive upload** as a fourth output door
- [ ] **autosave prompt templates** + scheduled nightly runs
- [x] a test suite (vitest, 69 tests) + GitHub Actions CI
- [ ] a real `forge` CLI wrapping the MCP server
- [ ] reconnect Emberfair to pull *real* generated plates by filename ⚔️

---

<div align="center">

Keys never leave the browser except to call the engines you choose.
Quota numbers drift — verify on provider pricing pages before building on a
free tier. Built with React · Vite · Tailwind · Electron · Tauri.

*struck, not templated* ⚒

</div>
