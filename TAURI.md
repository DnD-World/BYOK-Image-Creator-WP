# 🦀 Image Forge → Tauri desktop app

Tauri is the slim alternative to Electron. Instead of shipping a whole Chromium,
it wraps the built site in the OS's own webview and adds a thin Rust shell — so the
final executable is **~5–10 MB** instead of ~200 MB, with lower memory use.

Everything is already wired: the `src-tauri/` folder, the native plugins, and the
frontend bridge (`src/lib/tauriFs.ts`).

---

## One-time prerequisites

1. **Rust** — https://rustup.rs (the installer adds `cargo` to PATH)
2. **Microsoft C++ Build Tools** — the Rust installer on Windows offers to fetch
   these automatically; accept. (WebView2 is already on Windows 10/11.)
3. **Node 18+** — you already have this.

## Build

```bash
npm install                # brings in @tauri-apps/cli + plugins
npm run tauri:icons        # downloads the emblem + derives every icon size
npm run tauri:build        # vite build → rust compile → bundle
```

First run compiles the Rust toolchain + dependencies (a few minutes, once). Output:

| file | where |
|---|---|
| `Image Forge_1.0.0_x64-setup.exe` | `src-tauri/target/release/bundle/nsis/` |
| `Image Forge_1.0.0_x64_en-US.msi` | `src-tauri/target/release/bundle/msi/` |

Develop with hot reload:

```bash
npm run tauri:dev
```

## What the Rust shell adds

- **Native folder picker** (`plugin-dialog`) and **direct file writes** (`plugin-fs`).
  In the Tauri build the "link output folder" feature needs *no permission
  re-confirmation* and works everywhere — the frontend detects the shell via
  `isTauri()` and routes writes through `tauriWriteImage`/`tauriWriteText`.
  The browser File System Access path is kept as the fallback for the web build.
- **External links** open in your real browser (`plugin-shell`).
- Single-instance window, fixed title, dark background — see `src-tauri/tauri.conf.json`.

## Troubleshooting

| symptom | fix |
|---|---|
| `cargo: command not found` | Rust not on PATH — restart your terminal after rustup |
| icon step fails | drop any 1024×1024 png at `src-tauri/icons/icon.png`, run `npx tauri icon src-tauri/icons/icon.png` |
| linker error (link.exe) | C++ Build Tools missing — rerun rustup, choose the MSVC toolchain |
| want the Electron build too | it still works — `npm run build-exe` is independent of Tauri |
