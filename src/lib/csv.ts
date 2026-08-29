import type { AspectKey, Category, ManifestRow, Status } from "../types";
import { ASPECTS, ASPECT_KEYS, CATEGORIES, STATUSES } from "../types";

export const FULL_COLUMNS = [
  "id",
  "filename",
  "prompt",
  "negative_prompt",
  "note",
  "category",
  "kind",
  "rating",
  "item_id",
  "shop_id",
  "event_id",
  "style",
  "aspect_ratio",
  "width",
  "height",
  "seed",
  "model",
  "status",
  "error",
  "generated_at",
  "imported_attachment_id",
];

function quote(v: string): string {
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export function rowsToCsv(rows: ManifestRow[]): string {
  const head = FULL_COLUMNS.join(",");
  const body = rows.map((r) => {
    const dims = ASPECTS[r.aspect_ratio] ?? ASPECTS["16:9"];
    return [
      String(r.id),
      r.filename,
      r.prompt,
      r.negative_prompt ?? "",
      r.note ?? "",
      r.category,
      r.kind ?? "",
      r.rating ?? "",
      r.item_id,
      r.shop_id,
      r.event_id,
      r.style,
      r.aspect_ratio,
      String(dims.w),
      String(dims.h),
      String(r.seed),
      r.model,
      r.status,
      r.error,
      r.generated_at,
      r.imported_attachment_id,
    ]
      .map(quote)
      .join(",");
  });
  return [head, ...body].join("\n");
}

/** RFC-4180-ish state machine: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): { headers: string[]; records: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return { headers, records: rows.slice(1) };
}

const normStatus = (s: string): Status => ((STATUSES as string[]).includes(s) ? (s as Status) : "pending");
const normCategory = (s: string): Category => ((CATEGORIES as string[]).includes(s) ? (s as Category) : "item");
const normAspect = (s: string): AspectKey => ((ASPECT_KEYS as string[]).includes(s) ? (s as AspectKey) : "16:9");

export interface ImportResult {
  rows: ManifestRow[];
  skipped: number;
}

export function rowsFromCsv(headers: string[], records: string[][], takenIds: Set<number>): ImportResult {
  const idx = (name: string) => headers.indexOf(name);
  const get = (rec: string[], name: string) => {
    const i = idx(name);
    return i >= 0 && i < rec.length ? rec[i].trim() : "";
  };

  const rows: ManifestRow[] = [];
  let skipped = 0;
  let nextId = 1;
  while (takenIds.has(nextId)) nextId++;

  for (const rec of records) {
    const filename = get(rec, "filename");
    if (!filename) {
      skipped++;
      continue;
    }
    let id = parseInt(get(rec, "id"), 10);
    if (!Number.isFinite(id) || takenIds.has(id)) id = nextId;
    takenIds.add(id);
    nextId = id + 1;
    while (takenIds.has(nextId)) nextId++;

    rows.push({
      id,
      filename,
      prompt: get(rec, "prompt"),
      negative_prompt: get(rec, "negative_prompt") || get(rec, "negative") || undefined,
      note: get(rec, "note") || undefined,
      category: normCategory(get(rec, "category")),
      kind: get(rec, "kind") || undefined,
      rating: (get(rec, "rating") === "like" || get(rec, "rating") === "dislike" ? get(rec, "rating") : undefined) as
        | "like"
        | "dislike"
        | undefined,
      item_id: get(rec, "item_id"),
      shop_id: get(rec, "shop_id"),
      event_id: get(rec, "event_id"),
      style: get(rec, "style") || "claymation",
      aspect_ratio: normAspect(get(rec, "aspect_ratio")),
      seed: parseInt(get(rec, "seed"), 10) || 0,
      model: get(rec, "model"),
      status: get(rec, "status") === "generating" ? "pending" : normStatus(get(rec, "status")),
      error: get(rec, "error"),
      generated_at: get(rec, "generated_at"),
      imported_attachment_id: get(rec, "imported_attachment_id"),
    });
  }
  return { rows, skipped };
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
