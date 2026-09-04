/**
 * Vision is no longer tied to one company. These pin the two things that
 * makes possible: any OpenAI-shaped endpoint works, and a failure says what
 * actually went wrong rather than showing a status code.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askVision,
  type ChatModel,
  explainVisionFailure,
  filterModels,
  jsonFromReply,
  listChatModels,
  readModelEntry,
  routeBase,
  VISION_PRESETS,
} from "../src/lib/visionEngine";

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
    const r = await listChatModels(engine);
    expect(r.ok && r.models.map((m) => m.id)).toEqual(["alpha", "zeta"]);
  });

  it("says nothing is known about a bare list, rather than assuming", async () => {
    // NVIDIA and Google's OpenAI-shaped endpoint both answer like this.
    vi.stubGlobal("fetch", reply({ data: [{ id: "alpha" }] }));
    const r = await listChatModels(engine);
    expect(r.ok && r.models[0]).toEqual({ id: "alpha", free: null, vision: null, chat: null });
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


/**
 * What the model list is allowed to hide.
 *
 * The governing rule: a filter hides only what the provider positively said to
 * hide. Anything unstated stays visible. Hiding on a guess means the model you
 * wanted vanishes and nothing tells you why — which is worse than a list that
 * is too long, because a long list is at least honest about the problem.
 */
describe("reading what a provider says about a model", () => {
  it("reads OpenRouter's price, so free means free", () => {
    const free = readModelEntry({ id: "a", pricing: { prompt: "0", completion: "0" } });
    const paid = readModelEntry({ id: "b", pricing: { prompt: "0.0000001", completion: "0.0000002" } });
    expect(free?.free).toBe(true);
    expect(paid?.free).toBe(false);
  });

  it("reads OpenRouter's modalities, so vision means vision", () => {
    const sees = readModelEntry({ id: "a", architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } });
    const blind = readModelEntry({ id: "b", architecture: { input_modalities: ["text"], output_modalities: ["text"] } });
    expect(sees?.vision).toBe(true);
    expect(blind?.vision).toBe(false);
  });

  it("rules out anything that cannot answer in words", () => {
    // OpenRouter lists audio and image generators beside the chat models.
    const audio = readModelEntry({ id: "lyria", architecture: { input_modalities: ["text"], output_modalities: ["audio"] } });
    expect(audio?.chat).toBe(false);
  });

  it("reads Mistral's capabilities, which is what makes its list usable", () => {
    // mistral-embed sits in the same list as the chat models and fails with an
    // error that never says why. This is the field that separates them.
    const embed = readModelEntry({ id: "mistral-embed", capabilities: { completion_chat: false, vision: false } });
    const chat = readModelEntry({ id: "mistral-medium-latest", capabilities: { completion_chat: true, vision: true } });
    expect(embed?.chat).toBe(false);
    expect(chat?.chat).toBe(true);
    expect(chat?.vision).toBe(true);
  });

  it("skips an entry with no id at all rather than inventing one", () => {
    expect(readModelEntry({ object: "model" })).toBeNull();
  });
});

describe("filtering the model list", () => {
  const m = (over: Partial<ChatModel>): ChatModel => ({ id: "x", free: null, vision: null, chat: null, ...over });

  it("hides a model the provider said costs money", () => {
    const out = filterModels([m({ id: "paid", free: false }), m({ id: "free", free: true })], { freeOnly: true });
    expect(out.map((x) => x.id)).toEqual(["free"]);
  });

  it("keeps a model whose price was never stated, even when hiding paid ones", () => {
    // The NVIDIA case. Hiding here would empty the list over a question the
    // endpoint was never asked.
    const out = filterModels([m({ id: "unknown" })], { freeOnly: true });
    expect(out.map((x) => x.id)).toEqual(["unknown"]);
  });

  it("keeps a model whose modality was never stated, even when asking for vision", () => {
    const out = filterModels([m({ id: "unknown" })], { visionOnly: true });
    expect(out.map((x) => x.id)).toEqual(["unknown"]);
  });

  it("hides one the provider said is text only", () => {
    const out = filterModels([m({ id: "blind", vision: false }), m({ id: "sees", vision: true })], { visionOnly: true });
    expect(out.map((x) => x.id)).toEqual(["sees"]);
  });

  it("always hides what the provider said cannot chat", () => {
    expect(filterModels([m({ id: "embed", chat: false })])).toEqual([]);
  });

  it("falls back to reading the name only where nothing was stated", () => {
    // Real ids from NVIDIA's list, which discloses nothing else about them.
    expect(filterModels([m({ id: "nvidia/nv-embedqa-e5-v5" })])).toEqual([]);
    expect(filterModels([m({ id: "nvidia/rerank-qa-mistral-4b-v3" })])).toEqual([]);
    expect(filterModels([m({ id: "meta/llama-3.1-70b-instruct" })]).map((x) => x.id)).toEqual([
      "meta/llama-3.1-70b-instruct",
    ]);
  });

  it("does not mistake a short word inside a longer one", () => {
    // "clip" lives inside "eclipse"; "stt" inside plenty of things. A guess
    // that eats a real chat model is worse than one that lets an odd id past.
    for (const id of ["anthropic/eclipse-1", "acme/instructor-7b", "x/attention-7b"]) {
      expect(filterModels([m({ id })]).map((x) => x.id), id).toEqual([id]);
    }
  });

  it("never overrules a provider that said the model does chat", () => {
    // A name containing "guard" or "clip" is a hint, not evidence. When the
    // provider has answered, the answer wins.
    const named = m({ id: "some/embed-chat-model", chat: true });
    expect(filterModels([named]).map((x) => x.id)).toEqual(["some/embed-chat-model"]);
  });
});

describe("providers a browser is not allowed to call", () => {
  // The detour exists only inside the app's window. In Node — the MCP server,
  // and these tests by default — there is no CORS rule and no proxy to reach,
  // so the real address must be used. Both halves are worth pinning.
  const asBrowser = (fn: () => void) => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    try {
      fn();
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it("leaves NVIDIA alone in Node, where there is nothing to route around", () => {
    expect(routeBase("https://integrate.api.nvidia.com/v1")).toBe("https://integrate.api.nvidia.com/v1");
  });

  it("sends NVIDIA through the app's own proxy in the browser", () => {
    // NVIDIA answers the preflight 200 with no Access-Control-Allow-Origin
    // header, so the browser refuses and reports "Failed to fetch". Verified
    // 4 September 2026 — not the key, and not fixable from the page.
    asBrowser(() => expect(routeBase("https://integrate.api.nvidia.com/v1")).toBe("/nv-api/v1"));
  });

  it("leaves everyone else exactly as typed, even in the browser", () => {
    asBrowser(() => {
      expect(routeBase("https://api.mistral.ai/v1")).toBe("https://api.mistral.ai/v1");
      expect(routeBase("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api/v1");
      expect(routeBase("http://localhost:8080/v1")).toBe("http://localhost:8080/v1");
    });
  });

  it("strips a trailing slash either way", () => {
    expect(routeBase("https://api.mistral.ai/v1/")).toBe("https://api.mistral.ai/v1");
  });
});
