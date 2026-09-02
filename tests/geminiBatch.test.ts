import { afterEach, describe, expect, it, vi } from "vitest";
import { batchRequestFor, checkBatch, collectBatch, describeJob, submitBatch } from "../src/lib/geminiBatch.mjs";

const png = () => new Uint8Array([137, 80, 78, 71]);
const b64png = () => Buffer.from(png()).toString("base64");

const row = (over: Record<string, unknown> = {}) => ({
  filename: "shop_bakery.png",
  prompt: "a warm bakery",
  aspect_ratio: "16:9",
  seed: 1,
  model: "nano-banana-2",
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("batchRequestFor", () => {
  it("uses the generateContent shape batch jobs require, not the live one", () => {
    const req = batchRequestFor(row()) as Record<string, any>;
    expect(req.contents[0].parts[0].text).toBe("a warm bakery");
    expect(req.generationConfig.responseModalities).toEqual(["TEXT", "IMAGE"]);
    expect(req.generationConfig.imageConfig.aspectRatio).toBe("16:9");
  });

  it("folds the negative prompt in", () => {
    const req = batchRequestFor(row({ negative_prompt: "blurry" })) as Record<string, any>;
    expect(req.contents[0].parts[0].text).toContain("Avoid: blurry");
  });
});

describe("submitBatch", () => {
  it("sends every row in one job and hands back a trackable name", async () => {
    const fetchMock = vi.fn(async () => Response.json({ name: "batches/abc123" }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const job = await submitBatch([row(), row({ filename: "shop_inn.png" })], {
      apiKey: "k",
      modelId: "nano-banana-2",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-3.1-flash-image:batchGenerateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(String(init.body));
    expect(body.batch.input_config.requests.requests).toHaveLength(2);
    expect(body.batch.input_config.requests.requests[1].metadata.key).toBe("shop_inn.png");
    expect(job).toMatchObject({ name: "batches/abc123", count: 2, model: "nano-banana-2" });
    expect(job.filenames).toEqual(["shop_bakery.png", "shop_inn.png"]);
  });

  it("refuses models that have no batch mode", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(submitBatch([row()], { apiKey: "k", modelId: "cloudflare-flux" })).rejects.toThrow(/cannot be sent as a batch/);
  });

  it("refuses to send nothing, or to send without a key", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(submitBatch([], { apiKey: "k", modelId: "nano-banana-2" })).rejects.toThrow(/Nothing to send/);
    await expect(submitBatch([row()], { apiKey: "", modelId: "nano-banana-2" })).rejects.toThrow(/No Google key/);
  });

  it("says so when Google refuses the job", async () => {
    vi.stubGlobal("fetch", async () => new Response("billing not enabled", { status: 400 }));
    await expect(submitBatch([row()], { apiKey: "k", modelId: "nano-banana-2" })).rejects.toThrow(/billing not enabled/);
  });
});

describe("checkBatch", () => {
  it("reports progress in words", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ metadata: { state: "JOB_STATE_RUNNING" } }, { status: 200 }));
    const s = await checkBatch("batches/abc", "k");
    expect(s.done).toBe(false);
    expect(s.failed).toBe(false);
    expect(s.label).toMatch(/drawing/);
  });

  it("knows when a job is finished", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ done: true, metadata: { state: "JOB_STATE_SUCCEEDED" } }, { status: 200 }));
    expect((await checkBatch("batches/abc", "k")).done).toBe(true);
  });

  it("knows when a job died", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ metadata: { state: "JOB_STATE_FAILED" } }, { status: 200 }));
    const s = await checkBatch("batches/abc", "k");
    expect(s.failed).toBe(true);
  });
});

describe("collectBatch", () => {
  const job = {
    response: {
      inlinedResponses: {
        inlinedResponses: [
          {
            metadata: { key: "shop_bakery.png" },
            response: { candidates: [{ content: { parts: [{ inlineData: { data: b64png() } }] } }] },
          },
          { metadata: { key: "shop_inn.png" }, error: { message: "blocked by safety filters" } },
          {
            metadata: { key: "shop_forge.png" },
            response: { candidates: [{ content: { parts: [{ text: "no picture here" }] } }] },
          },
        ],
      },
    },
  };

  it("pulls the finished images out and names them correctly", () => {
    const { images, failures } = collectBatch(job);
    expect(images).toHaveLength(1);
    expect(images[0].filename).toBe("shop_bakery.png");
    expect(images[0].bytes).toEqual(png());
  });

  it("keeps the failures separate and explains each one", () => {
    const { failures } = collectBatch(job);
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatchObject({ filename: "shop_inn.png" });
    expect(failures[0].error).toMatch(/safety/);
    expect(failures[1].error).toMatch(/without an image/);
  });

  it("copes with an empty job rather than throwing", () => {
    expect(collectBatch({})).toEqual({ images: [], failures: [] });
  });
});

describe("describeJob", () => {
  it("describes a job in plain words", () => {
    const text = describeJob({ count: 12, model: "nano-banana-2", submittedAt: "2026-09-02T10:00:00.000Z" });
    expect(text).toContain("12 images");
    expect(text).toContain("nano-banana-2");
  });
});
