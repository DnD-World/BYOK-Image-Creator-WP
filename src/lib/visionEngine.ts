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
 * Ask the endpoint which models it has. Saves the user guessing an id, and
 * saves us shipping a list that goes stale.
 */
export async function listChatModels(
  engine: VisionEngine,
  signal?: AbortSignal
): Promise<{ ok: true; models: string[] } | { ok: false; problem: string }> {
  const base = trimBase(engine.base);
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
    const json = JSON.parse(text) as { data?: { id?: string }[] };
    const models = (json.data ?? []).map((m) => m.id ?? "").filter(Boolean).sort();
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
  const base = trimBase(engine.base);
  if (!base) return { ok: false, problem: "no vision engine set — choose one in Settings → Vision" };
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(base);
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
  const base = trimBase(engine.base);
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
