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

1. Open **File Explorer** and go inside your `image-forge` folder.
2. Click the **address bar** at the top (where the folder path is), type `cmd`,
   press **Enter**. A black box opens *already inside the folder*.
3. Type this and press Enter *(downloads the parts the forge needs — one time only)*:
   ```
   npm install
   ```
   Wait a minute or two. Go get a snack. 🍿
4. Now start the forge:
   ```
   npm run dev
   ```
5. You'll see lines of text, then a web address like **`http://localhost:5173`**.
   Hold **Ctrl** and **click** that link (or copy-paste it into your browser).

**That's it — Image Forge is running!** 🎉

To stop it later: click the black box and press **Ctrl + C**.
To run it again later: open the folder, `cmd` in the address bar, `npm run dev`.
(You only do `npm install` once — after that it's just `npm run dev`.)

---

## 🖥️ Want it as a real app with an icon instead? (.exe)

If you'd rather have a normal program you double-click (no black box):

```
node scripts/build-exe.js
```

Wait a few minutes. Then look in the **`release`** folder and double-click
**`Image Forge Setup.exe`**. Install it like any game. It'll appear in your
Start Menu. *(First open may show a blue "Windows protected your PC" screen —
click **More info → Run anyway**. That's normal for apps you build yourself.)*

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
| Build-exe fails | Make sure you ran `npm install` first. |

---

### One last thing
Your pictures, keys, and settings are saved on **your computer only**
(in `%APPDATA%\Image Forge` for the .exe). Nothing is uploaded anywhere except
the image engines you choose. Have fun! ⚒️
