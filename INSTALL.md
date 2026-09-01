# 🎮 Installing Image Forge on your PC

Think of this like installing a game. There are **3 steps**: get the game files,
install the "game engine" (Node.js), then press play. That's it.

---

## STEP 1 — Get the files onto your computer

You already put the project on GitHub, so this is easy:

1. Open a web browser and go to your GitHub repository.
2. Click the green **`<> Code`** button, then **`Download ZIP`**.
3. Find the ZIP in your **Downloads** folder, right-click it, choose **`Extract All…`**.
4. Put the folder somewhere simple with **no spaces**, like:
   ```
   C:\Games\image-forge
   ```

> 💡 If you have Git installed you can instead run `git clone <your-repo-url>` — same result.

---

## STEP 2 — Install Node.js (the "game engine")

Your computer needs one free program to run the forge. It's like installing the
launcher a game needs (the way some games need Steam).

1. Go to **https://nodejs.org**
2. Click the big green **LTS** button (the one that says "Recommended").
3. Run the file you downloaded. Click **Next → Next → Next → Install → Finish**.
   *(Leave every box checked, especially "Add to PATH".)*
4. **Check it worked:** press the **Windows key**, type `cmd`, press Enter.
   In the black box, type:
   ```
   node -v
   ```
   If you see a number like `v22.11.0`, you're ready. 🎉

---

## STEP 3 — Press play

**The easy way:** inside the `image-forge` folder, double-click **`start-forge.bat`**.
It downloads anything missing, starts the forge, and shows you the link.
Hold **Ctrl** and **click** the link it prints (something like
`http://localhost:5173`). To stop it, press **Ctrl + C** in that window.

**The manual way** (if you like black boxes): open the folder, type `cmd` in the
address bar, press Enter, then:
```
npm install        ← one time only (get a snack 🍿)
npm run dev        ← every time you want to play
```
Then Ctrl+click the `http://localhost:5173` link.

**That's it — Image Forge is running!** 🎉

---

## 🖥️ Want it as a real app with an icon instead? (.exe)

If you'd rather have a normal program you double-click (no black box):

**Double-click `make-installer.bat`** in the project folder and wait.
*(Manual equivalent: `node scripts/build-exe.js`.)*

It builds everything and opens the **`release`** folder, which contains:

| file | what it is |
|---|---|
| **`Image Forge Setup 1.0.0.exe`** | a proper Windows installer — pick the install folder, creates **desktop + Start Menu shortcuts**, launches the app when it finishes, and adds a normal uninstaller |
| **`image-forge-portable.exe`** | a single file you can run from anywhere — even a USB stick, no install |

Double-click the Setup file and install it like any game. The app gets the forge's
anvil icon, and right-click → Properties shows its name and description like a
real program.

> ⚠️ The first time you open it, Windows may show a blue *"Windows protected your
> PC"* screen. That's normal for apps you build yourself (they aren't
> code-signed). Click **More info → Run anyway**.

---

## 🧹 Uninstalling, repairing, resetting & updating

### Uninstall (removes the app, keeps your stuff by default)
1. Open **Windows Settings → Apps → Installed apps** — there's a shortcut button
   for this in the app: **Settings → Advanced → "Open Windows Installed apps"**.
2. Find **Image Forge** → **Uninstall**.
3. The uninstaller asks one question: *"Remove your Image Forge data as well?"*
   - **No** → only the app goes; your manifest, recipes, keys and marketplace
     progress stay in `%APPDATA%\Image Forge`, ready for a reinstall.
   - **Yes** → that data goes too.
4. Images you generated on disk (your linked folder, ZIPs) are **never** touched
   by uninstalling.

### Repair (the app feels broken)
In the app: **Settings → Advanced → Run repair**. One click:
- puts rows stuck on *generating* back to *pending*,
- de-duplicates any colliding filenames,
- re-creates `shops/ items/ events/ npcs/` in your linked folder,
- rewrites a fresh `marketplace-images.csv` there.

### Reset (keep the app, lose the data)
**Settings → Advanced → Reset** — tick exactly which stores to wipe (manifest,
recipes/batches, settings+keys, marketplace progress). Always
**"Download backup first"** — it saves everything as one JSON file.
Reset asks for confirmation twice before erasing anything.

### Update from GitHub (no reinstall needed)
**Settings → Advanced → Sync & update from GitHub**:
- enter your repo's **owner / name / branch**,
- **Pull manifest** fetches `marketplace-images.csv` straight from the repo
  (merge it in, or replace your current one) — perfect when an agent or a
  teammate edits the CSV on GitHub,
- **Check for app update** looks at the repo's latest release; if it's newer
  than the version you run, it downloads the fresh `Setup.exe` — run it and
  you're updated, data intact.

To make releases discoverable, publish one on GitHub:
```
git tag v1.1.0 && git push --tags
# then GitHub → Releases → "Draft a new release" → attach the Setup .exe
```

---

## 🤖 Let Claude Code / Hermes / other agents use it (the "API")

Yes — there's an API. It's an **MCP server**, which is the standard way AI agents
talk to tools. Claude Code and Hermes both understand MCP.

The server reads the same `marketplace-images.csv` the app uses, and can even
**generate images for free** (no API key) via the Pollinations endpoint.

### What agents can do
| tool | what it does |
|---|---|
| `forge_status` | how many pending / done / failed |
| `forge_list` | list the pictures in the manifest |
| `forge_add_row` | add a new picture idea |
| `forge_generate_pending` | make all pending pictures → real PNGs on disk |
| `forge_generate_one` | make one picture by filename |
| `forge_retry_failed` | try the failed ones again |

### Connect Claude Code
Run this once in your project folder:
```
claude mcp add image-forge node scripts/mcp-server.js
```
Or add it by hand to your Claude config (`claude_desktop_config.json` /
`~/.claude.json`):
```json
{
  "mcpServers": {
    "image-forge": {
      "command": "node",
      "args": ["scripts/mcp-server.js"],
      "cwd": "C:\\Games\\image-forge"
    }
  }
}
```
Then just tell Claude: *"use the forge to make the pending images"* — it will.

### Connect Hermes / anything MCP-compatible
Point it at the same thing: command `node`, args `["scripts/mcp-server.js"]`,
working directory = your project folder. Any MCP client works the same way.

> By default images land in `generated-images/` (in `shops/ items/ events/ npcs/`)
> and the manifest is `marketplace-images.csv`. Change with:
> `node scripts/mcp-server.js --csv path/to/manifest.csv --out path/to/images`

---

## 🆘 Troubleshooting (the "it won't start" fixes)

| Problem | Fix |
|---|---|
| `'node' is not recognized` | Reinstall Node.js, then **close and reopen** the black box. |
| `npm install` fails | Check your internet; run it again. |
| `port 5173 already in use` | Another forge is still running. Close its black box, or restart your PC. |
| Page is blank | Run `npm run build` once, then `npm run dev` again. |
| `make-installer.bat` fails | It downloads everything it needs by itself — if it still fails, check your internet, close the window and double-click it again. |

---

### One last thing
Your pictures, keys, and settings are saved on **your computer only**
(in `%APPDATA%\Image Forge` for the .exe). Nothing is uploaded anywhere except
the image engines you choose. Have fun! ⚒️
