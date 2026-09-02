/**
 * Vision is no longer tied to one company. These pin the two things that
 * makes possible: any OpenAI-shaped endpoint works, and a failure says what
 * actually went wrong rather than showing a status code.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { askVision, explainVisionFailure, jsonFromReply, listChatModels, VISION_PRESETS } from "../src/lib/visionEngine";

const engine = { base: "https://api.example.com/v1", key: "k", model: "some-vision-model" };

const reply = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, text: async () => JSON.stringify(body) } as unknown as Response);

afterEach(() => vi.unstubAllGlobals());

describe("asking a model to look at a picture", () => {
  it("sends the OpenAI shape, with the image as a data URL", async () => {
    const fetchMock = reply({ choices: [{ message: { content: "red" } }] });
    vi.stubGlobal("fetch", fetchMock);

    const r = await askVision(engine, "BASE64DATA", "what colour?");
    expect(r).toEqual({ ok: true, text: "red" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.model).toBe("some-vision-model");
    expect(sent.messages[0].content[1].image_url.url).toBe("data:image/png;base64,BASE64DATA");
  });

  it("copes with an endpoint that hands the parts array back", async () => {
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: [{ text: "a " }, { text: "sign" }] } }] }));
    expect(await askVision(engine, "x", "q")).toEqual({ ok: true, text: "a sign" });
  });

  it("trims a trailing slash off the address rather than making a double slash", async () => {
    const fetchMock = reply({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchMock);
    await askVision({ ...engine, base: "https://api.example.com/v1/" }, "x", "q");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/v1/chat/completions");
  });

  it("does not demand a key for a model on your own machine", async () => {
    const fetchMock = reply({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchMock);
    const r = await askVision({ base: "http://localhost:8080/v1", key: "", model: "m" }, "x", "q");
    expect(r.ok).toBe(true);
  });

  it("asks for a key when the endpoint is somebody else's", async () => {
    const r = await askVision({ ...engine, key: "" }, "x", "q");
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.problem).toMatch(/no vision key/);
  });

  it("says which field is missing instead of failing vaguely", async () => {
    const noModel = await askVision({ ...engine, model: "" }, "x", "q");
    expect(noModel.ok === false && noModel.problem).toMatch(/Load models/);
    const noBase = await askVision({ ...engine, base: "" }, "x", "q");
    expect(noBase.ok === false && noBase.problem).toMatch(/Settings/);
  });

  it("reports an empty reply rather than pretending it worked", async () => {
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: "   " } }] }));
    const r = await askVision(engine, "x", "q");
    expect(r.ok).toBe(false);
  });
});

describe("what a failure is called", () => {
  it.each([
    [401, "", /refused/],
    [403, "", /refused/],
    [429, "slow down", /wait a moment/],
    [404, "", /not on this endpoint/],
    [500, "", /their end, not yours/],
  ])("%i is explained, not just shown", (status, body, expected) => {
    expect(explainVisionFailure(status as number, body as string)).toMatch(expected as RegExp);
  });

  it("names an empty account, even when it arrives as a 429", () => {
    // Providers routinely send 429 for "you have no money", which tells the
    // user to wait for a reset that is never coming.
    expect(explainVisionFailure(429, "Your prepayment credits are depleted")).toMatch(/no credit/);
  });

  it("says so when the model simply cannot see", () => {
    expect(explainVisionFailure(400, "This model does not support image input")).toMatch(/cannot look at pictures/);
  });
});

describe("digging JSON out of a reply", () => {
  it("reads a bare object", () => {
    expect(jsonFromReply('{"surface":"sign"}')).toEqual({ surface: "sign" });
  });

  it("reads one wrapped in a fenced code block", () => {
    expect(jsonFromReply('```json\n{"surface":"sign"}\n```')).toEqual({ surface: "sign" });
  });

  it("reads one buried in chat", () => {
    expect(jsonFromReply('Sure! Here you go:\n{"surface":"sign"}\nHope that helps.')).toEqual({ surface: "sign" });
  });

  it("throws clearly when there is no object at all", () => {
    expect(() => jsonFromReply("I could not find a good spot.")).toThrow(/no JSON object/);
  });
});

describe("listing what an endpoint really has", () => {
  it("returns the ids, sorted", async () => {
    vi.stubGlobal("fetch", reply({ data: [{ id: "zeta" }, { id: "alpha" }] }));
    expect(await listChatModels(engine)).toEqual({ ok: true, models: ["alpha", "zeta"] });
  });

  it("says so when the endpoint lists nothing, instead of showing an empty box", async () => {
    vi.stubGlobal("fetch", reply({ data: [] }));
    const r = await listChatModels(engine);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.problem).toMatch(/listed no models/);
  });
});

describe("the presets", () => {
  it("all point at an OpenAI-shaped v1 address", () => {
    for (const p of VISION_PRESETS) expect(p.base).toMatch(/\/v1(beta\/openai)?$/);
  });

  it("offers at least one that costs nothing", () => {
    expect(VISION_PRESETS.some((p) => p.free)).toBe(true);
  });

  it("gives every paid preset somewhere to get a key", () => {
    for (const p of VISION_PRESETS.filter((x) => !x.free)) expect(p.keyUrl).not.toBe("");
  });
});
