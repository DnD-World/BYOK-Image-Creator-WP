# 🧒 The Image Forge, explained simply

This guide has no big words on purpose. If you can install a game, you can use
the Image Forge. Follow the pictures with your eyes, do the steps with your
hands. That's all.

---

## Part 1 · What even is this thing?

The Image Forge is a **picture-making factory** that lives on your computer.

```
   your idea          the forge          your pictures
  ┌──────────┐      ┌──────────┐      ┌──────────────────────┐
  │ “a potion│      │  ⚒ ⚒ ⚒   │      │ items/item_potion.png│
  │  shop”   │ ───▶ │ hammer…  │ ───▶ │ shops/shop_potions…  │
  └──────────┘      │ hammer…  │      │ + a tidy spreadsheet │
                    └──────────┘      └──────────────────────┘
```

You give it a **list** of pictures you want (the list is called a *manifest* —
fancy word for "the shopping list"). The forge paints every picture on the
list, puts each one in the **right folder**, and ticks it off the list.

Some painters are **free forever** and need no account. Some need a free key
from Google. Some need money. You choose — always.

---

## Part 2 · Getting it running (do this once)

### Step 1 — Get Node.js (the engine the forge rides on)

1. Open your browser, go to **nodejs.org**
2. Click the big **green button** that says **LTS**
3. Open the file you downloaded. Click **Next → Next → Next → Install → Finish**
4. ✅ Check: press the **Windows key**, type `cmd`, press Enter.
   In the black box type `node -v` and press Enter.
   - You see a number like `v22.11.0`? **You're ready!** 🎉
   - It says *"not recognized"*? Close the black box, open a new one, try again.
     Still nothing? Reinstall Node.js and restart your computer.

### Step 2 — Put the forge folder somewhere simple

Like `C:\Games\image-forge`. **No spaces in the folder name!**
(`C:\My Games\image forge` = bad. `C:\Games\image-forge` = good.)

### Step 3 — Press play

**Double-click `start-forge.bat`** in the folder.

- First time: it downloads the parts (a few minutes — snack break 🍿)
- Then a black box appears with a link like `http://localhost:5173`
- **Hold Ctrl and click the link** (or copy it into your browser)

🎉 **The forge is open.** To stop it: press `Ctrl + C` in the black box.
Next time it starts instantly — no snack break needed.

> Want a **real app icon** instead of the black box? Double-click
> **`make-installer.bat`**, wait, then install `release\Image Forge Setup.exe`
> like any game. More in `INSTALL.md`.

---

## Part 3 · Making your first pictures (the fun part)

### Step 1 — Click **Wizards → Start wizard**

The wizard asks you **one question at a time**. There are no wrong answers.

| step | the question | what to do |
|---|---|---|
| 1 | What's this batch called? | Anything — “My shop fronts” |
| 2 | What world are we in? | 🏰 D&D, 🤖 cyberpunk, 🌿 cottagecore… or **Generic** |
| 3 | Which pictures do you want? | 👇 see below |
| 4 | What should they look like? | Claymation is the cozy one. Click a few to compare |
| 5 | Who paints them? | **“Free art (FLUX)”** = free, no key, real AI art ✨ |
| 6 | What shape? | “Match the picture” does the thinking for you |
| 7 | Where do files go? | On = the forge saves files into a folder for you |
| 8 | Any extras? | Skip both, that's fine |
| 9 | Ready! | Read the list, press the green button |

### Step 2 — The picture list (step 3), three ways

1. **Let the AI write it** — type a theme like “a harbour town”, press
   *Generate ideas*, and poof: a whole list with names, prompts, and
   "please don't draw this" notes already filled in. *(Works free, no key.)*
2. **Paste a list** — if you already have ideas, paste them as
   `filename | prompt` lines.
3. **Upload a CSV file** — a spreadsheet with columns
   `filename, prompt, category` (and more if you like).

### Step 3 — Watch it work

Back on the workbench, press **Run queue** (the orange button). Each row goes:

```
pending ──▶ generating ──▶ done ✅      (happy path)
                 │
                 └────▶ failed ❌        (click the row, fix, retry)
```

The little console at the bottom tells you what's happening, like a
sportscaster. ⚒

---

## Part 4 · Where do my pictures go? (very important!)

The pictures **do not float in the internet**. They go to your computer. Pick
one or more doors:

### 🚪 Door 1 — A folder on your computer (best)

Click the **folder button** at the top → choose a folder → done.
Now every finished picture **automatically** appears inside it:

```
My Pictures\forge-output\
   ├── shops\     shop_blacksmith.png
   ├── items\     item_potion.png
   ├── events\    event_escaped_goat.png
   ├── npcs\      npc_city_guard.png
   └── marketplace-images.csv   (your list, kept fresh)
```

> 💡 **Cloud trick:** point this at your **Google Drive folder**. The forge
> writes files there, Drive uploads them. Free cloud backup, zero extra work.

### 🚪 Door 2 — A ZIP file (works everywhere)

Click **Download ZIP**. You get one file with all folders inside.
Send it to anyone. Works on any computer, any browser.

### 🚪 Door 3 — One picture at a time

Open any row → **Save PNG**. Good for checking a picture before keeping it.

---

## Part 5 · The Library (your pictures, organized)

Under the **Library** menu:

- **Every picture** — click 👍 or 👎. Don't like one? Write a note
  (*“make the goat angrier”*) and press **Redo** — your note becomes part of
  the new instructions automatically!
- **Visual styles** — the "looks" (clay, paper, shadows…). You can invent
  your own, even letting the text AI dream one up.
- **Saved recipes** — wizard setups you saved. Next batch: one click, done.
- **Previous batches** — every batch with a progress bar. Re-open any time.

---

## Part 6 · Free vs. keys vs. money

| painter | cost | key? | good for |
|---|---|---|---|
| Practice forge | free | none | testing, instant |
| FLUX / turbo | **free** | **none** | real AI art, a bit slow |
| Google Imagen | free (≈25/day) | free key from **aistudio.google.com** | top quality |
| OpenAI & friends | paid | your key | when free isn't enough |

**Keys are like library cards** — you can add several. When one runs out for
the day, the forge **automatically uses the next one**. You never think about it.

Put keys in **Settings → Image engines**. They stay on *your* computer only.

---

## Part 7 · "It's stuck!" — the fix-it page

| you see | you do |
|---|---|
| `node -v` not recognized | Reinstall Node.js, **restart computer**, try again |
| Black box closes instantly | Open `cmd` in the folder, type `npm install`, then `npm run dev` — read what it says |
| A row says **failed** | Click it. Read the little red note. Press *Generate* again — most fix themselves |
| A row says **resting 23h** | The free painter is tired for today. Wait, or add another Google key |
| "Link folder" does nothing | Your browser can't do folders (try Chrome/Edge) — **use the ZIP door** 🚪2 |
| Page looks broken | In the folder: `npm run build`, then start again |
| Everything is weird | Settings → **Advanced → Run repair**. It fixes the usual problems in one click |

---

## Part 8 · Grown-up extras (optional!)

- **Settings → Advanced** — repair, backup, reset, pull the list from GitHub,
  check for a newer version, uninstall properly.
- **Let robots drive it** — the forge has an **MCP server** (`scripts/mcp-server.js`).
  Claude Code, Hermes, or n8n can add ideas and generate pictures all by
  themselves. One line to connect: `claude mcp add image-forge node scripts/mcp-server.js`
- **The marketplace** — click the little **⚜ fair** up top to visit Emberfair,
  the night market these pictures were born for.
- **More big-kid docs** — `HANDOFF.md` (for coders), `INSTALL.md`,
  `WINDOWS-EXE.md`, `TAURI.md`.

---

## The whole thing on one page

```
1. install Node.js (green button, nodejs.org)
2. double-click start-forge.bat
3. Wizards → Start wizard → answer 9 easy questions
4. press Run queue ⚒
5. find your pictures in your folder (or the ZIP)
6. thumbs-up the good ones, redo the rest with a note
```

That's the entire app. You already know it. ⚒
