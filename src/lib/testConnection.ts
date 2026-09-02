/**
 * "Does this key actually work?" — one button per engine.
 *
 * Every check is deliberately the cheapest call that still proves the whole
 * chain: the address is right, the key is accepted, and the model exists. Where
 * a provider offers a free listing endpoint we use that rather than generating a
 * picture, so testing a key never costs money or eats a daily allowance.
 *
 * The one exception is noted below.
 */

import type { ForgeSettings } from "./providers";
import { scribeChat } from "./providers";

export type TestTarget =
  | "local"
  | "cloudflare"
  | "pollinations"
  | "gemini-free"
  | "gemini-paid"
  | "openai"
  | "scribe"
  | "coder";

export interface TestResult {
  ok: boolean;
  /** one line, written for a person */
  message: string;
  /** anything worth showing underneath, e.g. the models it found */
  detail?: string;
  /** true when the check cost nothing at all */
  free: boolean;
}

const ok = (message: string, detail?: string, free = true): TestResult => ({ ok: true, message, detail, free });
const bad = (message: string, detail?: string): TestResult => ({ ok: false, message, detail, free: true });

const timeout = (ms: number): AbortSignal => AbortSignal.timeout(ms);

const explain = (status: number, body: string): string => {
  const trimmed = body.trim().slice(0, 200);
  if (status === 401 || status === 403) return "the key was refused";
  if (status === 404) return "that address or model does not exist";
  if (status === 429) return "the key is right, but it has hit its limit for now";
  if (status >= 500) return "the provider is having a bad moment";
  return trimmed || `it answered ${status}`;
};

/* ---------------- one per engine ---------------- */

async function testLocal(s: ForgeSettings): Promise<TestResult> {
  const base = (s.localBase || "").trim().replace(/\/+$/, "");
  if (!base) return bad("No address yet.", "Put your server's address in, e.g. http://localhost:8080/v1");
  try {
    const res = await fetch(`${base}/models`, {
      headers: s.localKey.trim() ? { Authorization: `Bearer ${s.localKey.trim()}` } : {},
      signal: timeout(15000),
    });
    if (!res.ok) return bad(`Your server answered ${res.status}.`, explain(res.status, await res.text().catch(() => "")));
    const json = (await res.json()) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((d) => d.id).filter(Boolean) as string[];
    if (!ids.length) return bad("Your server is running but has no models loaded.");
    const wanted = s.localModel.trim();
    if (wanted && !ids.includes(wanted)) {
      return bad(
        `Connected, but "${wanted}" is not on your server.`,
        `It has: ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? "…" : ""}`
      );
    }
    return ok(`Working — ${ids.length} models, and "${wanted}" is one of them.`, ids.slice(0, 8).join(", "));
  } catch {
    return bad("Could not reach your server.", `Is it running at ${base}?`);
  }
}

async function testCloudflare(s: ForgeSettings): Promise<TestResult> {
  const id = s.cloudflare.accountId.trim();
  const token = s.cloudflare.token.trim();
  if (!id || !token) return bad("Needs both the account id and the token.");
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(id)}/ai/models/search?per_page=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: timeout(20000) }
    );
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      return bad("Cloudflare refused the token.", "Does it have the Workers AI permission?");
    }
    if (res.status === 404) return bad("Cloudflare did not recognise that account id.");
    if (!res.ok) return bad(`Cloudflare answered ${res.status}.`, explain(res.status, body));
    return ok("Working — the account and token are both good.", "No allowance was used by this check.");
  } catch {
    return bad("Could not reach Cloudflare.", "Check your internet connection.");
  }
}

async function testPollinations(s: ForgeSettings): Promise<TestResult> {
  const token = s.pollinationsToken.trim();
  try {
    const res = await fetch("https://image.pollinations.ai/models", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: timeout(20000),
    });
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      return bad(
        token ? "Pollinations refused that token." : "Pollinations needs a token now.",
        "Get a free one at auth.pollinations.ai"
      );
    }
    if (!res.ok) return bad(`Pollinations answered ${res.status}.`, explain(res.status, body));
    return ok(
      token ? "Working — your token was accepted." : "Reachable, but you have no token yet.",
      token ? undefined : "Pictures will fail without one. auth.pollinations.ai gives them out free."
    );
  } catch {
    return bad("Could not reach Pollinations.");
  }
}

/** Listing models is free and proves the key, without touching any allowance. */
async function testGeminiKey(key: string, model: string): Promise<TestResult> {
  if (!key.trim()) return bad("No key in this box yet.");
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": key.trim() },
      signal: timeout(20000),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) return bad(`Google answered ${res.status}.`, explain(res.status, body));
    const json = JSON.parse(body) as { models?: { name?: string }[] };
    const names = (json.models ?? []).map((m) => (m.name ?? "").replace("models/", ""));
    const has = model && names.some((n) => n.startsWith(model));
    return ok(
      has ? `Working — and "${model}" is available to this key.` : "Working — the key is good.",
      has ? undefined : model ? `It did not list "${model}". It may still work, or the name may have changed.` : undefined
    );
  } catch {
    return bad("Could not reach Google.");
  }
}

async function testOpenAiLike(base: string, key: string, model: string, who: string): Promise<TestResult> {
  const b = base.trim().replace(/\/+$/, "");
  if (!b) return bad("No address yet.");
  if (!key.trim()) return bad("No key yet.");
  try {
    const res = await fetch(`${b}/models`, {
      headers: { Authorization: `Bearer ${key.trim()}` },
      signal: timeout(20000),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) return bad(`${who} answered ${res.status}.`, explain(res.status, body));
    const json = JSON.parse(body) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((d) => d.id).filter(Boolean) as string[];
    const has = model && ids.includes(model);
    return ok(
      has ? `Working — and "${model}" is there.` : `Working — the key is good.`,
      has ? undefined : ids.length ? `It offers: ${ids.slice(0, 6).join(", ")}${ids.length > 6 ? "…" : ""}` : undefined
    );
  } catch {
    return bad(`Could not reach ${who}.`, `Is ${b} the right address?`);
  }
}

/** Chat models have no free listing worth trusting, so we ask them to say one word. */
async function testChat(engine: ForgeSettings["scribe"], who: string): Promise<TestResult> {
  if (!engine.key.trim()) return bad("No key yet.");
  try {
    const answer = await scribeChat(engine, "Reply with exactly: ready", "ready?");
    return ok(`Working — ${who} answered.`, `It said: "${answer.trim().slice(0, 60)}"`, false);
  } catch (e) {
    return bad(`${who} did not answer.`, (e as { message?: string })?.message ?? "unknown");
  }
}

/* ---------------- the one entry point ---------------- */

export async function testConnection(target: TestTarget, s: ForgeSettings): Promise<TestResult> {
  switch (target) {
    case "local":
      return testLocal(s);
    case "cloudflare":
      return testCloudflare(s);
    case "pollinations":
      return testPollinations(s);
    case "gemini-free":
      return testGeminiKey(s.geminiKeys.find((k) => k.key.trim())?.key ?? "", s.geminiModel);
    case "gemini-paid":
      return testGeminiKey(s.geminiPaidKeys.find((k) => k.key.trim())?.key ?? "", s.geminiModel);
    case "openai":
      return testOpenAiLike(s.openaiBase, s.openaiKeys.find((k) => k.key.trim())?.key ?? "", s.openaiModel, "The endpoint");
    case "scribe":
      return testChat(s.scribe, "your text model");
    case "coder":
      return testChat(s.coder, "your code model");
    default:
      return bad("Nothing to test.");
  }
}

/** Test every key in a pool, so one bad key among five is easy to spot. */
export async function testGeminiPool(
  pool: { id: string; label: string; key: string }[],
  model: string
): Promise<{ id: string; label: string; result: TestResult }[]> {
  const withKeys = pool.filter((k) => k.key.trim());
  return Promise.all(
    withKeys.map(async (k) => ({ id: k.id, label: k.label, result: await testGeminiKey(k.key, model) }))
  );
}
