---
title: If you make content
nav_order: 6
---

# If you make content

Sprite sheets, talking-avatar mouth shapes, GIFs from a single still, and text
that sits *on* a surface instead of floating over it.

All of it works on the free engines. None of it needs a card.

---

## Sheets

A sheet is a set of frames that belong together — same character, same light,
same style, one thing changed per frame. Getting that consistency by hand is
the tedious part, and it is what this automates.

Every frame gets **its own seed** and an explicit *"change ONLY this"*
instruction, which is what stops the model quietly redesigning your character
between frames.

| Sheet | Frames | What it is for |
|---|---|---|
| **Walk cycle** | 8 | contact · down · pass · up, then the same four on the other foot — the classic animation cycle |
| **Action set** | your choice | idle, run, jump, attack, hurt — whatever your game needs |
| **Turnaround** | 8 | the same character from every angle, for modelling or reference |
| **Visemes** | 10 | mouth shapes for a talking avatar — see below |
| **Expressions** | your choice | happy, angry, surprised, tired… one face, many moods |

Pick a sheet, describe the character once, press go. Frames arrive as separate
rows in the manifest, so you can redo any single one that comes out wrong
without touching the rest.

---

## Talking avatars: the ten mouth shapes

A face does not need a different mouth for all 26 letters. Animation has used
about ten shapes — **visemes** — for a century, because that is genuinely all
the eye needs:

| Shape | Sounds |
|---|---|
| rest | silence |
| A · I | "father", "I" |
| E | "bed" |
| O | "go" |
| U · W · Q | "you" |
| M · B · P | lips pressed shut |
| F · V | teeth on the lower lip |
| L | tongue behind the top teeth |
| C D K N S T | teeth nearly together |
| TH | tongue between the teeth |

Generate the sheet once and you can make that character say **anything**.

Better still: type a line of dialogue and the app works out the shape order
and the timing for you (about 90 ms a shape by default), then hands you the
strip. Feed that to whatever you animate in — or straight into the video maker.

---

## GIFs

Two ways in.

**From a picture you already made.** Any finished row has *"turn into a GIF"*.
You get camera motion — push in, pull out, pan, drift, a slow tilt — computed
from the single still. No second generation, so it costs nothing even on a
paid engine.

**From a description.** Say what you want to happen. Your text model turns
that into a motion plan, and the plan drives the frames.

Encoding is local (`gifenc`), so the GIF never leaves your machine.

> **Why camera motion rather than new frames?** Asking an image model for
> twenty frames of the same scene gets you twenty *slightly different scenes*.
> Moving a virtual camera over one real image gives motion that is actually
> coherent — and it is instant and free.

---

## Text that sits on the surface

If you have ever put text in PowerPoint, dragged the corner handles until it
looked like it belonged on the wall, and screenshotted the result — this is
that, done properly.

Drop a text layer on any image and drag **all four corners independently**.
It is a real projective warp (a homography), not a skew, so text lands on a
signboard, a wall, a banner or a book cover and looks like it was painted
there.

Practical bits:

- **Real fonts.** The text is typed, not generated, so it is spelled correctly
  every time. This is the reliable way to get words into a picture.
- **It shrinks to fit.** Long lines auto-size rather than getting clipped.
- **Find a quiet spot** — free, instant, no model. Picks the calmest patch of
  the image and puts the box there.
- **Ask a model where it goes** — say *"put it on the hanging sign"* and a
  vision model finds the actual sign and returns its four corners. You then
  nudge them. The model gets you most of the way; you correct the rest.

If no vision model is set up, the free quiet-spot finder covers you. Nothing
breaks.

**[→ Setting up a free vision model](no-code.md)** — one Mistral key, no card.

---

## Vectors

Vectors are **code**, not pictures, so an image model cannot make them. A code
model can:

- **SVG icon** — flat, single-subject, scales to any size
- **SVG illustration** — a fuller scene
- **Lottie** — JSON animation for web and app UI

Everything generated is **sanitised** before it is shown or saved: scripts,
event handlers, embedded objects and external references are stripped out. A
model that emits an SVG containing a script gets that script removed rather
than run.

Codestral is free and made for this. Same key as everything else.

---

## Practical notes

**Getting a consistent character across many pictures.** Fix the seed and keep
the description word-for-word identical. Change one thing at a time. A sheet
does this for you automatically; for loose pictures you have to be disciplined.

**Words inside a picture.** Most image models cannot spell. Two honest options:
use a Nano Banana model, which can, or add the words yourself with the
Letterer, which always can. Infographic and poster styles are deliberately
restricted to the models that can really do them, so you cannot spend money
finding out.

**Aspect ratios.** Set per row. `16:9` for video, `9:16` for shorts and
stories, `1:1` for square, `4:5` for feed posts.

**Bulk.** The whole point. Sixty thumbnails in sixty rows, all named properly,
sorted into folders, with a CSV of what happened. That is a much better use of
this than making one picture.

---

## Where to go next

- [Start from nothing](no-code.md)
- [Let an agent run it](vibe-coding.md)
- [Every manifest column](manifest.md)
