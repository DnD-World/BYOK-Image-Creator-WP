import type { ManifestRow, Toast } from "../types";
import { ASPECTS, STYLES } from "../types";
import { blobToDataUrl } from "./output";

export type ProviderId = "simulated" | "pollinations" | "imagen" | "openai";

/* ---------------- keys & settings ---------------- */

export interface ApiKey {
  id: string;
  label: string;
  key: string;
  /** epoch ms until which this key is benched after a 429; 0 = healthy */
  exhaustedUntil: number;
}

export const newKey = (label: string): ApiKey => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  label,
  key: "",
  exhaustedUntil: 0,
});

export interface ForgeSettings {
  provider: ProviderId;
  pollinationsModel: string;
  geminiKeys: ApiKey[];
  openaiKeys: ApiKey[];
  openaiBase: string;
  openaiModel: string;
  scribe: { base: string; key: string; model: string };
  cooldowns: Record<string, number>;
  usage: Record<string, { day: string; used: number }>;
  writeCsvOnSync: boolean;
  /** automatically re-queue rows whose cooldown has elapsed */
  autoRetry: boolean;
  metaPrompts: { promptWriter: string; filenameForger: string; stylePicker: string; wpMeta: string; factory: string };
  wp: { url: string; user: string; appPassword: string };
  ambient: {
    accent: string;
    background: "none" | "dots" | "embers" | "stars";
    density: number;
    wave: boolean;
    sparkle: boolean;
    glow: "off" | "accent" | "prismatic";
    cursor: "none" | "lantern" | "sparks";
    cursorSize: number;
  };
  customStyles: { id: string; name: string; block: string }[];
}

export const DEFAULT_SETTINGS: ForgeSettings = {
  provider: "simulated",
  pollinationsModel: "flux",
  geminiKeys: [newKey("key-1")],
  openaiKeys: [newKey("key-1")],
  openaiBase: "https://api.openai.com/v1",
  openaiModel: "gpt-image-1",
  scribe: { base: "https://api.openai.com/v1", key: "", model: "gpt-4o-mini" },
  cooldowns: {},
  usage: {},
  writeCsvOnSync: true,
  autoRetry: true,
  metaPrompts: { promptWriter: "", filenameForger: "", stylePicker: "", wpMeta: "", factory: "" },
  wp: { url: "", user: "", appPassword: "" },
  ambient: {
    accent: "ember",
    background: "dots",
    density: 55,
    wave: true,
    sparkle: true,
    glow: "accent",
    cursor: "lantern",
    cursorSize: 240,
  },
  customStyles: [],
};

export function normalizeSettings(s: Partial<ForgeSettings>): ForgeSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    scribe: { ...DEFAULT_SETTINGS.scribe, ...(s.scribe ?? {}) },
    metaPrompts: { ...DEFAULT_SETTINGS.metaPrompts, ...(s.metaPrompts ?? {}) },
    wp: { ...DEFAULT_SETTINGS.wp, ...(s.wp ?? {}) },
    ambient: (() => {
      const a = (s.ambient ?? {}) as Partial<ForgeSettings["ambient"]> & { dots?: boolean; glow?: boolean };
      const migrated: Partial<ForgeSettings["ambient"]> = { ...a };
      // legacy boolean toggles → new structured choices
      if (typeof a.background !== "string" && typeof a.dots === "boolean") migrated.background = a.dots ? "dots" : "none";
      if (typeof a.glow !== "string" && typeof (a as { glow?: boolean }).glow === "boolean")
        migrated.glow = (a as { glow?: boolean }).glow ? "accent" : "off";
      delete (migrated as { dots?: boolean }).dots;
      return { ...DEFAULT_SETTINGS.ambient, ...migrated };
    })(),
    customStyles: s.customStyles ?? [],
    geminiKeys: s.geminiKeys?.length ? s.geminiKeys : DEFAULT_SETTINGS.geminiKeys,
    openaiKeys: s.openaiKeys?.length ? s.openaiKeys : DEFAULT_SETTINGS.openaiKeys,
  };
}

/* ---------------- model registry ---------------- */

export interface ModelDef {
  id: string;
  engine: ProviderId;
  apiId: string;
  free: string;
  defaultCooldownH: number;
}

export const MODELS: ModelDef[] = [
  { id: "imagen-4-ultra", engine: "imagen", apiId: "imagen-4.0-ultra-generate-001", free: "≈ 25 images/day", defaultCooldownH: 24 },
  { id: "imagen-4", engine: "imagen", apiId: "imagen-4.0-generate-001", free: "≈ 25 images/day", defaultCooldownH: 24 },
  { id: "imagen-4-fast", engine: "imagen", apiId: "imagen-4.0-fast-generate-001", free: "≈ 25 images/day", defaultCooldownH: 24 },
  { id: "gemini-flash-image", engine: "imagen", apiId: "gemini-2.5-flash-image-preview", free: "free quota", defaultCooldownH: 1 },
  { id: "flux", engine: "pollinations", apiId: "flux", free: "free · no key", defaultCooldownH: 0 },
  { id: "turbo", engine: "pollinations", apiId: "turbo", free: "free · fastest", defaultCooldownH: 0 },
  { id: "dall-e-3", engine: "openai", apiId: "dall-e-3", free: "paid", defaultCooldownH: 1 },
  { id: "gpt-image-1", engine: "openai", apiId: "gpt-image-1", free: "paid", defaultCooldownH: 1 },
];

export const findModel = (id: string): ModelDef | undefined => MODELS.find((m) => m.id === id);
export const modelOptions = MODELS.map((m) => m.id);

export const cooldownHoursFor = (modelId: string, s: ForgeSettings): number => {
  const custom = s.cooldowns[modelId];
  if (typeof custom === "number" && custom >= 0) return custom;
  return findModel(modelId)?.defaultCooldownH ?? 1;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
export function bumpUsage(usage: ForgeSettings["usage"], modelId: string): ForgeSettings["usage"] {
  const cur = usage[modelId];
  const used = cur && cur.day === todayStr() ? cur.used + 1 : 1;
  return { ...usage, [modelId]: { day: todayStr(), used } };
}
export const usedToday = (usage: ForgeSettings["usage"], modelId: string): number => {
  const cur = usage[modelId];
  return cur && cur.day === todayStr() ? cur.used : 0;
};

export function formatCountdown(untilMs: number): string {
  const ms = untilMs - Date.now();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function resolveRoute(row: ManifestRow, s: ForgeSettings): { engine: ProviderId; apiModel: string; def?: ModelDef } {
  const wanted = (row.model || "").trim();
  if (wanted) {
    const def = findModel(wanted);
    if (def) return { engine: def.engine, apiModel: def.apiId, def };
    return { engine: s.provider, apiModel: wanted };
  }
  if (s.provider === "imagen") return { engine: "imagen", apiModel: "imagen-4.0-generate-001", def: findModel("imagen-4") };
  if (s.provider === "pollinations") return { engine: "pollinations", apiModel: s.pollinationsModel, def: findModel(s.pollinationsModel) };
  if (s.provider === "openai") return { engine: "openai", apiModel: s.openaiModel || "gpt-image-1", def: findModel(s.openaiModel) };
  return { engine: "simulated", apiModel: "forge" };
}

/* ---------------- provider meta & catalog ---------------- */

export const PROVIDER_META: Record<ProviderId, { name: string; short: string; needsKey: boolean; dot: string; note: string; free: string }> = {
  simulated: {
    name: "Simulated Forge", short: "simulated", needsKey: false, dot: "#97876d",
    note: "Offline rehearsal engine. Paints a deterministic procedural plate so you can dry-run the whole pipeline for free.",
    free: "∞ free",
  },
  pollinations: {
    name: "Pollinations · FLUX", short: "pollinations", needsKey: false, dot: "#f2a33c",
    note: "Real AI images with no account and no key. Community fair-use — expect 5–40s per plate and occasional throttling.",
    free: "free · no key",
  },
  imagen: {
    name: "Google Imagen", short: "imagen", needsKey: true, dot: "#56b8a5",
    note: "Gemini API image models. Add one or many keys — rotation on 429 is automatic. Free tiers reset daily (Pacific).",
    free: "≈ 25/day per model per key",
  },
  openai: {
    name: "OpenAI-compatible", short: "openai", needsKey: true, dot: "#b18ce0",
    note: "Any /images/generations endpoint: OpenAI itself, Together, OpenRouter, or a local Stable Diffusion WebUI.",
    free: "depends on endpoint",
  },
};

export const FREE_OPTIONS = [
  { name: "Pollinations (FLUX)", free: "unlimited fair-use", limit: "no key · community throttling", models: "flux, turbo", key: "none", wiring: "built-in" },
  { name: "Google Imagen (Gemini API)", free: "≈ 25/day per model", limit: "per key · resets midnight Pacific", models: "imagen-4-ultra, imagen-4, imagen-4-fast", key: "GEMINI_API_KEY", wiring: "built-in" },
  { name: "Hugging Face Inference", free: "free tier, rate-limited", limit: "seconds-per-request caps", models: "FLUX.1-schnell, SDXL", key: "HF token", wiring: "curl" },
  { name: "Cloudflare Workers AI", free: "10k neurons/day", limit: "account required", models: "FLUX.1-schnell, SDXL", key: "CF token", wiring: "curl" },
  { name: "Prodia", free: "limited free credits", limit: "slower queue on free tier", models: "SDXL, SD 1.5", key: "PRODIA_KEY", wiring: "curl" },
  { name: "Recraft", free: "50 credits/day", limit: "design-oriented outputs", models: "recraft-v3", key: "API key", wiring: "web only" },
  { name: "Leonardo AI", free: "150 tokens/day", limit: "token costs vary by model", models: "Phoenix, Kino", key: "API key", wiring: "curl" },
  { name: "Stability API", free: "25 one-time credits", limit: "then paid", models: "SD3.5, SDXL", key: "STABILITY_KEY", wiring: "curl" },
  { name: "Together AI", free: "$1 signup credit", limit: "then paid", models: "FLUX.1-schnell", key: "TOGETHER_KEY", wiring: "curl" },
  { name: "fal.ai", free: "free credits on signup", limit: "then paid", models: "FLUX.1, AuraFlow", key: "FAL_KEY", wiring: "curl" },
  { name: "SiliconFlow", free: "free tier quota", limit: "region-dependent", models: "FLUX.1-schnell, SD3.5", key: "API key", wiring: "curl" },
  { name: "Segmind", free: "100 free credits", limit: "credit-based", models: "SDXL, SSD-1B", key: "SEGMIND_KEY", wiring: "curl" },
  { name: "DeepAI", free: "limited free calls", limit: "watermarked on free tier", models: "txt2img", key: "DEEPAI_KEY", wiring: "curl" },
  { name: "Ideogram", free: "daily free prompts", limit: "web only · no API on free", models: "Ideogram 2", key: "—", wiring: "web only" },
  { name: "Craiyon", free: "unlimited, ad-supported", limit: "web only · lower fidelity", models: "craiyon", key: "—", wiring: "web only" },
];

export const SNIPPETS = [
  {
    label: "Google Imagen (Gemini API)",
    code: `curl "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=$GEMINI_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"instances":[{"prompt":"'"$PROMPT"'"}],
       "parameters":{"sampleCount":1,"aspectRatio":"16:9"}}' \\
  --output response.json
# base64 PNG lands in .predictions[0].bytesBase64Encoded`,
  },
  {
    label: "OpenAI-compatible",
    code: `curl "$BASE_URL/images/generations" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"model":"gpt-image-1","prompt":"'"$PROMPT"'",
       "size":"1024x1024","response_format":"b64_json"}' \\
  --output response.json
# base64 PNG lands in .data[0].b64_json`,
  },
  {
    label: "Hugging Face",
    code: `curl https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell \\
  -H "Authorization: Bearer $HF_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"inputs":"'"$PROMPT"'"}' \\
  --output image.jpg
# binary image in the response body`,
  },
];

/* ---------------- generation ---------------- */

export class RateLimitError extends Error {
  retryAt: number;
  keyLabel: string;
  constructor(message: string, retryAt: number, keyLabel: string) {
    super(message);
    this.name = "RateLimitError";
    this.retryAt = retryAt;
    this.keyLabel = keyLabel;
  }
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number, outer?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(new DOMException("request timed out", "TimeoutError")), ms);
  const onOuter = () => ctrl.abort(new DOMException("halted", "AbortError"));
  if (outer) {
    if (outer.aborted) onOuter();
    else outer.addEventListener("abort", onOuter);
  }
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => {
    window.clearTimeout(t);
    outer?.removeEventListener("abort", onOuter);
  });
}

export interface StrikeResult {
  blob: Blob;
  dataUrl: string;
}

type Exhaust = (pool: "geminiKeys" | "openaiKeys", keyId: string, untilMs: number) => void;

const healthyKeys = (pool: ApiKey[]) => pool.filter((k) => k.key.trim() && k.exhaustedUntil <= Date.now());

async function pollinations(row: ManifestRow, apiModel: string, signal?: AbortSignal): Promise<StrikeResult> {
  const { w, h } = ASPECTS[row.aspect_ratio];
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(row.prompt)}` +
    `?width=${w}&height=${h}&seed=${row.seed || 1}&model=${encodeURIComponent(apiModel)}&nologo=true&safe=true` +
    (row.negative_prompt ? `&negative=${encodeURIComponent(row.negative_prompt)}` : "");
  const res = await fetchWithTimeout(url, { method: "GET" }, 240000, signal);
  if (res.status === 429) throw new RateLimitError("pollinations 429 — fair-use throttle", Date.now() + 3600e3, "public");
  if (!res.ok) throw new Error(`pollinations ${res.status} — endpoint refused the request`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image")) throw new Error("pollinations returned a non-image payload");
  return { blob, dataUrl: await blobToDataUrl(blob) };
}

const ASPECT_API: Record<string, string> = { "16:9": "16:9", "1:1": "1:1", "9:16": "9:16", "4:3": "4:3" };

async function imagen(row: ManifestRow, apiModel: string, s: ForgeSettings, signal: AbortSignal | undefined, exhaust: Exhaust, cooldownMs: number): Promise<StrikeResult> {
  const pool = s.geminiKeys;
  const healthy = healthyKeys(pool);
  if (healthy.length === 0) {
    const withKey = pool.filter((k) => k.key.trim());
    const earliest = withKey.length ? Math.min(...withKey.map((k) => k.exhaustedUntil || Date.now())) : 0;
    throw new RateLimitError("every Gemini key is benched", Math.max(earliest, Date.now() + cooldownMs), "all");
  }
  let lastErr: unknown = null;
  for (const k of healthy) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:predict?key=${encodeURIComponent(k.key.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: row.prompt }],
            parameters: { sampleCount: 1, aspectRatio: ASPECT_API[row.aspect_ratio] ?? "1:1", seed: row.seed || undefined },
          }),
        },
        180000,
        signal
      );
      if (res.status === 429 || res.status === 403) {
        exhaust("geminiKeys", k.id, Date.now() + cooldownMs);
        lastErr = new RateLimitError(`${k.label} hit its limit (${res.status}) — rotating`, Date.now() + cooldownMs, k.label);
        continue;
      }
      if (!res.ok) {
        const text = (await res.text()).slice(0, 220);
        throw new Error(`imagen ${res.status} — ${text || "request refused"}`);
      }
      const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
      const b64 = json.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) throw new Error("imagen returned no image bytes");
      const blob = b64ToBlobLocal(b64, "image/png");
      return { blob, dataUrl: await blobToDataUrl(blob) };
    } catch (e) {
      if (e instanceof RateLimitError) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all Gemini keys failed");
}

async function openaiCompat(row: ManifestRow, apiModel: string, s: ForgeSettings, signal: AbortSignal | undefined, exhaust: Exhaust, cooldownMs: number): Promise<StrikeResult> {
  const pool = s.openaiKeys;
  const healthy = healthyKeys(pool);
  if (healthy.length === 0) {
    const withKey = pool.filter((k) => k.key.trim());
    const earliest = withKey.length ? Math.min(...withKey.map((k) => k.exhaustedUntil || Date.now())) : 0;
    throw new RateLimitError("every endpoint key is benched", Math.max(earliest, Date.now() + cooldownMs), "all");
  }
  const base = s.openaiBase.replace(/\/+$/, "");
  const { w, h } = ASPECTS[row.aspect_ratio];
  const size = w === h ? `${w}x${h}` : w > h ? "1536x1024" : "1024x1536";
  let lastErr: unknown = null;
  for (const k of healthy) {
    try {
      const res = await fetchWithTimeout(
        `${base}/images/generations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${k.key.trim()}` },
          body: JSON.stringify({ model: apiModel, prompt: row.prompt, size, response_format: "b64_json" }),
        },
        180000,
        signal
      );
      if (res.status === 429 || res.status === 401) {
        exhaust("openaiKeys", k.id, Date.now() + cooldownMs);
        lastErr = new RateLimitError(`${k.label} hit its limit (${res.status}) — rotating`, Date.now() + cooldownMs, k.label);
        continue;
      }
      if (!res.ok) {
        const text = (await res.text()).slice(0, 220);
        throw new Error(`endpoint ${res.status} — ${text || "request refused"}`);
      }
      const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
      const first = json.data?.[0];
      if (first?.b64_json) {
        const blob = b64ToBlobLocal(first.b64_json, "image/png");
        return { blob, dataUrl: await blobToDataUrl(blob) };
      }
      if (first?.url) {
        const img = await fetchWithTimeout(first.url, {}, 120000, signal);
        if (!img.ok) throw new Error("image URL fetch failed");
        const blob = await img.blob();
        return { blob, dataUrl: await blobToDataUrl(blob) };
      }
      throw new Error("endpoint returned no image");
    } catch (e) {
      if (e instanceof RateLimitError) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all endpoint keys failed");
}

const b64ToBlobLocal = (b64: string, mime: string): Blob => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/** Real generation against the routed engine, with key rotation on rate limits. */
export async function generateReal(
  row: ManifestRow,
  s: ForgeSettings,
  signal: AbortSignal | undefined,
  exhaust: Exhaust,
  cooldownMs: number
): Promise<StrikeResult> {
  const { engine, apiModel } = resolveRoute(row, s);
  if (engine === "pollinations") return pollinations(row, apiModel, signal);
  if (engine === "imagen") return imagen(row, apiModel, s, signal, exhaust, cooldownMs);
  if (engine === "openai") return openaiCompat(row, apiModel, s, signal, exhaust, cooldownMs);
  throw new Error("simulated engine has no network path");
}

/* ---------------- the scribe & factory (OpenAI-compatible chat) ---------------- */

export async function scribeChat(
  scribe: ForgeSettings["scribe"],
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<string> {
  if (!scribe.key.trim()) throw new Error("no text-engine key — set one in Settings → Text engines");
  const base = scribe.base.replace(/\/+$/, "");
  const res = await fetchWithTimeout(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${scribe.key.trim()}` },
      body: JSON.stringify({
        model: scribe.model || "gpt-4o-mini",
        temperature: 0.8,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    120000,
    signal
  );
  if (!res.ok) {
    const text = (await res.text()).slice(0, 180);
    throw new Error(`text engine ${res.status} — ${text || "request refused"}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("text engine answered with nothing");
  return out;
}

export const SCRIBE_SYSTEMS = {
  promptWriter: (styleBlock: string, category: string, kindFlavor = "", override?: string) =>
    override?.trim() ||
    `You are the prompt scribe of an image generation forge (category: ${category}).
Rewrite the user's short description into ONE vivid image prompt, 35–60 words, concrete nouns, strong light, no camera jargon.
${kindFlavor ? `The subject world is: ${kindFlavor}. Weave that flavor in naturally. ` : "Keep the subject world exactly as the user describes it — add no genre of your own. "}
You MUST end the prompt with exactly this style block, verbatim: ", ${styleBlock}".
Reply with the prompt only — no quotes, no preamble.`,
  styleCrafter: (override?: string) =>
    override?.trim() ||
    `You are the style smith of an image forge. The user describes a visual look in plain words.
Invent a NEW visual style for image prompts: a short kebab-case id (lowercase, dashes), a display Name, and a style block of 8–16 words describing ONLY the artistic medium (technique, materials, lighting, composition) — never the subject world.
Reply with valid JSON only, no markdown fences: {"id":"my-style","name":"My Style","block":"..."}`,
  filenameForger: (category: string, override?: string) =>
    override?.trim() ||
    `You are the filename forger. From the user's image prompt, invent ONE filename that obeys ALL rules:
lowercase only · no spaces · no special characters · words joined with underscores · must start with the prefix "${category}_" · must end with ".png" · max 4 words after the prefix · evocative but short.
Reply with ONLY the filename, nothing else. Example shape: ${category}_crooked_potion_shop.png`,
  styleSuggester: (override?: string) =>
    override?.trim() ||
    `You are the style advisor of an image forge. The available visual languages are: ${STYLES.map((s) => s.id).join(", ")}.
Pick the single best style id for the user's subject and reply with EXACTLY one line: <style-id> — <one short reason>.`,
  wpMetadata: (override?: string) =>
    override?.trim() ||
    `You craft WordPress attachment metadata for a marketplace image. From the user's filename + prompt, reply with valid JSON only, no markdown fences:
{"title": "Human readable title", "alt": "descriptive alt text under 125 chars, no keyword stuffing", "caption": "one charming sentence for the shop card"}`,
  factory: (kindFlavor: string, kindNegative: string, filenameTag: string, styleBlock: string | null, override?: string) =>
    override?.trim() ||
    `You are the prompt factory of an image forge. The user gives a theme and a count. Invent that many DIFFERENT picture ideas${
      kindFlavor ? ` for this subject world: ${kindFlavor}` : " — keep them genre-neutral unless the theme implies otherwise"
    }.
Rules for every idea:
- filename: lowercase, underscores only, starts with its category prefix (shop_ / item_ / event_ / npc_), ${
      filenameTag ? `then the world tag "${filenameTag}_", ` : ""
    }then up to 3 subject words, ends with .png (example shape: item_${filenameTag ? filenameTag + "_" : ""}healing_flask.png)
- prompt: RICH — 45–80 words across 2–3 sentences: subject & materials first, then lighting & mood, then one telling detail. No camera jargon.${
      styleBlock ? ` MUST end verbatim with ", ${styleBlock}".` : " Do NOT append any style words — the visual style is added later."
    }
- negative_prompt: start with "${kindNegative}" and add 2–4 subject-specific avoids
- category: one of shop | item | event | npc (mix them)
Reply with ONLY a JSON object, no markdown fences:
{"rows":[{"filename":"shop_...png","prompt":"...","negative_prompt":"...","category":"shop"}, ...]}`,
};

export type { Toast as ProviderToast };
