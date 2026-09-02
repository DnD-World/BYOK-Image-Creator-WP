---
title: Troubleshooting
nav_order: 7
---

# Troubleshooting

Every entry here is something that actually happened, with the cause that was
actually found — not a guess at what might go wrong.

---

## Google

### "Your prepayment credits are depleted" — but there is money in the account

**This is the one that costs people an evening.** Linking your project to
Google Cloud billing is what *causes* it.

In order:

1. A new project is on the **free tier**. It works.
2. You link it to a Cloud billing account — to use a voucher, to use trial
   credit, or because something told you to.
3. Google now marks the project **paid tier**.
4. Paid tier bills against a separate balance called **Prepay – AI Studio**.
5. Ordinary Google Cloud credit does not fund that balance. Neither does free
   trial credit, and nor do most vouchers.
6. The balance is therefore zero, and every request is refused with a `429`.

The result is a project holding hundreds of euros of Cloud credit that cannot
make a single call — *because* of the money.

**Two fixes, and you have to pick one:**

| You want | Do this |
|---|---|
| The free tier back | **Unlink the project** from its billing account at [console.cloud.google.com/billing](https://console.cloud.google.com/billing) |
| To actually pay | Add a **Prepay – AI Studio** balance at [ai.studio/projects](https://ai.studio/projects) |

What does *not* work is being linked to billing with only Cloud credit. That
is the trap.

> Confirmed on a real account: a project with €262 of Cloud credit refused
> every call on every model, on both `v1` and `v1beta`, and on the
> OpenAI-compatible endpoint. Unlinking restored it.

### "Your project has been denied access. Please contact support." (403)

A different problem that looks the same from the outside. This is a
**project-level block**, not a billing state. More credit will not fix it, and
neither will unlinking.

Verified **not** to be a browser or CORS problem: the same key fails
identically through a server-side proxy, so it is not about where the request
came from.

**What to do:** make a key in a fresh project, or take it up with Google.
There is nothing to change on your side.

### A key lists 50 models and then refuses everything

Expected, and the reason the app's key check makes a **real generation call**
rather than listing models. Listing is free and unauthenticated enough to
succeed on a key that can do nothing else. Any tool that "validates" your key
by listing models is telling you nothing.

### Model names that a chatbot suggested do not exist

Be careful taking model names from an AI's memory — including Google's own.
On a live account today, `gemini-1.5-flash`, `gemini-1.5-pro` and
`gemini-2.5-flash` all return:

> `404 — This model is no longer available to new users.`

Press **Load models** in Settings and use what your key actually lists. That
list is generated from your key, so it cannot be out of date.

---

## Cloudflare

### "Could not reach Cloudflare"

Almost never your internet. Cloudflare's API sends **no CORS headers at all**,
so a browser refuses the request before it leaves the page — with or without a
key, even unauthenticated.

The app proxies around this in both the dev server and the desktop build. If
you are seeing this, the proxy is not running: use `npm run dev` rather than
opening the built HTML directly, or use the desktop build.

### Every Cloudflare image fails at once

If a request includes `seed`, `flux-1-schnell` rejects the **whole request**:

> `Additional or unevaluated properties 'seed' at '/' not allowed`

Cloudflare's own model page lists `seed` as a parameter. It does not work.
The app does not send it. Confirmed against a live account on 2026-09-02.

### 403 on a Cloudflare token

The token needs **Account → Workers AI → Read**. A token with other
permissions authenticates fine and then refuses to run models.

---

## Pollinations

### "Missing Turnstile token"

Pollinations stopped serving anonymous requests. A free token from
`auth.pollinations.ai` fixes it, and removes the watermark as a bonus.

---

## Vision and lettering

### "That model cannot look at pictures"

The model answered but is text-only. Press **Load models** and pick one that
can see. The app's vision check sends a real image — a solid red square — and
asks what colour it is, because a model that cannot read that will not find a
signboard either.

### Pixtral returns 404

`pixtral-large-latest` is not on Mistral's model list any more (checked
2026-09-02). Use **`mistral-medium-latest`**, which is multimodal and free on
Mistral's tier. This is exactly why the model field is free text with a
**Load models** button rather than a fixed dropdown.

### The lettering lands in the wrong place

It is meant to be corrected. The model proposes, you drag. If there is no
vision model configured, the free **Find a quiet spot** finder places the box
in the calmest part of the image and you take it from there.

---

## The app

### Windows says "Windows protected your PC"

Expected. The app is not signed with a paid code-signing certificate. Click
**More info**, then **Run anyway**. Once only.

If you would rather not run unsigned software — a reasonable position — run it
from source instead.

### A picture was made but the row says failed

Fixed. This used to happen when the image generated fine but writing it to
your linked folder failed — disk full, folder moved, permission withdrawn.
The row now stays **done** and a separate message says the writing is what
went wrong, because on a paid engine "failed" invites paying for it twice.

### The app is stuck on "forging" with only a Stop button

Fixed. An error thrown outside the per-picture handler used to leave the run
flag set forever, with a reload the only way out. The flag is now cleared in a
`finally`, and the error is reported.

### Text in a picture is gibberish

Most image models cannot spell. Either use a Nano Banana model, or add the
words with the **Letterer**, which uses real fonts and is therefore always
spelled correctly.

The app suppresses text instructions on models known to produce gibberish, so
you get a clean picture rather than invented lettering.

### "Every key is resting"

The whole pool hit its limit. Rows park themselves and re-queue automatically
when the cooldown expires. Or switch engines and press Forge again.

### One of my keys is a duplicate

The key check fingerprints each key and names any that appear twice. Easy
mistake, and it quietly halves an allowance you thought you had.

---

## Still stuck

[Open an issue](https://github.com/Stravelakis/image-forge/issues).
Include what you pressed and what it said. "The button did nothing" is a
perfectly good bug report.

**Never paste an API key into an issue.** If a key seems to be the problem,
the key check in Settings will describe it without revealing it.
