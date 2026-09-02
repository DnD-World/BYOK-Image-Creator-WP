/**
 * The app and the MCP server each carry their own CSV reader. They write to the
 * same file, so the two must agree byte for byte — this pins them together, and
 * fails loudly the moment one side is changed alone.
 */
import { describe, expect, it } from "vitest";
import { parseCsv as appParse, rowsToCsv } from "../src/lib/csv";
import { parseCsv as mcpParse } from "../scripts/mcp-server.js";
import type { ManifestRow } from "../src/types";

const SAMPLES = [
  "id,filename\n1,shop_bakery.png\n",
  'id,prompt\n1,"a shop, a cat, a lamp"\n',
  'id,prompt\n1,"line one\nline two"\n',
  'id,prompt\n1,"he said ""hello"""\n',
  "id,filename\r\n1,a.png\r\n2,b.png\r\n",
  "\uFEFFID, Negative Prompt\n1,x\n",
  "id,filename\n\n1,a.png\n\n",
  "id,filename,prompt\n1,a.png,\n",
];

const row: ManifestRow = {
  id: 7,
  filename: "item_lantern.png",
  prompt: 'a "brass" lantern, lit\nhanging from a hook',
  negative_prompt: "blurry, text",
  note: "for the market stall",
  category: "item",
  item_id: "lantern",
  shop_id: "",
  event_id: "",
  style: "claymation",
  aspect_ratio: "4:3",
  seed: 12345,
  model: "imagen-4",
  status: "done",
  error: "",
  generated_at: "2026-09-01T10:00:00.000Z",
  imported_attachment_id: "",
};

describe("CSV parity between the app and the MCP server", () => {
  it.each(SAMPLES)("agrees on sample %#", (sample) => {
    expect(mcpParse(sample)).toEqual(appParse(sample));
  });

  it("reads a manifest written by the app identically", () => {
    const csv = rowsToCsv([row]);
    expect(mcpParse(csv)).toEqual(appParse(csv));
  });
});
