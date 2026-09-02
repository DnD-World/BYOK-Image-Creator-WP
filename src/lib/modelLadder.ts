/**
 * The text-model ladder.
 *
 * Free Gemini tiers are generous but finite, and each model has its own daily
 * allowance. Rather than stopping when the good model runs dry, the forge walks
 * down a ladder: the best model first, then the next, ending on one with an
 * allowance large enough that it realistically never runs out.
 *
 * Two things are non-negotiable when it steps down:
 *   · you are TOLD, loudly, in the console and in a toast
 *   · you are told HOW MANY calls the exhausted model managed today
 *
 * Counts are per model, per day, and reset on their own at midnight local time.
 */

export interface LadderRung {
  /** the model id sent to the API */
  model: string;
  /** what to call it in the console */
  label: string;
  /** roughly what the free tier allows per day, for the message only */
  dailyHint?: string;
}

/**
 * Default ladder, best first. These are text/vision models — the free tier for
 * them is real, unlike image generation which has none.
 */
export const DEFAULT_LADDER: LadderRung[] = [
  { model: "gemini-3.7-flash", label: "Gemini 3.7 Flash", dailyHint: "small daily allowance" },
  { model: "gemini-3.6-flash", label: "Gemini 3.6 Flash", dailyHint: "larger allowance" },
  { model: "gemini-3.5-flash", label: "Gemini 3.5 Flash", dailyHint: "larger still" },
  { model: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", dailyHint: "~500/day — the safety net" },
];

/** Per-model tallies for one day. */
export interface LadderUsage {
  day: string;
  /** calls that came back with a picture or an answer */
  calls: Record<string, number>;
  /** models that returned 429 today and are therefore out */
  exhausted: string[];
}

export const emptyUsage = (): LadderUsage => ({ day: today(), calls: {}, exhausted: [] });

export const today = (): string => new Date().toISOString().slice(0, 10);

/** Roll the tallies over when the date changes. */
export function freshUsage(u: LadderUsage | undefined): LadderUsage {
  if (!u || u.day !== today()) return emptyUsage();
  return u;
}

/** The first rung that has not been exhausted today. */
export function currentRung(ladder: LadderRung[], usage: LadderUsage): LadderRung | null {
  const u = freshUsage(usage);
  return ladder.find((r) => !u.exhausted.includes(r.model)) ?? null;
}

export const callsFor = (usage: LadderUsage, model: string): number => freshUsage(usage).calls[model] ?? 0;

/** Record one successful call. */
export function countCall(usage: LadderUsage, model: string): LadderUsage {
  const u = freshUsage(usage);
  return { ...u, calls: { ...u.calls, [model]: (u.calls[model] ?? 0) + 1 } };
}

export interface StepDown {
  usage: LadderUsage;
  /** the model we just gave up on */
  exhausted: LadderRung;
  /** how many calls it managed today before running out */
  callsMade: number;
  /** what we moved to, or null when the whole ladder is spent */
  movedTo: LadderRung | null;
  /** ready to show to a person */
  message: string;
}

/**
 * Mark a model as out for today and work out where to go next.
 * The message is deliberately complete — it is the alert.
 */
export function stepDown(ladder: LadderRung[], usage: LadderUsage, model: string): StepDown {
  const u = freshUsage(usage);
  const rung = ladder.find((r) => r.model === model) ?? { model, label: model };
  const callsMade = u.calls[model] ?? 0;
  const nextUsage: LadderUsage = {
    ...u,
    exhausted: u.exhausted.includes(model) ? u.exhausted : [...u.exhausted, model],
  };
  const movedTo = currentRung(ladder, nextUsage);

  const made = `${callsMade} call${callsMade === 1 ? "" : "s"}`;
  const message = movedTo
    ? `${rung.label} is out of free calls for today after ${made}. Switching to ${movedTo.label}` +
      `${movedTo.dailyHint ? ` (${movedTo.dailyHint})` : ""}.`
    : `${rung.label} is out for today after ${made}, and every model below it is too. ` +
      `Nothing left on the ladder until tomorrow.`;

  return { usage: nextUsage, exhausted: rung, callsMade, movedTo, message };
}

/** A one-line summary of the day so far, for the console. */
export function summariseDay(ladder: LadderRung[], usage: LadderUsage): string {
  const u = freshUsage(usage);
  const parts = ladder
    .filter((r) => (u.calls[r.model] ?? 0) > 0 || u.exhausted.includes(r.model))
    .map((r) => `${r.label} ${u.calls[r.model] ?? 0}${u.exhausted.includes(r.model) ? " (out)" : ""}`);
  return parts.length ? parts.join(" · ") : "no text-model calls yet today";
}

/** Does this failure mean "you have used your allowance", rather than a real error? */
export function isAllowanceError(status: number, body = ""): boolean {
  if (status === 429) return true;
  // Google sometimes reports an exhausted free tier as a 403 with a quota note
  return status === 403 && /quota|exceed|exhaust|rate.?limit/i.test(body);
}
