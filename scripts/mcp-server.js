#!/usr/bin/env node
/**
 * Image Forge — MCP server (the "API" for Claude Code, Hermes, LangChain, n8n…).
 *
 *   node scripts/mcp-server.js
 *
 * Speaks MCP over stdio. It drives the SAME marketplace-images.csv manifest the
 * web app uses, and can actually generate images with no API key by calling the
 * free Pollinations endpoint. So an agent can:
 *   · read the manifest           (forge_list / forge_status)
 *   · add new picture ideas       (forge_add_row)
 *   · generate the pending ones   (forge_generate_pending) → real PNGs on disk
 *   · retry failures              (forge_retry_failed)
 *
 * Images land in shops/ items/ events/ npcs/ under --out (default: ./generated-images).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/* ---------------- config ---------------- */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const CSV_PATH = path.resolve(flag("--csv", "marketplace-images.csv"));
const OUT_DIR = path.resolve(flag("--out", "generated-images"));

const COLUMNS = [
  "id", "filename", "prompt", "negative_prompt", "category", "style",
  "aspect_ratio", "seed", "model", "status", "error", "generated_at",
];
const FOLDERS = { shop: "shops", item: "items", event: "events", npc: "npcs" };
const DIMS = { "16:9": [1024, 576], "1:1": [768, 768], "9:16": [576, 1024], "4:3": [1024, 768] };

/* ---------------- tiny CSV ---------------- */

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  if (!rows.length) return { headers: COLUMNS, records: [] };
  return { headers: rows[0].map((h) => h.trim().toLowerCase()), records: rows.slice(1) };
}

function toCsv(headers, records) {
  const q = (v) => (/[",\n\r]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  return [headers, ...records].map((r) => r.map(q).join(",")).join("\n") + "\n";
}

function loadManifest() {
  if (!fs.existsSync(CSV_PATH)) return { headers: COLUMNS, records: [] };
  return parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
}
function saveManifest(m) {
  fs.writeFileSync(CSV_PATH, toCsv(m.headers, m.records), "utf8");
}
const col = (headers, name) => headers.indexOf(name);
const get = (headers, rec, name) => {
  const i = col(headers, name);
  return i >= 0 && i < rec.length ? rec[i] : "";
};
const set = (headers, rec, name, val) => {
  let i = col(headers, name);
  if (i < 0) { headers.push(name); i = headers.length - 1; }
  rec[i] = val;
};
const toRows = (m) =>
  m.records.map((rec) => {
    const o = {};
    for (const h of m.headers) o[h] = get(m.headers, rec, h);
    return o;
  });

/* ---------------- generation (free, keyless) ---------------- */

async function generateImage(row) {
  const [w, h] = DIMS[row.aspect_ratio] || DIMS["16:9"];
  const url =
    "https://image.pollinations.ai/prompt/" + encodeURIComponent(row.prompt) +
    `?width=${w}&height=${h}&seed=${row.seed || 1}&model=flux&nologo=true&safe=true` +
    (row.negative_prompt ? `&negative=${encodeURIComponent(row.negative_prompt)}` : "");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pollinations said ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const folder = FOLDERS[row.category] || "items";
  const dir = path.join(OUT_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, row.filename);
  fs.writeFileSync(dest, buf);
  return dest;
}

/* ---------------- MCP server ---------------- */

const server = new Server(
  { name: "image-forge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "forge_status",
    description: "Summarize the image manifest: how many pending, done, failed, etc.",
    inputSchema: z.object({}).shape,
  },
  {
    name: "forge_list",
    description: "List manifest rows (filename, category, status). Optional status filter.",
    inputSchema: z.object({ status: z.string().optional() }).shape,
  },
  {
    name: "forge_add_row",
    description: "Add a picture idea to the manifest.",
    inputSchema: z.object({
      filename: z.string().describe("lowercase, underscores, e.g. shop_bakery.png"),
      prompt: z.string(),
      negative_prompt: z.string().optional(),
      category: z.enum(["shop", "item", "event", "npc"]).default("item"),
      aspect_ratio: z.enum(["16:9", "1:1", "9:16", "4:3"]).default("1:1"),
      seed: z.number().optional(),
    }).shape,
  },
  {
    name: "forge_generate_pending",
    description: "Generate images for all pending rows using the free Pollinations endpoint. Writes PNGs to disk and marks rows done.",
    inputSchema: z.object({ limit: z.number().optional().describe("max rows to generate") }).shape,
  },
  {
    name: "forge_generate_one",
    description: "Generate a single row by filename.",
    inputSchema: z.object({ filename: z.string() }).shape,
  },
  {
    name: "forge_retry_failed",
    description: "Reset all failed rows back to pending so they can be generated again.",
    inputSchema: z.object({}).shape,
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  const m = loadManifest();
  const text = (s) => ({ content: [{ type: "text", text: s }] });

  try {
    switch (name) {
      case "forge_status": {
        const rows = toRows(m);
        const by = (s) => rows.filter((r) => r.status === s).length;
        return text(
          `manifest: ${CSV_PATH}\n` +
          `total=${rows.length} pending=${by("pending")} done=${by("done")} ` +
          `failed=${by("failed")} generating=${by("generating")} imported=${by("imported")}\n` +
          `output folder: ${OUT_DIR}`
        );
      }
      case "forge_list": {
        let rows = toRows(m);
        if (a.status) rows = rows.filter((r) => r.status === a.status);
        if (!rows.length) return text("(no rows" + (a.status ? ` with status ${a.status}` : "") + ")");
        return text(rows.map((r) => `${r.filename} [${r.category}] ${r.status || "pending"}`).join("\n"));
      }
      case "forge_add_row": {
        const maxId = toRows(m).reduce((mx, r) => Math.max(mx, parseInt(r.id) || 0), 0);
        const rec = [];
        set(m.headers, rec, "id", String(maxId + 1));
        set(m.headers, rec, "filename", a.filename);
        set(m.headers, rec, "prompt", a.prompt);
        set(m.headers, rec, "negative_prompt", a.negative_prompt || "");
        set(m.headers, rec, "category", a.category);
        set(m.headers, rec, "aspect_ratio", a.aspect_ratio);
        set(m.headers, rec, "seed", String(a.seed || Math.floor(Math.random() * 98) + 1));
        set(m.headers, rec, "status", "pending");
        m.records.push(rec);
        saveManifest(m);
        return text(`added ${a.filename} (id ${maxId + 1}) as pending`);
      }
      case "forge_generate_pending": {
        let rows = toRows(m).filter((r) => (r.status || "pending") === "pending");
        if (a.limit) rows = rows.slice(0, a.limit);
        if (!rows.length) return text("nothing pending to generate");
        const results = [];
        for (const r of rows) {
          const rec = m.records.find((x) => get(m.headers, x, "filename") === r.filename);
          try {
            set(m.headers, rec, "status", "generating");
            const dest = await generateImage(r);
            set(m.headers, rec, "status", "done");
            set(m.headers, rec, "generated_at", new Date().toISOString());
            set(m.headers, rec, "error", "");
            results.push(`✓ ${r.filename} → ${dest}`);
          } catch (e) {
            set(m.headers, rec, "status", "failed");
            set(m.headers, rec, "error", String(e.message || e).slice(0, 120));
            results.push(`✗ ${r.filename} — ${e.message || e}`);
          }
          saveManifest(m);
        }
        return text(results.join("\n"));
      }
      case "forge_generate_one": {
        const rec = m.records.find((x) => get(m.headers, x, "filename") === a.filename);
        if (!rec) return text(`no row named ${a.filename}`);
        const row = toRows(m).find((r) => r.filename === a.filename);
        try {
          const dest = await generateImage(row);
          set(m.headers, rec, "status", "done");
          set(m.headers, rec, "generated_at", new Date().toISOString());
          set(m.headers, rec, "error", "");
          saveManifest(m);
          return text(`✓ ${a.filename} → ${dest}`);
        } catch (e) {
          set(m.headers, rec, "status", "failed");
          set(m.headers, rec, "error", String(e.message || e).slice(0, 120));
          saveManifest(m);
          return text(`✗ ${a.filename} — ${e.message || e}`);
        }
      }
      case "forge_retry_failed": {
        let n = 0;
        for (const rec of m.records) {
          if (get(m.headers, rec, "status") === "failed") {
            set(m.headers, rec, "status", "pending");
            set(m.headers, rec, "error", "");
            n++;
          }
        }
        saveManifest(m);
        return text(n ? `reset ${n} failed row(s) to pending` : "no failed rows");
      }
      default:
        return text(`unknown tool: ${name}`);
    }
  } catch (e) {
    return text(`error: ${e.message || e}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// (runs until the host closes the connection)
