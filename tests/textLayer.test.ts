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
  // Vision now goes through whatever endpoint is configured, in the OpenAI
  // chat shape, so these no longer assume one company.
  const settings = (over: Record<string, unknown> = {}) =>
    ({
      vision: { base: "https://api.mistral.ai/v1", key: "secret", model: "pixtral-large-latest" },
      ...over,
    }) as never;

  const visionReply = (payload: unknown) =>
    Response.json({ choices: [{ message: { content: JSON.stringify(payload) } }] }, { status: 200 });

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

    const r = await findTextSpotWithVision("BASE64", "the shop name", settings());
    expect(r.surface).toBe("the hanging wooden sign");
    expect(r.confident).toBe(true);
    expect(r.quad[1].x).toBeCloseTo(0.8, 6);
    expect(isDrawableQuad(r.quad)).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe("pixtral-large-latest");
    expect(sent.messages[0].content[1].image_url.url).toBe("data:image/png;base64,BASE64");
    expect(sent.messages[0].content[0].text).toContain("the shop name");
  });

  it("works against any provider, not just the one we happened to test", async () => {
    const fetchMock = vi.fn(async () => visionReply({ quad: [[0, 0], [1, 0], [1, 1], [0, 1]], surface: "wall" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await findTextSpotWithVision(
      "x",
      "",
      settings({ vision: { base: "https://openrouter.ai/api/v1", key: "or-key", model: "some/vision-model" } })
    );
    expect(r.surface).toBe("wall");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
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
    const r = await findTextSpotWithVision("x", "", settings());
    expect(r.quad[2].x).toBeCloseTo(0.9, 6);
  });

  it("reads an answer the model wrapped in a code fence", async () => {
    // Chat models do this constantly. Failing over a stray backtick would
    // throw away a call that already cost something.
    vi.stubGlobal("fetch", async () =>
      Response.json({
        choices: [
          {
            message: {
              content: ["```json", '{"quad":[[0.1,0.1],[0.9,0.1],[0.9,0.3],[0.1,0.3]],"surface":"a crate"}', "```"].join(
                "\n"
              ),
            },
          },
        ],
      })
    );
    const r = await findTextSpotWithVision("x", "", settings());
    expect(r.surface).toBe("a crate");
    expect(r.problem).toBeUndefined();
  });

  it("keeps wildly out-of-frame corners near the picture", async () => {
    vi.stubGlobal("fetch", async () =>
      visionReply({ quad: [[-5, -5], [9, 0], [9, 9], [0, 9]], surface: "?" })
    );
    const r = await findTextSpotWithVision("x", "", settings());
    for (const p of r.quad) {
      expect(p.x).toBeLessThanOrEqual(1.1);
      expect(p.x).toBeGreaterThanOrEqual(-0.1);
    }
  });

  it("falls back to a caption box when the model returns nonsense", async () => {
    vi.stubGlobal("fetch", async () => visionReply({ quad: "somewhere nice" }));
    const r = await findTextSpotWithVision("x", "", settings());
    expect(r.confident).toBe(false);
    expect(r.problem).toBeTruthy();
    expect(isDrawableQuad(r.quad)).toBe(true);
  });

  it("explains an empty account rather than showing a status code", async () => {
    vi.stubGlobal("fetch", async () => new Response("prepayment credits are depleted", { status: 429 }));
    const r = await findTextSpotWithVision("x", "", settings());
    expect(r.problem).toMatch(/no credit/);
    expect(r.status).toBe(429);
    expect(isDrawableQuad(r.quad)).toBe(true);
  });

  it("says plainly when there is no key, without calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await findTextSpotWithVision("x", "", settings({ vision: { base: "https://api.mistral.ai/v1", key: "", model: "m" } }));
    expect(r.problem).toMatch(/no vision key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says which setting is missing when no model has been chosen", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await findTextSpotWithVision("x", "", settings({ vision: { base: "https://api.mistral.ai/v1", key: "k", model: "" } }));
    expect(r.problem).toMatch(/Load models/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives the network dying, and still hands back a usable box", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const r = await findTextSpotWithVision("x", "", settings());
    expect(r.problem).toBeTruthy();
    expect(isDrawableQuad(r.quad)).toBe(true);
  });
});
