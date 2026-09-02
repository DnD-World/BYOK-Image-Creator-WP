import { afterEach, describe, expect, it, vi } from "vitest";
import { testConnection } from "../src/lib/testConnection";
import { generateBytes } from "../src/lib/engines.mjs";

afterEach(() => vi.unstubAllGlobals());

const key = (id: string, k = `secret-${id}`, exhaustedUntil = 0) => ({ id, label: id, key: k, exhaustedUntil });

const settings = (over: Record<string, unknown> = {}) =>
  ({
    localBase: "http://localhost:8080/v1",
    localModel: "flux.2-klein-4b",
    localKey: "",
    cloudflare: { accountId: "acct", token: "tok" },
    pollinationsToken: "polli",
    geminiKeys: [key("free1")],
    geminiPaidKeys: [key("paid1")],
    geminiModel: "gemini-3.1-flash-image",
    openaiKeys: [key("oa1")],
    openaiBase: "https://api.openai.com/v1",
    openaiModel: "gpt-image-1",
    scribe: { base: "https://api.openai.com/v1", key: "sk-prose", model: "gpt-4o-mini" },
    coder: { base: "https://api.mistral.ai/v1", key: "sk-code", model: "codestral-latest" },
    provider: "local",
    pollinationsModel: "flux",
    pollinationsReferrer: "",
    geminiImageSize: "1K",
    cloudflareSteps: 4,
    localTextQuality: "poor",
    suppressTextOnWeakModels: true,
    ...over,
  }) as never;

describe("checking a connection never costs money", () => {
  it("asks your own machine only for its model list", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [{ id: "flux.2-klein-4b" }] }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await testConnection("local", settings());
    expect(r.ok).toBe(true);
    expect(r.free).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:8080/v1/models");
  });

  it("asks Cloudflare only to list models, so no allowance is used", async () => {
    const fetchMock = vi.fn(async () => Response.json({ result: [] }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await testConnection("cloudflare", settings());
    expect(r.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/ai/models/search");
    expect(r.detail).toMatch(/No allowance/i);
  });

  it("does not trust a Google key just because it lists models", async () => {
    // A key with no credit lists all 50 models and then refuses everything.
    // Verified against a real key on 2026-09-02.
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).endsWith("/models")
        ? Response.json({ models: [{ name: "models/gemini-3.1-flash-image" }] }, { status: 200 })
        : new Response(
            JSON.stringify({ error: { message: "Your prepayment credits are depleted." } }),
            { status: 429 }
          )
    );
    const r = await testConnection("gemini-free", settings());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no credit/i);
    expect(r.detail).toMatch(/SAME project/);
  });

  it("passes a Google key only once it has really been used", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).endsWith("/models")
        ? Response.json({ models: [{ name: "models/gemini-3.1-flash-image" }] }, { status: 200 })
        : Response.json({ candidates: [{ content: { parts: [{ text: "ready" }] } }] }, { status: 200 })
    );
    const r = await testConnection("gemini-free", settings());
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/can actually be used/);
    expect(r.free).toBe(false);
  });
});

describe("it tells you what is actually wrong", () => {
  it("says the key was refused, not just 403", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 403 }));
    const r = await testConnection("gemini-free", settings());
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/refused/);
  });

  it("says a 429 means the key is right but spent", async () => {
    vi.stubGlobal("fetch", async () => new Response("slow down", { status: 429 }));
    const r = await testConnection("gemini-free", settings());
    expect(r.detail).toMatch(/hit its limit/);
  });

  it("tells you the model is missing from your own server, and lists what is there", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ data: [{ id: "Z-Image-Turbo" }] }, { status: 200 }));
    const r = await testConnection("local", settings());
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not on your server/);
    expect(r.detail).toContain("Z-Image-Turbo");
  });

  it("says the server is unreachable rather than a raw network error", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const r = await testConnection("local", settings());
    expect(r.message).toMatch(/Could not reach/);
    expect(r.detail).toContain("localhost:8080");
  });

  it("points at auth.pollinations.ai when there is no token", async () => {
    vi.stubGlobal("fetch", async () => new Response("[]", { status: 200 }));
    const r = await testConnection("pollinations", settings({ pollinationsToken: "" }));
    expect(r.detail).toMatch(/auth\.pollinations\.ai/);
  });

  it("asks for both Cloudflare fields when one is blank", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await testConnection("cloudflare", settings({ cloudflare: { accountId: "a", token: "" } }));
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blames the Workers AI permission on a 403", async () => {
    vi.stubGlobal("fetch", async () => new Response("forbidden", { status: 403 }));
    const r = await testConnection("cloudflare", settings());
    expect(r.detail).toMatch(/Workers AI permission/);
  });

  it("checks the free and paid Google pools separately", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      seen.push((init.headers as Record<string, string>)["x-goog-api-key"]);
      return Response.json({ models: [] }, { status: 200 });
    });
    await testConnection("gemini-free", settings());
    const afterFree = seen.length;
    await testConnection("gemini-paid", settings());
    // each check lists models and then tries to use the key, so two calls each
    expect(seen.slice(0, afterFree).every((k) => k === "secret-free1")).toBe(true);
    expect(seen.slice(afterFree).every((k) => k === "secret-paid1")).toBe(true);
    expect(seen.length).toBeGreaterThan(afterFree);
  });
});

describe("free Google keys are always spent before paid ones", () => {
  const png = () => new Uint8Array([137, 80, 78, 71]);
  const b64 = () => Buffer.from(png()).toString("base64");

  it("reaches for a free key first", async () => {
    const used: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      used.push((init.headers as Record<string, string>)["x-goog-api-key"]);
      return Response.json({ output_image: { data: b64() } }, { status: 200 });
    });
    await generateBytes(
      { prompt: "x", aspect_ratio: "1:1", seed: 1, model: "nano-banana-2" },
      settings() as never,
      undefined,
      () => {},
      0
    );
    expect(used[0]).toBe("secret-free1");
  });

  it("only touches a paid key once every free one is resting", async () => {
    const used: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      used.push((init.headers as Record<string, string>)["x-goog-api-key"]);
      return Response.json({ output_image: { data: b64() } }, { status: 200 });
    });
    await generateBytes(
      { prompt: "x", aspect_ratio: "1:1", seed: 1, model: "nano-banana-2" },
      settings({ geminiKeys: [key("free1", "secret-free1", Date.now() + 60_000)] }) as never,
      undefined,
      () => {},
      0
    );
    expect(used[0]).toBe("secret-paid1");
  });

  it("benches a free key in the free pool, not the paid one", async () => {
    const benched: { pool: string; id: string }[] = [];
    let call = 0;
    vi.stubGlobal("fetch", async () => {
      call++;
      if (call === 1) return new Response("slow down", { status: 429 });
      return Response.json({ output_image: { data: b64() } }, { status: 200 });
    });
    await generateBytes(
      { prompt: "x", aspect_ratio: "1:1", seed: 1, model: "nano-banana-2" },
      settings() as never,
      undefined,
      (pool, id) => benched.push({ pool, id }),
      60_000
    );
    expect(benched).toEqual([{ pool: "geminiKeys", id: "free1" }]);
  });
});
