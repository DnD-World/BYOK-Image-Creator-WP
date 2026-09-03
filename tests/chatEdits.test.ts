/**
 * The chat changing rows that already exist — the Scribe's real job.
 *
 * The danger here is different from writing new rows. A bad new row is one
 * wasted picture; a bad edit silently rewrites work you already have. So
 * nothing is applied without being shown, unknown rows are dropped rather than
 * guessed at, and the fields a chat may touch are a closed list.
 */
import { describe, expect, it } from "vitest";
import { manifestDigest, parseEdits, parseReply } from "../src/lib/chatPlan";
import { STYLE_CATALOGUE } from "../src/lib/styleCatalogue";
import type { ForgeSettings } from "../src/lib/providers";

const settings = () =>
  ({
    localBase: "http://localhost:8080/v1",
    localModel: "flux.2-klein-4b",
    cloudflare: { accountId: "a", token: "t" },
    pollinationsToken: "t",
    geminiKeys: [],
    geminiPaidKeys: [],
    openaiKeys: [],
  }) as unknown as ForgeSettings;

const rows = () => [
  { id: 1, filename: "image_a.png", prompt: "a cat", style: "claymation", model: "cloudflare-flux", aspect_ratio: "1:1", status: "done", note: "" },
  { id: 2, filename: "image_b.png", prompt: "a dog", style: "claymation", model: "cloudflare-flux", aspect_ratio: "16:9", status: "pending", note: "" },
];

const editLine = (o: unknown) => `EDIT: ${JSON.stringify(o)}`;

describe("what the chat can see", () => {
  it("lists the rows with what matters for changing them", () => {
    const d = manifestDigest(rows() as never);
    expect(d).toContain("#1 image_a.png");
    expect(d).toContain("[done]");
    expect(d).toContain("a cat");
  });

  it("caps the list, because the whole thing is sent every message", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ ...rows()[0], id: i + 1 }));
    const d = manifestDigest(many as never, 60);
    expect(d).toContain("140 more, not listed");
    expect(d.split("\n").length).toBeLessThan(70);
  });

  it("says so plainly when there is nothing there", () => {
    expect(manifestDigest([])).toMatch(/empty/i);
  });
});

describe("reading an edit", () => {
  it("records what would change, old value and new", () => {
    const corrections: string[] = [];
    const { edits, previews } = parseEdits([{ id: 1, prompt: "a moodier cat" }], rows() as never, corrections);
    expect(edits).toEqual([{ id: 1, prompt: "a moodier cat" }]);
    expect(previews[0].changes[0]).toEqual({ field: "prompt", from: "a cat", to: "a moodier cat" });
  });

  it("drops a row that does not exist rather than guessing", () => {
    // "row 12" when there is no row 12 must never quietly become row 2.
    const corrections: string[] = [];
    const { edits } = parseEdits([{ id: 12, prompt: "x" }], rows() as never, corrections);
    expect(edits).toEqual([]);
    expect(corrections.join(" ")).toMatch(/no row #12/);
  });

  it("ignores a change that changes nothing", () => {
    const corrections: string[] = [];
    const { edits } = parseEdits([{ id: 1, prompt: "a cat" }], rows() as never, corrections);
    expect(edits).toEqual([]);
  });

  it("refuses a style that does not exist and keeps the row's own", () => {
    const corrections: string[] = [];
    const { edits } = parseEdits([{ id: 1, style: "vaporwave-dreamcore" }], rows() as never, corrections);
    expect(edits).toEqual([]);
    expect(corrections.join(" ")).toMatch(/no style called/);
  });

  it("accepts a style that does exist", () => {
    const other = STYLE_CATALOGUE.find((s) => s.id !== "claymation")!;
    const { edits } = parseEdits([{ id: 1, style: other.id }], rows() as never, []);
    expect(edits[0].style).toBe(other.id);
  });

  it("refuses a shape that is not one of the four", () => {
    const corrections: string[] = [];
    parseEdits([{ id: 1, aspect: "4:5" }], rows() as never, corrections);
    expect(corrections.join(" ")).toMatch(/not a shape/);
  });
});

describe("what an edit may never touch", () => {
  it("cannot change a row's status", () => {
    const { edits } = parseEdits([{ id: 2, status: "done" }], rows() as never, []);
    expect(edits).toEqual([]);
  });

  it("cannot change when a row was made, or its error", () => {
    const { edits } = parseEdits([{ id: 1, generated_at: "2020-01-01", error: "" }], rows() as never, []);
    expect(edits).toEqual([]);
  });

  it("cannot move a row to another id", () => {
    const { edits } = parseEdits([{ id: 1, id2: 5 }], rows() as never, []);
    expect(edits).toEqual([]);
  });
});

describe("an edit reply end to end", () => {
  it("comes back as edits and previews, not as new rows", () => {
    const r = parseReply(`Made them moodier.\n${editLine([{ id: 1, prompt: "a brooding cat" }])}`, settings(), rows() as never);
    expect(r.say).toBe("Made them moodier.");
    expect(r.rows).toBeNull();
    expect(r.plan).toBeNull();
    expect(r.edits).toHaveLength(1);
    expect(r.previews?.[0].changes).toHaveLength(1);
  });

  it("says so when nothing it asked for would actually change", () => {
    const r = parseReply(editLine([{ id: 1, prompt: "a cat" }]), settings(), rows() as never);
    expect(r.edits).toBeNull();
    expect(r.corrections.join(" ")).toMatch(/Nothing would actually change/);
  });

  it("keeps the words when the JSON is mangled", () => {
    const r = parseReply('Here you go.\nEDIT: [{"id": 1, ', settings(), rows() as never);
    expect(r.say).toContain("Here you go.");
    expect(r.edits).toBeNull();
  });
});
