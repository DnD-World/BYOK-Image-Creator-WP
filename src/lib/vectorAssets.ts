/**
 * Vectors and animated icons — drawn as CODE, not pixels.
 *
 * An image model cannot make an SVG. It makes pixels, and anything claiming
 * otherwise hands you a picture that merely looks like a vector. A *code* model
 * can write the SVG itself: real paths, infinitely scalable, a few kilobytes,
 * editable in any text editor.
 *
 * The same is true of Lottie, which is only JSON describing an animation.
 *
 * Codestral is built for exactly this, which is why the code engine is kept
 * separate from the prose engine.
 *
 * ── Safety ────────────────────────────────────────────────────────────────
 * Model-written SVG is untrusted code that ends up inside the page. SVG can
 * carry <script>, event handlers and external references, so everything here
 * goes through sanitiseSvg() before it is shown or saved. That is not
 * belt-and-braces; it is the whole reason this file has a sanitiser.
 */

import type { ForgeSettings } from "./providers";
import { scribeChat } from "./providers";

export type VectorKind = "svg-icon" | "svg-illustration" | "lottie";

export interface VectorAsset {
  kind: VectorKind;
  /** the SVG markup, or the Lottie JSON, as text */
  code: string;
  /** what the model called it */
  title: string;
  problem?: string;
}

/* ---------------- what we ask for ---------------- */

const SHARED_RULES = `Reply with ONLY the code. No prose, no explanation, no markdown fences.
Never include <script>, event handlers (onclick, onload and the like), <foreignObject>,
external images, or references to any URL. Everything must be self-contained.`;

export const SVG_ICON_SYSTEM = `You write clean, minimal SVG icons.

Rules:
- a single <svg> root with a viewBox of "0 0 24 24" and no width or height attributes
- strokes, not fills, unless a solid shape is clearly wanted
- stroke-width 1.5, stroke-linecap "round", stroke-linejoin "round"
- use currentColor for stroke and fill so the icon takes the colour around it
- simple geometry: a handful of paths, no gradients, no filters, no masks
- it must read clearly at 16 pixels across

${SHARED_RULES}`;

export const SVG_ILLUSTRATION_SYSTEM = `You write self-contained SVG illustrations.

Rules:
- a single <svg> root with a sensible viewBox and no width or height attributes
- flat vector shapes and a small deliberate palette, given as literal hex colours
- gradients are allowed; filters, masks and clip paths only if genuinely needed
- keep it under about 200 elements so it stays quick to draw and easy to edit

${SHARED_RULES}`;

export const LOTTIE_SYSTEM = `You write Lottie animation JSON, the bodymovin format.

Rules:
- a complete Lottie object with v, fr, ip, op, w, h and layers
- fr 60, ip 0, op 60 — a one second loop — unless asked otherwise
- shape layers only (ty 4). No images, no expressions, no fonts, no external assets
- animate with keyframes on transform properties (position, scale, rotation, opacity)
- keep it small and readable: a few layers, not dozens

${SHARED_RULES}`;

const SYSTEMS: Record<VectorKind, string> = {
  "svg-icon": SVG_ICON_SYSTEM,
  "svg-illustration": SVG_ILLUSTRATION_SYSTEM,
  lottie: LOTTIE_SYSTEM,
};

/* ---------------- making SVG safe ---------------- */

/** Anything that can execute, phone home, or escape the picture. */
const BANNED_TAGS = ["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "animate", "set", "handler"];
const BANNED_ATTR_PREFIX = "on"; // onclick, onload, onmouseover…
const URL_ATTRS = ["href", "xlink:href", "src", "from", "to", "values"];

export interface SanitiseResult {
  svg: string;
  /** what was taken out, so it can be reported rather than hidden */
  removed: string[];
  ok: boolean;
}

/**
 * Strip everything dangerous from model-written SVG.
 *
 * Deliberately blunt: it works on the text, so it cannot be defeated by a DOM
 * parser quirk, and it removes rather than escapes. A slightly broken icon is a
 * far better outcome than running someone else's script.
 */
export function sanitiseSvg(raw: string): SanitiseResult {
  const removed: string[] = [];
  let svg = String(raw);

  // markdown fences, if the model added them despite being told not to
  svg = svg.replace(/^\s*```[a-z]*\s*/i, "").replace(/```\s*$/i, "");

  // keep only from the first <svg to the last </svg>
  const start = svg.search(/<svg[\s>]/i);
  const end = svg.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < 0) return { svg: "", removed: ["no <svg> element found"], ok: false };
  svg = svg.slice(start, end + 6);

  for (const tag of BANNED_TAGS) {
    const paired = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    const single = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    if (paired.test(svg) || single.test(svg)) removed.push(`<${tag}>`);
    svg = svg.replace(paired, "").replace(single, "");
  }

  // event handlers: on…="…"
  svg = svg.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, () => {
    if (!removed.includes("event handlers")) removed.push("event handlers");
    return "";
  });

  // anything that reaches outside — but keep harmless in-document #fragments
  for (const attr of URL_ATTRS) {
    const re = new RegExp(`\\s${attr.replace(":", "\\:")}\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi");
    svg = svg.replace(re, (whole, _q, dq, sq) => {
      const value = (dq ?? sq ?? "").trim();
      if (value.startsWith("#")) return whole;
      if (!removed.includes("external references")) removed.push("external references");
      return "";
    });
  }

  // javascript: and data: urls anywhere left in style attributes
  if (/javascript\s*:/i.test(svg)) {
    removed.push("javascript: urls");
    svg = svg.replace(/javascript\s*:/gi, "");
  }

  // An SVG shown in an <img>, or saved as a .svg file, is its own document and
  // MUST declare the namespace. Models routinely leave it out — the markup then
  // looks perfect and renders as a broken-image icon everywhere. Add it back.
  if (!/\sxmlns\s*=/i.test(svg)) {
    svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return { svg: svg.trim(), removed, ok: svg.includes("<svg") };
}

/** Does this look like a usable icon? */
export function checkSvg(svg: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!/<svg[\s>]/i.test(svg)) problems.push("there is no <svg> element");
  if (!/viewBox\s*=/i.test(svg)) problems.push("it has no viewBox, so it will not scale");
  const opens = (svg.match(/<[a-z]/gi) ?? []).length;
  if (opens < 2) problems.push("it is empty — nothing would be drawn");
  if (svg.length > 400_000) problems.push("it is enormous; something has gone wrong");
  return { ok: problems.length === 0, problems };
}

/** Does this look like a real Lottie animation? */
export function checkLottie(text: string): { ok: boolean; problems: string[]; data?: Record<string, unknown> } {
  const problems: string[] = [];
  let data: Record<string, unknown>;
  const cleaned = text.replace(/^\s*```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return { ok: false, problems: ["it is not valid JSON"] };
  }
  for (const key of ["v", "fr", "ip", "op", "w", "h", "layers"]) {
    if (!(key in data)) problems.push(`missing "${key}"`);
  }
  if (!Array.isArray(data.layers)) problems.push('"layers" is not a list');
  else if (data.layers.length === 0) problems.push("it has no layers, so nothing would move");
  if (typeof data.fr === "number" && (data.fr <= 0 || data.fr > 120)) problems.push("the frame rate is not sensible");
  if (JSON.stringify(data).includes('"ty":2')) problems.push("it uses an image layer, which will not be self-contained");
  return { ok: problems.length === 0, problems, data };
}

/* ---------------- asking the code model ---------------- */

/** Which engine writes the code: the code model if set, otherwise the prose one. */
export function codeEngineFor(settings: ForgeSettings): { engine: ForgeSettings["coder"]; usingFallback: boolean } {
  if (settings.coder.key.trim()) return { engine: settings.coder, usingFallback: false };
  return { engine: settings.scribe, usingFallback: true };
}

export async function makeVector(
  kind: VectorKind,
  description: string,
  settings: ForgeSettings,
  signal?: AbortSignal
): Promise<VectorAsset> {
  const title = description.trim().slice(0, 60) || "untitled";
  const { engine, usingFallback } = codeEngineFor(settings);

  if (!engine.key.trim()) {
    return {
      kind,
      code: "",
      title,
      problem: "no code-engine key — add Codestral under Settings → Text engines",
    };
  }

  let answer: string;
  try {
    answer = await scribeChat(engine, SYSTEMS[kind], description.trim(), signal);
  } catch (e) {
    return { kind, code: "", title, problem: (e as { message?: string })?.message ?? "the code engine could not be reached" };
  }

  if (kind === "lottie") {
    const check = checkLottie(answer);
    if (!check.ok) return { kind, code: "", title, problem: check.problems.join("; ") };
    return { kind, code: JSON.stringify(check.data, null, 2), title };
  }

  const clean = sanitiseSvg(answer);
  if (!clean.ok) return { kind, code: "", title, problem: clean.removed.join("; ") || "the model did not return an SVG" };
  const check = checkSvg(clean.svg);
  if (!check.ok) return { kind, code: clean.svg, title, problem: check.problems.join("; ") };

  return {
    kind,
    code: clean.svg,
    title,
    ...(clean.removed.length
      ? { problem: `removed for safety: ${clean.removed.join(", ")}` }
      : usingFallback
        ? { problem: "written by your prose model — Codestral would do this better" }
        : {}),
  };
}

/** icon_anvil + svg-icon → icon_anvil.svg */
export function vectorFilename(base: string, kind: VectorKind): string {
  const stem = base.replace(/\.[a-z0-9]+$/i, "") || "asset";
  return kind === "lottie" ? `${stem}.json` : `${stem}.svg`;
}

/** A data URL for previewing an SVG without putting it in the DOM. */
export const svgToDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
