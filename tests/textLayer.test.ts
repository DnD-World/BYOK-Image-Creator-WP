import { describe, expect, it, vi, afterEach } from "vitest";
import { FONT_CHOICES, boxQuad, letteredNameFor, newTextLayer } from "../src/lib/textLayer";
import { findTextSpotWithVision, SPOT_SYSTEM } from "../src/lib/findTextSpot";
import { isDrawableQuad, quadArea } from "../src/lib/warp";

afterEach(() => vi.unstubAllGlobals());

describe("a new text layer", () => {
  it("is ready to draw straight away", () => {
    const l = newTextLayer();
    expect(l.text.length).toBeGreaterThan(0);
    expect(isDrawableQuad(l.quad)).toBe(true);
    expect(l.id).toMatch(/^t/);
  });

  it("gives each layer its own id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newTextLayer().id));
    expect(ids.size).toBe(50);
  });

  it("sits in the middle of the picture by default", () => {
    const l = newTextLayer();
    const cx = l.quad.reduce((s, p) => s + p.x, 0) / 4;
    const cy = l.quad.reduce((s, p) => s + p.y, 0) / 4;
    expect(cx).toBeCloseTo(0.5, 6);
    expect(cy).toBeCloseTo(0.5, 6);
  });

  it("offers real font stacks with fallbacks", () => {
    for (const f of FONT_CHOICES) {
      expect(f.stack).toContain(",");
      expect(f.label.length).toBeGreaterThan(2);
    }
  });
});

describe("moving the box", () => {
  it("keeps its area when rotated", () => {
    const flat = boxQuad(0.5, 0.5, 0.6, 0.2, 0);
    const tilted = boxQuad(0.5, 0.5, 0.6, 0.2, 25);
    expect(Math.abs(quadArea(tilted))).toBeCloseTo(Math.abs(quadArea(flat)), 8);
  });

  it("stays centred where it was put", () => {
    const q = boxQuad(0.3, 0.8, 0.4, 0.1, 40);
    const cx = q.reduce((s, p) => s + p.x, 0) / 4;
    const cy = q.reduce((s, p) => s + p.y, 0) / 4;
    expect(cx).toBeCloseTo(0.3, 8);
    expect(cy).toBeCloseTo(0.8, 8);
  });
});

describe("naming the lettered copy", () => {
  it.each([
    ["shop_sign.png", "shop_sign_lettered.png"],
    ["item_card.jpeg", "item_card_lettered.jpeg"],
    ["plain", "plain_lettered.png"],
  ])("turns %s into %s", (a, b) => {
    expect(letteredNameFor(a)).toBe(b);
  });

  it("never overwrites the original", () => {
    expect(letteredNameFor("a.png")).not.toBe("a.png");
  });
});

describe("asking a vision model where the text goes", () => {
  const settings = (over: Record<string, unknown> = {}) =>
    ({
      geminiKeys: [{ id: "k1", label: "k1", key: "secret", exhaustedUntil: 0 }],
      ...over,
    }) as never;

  const visionReply = (payload: unknown) =>
    Response.json(
      { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] },
      { status: 200 }
    );

  it("asks for corners in reading order and explains the coordinate system", () => {
    expect(SPOT_SYSTEM).toMatch(/CLOCKWISE/);
    expect(SPOT_SYSTEM).toMatch(/TOP-LEFT/);
    expect(SPOT_SYSTEM).toMatch(/fraction of the picture/);
  });

  it("reads back a perspective quad and what it found", async () => {
    const fetchMock = vi.fn(async () =>
      visionReply({
        quad: [[0.2, 0.3], [0.8, 0.34], [0.8, 0.5], [0.2, 0.54]],
        surface: "the hanging wooden sign",
        confident: true,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await findTextSpotWithVision("BASE64", "the shop name", settings(), "gemini-3.7-flash");
    expect(r.surface).toBe("the hanging wooden sign");
    expect(r.confident).toBe(true);
    expect(r.quad[1].x).toBeCloseTo(0.8, 6);
    expect(isDrawableQuad(r.quad)).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-3.7-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret");
    const sent = JSON.parse(String(init.body));
    expect(sent.contents[0].parts[1].inline_data.data).toBe("BASE64");
    expect(sent.contents[0].parts[0].text).toContain("the shop name");
  });

  it("accepts corners given as objects rather than pairs", async () => {
    vi.stubGlobal("fetch", async () =>
      visionReply({
        quad: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.3 },
          { x: 0.1, y: 0.3 },
        ],
        surface: "a banner",
      })
    );
    const r = await findTextSpotWithVision("x", "", settings(), "m");
    expect(r.quad[2].x).toBeCloseTo(0.9, 6);
  });

  it("keeps wildly out-of-frame corners near the picture", async () => {
    vi.stubGlobal("fetch", async () =>
      visionReply({ quad: [[-5, -5], [9, 0], [9, 9], [0, 9]], surface: "?" })
    );
    const r = await findTextSpotWithVision("x", "", settings(), "m");
    for (const p of r.quad) {
      expect(p.x).toBeLessThanOrEqual(1.1);
      expect(p.x).toBeGreaterThanOrEqual(-0.1);
    }
  });

  it("falls back to a caption box when the model returns nonsense", async () => {
    vi.stubGlobal("fetch", async () => visionReply({ quad: "somewhere nice" }));
    const r = await findTextSpotWithVision("x", "", settings(), "m");
    expect(r.confident).toBe(false);
    expect(r.problem).toBeTruthy();
    expect(isDrawableQuad(r.quad)).toBe(true);
  });

  it("hands back the status so the ladder can react to a 429", async () => {
    vi.stubGlobal("fetch", async () => new Response("quota exceeded", { status: 429 }));
    const r = await findTextSpotWithVision("x", "", settings(), "gemini-3.7-flash");
    expect(r.status).toBe(429);
    expect(r.model).toBe("gemini-3.7-flash");
    expect(r.body).toContain("quota");
  });

  it("says plainly when there is no key, without calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await findTextSpotWithVision("x", "", settings({ geminiKeys: [] }), "m");
    expect(r.problem).toMatch(/no Google key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips a key that is resting after a 429", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await findTextSpotWithVision(
      "x",
      "",
      settings({ geminiKeys: [{ id: "k", label: "k", key: "s", exhaustedUntil: Date.now() + 60_000 }] }),
      "m"
    );
    expect(r.problem).toMatch(/no Google key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives the network dying", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const r = await findTextSpotWithVision("x", "", settings(), "m");
    expect(r.problem).toBeTruthy();
    expect(isDrawableQuad(r.quad)).toBe(true);
  });
});
