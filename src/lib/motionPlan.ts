/**
 * Turning "what should this do?" into actual movement.
 *
 * A still picture can be animated convincingly without any video model at all,
 * by moving the *camera* rather than the subject: drift, push in, sway, a
 * flicker of light. That is how most animated marketing images are made, and it
 * costs nothing, renders instantly, and never wobbles between frames the way
 * regenerated frames do.
 *
 * So: your words go to the TEXT model, which returns a motion plan. The plan is
 * then rendered from the one picture you already have.
 *
 * What this CANNOT do is change what is in the picture — a character will not
 * wave, a mouth will not move. That needs a real video model (Veo). The planner
 * says so honestly rather than pretending.
 */

import type { ForgeSettings } from "./providers";
import { scribeChat } from "./providers";

export type Easing = "linear" | "ease-in-out" | "bounce";

export interface MotionPlan {
  /** how the camera drifts across the picture, as a fraction of its size */
  pan: { x: number; y: number };
  /** 1 = no zoom. 1.12 = push in 12% by the end. */
  zoom: number;
  /** degrees of rotation across the whole loop */
  rotate: number;
  /** side-to-side sway, as a fraction of width; 0 = none */
  sway: number;
  /** up-and-down bob, as a fraction of height; 0 = none */
  bob: number;
  /** brightness oscillation, 0–0.6 — good for firelight and glow */
  flicker: number;
  /** overall brightness ramp across the loop, -0.4 to 0.4 */
  brighten: number;
  /** how many times the wobbles repeat across the loop */
  cycles: number;
  /** does the last frame return to the first? */
  pingPong: boolean;
  frames: number;
  /** milliseconds per frame */
  frameMs: number;
  easing: Easing;
  /** one plain sentence describing what will happen */
  summary: string;
  /** set when the ask needs a real video model instead */
  beyondReach?: string;
}

export const DEFAULT_PLAN: MotionPlan = {
  pan: { x: 0, y: 0 },
  zoom: 1.08,
  rotate: 0,
  sway: 0,
  bob: 0,
  flicker: 0,
  brighten: 0,
  cycles: 1,
  pingPong: true,
  frames: 16,
  frameMs: 80,
  easing: "ease-in-out",
  summary: "A slow push in.",
};

/** Ready-made movements, so the thing is useful before you type anything. */
export const MOTION_PRESETS: { id: string; label: string; hint: string; plan: Partial<MotionPlan> }[] = [
  { id: "push-in", label: "Slow push in", hint: "the camera creeps closer", plan: { zoom: 1.12, pingPong: true } },
  { id: "pull-out", label: "Pull back", hint: "reveals more of the scene", plan: { zoom: 0.9, pingPong: true } },
  { id: "pan-right", label: "Drift right", hint: "a slow sideways glide", plan: { pan: { x: 0.08, y: 0 }, zoom: 1.1 } },
  { id: "breathe", label: "Breathe", hint: "gentle in and out, endless", plan: { zoom: 1.05, cycles: 1, pingPong: true, frames: 20 } },
  { id: "firelight", label: "Firelight", hint: "flickering warm light", plan: { flicker: 0.28, cycles: 6, zoom: 1.03, frames: 18, frameMs: 70 } },
  { id: "sway", label: "Gentle sway", hint: "as if hanging or floating", plan: { sway: 0.018, bob: 0.01, cycles: 2, zoom: 1.04 } },
  { id: "shimmer", label: "Magic shimmer", hint: "a pulse of glow", plan: { flicker: 0.18, brighten: 0.12, cycles: 3, zoom: 1.04 } },
  { id: "wobble", label: "Cartoon wobble", hint: "bouncy and playful", plan: { rotate: 2.2, bob: 0.015, cycles: 3, zoom: 1.05, easing: "bounce" } },
];

/** Clamp into range, falling back to the default when the value is not a number. */
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
};

/** Force whatever came back into something safe to render. */
export function sanitisePlan(raw: Partial<MotionPlan> | null | undefined): MotionPlan {
  // A key explicitly set to undefined must NOT wipe out the default, which is
  // what a plain spread would do — models often omit or null out fields.
  const given = Object.fromEntries(
    Object.entries(raw ?? {}).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<MotionPlan>;
  const p = { ...DEFAULT_PLAN, ...given };
  return {
    pan: { x: clamp(p.pan?.x, -0.3, 0.3, 0), y: clamp(p.pan?.y, -0.3, 0.3, 0) },
    zoom: clamp(p.zoom, 0.7, 1.6, DEFAULT_PLAN.zoom),
    rotate: clamp(p.rotate, -12, 12, 0),
    sway: clamp(p.sway, 0, 0.08, 0),
    bob: clamp(p.bob, 0, 0.08, 0),
    flicker: clamp(p.flicker, 0, 0.6, 0),
    brighten: clamp(p.brighten, -0.4, 0.4, 0),
    cycles: Math.round(clamp(p.cycles, 1, 10, DEFAULT_PLAN.cycles)),
    pingPong: Boolean(p.pingPong),
    frames: Math.round(clamp(p.frames, 4, 48, DEFAULT_PLAN.frames)),
    frameMs: Math.round(clamp(p.frameMs, 40, 500, DEFAULT_PLAN.frameMs)),
    easing: (["linear", "ease-in-out", "bounce"] as Easing[]).includes(p.easing) ? p.easing : "ease-in-out",
    summary: String(p.summary || DEFAULT_PLAN.summary).slice(0, 200),
    ...(p.beyondReach ? { beyondReach: String(p.beyondReach).slice(0, 240) } : {}),
  };
}

export const PLANNER_SYSTEM = `You turn a request for animation into a camera-motion plan for a single still image.

You can only move the CAMERA and the LIGHT. You cannot change what is in the picture:
no new poses, no walking, no talking, no objects appearing or leaving.

Reply with ONLY a JSON object, no prose, no code fences, using these keys:
{
  "pan": {"x": -0.3..0.3, "y": -0.3..0.3},   sideways / vertical drift, fraction of the image
  "zoom": 0.7..1.6,                            1 = none, >1 pushes in, <1 pulls back
  "rotate": -12..12,                           degrees across the loop
  "sway": 0..0.08,                             side-to-side wobble
  "bob": 0..0.08,                              up-and-down wobble
  "flicker": 0..0.6,                           brightness flutter — firelight, magic, neon
  "brighten": -0.4..0.4,                       overall light ramp across the loop
  "cycles": 1..10,                             how many times wobbles/flicker repeat
  "pingPong": true|false,                      true means it returns to the start, so it loops seamlessly
  "frames": 4..48,
  "frameMs": 40..500,
  "easing": "linear" | "ease-in-out" | "bounce",
  "summary": "one short sentence, plain English, describing what will happen",
  "beyondReach": "OPTIONAL. Set ONLY if the request needs the subject itself to move
                  (waving, walking, speaking, weather, fire spreading). Say in one plain
                  sentence what cannot be done this way and that a video model is needed.
                  Still fill in every other field with the closest camera motion."
}

Prefer subtle values. A loop that breathes gently reads better than one that lurches.
Set pingPong true unless a one-way drift is clearly wanted.`;

export interface PlanResult {
  plan: MotionPlan;
  /** true when the text model wrote it; false when we fell back */
  fromModel: boolean;
  problem?: string;
}

/** Ask the text model how to animate this. Falls back to a sensible push-in. */
export async function planMotion(
  wish: string,
  settings: ForgeSettings,
  signal?: AbortSignal
): Promise<PlanResult> {
  const fallback = sanitisePlan({ ...DEFAULT_PLAN, summary: "A slow push in — the text engine was not available." });
  if (!wish.trim()) return { plan: sanitisePlan(DEFAULT_PLAN), fromModel: false };
  if (!settings.scribe.key.trim()) {
    return { plan: fallback, fromModel: false, problem: "no text-engine key — Settings → Text engines" };
  }
  try {
    const out = await scribeChat(settings.scribe, PLANNER_SYSTEM, wish.trim(), signal);
    const json = out.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
    const parsed = JSON.parse(json) as Partial<MotionPlan>;
    return { plan: sanitisePlan(parsed), fromModel: true };
  } catch (e) {
    return {
      plan: fallback,
      fromModel: false,
      problem: (e as { message?: string })?.message ?? "the text engine could not be reached",
    };
  }
}
