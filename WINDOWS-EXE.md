# 🪟 Image Forge → Windows `.exe`

The project is fully wired for desktop packaging with **Electron + electron-builder**,
both committed as `devDependencies`.

---

## The one command

On any machine with **Node 18+** and internet access:

```bash
npm install          # once — brings in electron + electron-builder
npm run build-exe    # vite build → icon → electron-builder → release/
```

(`node scripts/build-exe.js` runs the exact same thing.) First run downloads
Electron's binaries (~150 MB, coffee time); every run after is fast.

## What you get — in `release/`

| file | what it is |
|---|---|
| `Image Forge Setup x.y.z.exe` | normal Windows installer — pick the install folder, desktop & start-menu shortcuts |
| `image-forge-portable.exe` | portable single file — runs from a USB stick, no install |

## What the exe actually is

- The built site (`dist/`) ships inside the package and is served by a tiny embedded
  server at `http://127.0.0.1:<port>` — that also makes the browser treat the app as a
  **secure context**, so the forge's *link output folder* feature works in the desktop app.
- Your data (manifest, recipes, engine keys, settings) persists in
  `%APPDATA%\Image Forge` — the *Help → Where is my data?* menu item shows the exact path.
- Internet is still needed for Google Fonts and the AI engines (Pollinations / Imagen),
  exactly as in the browser. Everything else runs offline.

## Try it before packaging (dev mode)

```bash
npm run build
npx electron .          # loads electron/main.js via package.json "main"
```

Opens the same window without building an installer — handy for a quick look.

## First-launch notes

- **SmartScreen** may say “Windows protected your PC” (the app isn't code-signed —
  signing needs a paid certificate). Click **More info → Run anyway**. It's the normal
  path for every unsigned app.
- Expected install size is ~180–220 MB — that's Chromium inside; unavoidable with Electron.
  If that matters, the portable file is the same size but needs no installation.

## Troubleshooting

| symptom | fix |
|---|---|
| `npm install` of electron fails | corporate proxy? set `npm config set proxy …` / `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` and retry |
| antivirus eats the installer | false positive common for unsigned NSIS builds — whitelist `release/` or sign the app (v2) |
| window opens blank | run `npm run build` first — the exe needs a fresh `dist/` |
| want arm64 or ia32 too | add the arch to the `win.target` list in `scripts/build-exe.js` |

## Later (v2 ideas)

- code signing certificate → no SmartScreen warning
- auto-updates via `electron-updater`
- Tauri build for a ~10 MB alternative (needs the Rust toolchain)
