#!/usr/bin/env node
/**
 * One-command Windows packaging.
 *
 *   node scripts/build-exe.js
 *
 * 1. installs electron + electron-builder if missing (--no-save, package.json untouched)
 * 2. builds the site with vite            → dist/
 * 3. packages it                          → release/
 *       · "Image Forge Setup x.y.z.exe" (installer, pick install folder)
 *       · "image-forge-portable.exe"    (portable, runs from anywhere)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const step = (msg) => console.log(`\n\x1b[38;5;215m▸ ${msg}\x1b[0m`);
const ok = (msg) => console.log(`\x1b[38;5;114m✓ ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\x1b[38;5;203m✗ ${msg}\x1b[0m`);
  process.exit(1);
};

function has(mod) {
  try {
    require.resolve(mod, { paths: [ROOT] });
    return true;
  } catch {
    return false;
  }
}

/** Downloads the forge's emblem into build/icon.png on first run, then it's cached. */
function ensureIcon() {
  return new Promise((resolve) => {
    const dest = path.join(ROOT, "build", "icon.png");
    if (fs.existsSync(dest)) {
      ok("icon already cached");
      return resolve();
    }
    const url =
      "https://image.qwenlm.ai/generated-images/498dde55-0b24-4a59-a260-33d1bbee3a0a/_result.png";
    console.log("  downloading icon…");
    const get = (u, redirects = 0) => {
      const mod = u.startsWith("https") ? require("https") : require("http");
      mod
        .get(u, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
            return get(res.headers.location, redirects + 1);
          }
          if (res.statusCode !== 200) {
            console.log("  (icon download failed — packaging continues with the default icon)");
            return resolve();
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const out = fs.createWriteStream(dest);
          res.pipe(out);
          out.on("finish", () => {
            ok("icon saved to build/icon.png");
            resolve();
          });
          out.on("error", () => resolve());
        })
        .on("error", () => {
          console.log("  (no connection for the icon — packaging continues with the default icon)");
          resolve();
        });
    };
    get(url);
  });
}

async function main() {
  step("checking packaging tools (first run downloads ~150 MB — coffee time)");
  if (!has("electron") || !has("electron-builder")) {
    console.log("  installing electron + electron-builder (not saved to package.json)…");
    const r = spawnSync(npmCmd, ["install", "--no-save", "electron", "electron-builder"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (r.status !== 0) fail("could not install electron/electron-builder — check your internet connection");
  }
  ok("tools ready");

  step("building the site (vite → dist/)");
  const b = spawnSync(npmCmd, ["run", "build"], { cwd: ROOT, stdio: "inherit" });
  if (b.status !== 0) fail("vite build failed");
  ok("site built");

  step("fetching the app icon (once)");
  await ensureIcon();

  step("packaging the exe (this is the slow part)");
  const { build } = require(require.resolve("electron-builder", { paths: [ROOT] }));
  const iconFile = path.join(ROOT, "build", "icon.png");
  const hasIcon = fs.existsSync(iconFile);

  const artifacts = await build({
    config: {
      appId: "forge.imageforge.app",
      productName: "Image Forge",
      copyright: "Image Forge — forged locally",
      asar: true,
      directories: { output: "release", buildResources: "build" },
      files: ["electron/**/*", "build/icon.png", "package.json"],
      extraResources: [{ from: "dist", to: "dist" }],
      // package.json is deliberately left untouched — electron-builder gets its
      // entry point from here instead:
      extraMetadata: { main: "electron/main.cjs" },
      win: {
        ...(hasIcon ? { icon: "build/icon.png" } : {}),
        target: [
          { target: "nsis", arch: ["x64"] },
          { target: "portable", arch: ["x64"] },
        ],
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "Image Forge",
      },
      portable: { artifactName: "image-forge-portable.exe" },
    },
  });

  ok("done! your executables:");
  for (const a of artifacts) console.log(`  \x1b[38;5;229m${path.relative(ROOT, a)}\x1b[0m`);
  console.log(`
  · the "Setup" file is a normal Windows installer
  · the "portable" file runs straight from a USB stick
  · first launch may show a SmartScreen warning (unsigned app):
      More info → Run anyway
  · your data (manifest, recipes, keys, settings) lives in %APPDATA%\\Image Forge`);
}

main().catch((e) => fail(e && e.message ? e.message : String(e)));
