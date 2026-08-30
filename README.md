<p align="center">
  <b style="font-size:22px;letter-spacing:2px">⚒ IMAGE FORGE</b><br/>
  <i>manifest in · images out · zero WordPress required</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-CSV-f2a33c" alt="manifest"/>
  <img src="https://img.shields.io/badge/engines-pollinations_%C2%B7_imagen_%C2%B7_openai-56b8a5" alt="engines"/>
  <img src="https://img.shields.io/badge/keys-rotating_pools-e2593f" alt="keys"/>
  <img src="https://img.shields.io/badge/wizard-one_choice_per_step-8cb56f" alt="wizard"/>
</p>

**Image Forge** is a standalone, human-first image production line. A wizard walks you through one easy choice at a time, a prompt factory writes huge idea lists for you (with AI or your own CSV), and the forge paints every picture, files it into the right folder, and hands the finished set to whatever project needs it — WordPress, a D&D marketplace, anything with a media library.

## How it feels

- **Wizards → Start the wizard** — 9 steps, one decision each, plain-English explanations, saved recipes as starting points. If a painter needs a key, you add URL + key + model right there in one step.
- **Wizards → Prompt factory** — “write a big list about a harbor town” → AI returns every filename, prompt and negative prompt. Or paste `filename | prompt | negative` lines, or upload a CSV (`filename, model, prompt, negative_prompt`).
- **Library** — images (mark one failed, write *what should be better*, redo — the note becomes part of the new prompt), styles, templates, previous batches.
- **Settings** — Image engines · Image styles · Text engines · Text prompts · Filenames · Folders · WP connections · Appearance.

## Engines & keys

| model id | engine | free allowance |
|---|---|---|
| `flux` / `turbo` | Pollinations | free · **no key, no signup** |
| `imagen-4-ultra` / `imagen-4` / `imagen-4-fast` | Google Imagen (Gemini API) | ≈ **25/day per model per key** |
| `gemini-flash-image` | Nano Banana | free quota |
| `dall-e-3` / `gpt-image-1` | any OpenAI-compatible endpoint | paid |

- **Key pools rotate on 429** — the hot key rests, the next healthy key retries the same row instantly.
- **Cooldowns are yours** — hours a parked row waits (24h default for daily-quota Imagens); force-retry lives in every drawer.
- The row-level **`model` column** overrides the default engine per picture.

## Where the files go

1. **Linked folder** (Chrome/Edge File System Access) — auto-saves into `shops/ items/ events/ npcs/`; your pre-made subfolders are used as-is. Point it at your Google Drive sync folder for cloud backup.
2. **ZIP** — full structure + CSV, every browser.
3. **WordPress** — real upload via application password (attachment ids written back into the manifest → Imagify does the rest), or a generated WP-CLI script.

## The contract

```csv
id,filename,prompt,negative_prompt,note,category,item_id,shop_id,event_id,style,aspect_ratio,width,height,seed,model,status,error,generated_at,imported_attachment_id
```

`pending → generating → done → imported` (with `failed` / `skipped` side doors). The CSV is the whole API — see **Docs → Agents & API** for n8n, MCP and LangChain recipes.

## Run it

```bash
npm install
npm run dev
npm run build
```

Keys never leave the browser except to call the image/text engines. Quota numbers drift — verify on provider pricing pages before building on a free tier.

## 🪟 Desktop app (Windows `.exe`)

One command packages market + forge into Windows executables — an installer and a portable file land in `release/`:

```bash
node scripts/build-exe.js
```

Electron + electron-builder install themselves on demand (`--no-save`, `package.json` untouched). Full walkthrough, sizes, SmartScreen notes and troubleshooting: **[WINDOWS-EXE.md](WINDOWS-EXE.md)**.
