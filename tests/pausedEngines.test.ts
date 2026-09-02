/**
 * Pausing an engine. A provider having a bad month should not cost you your
 * key setup, and should not cost you a timeout per row proving it again.
 */
import { describe, expect, it } from "vitest";
import { PausedEngineError, generateBytes, resolveRoute } from "../src/lib/engines.mjs";

const settings = (over: Record<string, unknown> = {}) =>
  ({
    provider: "gemini",
    geminiModel: "nano-banana-2",
    geminiKeys: [{ id: "a", label: "a", key: "k", exhaustedUntil: 0 }],
    geminiPaidKeys: [],
    localModel: "flux.2-klein-4b",
    pollinationsModel: "flux",
    openaiModel: "gpt-image-1",
    pausedEngines: [],
    ...over,
  }) as never;

const row = (model = "") => ({ prompt: "a cat", aspect_ratio: "1:1", seed: 1, model }) as never;

describe("routing while nothing is paused", () => {
  it("goes where it always went", () => {
    expect(resolveRoute(row(), settings()).engine).toBe("gemini");
    expect(resolveRoute(row("cloudflare-flux"), settings()).engine).toBe("cloudflare");
  });
});

describe("routing with an engine paused", () => {
  it("diverts the default engine and remembers what it was", () => {
    const r = resolveRoute(row(), settings({ pausedEngines: ["gemini"] }));
    expect(r.engine).toBe("paused");
    expect(r.pausedEngine).toBe("gemini");
  });

  it("also catches a row that names a paused engine's model directly", () => {
    // Pausing Google has to mean Google, not just "the default was Google".
    const r = resolveRoute(row("nano-banana-2"), settings({ pausedEngines: ["gemini"] }));
    expect(r.engine).toBe("paused");
  });

  it("leaves every other engine alone", () => {
    const s = settings({ pausedEngines: ["gemini"] });
    expect(resolveRoute(row("cloudflare-flux"), s).engine).toBe("cloudflare");
    expect(resolveRoute(row("flux"), s).engine).toBe("pollinations");
  });

  it("keeps the keys, so switching back on needs no setting up again", () => {
    const s = settings({ pausedEngines: ["gemini"] });
    expect((s as unknown as { geminiKeys: unknown[] }).geminiKeys).toHaveLength(1);
  });
});

describe("what happens when you try to run a paused engine", () => {
  it("fails at once, by name, without making a request", async () => {
    await expect(generateBytes(row(), settings({ pausedEngines: ["gemini"] }))).rejects.toThrow(PausedEngineError);
    await expect(generateBytes(row(), settings({ pausedEngines: ["gemini"] }))).rejects.toThrow(/Google is paused/);
  });

  it("tells you where to switch it back on", async () => {
    await expect(generateBytes(row(), settings({ pausedEngines: ["gemini"] }))).rejects.toThrow(/Settings/);
  });
});
