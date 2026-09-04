/**
 * A model that can look at a picture.
 *
 * Vision used to be hard-wired to Google. It is not any more: anything that
 * speaks the OpenAI chat shape and accepts an `image_url` part works, which is
 * nearly everything — Mistral, OpenRouter, NVIDIA NIM, a local server.
 *
 * Two deliberate choices:
 *
 *   · No hard-coded list of model ids. Providers rename and retire models
 *     constantly, and a stale id in our code becomes the user's 404. Instead
 *     the model is a free-text field and `listChatModels()` asks the endpoint
 *     what it actually has, so the list is always right.
 *
 *   · No `response_format: json_object`. Some endpoints reject the field
 *     outright with a 400, which reads to the user as "vision is broken" when
 *     the model would have answered fine. We ask for JSON in the prompt and
 *     dig it out of the reply instead.
 */

export type VisionEngine = { base: string; key: string; model: string };

/**
 * Starting points, not a closed list. Each one is a base URL that speaks the
 * OpenAI chat shape; the model id stays editable because only the provider
 * knows what it currently offers.
 */
export const VISION_PRESETS: {
  id: string;
  label: string;
  base: string;
  model: string;
  note: string;
  free: boolean;
  keyUrl: string;
}[] = [
  {
    id: "mistral",
    label: "Mistral",
    base: "https://api.mistral.ai/v1",
    // Not Pixtral. Pixtral was the obvious choice and is no longer listed on a
    // live Mistral account (checked 2026-09-02) — it would have been a 404 on
    // first use. mistral-medium-latest is multimodal and was confirmed reading
    // a test image correctly on that same account.
    model: "mistral-medium-latest",
    note: "Free on Mistral's own tier, and the same key already runs the code engine. Start here.",
    free: true,
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    model: "",
    note: "One key, hundreds of models from every company. Some are free, most are cheap. Press Load models to see what is there today.",
    free: false,
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    base: "https://integrate.api.nvidia.com/v1",
    model: "",
    note: "NVIDIA's hosted models, with free credits to start. Press Load models to see what your account can reach.",
    free: false,
    keyUrl: "https://build.nvidia.com/",
  },
  {
    id: "local",
    label: "Your own machine",
    base: "http://localhost:8080/v1",
    model: "",
    note: "A vision model running on your own computer. Free, private, no internet, no limits — as fast as your graphics card.",
    free: true,
    keyUrl: "",
  },
  {
    id: "google",
    label: "Google Gemini",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3-flash",
    note: "Google's OpenAI-compatible endpoint. Needs credit on the account — see the credit note in Troubleshooting.",
    free: false,
    keyUrl: "https://aistudio.google.com/apikey",
  },
];

const trimBase = (base: string) => base.trim().replace(/\/+$/, "");

/** True inside the app's window; false in Node, where CORS does not exist. */
const inBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Hosts a browser is not allowed to call, and where the app forwards them.
 *
 * NVIDIA answers a preflight with 200 and no Access-Control-Allow-Origin
 * header, which the browser treats as a refusal and reports as "Failed to
 * fetch" — nothing to do with the key or the address, and impossible to work
 * around from the page. The app proxies it instead, the same way it already
 * proxies Cloudflare. Verified 4 September 2026.
 *
 * In Node there is no such rule, so the address is used untouched.
 */
const NO_CORS: { host: string; prefix: string }[] = [
  { host: "integrate.api.nvidia.com", prefix: "/nv-api" },
];

/** The address to actually call, detouring through the proxy when we must. */
export function routeBase(base: string): string {
  const trimmed = trimBase(base);
  if (!inBrowser()) return trimmed;
  for (const { host, prefix } of NO_CORS) {
    const match = new RegExp(`^https?://${host.replace(/\./g, "\.")}`, "i");
    if (match.test(trimmed)) return trimmed.replace(match, prefix);
  }
  return trimmed;
}

/** Providers phrase the same problem differently. Say what it means instead. */
export function explainVisionFailure(status: number, body: string): string {
  const b = body.toLowerCase();
  if (status === 401 || status === 403) return "the key was refused — check it is pasted whole, with no spaces";
  if (b.includes("credit") || b.includes("quota") || b.includes("billing") || b.includes("depleted"))
    return "the key is valid, but the account behind it has no credit";
  if (status === 429) return "too many requests just now — wait a moment and try again";
  if (status === 404 || b.includes("model_not_found") || b.includes("unknown model"))
    return "that model name is not on this endpoint — press Load models and pick one from the list";
  if (b.includes("image") && (b.includes("not support") || b.includes("unsupported")))
    return "that model cannot look at pictures — press Load models and pick one that can";
  if (status >= 500) return "the provider is having trouble — this is their end, not yours";
  return `the vision model answered ${status}`;
}

/**
 * One model, with whatever the provider was willing to say about it.
 *
 * `null` means "not stated", and is deliberately different from `false`. The
 * providers vary enormously in what they disclose:
 *
 *   · OpenRouter gives a price and a modality list for all 427 of its models,
 *     so both questions can be answered exactly.
 *   · Mistral gives a capabilities object, so "can it chat" and "can it see"
 *     are answerable but the price is not.
 *   · NVIDIA and Google's OpenAI-shaped endpoint give a bare id and nothing
 *     else, so neither question is answerable.
 *
 * The rule that follows from this is in `filterModels`: a filter may only hide
 * a model the provider positively said to hide. Guessing from the id would
 * mean hiding the thing you were looking for, and no way to tell why.
 */
export interface ChatModel {
  id: string;
  /** true = free, false = costs money, null = the provider did not say */
  free: boolean | null;
  /** true = accepts images, false = text only, null = not stated */
  vision: boolean | null;
  /** true/false when the provider says; null when it says nothing */
  chat: boolean | null;
}

/**
 * A guess at whether an id belongs to something that cannot hold a
 * conversation — and it IS a guess, used only where the provider disclosed
 * nothing at all.
 *
 * NVIDIA and Google list embedding, reranking and speech models beside their
 * chat models with no field to tell them apart. Offering those as a writing
 * engine produces a failure whose error never says why, which is worse than a
 * name-based rule being occasionally wrong. Where a provider does state its
 * capabilities — Mistral, OpenRouter — this is never consulted.
 */
export const looksNonChat = (id: string): boolean =>
  // Two lists on purpose. The first are unmistakable anywhere in a name:
  // NVIDIA ships "nv-embedqa-e5-v5" and "rerank-qa-mistral-4b", so requiring a
  // word boundary would miss exactly the models this is for.
  /embed|rerank|moderation|whisper|transcribe/i.test(id) ||
  // The second are short enough to appear inside ordinary words — "clip" in
  // "eclipse", "stt" in almost anything — so they must stand alone.
  /(^|[/\-_.])(tts|stt|ocr|fim|clip|guard)([/\-_.]|$)/i.test(id);

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Read one entry of a /models list, in whichever dialect it arrived.
 *
 * Every provider here speaks the OpenAI listing shape and then adds its own
 * fields on top. We read the ones we recognise and shrug at the rest.
 */
export function readModelEntry(raw: unknown): ChatModel | null {
  const m = (raw ?? {}) as Record<string, unknown>;
  const id = typeof m.id === "string" ? m.id : "";
  if (!id) return null;

  let free: boolean | null = null;
  let vision: boolean | null = null;
  let chat: boolean | null = null;

  // OpenRouter: pricing per token, as decimal strings.
  const pricing = m.pricing as Record<string, unknown> | undefined;
  if (pricing && (typeof pricing.prompt === "string" || typeof pricing.completion === "string")) {
    const inCost = num(pricing.prompt);
    const outCost = num(pricing.completion);
    if (Number.isFinite(inCost) && Number.isFinite(outCost)) free = inCost === 0 && outCost === 0;
  }

  // OpenRouter: what it accepts and what it emits.
  const arch = m.architecture as Record<string, unknown> | undefined;
  const inputs = Array.isArray(arch?.input_modalities) ? (arch!.input_modalities as unknown[]) : null;
  const outputs = Array.isArray(arch?.output_modalities) ? (arch!.output_modalities as unknown[]) : null;
  if (inputs) vision = inputs.includes("image");
  // A model that cannot emit text cannot hold a conversation, whatever else it
  // does — the audio and image generators on OpenRouter are listed alongside
  // the chat models and would otherwise look like valid choices.
  if (outputs) chat = outputs.includes("text");

  // Mistral: a capabilities object. This is what makes the writing engine
  // usable there — mistral-embed, mistral-ocr-latest and mistral-moderation
  // are all in the same list as the chat models and all fail identically if
  // you pick one, with an error that does not say why.
  const caps = m.capabilities as Record<string, unknown> | undefined;
  if (caps) {
    if (typeof caps.completion_chat === "boolean") chat = caps.completion_chat;
    if (typeof caps.vision === "boolean") vision = caps.vision;
  }

  return { id, free, vision, chat };
}

/** What a filter is allowed to ask for. */
export interface ModelFilter {
  /** hide models the provider said cost money */
  freeOnly?: boolean;
  /** hide models the provider said cannot see pictures */
  visionOnly?: boolean;
}

/**
 * Apply a filter, hiding only what the provider positively told us to hide.
 *
 * A model whose price or modality is unstated always stays visible. That is
 * the difference between a filter and a guess: NVIDIA discloses nothing, so
 * "free only" leaves its list untouched rather than emptying it, and the UI
 * says as much instead of implying the tick box did something.
 */
export function filterModels(models: ChatModel[], filter: ModelFilter = {}): ChatModel[] {
  return models.filter((m) => {
    if (m.chat === false) return false;
    // Nothing was said, so fall back to reading the name — see looksNonChat.
    if (m.chat === null && looksNonChat(m.id)) return false;
    if (filter.freeOnly && m.free === false) return false;
    if (filter.visionOnly && m.vision === false) return false;
    return true;
  });
}

/** Does the provider state whether its models can chat? */
export const statesChat = (models: ChatModel[]): boolean => models.some((m) => m.chat !== null);
/** Does this list say anything about price at all? Drives the UI's honesty. */
export const statesPricing = (models: ChatModel[]): boolean => models.some((m) => m.free !== null);
/** Does this list say anything about which models can see? */
export const statesVision = (models: ChatModel[]): boolean => models.some((m) => m.vision !== null);

/**
 * Ask the endpoint which models it has. Saves the user guessing an id, and
 * saves us shipping a list that goes stale.
 */
export async function listChatModels(
  engine: VisionEngine,
  signal?: AbortSignal
): Promise<{ ok: true; models: ChatModel[] } | { ok: false; problem: string }> {
  const base = routeBase(engine.base);
  if (!base) return { ok: false, problem: "no address set" };
  let res: Response;
  try {
    res = await fetch(`${base}/models`, {
      headers: engine.key.trim() ? { Authorization: `Bearer ${engine.key.trim()}` } : {},
      signal,
    });
  } catch (e) {
    return { ok: false, problem: (e as { message?: string })?.message ?? "could not reach it" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, problem: explainVisionFailure(res.status, text) };
  try {
    const json = JSON.parse(text) as { data?: unknown[] };
    const models = (json.data ?? [])
      .map(readModelEntry)
      .filter((m): m is ChatModel => m !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (models.length === 0) return { ok: false, problem: "the endpoint listed no models" };
    return { ok: true, models };
  } catch {
    return { ok: false, problem: "the endpoint's answer was not the expected shape" };
  }
}

/**
 * Show the model a picture and a question. Returns the reply as plain text.
 *
 * `pngBase64` is bare base64 with no `data:` prefix — the same thing the
 * Google path used, so callers did not have to change.
 */
export async function askVision(
  engine: VisionEngine,
  pngBase64: string,
  prompt: string,
  signal?: AbortSignal
): Promise<{ ok: true; text: string } | { ok: false; problem: string; status?: number; body?: string }> {
  const base = routeBase(engine.base);
  if (!base) return { ok: false, problem: "no vision engine set — choose one in Settings → Vision" };
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(engine.base.trim());
  if (!engine.key.trim() && !isLocal)
    return { ok: false, problem: "no vision key — add one in Settings → Vision" };
  if (!engine.model.trim())
    return { ok: false, problem: "no vision model chosen — press Load models in Settings → Vision" };

  const body = {
    model: engine.model.trim(),
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${pngBase64}` } },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(engine.key.trim() ? { Authorization: `Bearer ${engine.key.trim()}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    return { ok: false, problem: (e as { message?: string })?.message ?? "could not reach the vision engine" };
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, problem: explainVisionFailure(res.status, text), status: res.status, body: text };

  try {
    const json = JSON.parse(text) as { choices?: { message?: { content?: unknown } }[] };
    const content = json.choices?.[0]?.message?.content;
    // Most return a string. A few return the parts array back at you.
    const answer =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((p) => (p as { text?: string })?.text ?? "").join("")
          : "";
    if (!answer.trim()) return { ok: false, problem: "the vision model replied with nothing" };
    return { ok: true, text: answer };
  } catch {
    return { ok: false, problem: "the vision model's answer was not the expected shape" };
  }
}

/**
 * Pull a JSON object out of a reply that may be wrapped in prose or a fenced
 * code block. Models do this constantly, and failing over a stray backtick
 * would waste a call that already cost something.
 */
export function jsonFromReply(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : reply).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON object in the reply");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Say "hi" to a list of models and report which actually answer.
 *
 * An endpoint's model list is what it SERVES, not what your key may use. Some
 * entries need a tier you do not have, some are retired but still listed, and
 * some are not chat models at all. The only way to know is to ask.
 *
 * Deliberately a button, never automatic. This is one real request per model,
 * and a list of fifty would mean fifty requests every time the chat opened.
 * They run one at a time for the same reason key checks do: fifty at once from
 * one address looks like abuse and gets you rate-limited into false failures.
 */
export async function probeChatModels(
  engine: VisionEngine,
  models: string[],
  onProgress?: (done: number, total: number, model: string, ok: boolean) => void,
  signal?: AbortSignal
): Promise<{ model: string; ok: boolean; why?: string }[]> {
  const base = routeBase(engine.base);
  const out: { model: string; ok: boolean; why?: string }[] = [];

  for (let i = 0; i < models.length; i++) {
    if (signal?.aborted) break;
    const model = models[i];
    let ok = false;
    let why: string | undefined;
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(engine.key.trim() ? { Authorization: `Bearer ${engine.key.trim()}` } : {}),
        },
        // As small as a real request can be: one token in, one token out.
        body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
        signal,
      });
      if (res.ok) ok = true;
      else why = explainVisionFailure(res.status, await res.text().catch(() => ""));
    } catch (e) {
      why = (e as { message?: string })?.message ?? "could not reach it";
    }
    out.push({ model, ok, why });
    onProgress?.(i + 1, models.length, model, ok);
  }
  return out;
}
