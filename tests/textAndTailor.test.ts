/**
 * Two features that shape the prompt before it reaches a painter:
 *   · telling models that cannot spell to stop trying
 *   · rewriting the prompt to suit the model (only when switched on)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODELS,
  MODEL_TRAITS,
  NO_TEXT_NEGATIVE,
  promptStyleFor,
  suppressTextIfWeak,
  textQualityFor,
} from "../src/lib/engines.mjs";

const settings = (over: Record<string, unknown> = {}) => ({
  provider: "gemini",
  pollinationsModel: "flux",
  pollinationsToken: "",
  pollinationsReferrer: "",
  geminiKeys: [],
  geminiModel: "nano-banana-2",
  geminiImageSize: "1K",
  cloudflare: { accountId: "", token: "" },
  cloudflareSteps: 4,
  openaiKeys: [],
  openaiBase: "https://api.openai.com/v1",
  openaiModel: "gpt-image-1",
  localBase: "http://localhost:8080/v1",
  localModel: "flux.2-klein-4b",
  localKey: "",
  localTextQuality: "poor",
  suppressTextOnWeakModels: true,
  ...over,
}) as Parameters<typeof textQualityFor>[1];

const row = (over: Record<string, unknown> = {}) => ({
  prompt: "a cosy bakery",
  aspect_ratio: "1:1",
  seed: 1,
  model: "",
  ...over,
}) as Parameters<typeof textQualityFor>[0];

afterEach(() => vi.unstubAllGlobals());

describe("who can actually write words", () => {
  it("has a verdict for every model in the catalogue", () => {
    for (const m of MODELS) {
      expect(MODEL_TRAITS[m.id], `${m.id} needs traits`).toBeDefined();
      expect(["poor", "fair", "good"]).toContain(MODEL_TRAITS[m.id].textQuality);
      expect(MODEL_TRAITS[m.id].promptStyle.length).toBeGreaterThan(20);
    }
  });

  it("rates Google's models as good and the tiny ones as not", () => {
    expect(textQualityFor(row({ model: "nano-banana-2" }), settings())).toBe("good");
    expect(textQualityFor(row({ model: "gemini-3-pro-image" }), settings())).toBe("good");
    expect(textQualityFor(row({ model: "turbo" }), settings())).toBe("poor");
  });

  it("asks you about your own machine rather than guessing", () => {
    expect(textQualityFor(row(), settings({ provider: "local" }))).toBe("poor");
    expect(textQualityFor(row(), settings({ provider: "local", localTextQuality: "good" }))).toBe("good");
  });
});

describe("suppressTextIfWeak", () => {
  it("tells a weak model not to attempt writing", () => {
    const out = suppressTextIfWeak(row({ model: "turbo" }), settings());
    expect(out.negative_prompt).toBe(NO_TEXT_NEGATIVE);
  });

  it("keeps whatever negatives you already wrote", () => {
    const out = suppressTextIfWeak(row({ model: "turbo", negative_prompt: "blurry" }), settings());
    expect(out.negative_prompt).toContain("blurry");
    expect(out.negative_prompt).toContain("gibberish text");
  });

  it("leaves models that can write completely alone", () => {
    const original = row({ model: "nano-banana-2", negative_prompt: "blurry" });
    expect(suppressTextIfWeak(original, settings())).toEqual(original);
  });

  it("does nothing at all when the setting is off", () => {
    const original = row({ model: "turbo" });
    expect(suppressTextIfWeak(original, settings({ suppressTextOnWeakModels: false }))).toEqual(original);
  });

  it("never stacks the same words twice", () => {
    const once = suppressTextIfWeak(row({ model: "turbo" }), settings());
    const twice = suppressTextIfWeak(once, settings());
    expect(twice.negative_prompt).toBe(once.negative_prompt);
  });

  it("does not mutate the row it was given", () => {
    const original = row({ model: "turbo" });
    suppressTextIfWeak(original, settings());
    expect(original.negative_prompt).toBeUndefined();
  });
});

describe("promptStyleFor", () => {
  it("knows what each catalogue model likes to be told", () => {
    expect(promptStyleFor(row({ model: "nano-banana-2" }), settings())).toMatch(/sentence/i);
    expect(promptStyleFor(row({ model: "cloudflare-flux" }), settings())).toMatch(/short/i);
  });

  it("has advice for a model on your own machine", () => {
    expect(promptStyleFor(row(), settings({ provider: "local" }))).toMatch(/short, concrete/i);
  });
});

describe("the prompt tailor", () => {
  const tailorSettings = (over: Record<string, unknown> = {}) =>
    ({
      ...(settings() as unknown as Record<string, unknown>),
      tailorPrompts: true,
      scribe: { base: "https://api.openai.com/v1", key: "sk-test", model: "gpt-4o-mini" },
      ...over,
    }) as never;

  const manifestRow = (over: Record<string, unknown> = {}) =>
    ({
      id: 1,
      filename: "shop_bakery.png",
      prompt: "a cosy bakery",
      category: "shop",
      item_id: "",
      shop_id: "",
      event_id: "",
      style: "claymation",
      aspect_ratio: "1:1",
      seed: 1,
      model: "nano-banana-2",
      status: "pending",
      error: "",
      generated_at: "",
      imported_attachment_id: "",
      ...over,
    }) as never;

  const chatReply = (text: string) =>
    Response.json({ choices: [{ message: { content: text } }] }, { status: 200 });

  it("does nothing while it is switched off", async () => {
    const { tailorPrompt } = await import("../src/lib/promptTailor");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await tailorPrompt(manifestRow(), tailorSettings({ tailorPrompts: false }));
    expect(out.changed).toBe(false);
    expect(out.prompt).toBe("a cosy bakery");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when there is no text-engine key", async () => {
    const { tailorPrompt } = await import("../src/lib/promptTailor");
    vi.stubGlobal("fetch", vi.fn());
    const out = await tailorPrompt(
      manifestRow(),
      tailorSettings({ scribe: { base: "x", key: "  ", model: "m" } })
    );
    expect(out.problem).toMatch(/no text-engine key/);
    expect(out.prompt).toBe("a cosy bakery");
  });

  it("rewrites the prompt and tells the model what it is aiming at", async () => {
    const { clearTailorCache, tailorPrompt } = await import("../src/lib/promptTailor");
    clearTailorCache();
    const fetchMock = vi.fn(async () => chatReply("A warm, cosy bakery at dawn, shot on a 50mm lens."));
    vi.stubGlobal("fetch", fetchMock);

    const out = await tailorPrompt(manifestRow({ prompt: "a cosy bakery" }), tailorSettings());
    expect(out.changed).toBe(true);
    expect(out.prompt).toBe("A warm, cosy bakery at dawn, shot on a 50mm lens.");

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const user = body.messages.find((m: { role: string }) => m.role === "user").content;
    expect(user).toContain("nano-banana-2");
    expect(user).toContain("a cosy bakery");
    expect(user).toMatch(/renders words well/);
  });

  it("warns a weak model away from writing when it rewrites", async () => {
    const { clearTailorCache, tailorPrompt } = await import("../src/lib/promptTailor");
    clearTailorCache();
    const fetchMock = vi.fn(async () => chatReply("A bakery with a wordless carved sign."));
    vi.stubGlobal("fetch", fetchMock);

    await tailorPrompt(manifestRow({ model: "turbo", prompt: "bakery with a sign saying BREAD" }), tailorSettings());
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const user = body.messages.find((m: { role: string }) => m.role === "user").content;
    expect(user).toMatch(/cannot render readable words/);
  });

  it("strips quotes the text model wraps around its answer", async () => {
    const { clearTailorCache, tailorPrompt } = await import("../src/lib/promptTailor");
    clearTailorCache();
    vi.stubGlobal("fetch", async () => chatReply('"A quoted rewrite."'));
    const out = await tailorPrompt(manifestRow({ prompt: "unique-prompt-quotes" }), tailorSettings());
    expect(out.prompt).toBe("A quoted rewrite.");
  });

  it("keeps the original prompt when the text model fails", async () => {
    const { clearTailorCache, tailorPrompt } = await import("../src/lib/promptTailor");
    clearTailorCache();
    vi.stubGlobal("fetch", async () => new Response("upstream is down", { status: 500 }));
    const out = await tailorPrompt(manifestRow({ prompt: "unique-prompt-fail" }), tailorSettings());
    expect(out.prompt).toBe("unique-prompt-fail");
    expect(out.changed).toBe(false);
    expect(out.problem).toBeTruthy();
  });

  it("rejects a runaway rewrite rather than sending it", async () => {
    const { clearTailorCache, tailorPrompt } = await import("../src/lib/promptTailor");
    clearTailorCache();
    vi.stubGlobal("fetch", async () => chatReply("x".repeat(5000)));
    const out = await tailorPrompt(manifestRow({ prompt: "unique-prompt-runaway" }), tailorSettings());
    expect(out.prompt).toBe("unique-prompt-runaway");
    expect(out.problem).toMatch(/unusable/);
  });

  it("remembers a rewrite so a re-run costs nothing", async () => {
    const { clearTailorCache, tailorPrompt } = await import("../src/lib/promptTailor");
    clearTailorCache();
    const fetchMock = vi.fn(async () => chatReply("Remembered rewrite."));
    vi.stubGlobal("fetch", fetchMock);

    const r = manifestRow({ prompt: "unique-prompt-cache" });
    await tailorPrompt(r, tailorSettings());
    await tailorPrompt(r, tailorSettings());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
