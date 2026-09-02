/**
 * Turning what the chat said into something safe to run.
 *
 * The model is asked to end a message with a FORGE: line carrying a style, a
 * model, a prompt and an aspect ratio. It is told which ids exist. It will
 * still, sometimes, invent one — that is not a failure to prompt harder, it is
 * what language models do, and the same thing that made a hard-coded
 * `pixtral-large-latest` into a 404 on a live account.
 *
 * So nothing here trusts the reply. Every field is checked against the real
 * catalogue, an unusable choice is corrected rather than passed through, and
 * the correction is reported so the user sees what actually happened instead
 * of quietly getting a different picture from the one they were promised.
 */

import { MODELS } from "./engines.mjs";
import type { ForgeSettings } from "./providers";
import type { AspectKey } from "../types";
import { availableModelsForStyle, defaultModelForStyle, styleById, STYLE_CATALOGUE } from "./styleCatalogue";

export interface ChatPlan {
  style: string;
  model: string;
  prompt: string;
  aspect: AspectKey;
}

export interface ParsedReply {
  /** what to show in the conversation, with the machine line removed */
  say: string;
  plan: ChatPlan | null;
  /** a whole list of pictures, when asked for many at once */
  rows: ChatPlan[] | null;
  /** anything we had to correct, in plain words, for the user to see */
  corrections: string[];
}

/** The only shapes the manifest accepts. Kept in step with AspectKey. */
const ASPECTS: AspectKey[] = ["16:9", "1:1", "9:16", "4:3"];
const FALLBACK_ASPECT: AspectKey = "16:9";

const liveModelIds = () => new Set(MODELS.map((m) => m.id));

/** The lists the model is allowed to choose from, rendered for the prompt. */
export const styleListForPrompt = (): string =>
  STYLE_CATALOGUE.map((s) => `${s.id} — ${s.name}: ${s.blurb}`).join("\n");

export const modelListForPrompt = (): string =>
  MODELS.map((m) => {
    const price = m.priceUsd === 0 || m.priceUsd === null ? "FREE" : `$${m.priceUsd.toFixed(3)}`;
    return `${m.id} — ${m.label} (${price})`;
  }).join("\n");

/**
 * Pull the FORGE line out of a reply and validate it.
 *
 * A reply with no FORGE line is perfectly normal — it means the model is still
 * asking a question, or answering one about the app.
 */
/** Check one proposal against the real catalogue. Never trusts a field. */
function validate(raw: Record<string, unknown>, settings: ForgeSettings, corrections: string[]): ChatPlan | null {
  const prompt = String(raw.prompt ?? "").trim();
  if (!prompt) return null;

  let style = String(raw.style ?? "").trim();
  let entry = styleById(style);
  if (!entry) {
    const invented = style;
    entry = STYLE_CATALOGUE[0];
    style = entry.id;
    corrections.push(
      invented
        ? `There is no style called "${invented}", so "${entry.name}" was used instead.`
        : `No style was chosen, so "${entry.name}" was used.`
    );
  }

  const askedAspect = String(raw.aspect ?? "").trim();
  let aspect: AspectKey = FALLBACK_ASPECT;
  if (ASPECTS.includes(askedAspect as AspectKey)) aspect = askedAspect as AspectKey;
  else if (askedAspect) corrections.push(`"${askedAspect}" is not a shape the forge knows, so ${FALLBACK_ASPECT} was used.`);

  let model = String(raw.model ?? "").trim();
  const allowed = availableModelsForStyle(entry, settings);
  if (!liveModelIds().has(model)) {
    const invented = model;
    model = defaultModelForStyle(entry, settings);
    corrections.push(
      invented
        ? `There is no model called "${invented}", so ${model} was used instead.`
        : `No model was chosen, so ${model} was used.`
    );
  } else if (allowed.length > 0 && !allowed.includes(model)) {
    const wanted = model;
    model = defaultModelForStyle(entry, settings);
    corrections.push(`${wanted} cannot do the "${entry.name}" style, so ${model} was used instead.`);
  }

  return { style, model, prompt, aspect };
}

export function parseReply(reply: string, settings: ForgeSettings): ParsedReply {
  const corrections: string[] = [];

  // ROWS first: a list of pictures for the manifest. This is the bulk job the
  // Scribe used to do behind a button nobody could find.
  const many = reply.match(/^ROWS:\s*(\[[\s\S]*?\])\s*$/m);
  if (many) {
    const say = reply.slice(0, many.index).trim();
    let list: unknown;
    try {
      list = JSON.parse(many[1]);
    } catch {
      return { say, plan: null, rows: null, corrections: ["It tried to write a list of pictures and garbled it. Ask again."] };
    }
    if (!Array.isArray(list) || list.length === 0) {
      return { say, plan: null, rows: null, corrections: ["It returned an empty list, so nothing was added."] };
    }
    const rows = list
      .map((r) => validate((r ?? {}) as Record<string, unknown>, settings, corrections))
      .filter((r): r is ChatPlan => r !== null);
    const dropped = list.length - rows.length;
    if (dropped > 0) corrections.push(`${dropped} of ${list.length} had no prompt and were skipped.`);
    return { say, plan: null, rows: rows.length > 0 ? rows : null, corrections };
  }

  const line = reply.match(/^FORGE:\s*(\{[\s\S]*?\})\s*$/m);
  const say = (line ? reply.slice(0, line.index) : reply).trim();
  if (!line) return { say, plan: null, rows: null, corrections: [] };

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(line[1]) as Record<string, unknown>;
  } catch {
    // It meant to propose something and mangled the JSON. Better to keep the
    // words and drop the plan than to guess at what it intended.
    return { say, plan: null, rows: null, corrections: ["It tried to suggest a picture but garbled it. Ask again."] };
  }

  const plan = validate(raw, settings, corrections);
  if (!plan) return { say, plan: null, rows: null, corrections: ["It suggested a picture with no prompt, so nothing was made."] };
  return { say, plan, rows: null, corrections };
}

/** A filename that obeys the seven rules, derived from what was asked for. */
export function filenameFor(prompt: string, category = "item", taken: string[] = []): string {
  const stem =
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join("_") || "picture";
  let name = `${category}_${stem}.png`;
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${category}_${stem}_${n}.png`)) n++;
  return `${category}_${stem}_${n}.png`;
}
