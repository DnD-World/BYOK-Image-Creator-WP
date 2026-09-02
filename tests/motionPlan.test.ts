import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PLAN,
  MOTION_PRESETS,
  planMotion,
  sanitisePlan,
  type MotionPlan,
} from "../src/lib/motionPlan";
import { gifNameFor, loopPosition } from "../src/lib/makeGif";

const settings = (over: Record<string, unknown> = {}) =>
  ({
    scribe: { base: "https://api.openai.com/v1", key: "sk-test", model: "gpt-4o-mini" },
    ...over,
  }) as never;

const chatReply = (text: string) => Response.json({ choices: [{ message: { content: text } }] }, { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("sanitisePlan", () => {
  it("fills in everything from an empty object", () => {
    const p = sanitisePlan({});
    expect(p.frames).toBeGreaterThan(0);
    expect(p.frameMs).toBeGreaterThan(0);
    expect(p.summary.length).toBeGreaterThan(0);
  });

  it("drags absurd numbers back into range", () => {
    const p = sanitisePlan({
      zoom: 99,
      rotate: -400,
      flicker: 5,
      frames: 5000,
      frameMs: 1,
      cycles: 999,
      pan: { x: 8, y: -8 },
    } as Partial<MotionPlan>);
    expect(p.zoom).toBeLessThanOrEqual(1.6);
    expect(p.rotate).toBeGreaterThanOrEqual(-12);
    expect(p.flicker).toBeLessThanOrEqual(0.6);
    expect(p.frames).toBeLessThanOrEqual(48);
    expect(p.frameMs).toBeGreaterThanOrEqual(40);
    expect(p.cycles).toBeLessThanOrEqual(10);
    expect(p.pan.x).toBeLessThanOrEqual(0.3);
    expect(p.pan.y).toBeGreaterThanOrEqual(-0.3);
  });

  it("survives rubbish instead of numbers", () => {
    const p = sanitisePlan({ zoom: NaN, rotate: "spin" as unknown as number, frames: undefined });
    expect(Number.isFinite(p.zoom)).toBe(true);
    expect(Number.isFinite(p.rotate)).toBe(true);
    expect(p.frames).toBe(DEFAULT_PLAN.frames);
  });

  it("only accepts an easing it knows", () => {
    expect(sanitisePlan({ easing: "wobbly" as never }).easing).toBe("ease-in-out");
    expect(sanitisePlan({ easing: "bounce" }).easing).toBe("bounce");
  });

  it("keeps the note about what cannot be done", () => {
    expect(sanitisePlan({ beyondReach: "the flag cannot actually wave" }).beyondReach).toMatch(/flag/);
  });
});

describe("the ready-made movements", () => {
  it("every preset survives sanitising and stays sensible", () => {
    for (const p of MOTION_PRESETS) {
      const plan = sanitisePlan({ ...p.plan });
      expect(plan.frames, p.id).toBeGreaterThanOrEqual(4);
      expect(plan.frameMs, p.id).toBeGreaterThanOrEqual(40);
      expect(p.label.length, p.id).toBeGreaterThan(2);
      expect(p.hint.length, p.id).toBeGreaterThan(4);
    }
  });

  it("gives each preset a unique id", () => {
    const ids = MOTION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("loopPosition", () => {
  it("runs straight through when not ping-ponging", () => {
    expect(loopPosition(0, 10, false)).toBe(0);
    expect(loopPosition(5, 10, false)).toBeCloseTo(0.5, 5);
  });

  it("goes out and comes back when ping-ponging, so the loop is seamless", () => {
    expect(loopPosition(0, 10, true)).toBeCloseTo(0, 5);
    expect(loopPosition(5, 10, true)).toBeCloseTo(1, 5);
    expect(loopPosition(9, 10, true)).toBeCloseTo(0.2, 5);
  });

  it("never leaves 0..1", () => {
    for (let f = 0; f < 24; f++) {
      const v = loopPosition(f, 24, true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("gifNameFor", () => {
  it.each([
    ["shop_bakery.png", "shop_bakery.gif"],
    ["item_sword.jpeg", "item_sword.gif"],
    ["noextension", "noextension.gif"],
  ])("turns %s into %s", (a, b) => {
    expect(gifNameFor(a)).toBe(b);
  });
});

describe("planMotion", () => {
  it("uses the plan the text model returns", async () => {
    const fetchMock = vi.fn(async () =>
      chatReply('{"zoom":1.3,"flicker":0.4,"cycles":5,"frames":20,"frameMs":60,"summary":"Firelight flickers."}')
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await planMotion("the lantern flickers", settings());
    expect(res.fromModel).toBe(true);
    expect(res.plan.zoom).toBeCloseTo(1.3, 5);
    expect(res.plan.flicker).toBeCloseTo(0.4, 5);
    expect(res.plan.summary).toBe("Firelight flickers.");
  });

  it("copes with the model wrapping its JSON in chatter", async () => {
    vi.stubGlobal("fetch", async () =>
      chatReply('Sure! Here you go:\n```json\n{"zoom":1.2,"summary":"A push in."}\n```\nHope that helps.')
    );
    const res = await planMotion("push in", settings());
    expect(res.fromModel).toBe(true);
    expect(res.plan.zoom).toBeCloseTo(1.2, 5);
  });

  it("still clamps a wild plan from the model", async () => {
    vi.stubGlobal("fetch", async () => chatReply('{"zoom":50,"frames":9000,"summary":"whoosh"}'));
    const res = await planMotion("go mad", settings());
    expect(res.plan.zoom).toBeLessThanOrEqual(1.6);
    expect(res.plan.frames).toBeLessThanOrEqual(48);
  });

  it("falls back to a push in when the text model breaks", async () => {
    vi.stubGlobal("fetch", async () => chatReply("I am afraid I cannot do that."));
    const res = await planMotion("something", settings());
    expect(res.fromModel).toBe(false);
    expect(res.problem).toBeTruthy();
    expect(res.plan.zoom).toBeGreaterThan(1);
  });

  it("says plainly when there is no text engine, without calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await planMotion("wiggle", settings({ scribe: { base: "x", key: "  ", model: "m" } }));
    expect(res.problem).toMatch(/no text-engine key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes through the model's warning that the subject cannot move", async () => {
    vi.stubGlobal("fetch", async () =>
      chatReply('{"zoom":1.1,"summary":"A slow push in.","beyondReach":"The character cannot actually wave — that needs a video model."}')
    );
    const res = await planMotion("make him wave", settings());
    expect(res.plan.beyondReach).toMatch(/video model/);
  });

  it("does not bother the text model for an empty wish", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await planMotion("   ", settings());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.fromModel).toBe(false);
  });
});
