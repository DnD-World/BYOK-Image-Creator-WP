/**
 * Image Forge desktop shell (Electron, ESM).
 *
 * The built site (dist/) is served by a tiny embedded HTTP server on
 * http://127.0.0.1:<random-port>. Two reasons we don't just open the html file:
 *   1. Vite emits absolute asset paths (/assets/...) which need a web root.
 *   2. 127.0.0.1 is a *secure context* — so the File System Access API
 *      (link output folder) keeps working inside the desktop app.
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, shell, dialog } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- static file server ---------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function resolveDistDir() {
  // packaged: dist/ travels as an extraResource next to the exe
  // dev: dist/ sits at the project root
  const candidates = [
    path.join(process.resourcesPath || "", "dist"),
    path.join(__dirname, "..", "dist"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "index.html"))) return c;
  }
  return null;
}

function startServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      let filePath = path.normalize(path.join(distDir, urlPath));
      // keep requests inside dist
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html"); // SPA fallback
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/* ---------------- app ---------------- */

// one instance only
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow = null;

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [{ role: "quit", label: "Quit Image Forge" }],
    },
    {
      label: "Edit",
      submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
    },
    {
      label: "View",
      submenu: [
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        ...(!app.isPackaged ? [{ role: "toggleDevTools", label: "Developer tools" }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Where is my data?",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: "Your data",
              message: "Your manifest, recipes, engine keys and settings live in:",
              detail: path.join(app.getPath("appData"), "Image Forge"),
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ]);

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(menu);

    const distDir = resolveDistDir();
    if (!distDir) {
      dialog.showErrorBox(
        "Build not found",
        "The dist/ folder is missing.\nRun  npm run build  first, then start the app again."
      );
      app.quit();
      return;
    }

    const { port } = await startServer(distDir);

    const iconPath = path.join(__dirname, "..", "build", "icon.png");

    mainWindow = new BrowserWindow({
      width: 1320,
      height: 840,
      minWidth: 980,
      minHeight: 640,
      backgroundColor: "#17120e",
      title: "Image Forge",
      show: false,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });

    mainWindow.once("ready-to-show", () => mainWindow.show());

    // external links open in the real browser, never inside the app
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("http")) shell.openExternal(url);
      return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (e, url) => {
      if (!url.startsWith(`http://127.0.0.1:${port}`)) {
        e.preventDefault();
        shell.openExternal(url);
      }
    });

    await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  });

  app.on("window-all-closed", () => app.quit()); // Windows convention
}
