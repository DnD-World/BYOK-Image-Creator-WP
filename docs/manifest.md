---
title: The manifest
nav_order: 8
---

# The manifest

The manifest is a CSV. One row is one picture. It is the contract between you,
the app, and anything else you point at it — and it is deliberately plain
enough that a spreadsheet, a Python script or an agent can all be equal
participants.

```csv
id,filename,prompt,category,aspect_ratio,seed,model,status
1,shop_cyber_noodle_bar.png,"rain-slick noodle stall, neon steam",shop,16:9,41,cloudflare-flux,pending
```

**`filename` is the only column you must supply.** Everything else has a
sensible default, and import forgives whatever is missing — a two-column CSV
of `filename,prompt` is a perfectly valid manifest.

---

## Every column

| Column | Meaning |
|---|---|
| `id` | Row number. Assigned for you; you can ignore it. |
| **`filename`** | **Required.** The output file. Seven rules, enforced live — see below. |
| `prompt` | What to paint. |
| `negative_prompt` | What to avoid. Auto-filled per world flavour if you leave it blank. |
| `note` | Your "make it better" instruction. Folded into the prompt on a redo. |
| `category` | `shop` · `item` · `event` · `npc`. Decides the output subfolder. |
| `kind` | World flavour (12 of them). Seasons the prompt and tags the filename. |
| `rating` | `like` / `dislike`, set from the image library. |
| `item_id` `shop_id` `event_id` | Foreign keys back into *your* database. The app never touches them. |
| `style` | Which of the 34 visual styles to apply. |
| `aspect_ratio` | `16:9`, `1:1`, `9:16`, `4:5`… |
| `width` `height` | Derived from the aspect ratio. Written on export for convenience. |
| `seed` | Makes randomness repeatable. Same prompt + same seed = same picture. |
| `model` | **The engine for this row.** Blank means "use the default in Settings". |
| `status` | `pending` → `generating` → `done` → `imported`, plus `failed` and `skipped`. |
| `error` | Why it failed, in plain words. |
| `generated_at` | ISO timestamp of the successful strike. |
| `imported_attachment_id` | Filled by the WordPress import step, if you use it. |

---

## The seven filename rules

Enforced as you type, each with a one-click fix. They exist so that a hundred
files stay findable a month later.

1. **lowercase only**
2. **no spaces**
3. **no special characters**
4. **words joined with underscores** (no doubled `__` or `--`)
5. **starts with the category** — `shop_`, `item_`, `event_`, `npc_`
6. **ends with `.png`**
7. **unique across the manifest**

`shop_cyber_noodle_bar.png` passes. `Shop Cyber Noodle Bar.PNG` fails five of
them, and the Fix button repairs all five at once.

---

## The status lifecycle

```
pending ──▶ generating ──▶ done ──▶ imported
   ▲             │
   │             ├──▶ failed    (retryable on its own)
   └─────────────┴──▶ skipped
```

- **pending** — queued. `Forge` picks these up.
- **generating** — in flight right now.
- **done** — the image exists. If a linked folder is set, it is on disk.
- **failed** — something went wrong; `error` says what. Retry just these.
- **imported** — handed off to your own system.
- **skipped** — deliberately passed over.

A row that hits a daily quota is parked with a `retry_at` and re-queues itself
once the cooldown expires.

---

## Per-row engine routing

The `model` column is what makes one batch able to mix free and paid work:

```csv
filename,prompt,model
shop_bakery.png,a village bakery,cloudflare-flux
shop_sign.png,a shop sign reading OPEN,nano-banana-2-lite
npc_baker.png,the baker,
```

Row one goes to Cloudflare (free). Row two needs real lettering, so it goes to
a model that can spell — and the app will ask before spending. Row three is
blank, so it uses whatever Settings says.

A row's `model` always beats the app default, and beats the MCP server's
environment variables too.

---

## Working with it from outside

It is [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) CSV. Nothing exotic:
quoted fields, doubled quotes for a literal quote, `\r\n` or `\n` line endings
both accepted.

```python
import csv

with open("marketplace-images.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

# queue everything that has no picture yet
for r in rows:
    if not r["generated_at"]:
        r["status"] = "pending"
```

Write it back, open the app, press Forge. That is a complete integration with
no API involved.

> A test called `csv-parity` pins that the app and the MCP server read and
> write this file identically. Without it, an agent and a human working on the
> same manifest would slowly corrupt each other's rows.

---

## Export

**CSV** — the same format, round-trips exactly.
**XLSX** — for handing to someone who wants a spreadsheet.
**ZIP** — the images in their folder structure, with the CSV inside.

The app can also keep `marketplace-images.csv` refreshed in your linked folder
automatically after every run, which is on by default.
