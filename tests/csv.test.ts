import { describe, expect, it } from "vitest";
import { FULL_COLUMNS, parseCsv, rowsFromCsv, rowsToCsv } from "../src/lib/csv";
import type { ManifestRow } from "../src/types";

const row = (over: Partial<ManifestRow> = {}): ManifestRow => ({
  id: 1,
  filename: "shop_bakery.png",
  prompt: "a warm bakery",
  category: "shop",
  item_id: "",
  shop_id: "bakery",
  event_id: "",
  style: "claymation",
  aspect_ratio: "16:9",
  seed: 42,
  model: "flux",
  status: "pending",
  error: "",
  generated_at: "",
  imported_attachment_id: "",
  ...over,
});

describe("parseCsv", () => {
  it("reads a plain file", () => {
    const { headers, records } = parseCsv("id,filename\n1,shop_bakery.png\n");
    expect(headers).toEqual(["id", "filename"]);
    expect(records).toEqual([["1", "shop_bakery.png"]]);
  });

  it("keeps commas inside quoted fields", () => {
    const { records } = parseCsv('id,prompt\n1,"a shop, a cat, a lamp"\n');
    expect(records[0][1]).toBe("a shop, a cat, a lamp");
  });

  it("keeps newlines inside quoted fields", () => {
    const { records } = parseCsv('id,prompt\n1,"line one\nline two"\n');
    expect(records).toHaveLength(1);
    expect(records[0][1]).toBe("line one\nline two");
  });

  it("unescapes doubled quotes", () => {
    const { records } = parseCsv('id,prompt\n1,"he said ""hello"""\n');
    expect(records[0][1]).toBe('he said "hello"');
  });

  it("handles CRLF line endings", () => {
    const { headers, records } = parseCsv("id,filename\r\n1,a.png\r\n2,b.png\r\n");
    expect(headers).toEqual(["id", "filename"]);
    expect(records).toEqual([["1", "a.png"], ["2", "b.png"]]);
  });

  it("strips a leading BOM and normalizes header casing/spacing", () => {
    const { headers } = parseCsv("\uFEFFID, Negative Prompt\n1,x\n");
    expect(headers).toEqual(["id", "negative_prompt"]);
  });

  it("skips blank lines", () => {
    const { records } = parseCsv("id,filename\n\n1,a.png\n\n");
    expect(records).toEqual([["1", "a.png"]]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("")).toEqual({ headers: [], records: [] });
  });
});

describe("rowsToCsv → parseCsv → rowsFromCsv", () => {
  it("round-trips a row without losing anything", () => {
    const original = row({ prompt: 'a "grand" shop, at dusk\nwith lanterns', negative_prompt: "blurry" });
    const { headers, records } = parseCsv(rowsToCsv([original]));
    expect(headers).toEqual(FULL_COLUMNS);
    const { rows, skipped } = rowsFromCsv(headers, records, new Set());
    expect(skipped).toBe(0);
    expect(rows[0].prompt).toBe(original.prompt);
    expect(rows[0].negative_prompt).toBe("blurry");
    expect(rows[0].seed).toBe(42);
    expect(rows[0].aspect_ratio).toBe("16:9");
  });

  it("writes the pixel dimensions for the aspect ratio", () => {
    const csv = rowsToCsv([row({ aspect_ratio: "9:16" })]);
    const { headers, records } = parseCsv(csv);
    expect(records[0][headers.indexOf("width")]).toBe("576");
    expect(records[0][headers.indexOf("height")]).toBe("1024");
  });

  it("re-numbers rows whose id is already taken", () => {
    const csv = rowsToCsv([row({ id: 1 }), row({ id: 2, filename: "shop_inn.png" })]);
    const { headers, records } = parseCsv(csv);
    const { rows } = rowsFromCsv(headers, records, new Set([1, 2]));
    expect(rows.map((r) => r.id)).toEqual([3, 4]);
  });

  it("drops rows with no filename", () => {
    const { headers, records } = parseCsv("id,filename,prompt\n1,,orphan\n2,shop_inn.png,keep\n");
    const { rows, skipped } = rowsFromCsv(headers, records, new Set());
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(1);
  });

  it("never imports a row as still generating", () => {
    const { headers, records } = parseCsv("id,filename,status\n1,shop_inn.png,generating\n");
    const { rows } = rowsFromCsv(headers, records, new Set());
    expect(rows[0].status).toBe("pending");
  });

  it("falls back to safe values for unknown enums", () => {
    const { headers, records } = parseCsv("id,filename,category,aspect_ratio,status\n1,x.png,dragon,3:7,exploded\n");
    const { rows } = rowsFromCsv(headers, records, new Set());
    expect(rows[0].category).toBe("item");
    expect(rows[0].aspect_ratio).toBe("16:9");
    expect(rows[0].status).toBe("pending");
  });
});
