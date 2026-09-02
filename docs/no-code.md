---
title: If you don't write code
nav_order: 3
---

# If you don't write code

This guide assumes nothing. If a word is unfamiliar, it gets explained the
first time it appears.

---

## What this app actually is

You write a list of pictures you want, one per line, in something that looks
like a spreadsheet. You press a button. It makes them all and puts them in a
folder with tidy names.

That is the whole idea. Everything else is a convenience on top of it.

**It is not a chatbot.** You are not having a conversation. You are filling in
a list and pressing go.

---

## Words you will meet

**API key** — a long password that lets this app use somebody else's picture
machine on your behalf. You get one from the company that runs the machine. It
is free to get one from several of them. Treat it like a password: anyone who
has it can spend your allowance.

**Engine** — the company or program that actually draws the picture.
Cloudflare, Google and Pollinations are engines. So is your own computer.

**Model** — a specific painter inside an engine. Different models have
different strengths and prices.

**Manifest** — the spreadsheet. One row per picture.

**Prompt** — the sentence describing what you want drawn.

**Seed** — a number that makes randomness repeatable. Same prompt plus same
seed gives you the same picture again. Change the seed to get a different take
on the same idea.

---

## Try it with nothing at all

Before signing up for anything, use the **practice forge**.

1. **⚙ Settings → Image engines**
2. Set the engine to **practice forge**
3. Close settings, add a few rows, press **Forge**

It draws small scenes on your own computer, instantly, free, forever. They are
not AI pictures — they are simple generated illustrations — but everything
else in the app behaves exactly as it will with a real engine. It is the
safest way to learn where the buttons are.

---

## Getting a free engine {#cloudflare}

**Cloudflare Workers AI** is the best free starting point: about **690 images
a day**, no credit card, and reasonably fast.

### Step 1 — make a Cloudflare account

Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and
sign up. Email and password. You do not need a domain name and you do not need
to enter a card.

### Step 2 — find your Account ID

Once you are signed in, look at the address bar. The URL looks like:

```
https://dash.cloudflare.com/abc123def456.../home
```

That long string of letters and numbers after `.com/` **is your Account ID**.
Copy it.

You can also find it under **Workers & Pages** in the left menu — it is
displayed on the right-hand side.

### Step 3 — make an API token

1. Click your profile icon (top right) → **Profile**
2. Left menu → **API Tokens**
3. **Create Token**
4. Scroll to the bottom and choose **Create Custom Token → Get started**
5. Give it a name, e.g. `image forge`
6. Under **Permissions**, set the three dropdowns to:
   **Account** · **Workers AI** · **Read**
7. **Continue to summary** → **Create Token**

The token appears **once**. Copy it now — Cloudflare will not show it again.
If you lose it, delete that token and make another; nothing bad happens.

### Step 4 — put both into the app

**⚙ Settings → Image engines → Cloudflare Workers AI.** Paste the Account ID
into the first box and the token into the second.

Then press **Test**. You want it to say it worked. If it does not, the message
tells you which of the two is wrong.

---

## Your first real batch

1. **Manifest** tab → **Add row**
2. In **filename**, type something like `shop_bakery.png`

   The app enforces naming rules as you type — lowercase, underscores instead
   of spaces, a category at the front, ending in `.png`. If you get it wrong
   it tells you and offers a **Fix** button. Let it fix things; the rules exist
   so a hundred files stay findable.

3. In **prompt**, describe the picture: *"a warm village bakery at dawn,
   bread in the window, soft morning light"*
4. Set **model** to `cloudflare-flux`
5. Press **Forge**

The row goes yellow, then shows a thumbnail. Click it to see it full size.

---

## Keeping the pictures

By default they live inside the app. To get them onto your disk, pick one:

**Link folder** *(best)* — **Link folder** button, choose a folder, and every
picture from then on is written there automatically as it finishes, sorted into
`shops/ items/ events/ npcs/`.

> **Free cloud backup:** point it at your OneDrive or Google Drive folder.
> Everything syncs itself with no extra work.

**Download ZIP** — one file with all the pictures, the folder structure, and
the CSV inside.

**Save PNG** — one picture at a time, from the row menu.

---

## About money

**You cannot spend money by accident.** Free engines never ask, because there
is nothing to ask about. A paid engine always stops and shows you a dialog
first:

> *12 pictures on Nano Banana 2 Lite — about $0.41 (about $0.034 each)*
> *Coming out of "tier 1 voucher", which lasts until 2026-09-21 (19 days).*

You press **OK, spend it** or **Use a free engine instead**. Nothing is spent
until you press the first one.

---

## When it goes wrong

**"Every key is resting"** — you used up the daily allowance. The rows park
themselves and try again automatically when the allowance resets. Or switch to
a different engine and press Forge again.

**"The key is valid, but its project has no credit"** — the key is fine; the
account behind it has no money on it. This is very common with Google.
[The full explanation is here](troubleshooting.md).

**A picture came out wrong** — open the row menu and press **Redo with a
note**. Type what was wrong in plain words — *"too dark, and she should be
facing left"* — and the app folds your note into a new prompt.

**Text in the picture is gibberish** — most image models cannot spell. Use a
Nano Banana model for anything with real words in it, or add the text yourself
afterwards with the **Letterer**, which uses actual fonts.

---

## Where to go next

- [Make sprite sheets, GIFs and talking avatars](creators.md)
- [Every column in the manifest, explained](manifest.md)
- [When something is broken](troubleshooting.md)
