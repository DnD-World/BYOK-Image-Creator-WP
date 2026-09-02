/**
 * Sheets — many frames of the SAME character.
 *
 * Two ways to build one, because they fail in opposite directions:
 *
 *   "one shot"    ask for the whole grid in a single picture. Fast and cheap,
 *                 but the model decides the layout, frames drift in size, and
 *                 you cannot use any one frame on its own.
 *
 *   "from a reference"  make the character once, then edit that same picture
 *                 into each pose. Slower — one generation per frame — but the
 *                 character actually stays the same, and every frame is a
 *                 separate usable image.
 *
 * The second only works on engines that accept a reference picture: a model on
 * your own machine, or Google. Verified on 2026-09-02 against LocalAI with
 * flux.2-klein-4b — the same scene came back with only the asked-for change.
 */

export type SheetKind = "sprite-walk" | "sprite-actions" | "turnaround" | "visemes" | "expressions";

export interface SheetFrame {
  /** short name, used for the file and the label under the frame */
  id: string;
  /** what to ask for, appended to the character description */
  direction: string;
  /** shown in the UI */
  label: string;
}

export interface SheetDef {
  kind: SheetKind;
  label: string;
  blurb: string;
  /** sensible grid, columns first */
  columns: number;
  frames: SheetFrame[];
  /** wording added to every frame, to keep the set consistent */
  common: string;
  negative: string;
}

/* The classic ten mouth shapes animators use. Grouping sounds that look the
   same is the whole trick — "b", "m" and "p" are one drawing, not three. */
const VISEMES: SheetFrame[] = [
  { id: "rest", direction: "mouth closed and relaxed, neutral resting expression", label: "rest / silence" },
  { id: "ai", direction: "mouth open wide in an 'ah' shape, as in 'father' or 'I'", label: "A · I" },
  { id: "e", direction: "mouth open in a wide flat 'eh' shape, corners pulled slightly back, as in 'bed'", label: "E" },
  { id: "o", direction: "lips rounded into an 'oh' shape, as in 'go'", label: "O" },
  { id: "u", direction: "lips pushed forward and tightly rounded, as in 'you'", label: "U · W · Q" },
  { id: "mbp", direction: "lips pressed firmly together and closed, as when saying 'm', 'b' or 'p'", label: "M · B · P" },
  { id: "fv", direction: "top teeth resting on the lower lip, as when saying 'f' or 'v'", label: "F · V" },
  { id: "l", direction: "mouth open with the tongue tip touching behind the top teeth, as when saying 'l'", label: "L" },
  { id: "etc", direction: "mouth slightly open with teeth nearly together, as when saying 'c', 'd', 'k', 'n', 's' or 't'", label: "C · D · K · N · S · T" },
  { id: "th", direction: "mouth slightly open with the tongue tip visible between the teeth, as when saying 'th'", label: "TH" },
];

const WALK: SheetFrame[] = [
  { id: "01_contact", direction: "mid-stride, front foot just landing, arms swinging in opposition", label: "contact" },
  { id: "02_down", direction: "weight settling onto the front leg, body at its lowest, knee bent", label: "down" },
  { id: "03_pass", direction: "passing position, back leg swinging through beneath the body, legs together", label: "pass" },
  { id: "04_up", direction: "body at its highest, pushing off the back foot, straight supporting leg", label: "up" },
  { id: "05_contact_b", direction: "mid-stride with the opposite foot landing, arms swapped", label: "contact (other foot)" },
  { id: "06_down_b", direction: "weight settling onto the other leg, body low", label: "down (other foot)" },
  { id: "07_pass_b", direction: "passing position with the other leg swinging through", label: "pass (other foot)" },
  { id: "08_up_b", direction: "body high again, pushing off the other foot", label: "up (other foot)" },
];

const ACTIONS: SheetFrame[] = [
  { id: "idle", direction: "standing still and relaxed, arms at their sides", label: "idle" },
  { id: "walk", direction: "mid-stride walking, one leg forward", label: "walk" },
  { id: "run", direction: "running hard, leaning forward, both feet off the ground", label: "run" },
  { id: "jump", direction: "at the top of a jump, knees tucked", label: "jump" },
  { id: "attack", direction: "swinging forward in an attack, weight committed", label: "attack" },
  { id: "hurt", direction: "recoiling backwards after being hit", label: "hurt" },
  { id: "cast", direction: "arms raised, casting or reaching upward", label: "cast" },
  { id: "down", direction: "collapsed on the ground, defeated", label: "down" },
];

const TURNAROUND: SheetFrame[] = [
  { id: "front", direction: "facing directly towards the camera, front view", label: "front" },
  { id: "three_quarter", direction: "turned forty-five degrees, three-quarter view", label: "3/4" },
  { id: "side", direction: "in full profile, side view, facing right", label: "side" },
  { id: "back_three_quarter", direction: "turned away at forty-five degrees, rear three-quarter view", label: "rear 3/4" },
  { id: "back", direction: "facing directly away from the camera, back view", label: "back" },
];

const EXPRESSIONS: SheetFrame[] = [
  { id: "neutral", direction: "a calm neutral expression", label: "neutral" },
  { id: "happy", direction: "smiling broadly, eyes bright and creased", label: "happy" },
  { id: "sad", direction: "downturned mouth, brows raised in the middle, eyes lowered", label: "sad" },
  { id: "angry", direction: "brows drawn down and together, mouth set hard", label: "angry" },
  { id: "surprised", direction: "eyes wide, brows high, mouth open in an O", label: "surprised" },
  { id: "afraid", direction: "eyes wide and tense, mouth drawn back, shoulders raised", label: "afraid" },
];

/** Every frame in a set must be framed identically or the sheet is useless. */
const SPRITE_COMMON =
  "full body, whole figure visible, centred in frame, identical character design in every frame, " +
  "same clothing, same colours, same proportions, same scale, flat even lighting, plain solid background, side-on game sprite";

const FACE_COMMON =
  "head and shoulders only, facing the camera straight on, identical character in every frame, " +
  "same hair, same clothing, same colours, same head size and position, flat even lighting, plain solid background";

const SHEET_NEGATIVE =
  "multiple characters, cropped head, cropped limbs, changing outfit, changing hairstyle, inconsistent proportions, " +
  "busy background, scenery, text, letters, watermark, motion blur";

export const SHEET_DEFS: SheetDef[] = [
  {
    kind: "sprite-walk",
    label: "Walk cycle",
    blurb: "Eight frames of a walk, the classic contact / down / pass / up beats.",
    columns: 4,
    frames: WALK,
    common: SPRITE_COMMON,
    negative: SHEET_NEGATIVE,
  },
  {
    kind: "sprite-actions",
    label: "Action set",
    blurb: "Idle, walk, run, jump, attack, hurt, cast, down — a game character's basics.",
    columns: 4,
    frames: ACTIONS,
    common: SPRITE_COMMON,
    negative: SHEET_NEGATIVE,
  },
  {
    kind: "turnaround",
    label: "Turnaround",
    blurb: "The same character from five angles, for reference or modelling.",
    columns: 5,
    frames: TURNAROUND,
    common: SPRITE_COMMON,
    negative: SHEET_NEGATIVE,
  },
  {
    kind: "visemes",
    label: "Mouth shapes (visemes)",
    blurb: "Ten mouth shapes for lip-sync, so an avatar can appear to speak.",
    columns: 5,
    frames: VISEMES,
    common: FACE_COMMON,
    negative: SHEET_NEGATIVE,
  },
  {
    kind: "expressions",
    label: "Expressions",
    blurb: "Six faces — neutral, happy, sad, angry, surprised, afraid.",
    columns: 3,
    frames: EXPRESSIONS,
    common: FACE_COMMON,
    negative: SHEET_NEGATIVE,
  },
];

export const sheetByKind = (kind: SheetKind): SheetDef | undefined => SHEET_DEFS.find((s) => s.kind === kind);

/* ---------------- building the prompts ---------------- */

/** What each kind of sheet is allowed to change between frames. */
const CHANGE_ONLY: Record<SheetKind, string> = {
  "sprite-walk": "the pose of the body and limbs",
  "sprite-actions": "the pose of the body and limbs",
  turnaround: "which way the character is facing",
  visemes: "the shape of the mouth",
  expressions: "the expression on the face",
};

/**
 * The prompt for one frame, when working from a reference picture.
 *
 * "Change ONLY x" matters: without it the model often returns the reference
 * untouched, having decided that keeping the character the same was the whole
 * instruction. Seen on 2026-09-02 — an "oh" mouth came back identical to the
 * resting frame until the wording was made this blunt.
 */
export function framePrompt(def: SheetDef, frame: SheetFrame, character: string): string {
  const only = CHANGE_ONLY[def.kind];
  return (
    `Keep this exact character unchanged — same face, same clothing, same colours, same art style, ` +
    `same position and same size in the frame. Change ONLY ${only}: ${frame.direction}. ${def.common}.` +
    (character.trim() ? ` The character is: ${character.trim()}.` : "")
  );
}

/**
 * A different seed for every frame.
 *
 * Reusing the reference picture's seed pushes the model towards reproducing it
 * exactly, so the requested change quietly never happens. Giving each frame its
 * own seed fixes that while the reference picture keeps the character steady.
 */
export function seedForFrame(baseSeed: number, index: number): number {
  const s = Math.abs(Math.round(baseSeed) || 1);
  // spread the frames far apart rather than 1,2,3 — adjacent seeds look alike
  return ((s + (index + 1) * 7919) % 2147483646) + 1;
}

/** The prompt for the very first picture, which every frame is then based on. */
export function referencePrompt(def: SheetDef, character: string): string {
  const base = def.frames[0];
  return `${character.trim() || "a character"}, ${base.direction}, ${def.common}`;
}

/**
 * The prompt for the whole grid in a single picture.
 * Fast and cheap; the model decides the layout, so frames drift.
 */
export function oneShotPrompt(def: SheetDef, character: string): string {
  const rows = Math.ceil(def.frames.length / def.columns);
  const list = def.frames.map((f, i) => `${i + 1}. ${f.direction}`).join("; ");
  return (
    `A single ${def.columns} by ${rows} grid contact sheet showing the same character ${def.frames.length} times, ` +
    `evenly spaced, each cell the same size, no gaps and no borders. ` +
    `${character.trim() || "a character"}. ${def.common}. ` +
    `Reading left to right, top to bottom, the cells are: ${list}.`
  );
}

/** shop_hero.png + "walk" + frame → shop_hero_walk_03_pass.png */
export function frameFilename(base: string, kind: SheetKind, frameId: string): string {
  const stem = base.replace(/\.[a-z0-9]+$/i, "");
  return `${stem}_${kind.replace(/-/g, "_")}_${frameId}.png`;
}

export const sheetFilename = (base: string, kind: SheetKind): string =>
  `${base.replace(/\.[a-z0-9]+$/i, "")}_${kind.replace(/-/g, "_")}_sheet.png`;

/** How many pictures each way will cost you, in generations. */
export function frameCount(def: SheetDef, method: "one-shot" | "from-reference"): number {
  return method === "one-shot" ? 1 : def.frames.length + 1; // +1 for the reference itself
}

/* ---------------- laying the frames out ---------------- */

export interface SheetLayout {
  columns: number;
  rows: number;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
}

export function layoutFor(count: number, columns: number, cellW: number, cellH: number): SheetLayout {
  const cols = Math.max(1, Math.min(columns, count));
  const rows = Math.ceil(count / cols);
  return { columns: cols, rows, cellW, cellH, width: cols * cellW, height: rows * cellH };
}

/** Where frame `i` sits on the sheet. */
export function cellPosition(i: number, layout: SheetLayout): { x: number; y: number } {
  return {
    x: (i % layout.columns) * layout.cellW,
    y: Math.floor(i / layout.columns) * layout.cellH,
  };
}

/* ---------------- handing frames to the animator ---------------- */

/**
 * A sheet is a pile of frames; the GIF maker plays frames in order. This is the
 * join between them, so a finished set of mouth shapes or a walk cycle can be
 * played back without leaving the app.
 */
export interface FrameStrip {
  /** frame ids, in the order they should play */
  order: string[];
  /** milliseconds each frame is held */
  frameMs: number;
  /** should it run forwards then backwards? */
  pingPong: boolean;
  label: string;
}

/**
 * Sensible playback for each kind of sheet.
 *
 * A walk cycle loops straight through — going backwards would moonwalk. A
 * turnaround reads better out and back. Mouth shapes are not an animation at
 * all on their own: they are a palette that real speech picks from, so the
 * default here is a slow readable cycle for checking the set, not for lip-sync.
 */
export function stripFor(def: SheetDef): FrameStrip {
  const ids = def.frames.map((f) => f.id);
  switch (def.kind) {
    case "sprite-walk":
      return { order: ids, frameMs: 90, pingPong: false, label: "walk cycle, looping" };
    case "turnaround":
      return { order: ids, frameMs: 220, pingPong: true, label: "turning, out and back" };
    case "visemes":
      return { order: ids, frameMs: 260, pingPong: false, label: "every mouth shape in turn" };
    case "expressions":
      return { order: ids, frameMs: 500, pingPong: true, label: "each expression in turn" };
    default:
      return { order: ids, frameMs: 140, pingPong: false, label: "each frame in turn" };
  }
}

/**
 * Turn a line of text into the mouth shapes that would say it.
 *
 * Crude on purpose: it maps letters to visemes rather than doing real phonetics,
 * which is enough to make a face look like it is talking. Anything better needs
 * an actual phoneme aligner working from recorded audio.
 */
export function visemesForText(text: string, msPerShape = 90): FrameStrip {
  const order: string[] = [];
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);

  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      if ("aáà".includes(c) || c === "i") order.push("ai");
      else if (c === "e") order.push("e");
      else if (c === "o") order.push("o");
      else if (c === "u" || c === "w" || c === "q") order.push("u");
      else if ("mbp".includes(c)) order.push("mbp");
      else if ("fv".includes(c)) order.push("fv");
      else if (c === "l") order.push("l");
      else if (c === "t" && word[i + 1] === "h") {
        order.push("th");
        i++;
      } else if (/[a-z]/.test(c)) order.push("etc");
    }
    order.push("rest"); // a beat between words
  }

  if (!order.length) order.push("rest");
  return { order, frameMs: msPerShape, pingPong: false, label: `saying "${text.slice(0, 40)}"` };
}
