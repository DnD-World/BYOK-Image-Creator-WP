#!/usr/bin/env node
/**
 * Prepares the Tauri icon set.
 *
 *   node scripts/tauri-icons.js
 *
 * 1. downloads the 1024×1024 emblem into src-tauri/icons/icon.png (cached)
 * 2. runs `tauri icon`, which derives every size Tauri needs
 *    (32×32, 128×128, @2x, .ico for Windows, .icns for macOS, StoreLogo…)
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "src-tauri", "icons", "icon.png");
const URL =
  "https://image.qwenlm.ai/generated-images/1aee720a-7125-4ae0-9f83-4cdfeed8af7c/_result.png";

const step = (m) => console.log(`\n\x1b[38;5;215m▸ ${m}\x1b[0m`);
const ok = (m) => console.log(`\x1b[38;5;114m✓ ${m}\x1b[0m`);

function download(u, redirects = 0) {
  return new Promise((resolve, reject) => {
    const mod = u.startsWith("https") ? https : http;
    mod
      .get(u, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
          return resolve(download(res.headers.location, redirects + 1));
        }
        if (res.statusCode !== 200) return reject(new Error(`icon server said ${res.statusCode}`));
        fs.mkdirSync(path.dirname(DEST), { recursive: true });
        const out = fs.createWriteStream(DEST);
        res.pipe(out);
        out.on("finish", () => resolve());
        out.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  if (fs.existsSync(DEST)) {
    ok("icon.png already cached");
  } else {
    step("downloading the emblem (once)…");
    await download(URL);
    ok(`saved to ${path.relative(ROOT, DEST)}`);
  }

  step("deriving the full icon set (tauri icon)…");
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "npx.cmd" : "npx", ["tauri", "icon", DEST], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("\x1b[38;5;203m✗ tauri icon failed — is @tauri-apps/cli installed and Rust on PATH?\x1b[0m");
    process.exit(1);
  }
  ok("icons ready — src-tauri/icons/ now holds every size Tauri needs");
}

main().catch((e) => {
  console.error(`\x1b[38;5;203m✗ ${e?.message ?? e}\x1b[0m`);
  console.log("  (you can also drop any 1024×1024 png at src-tauri/icons/icon.png and run `npx tauri icon src-tauri/icons/icon.png`)");
  process.exit(1);
});
