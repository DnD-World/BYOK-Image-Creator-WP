export type Status =
  | "pending"
  | "generating"
  | "done"
  | "failed"
  | "skipped"
  | "imported";

export type Category = "shop" | "item" | "event" | "npc";

export type AspectKey = "16:9" | "1:1" | "9:16" | "4:3";

export interface ManifestRow {
  id: number;
  filename: string;
  prompt: string;
  category: Category;
  item_id: string;
  shop_id: string;
  event_id: string;
  style: string;
  aspect_ratio: AspectKey;
  seed: number;
  status: Status;
  error: string;
  generated_at: string;
  imported_attachment_id: string;
  preview?: string;
}

export interface LogEntry {
  t: string;
  msg: string;
  kind: "ok" | "err" | "info" | "run";
}

export interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "err" | "info";
}

export const STATUSES: Status[] = [
  "pending",
  "generating",
  "done",
  "failed",
  "skipped",
  "imported",
];

export const STATUS_META: Record<
  Status,
  { label: string; hex: string; chip: string; dot: string }
> = {
  pending: {
    label: "pending",
    hex: "#97876d",
    chip: "bg-[#97876d]/12 text-parch border-[#97876d]/35",
    dot: "bg-dust",
  },
  generating: {
    label: "generating",
    hex: "#f2a33c",
    chip: "bg-ember/12 text-ember border-ember/40",
    dot: "bg-ember",
  },
  done: {
    label: "done",
    hex: "#8cb56f",
    chip: "bg-moss/12 text-moss border-moss/40",
    dot: "bg-moss",
  },
  failed: {
    label: "failed",
    hex: "#e2593f",
    chip: "bg-blood/12 text-blood border-blood/40",
    dot: "bg-blood",
  },
  skipped: {
    label: "skipped",
    hex: "#7c746a",
    chip: "bg-[#7c746a]/12 text-[#a89e8f] border-[#7c746a]/40",
    dot: "bg-[#7c746a]",
  },
  imported: {
    label: "imported",
    hex: "#56b8a5",
    chip: "bg-lagoon/12 text-lagoon border-lagoon/40",
    dot: "bg-lagoon",
  },
};

export const CATEGORIES: Category[] = ["shop", "item", "event", "npc"];

export const CATEGORY_META: Record<
  Category,
  { label: string; hex: string; chip: string }
> = {
  shop: {
    label: "shop",
    hex: "#f2a33c",
    chip: "bg-ember/10 text-ember border-ember/35",
  },
  item: {
    label: "item",
    hex: "#b18ce0",
    chip: "bg-potion/10 text-potion border-potion/35",
  },
  event: {
    label: "event",
    hex: "#e2593f",
    chip: "bg-blood/10 text-blood border-blood/35",
  },
  npc: {
    label: "npc",
    hex: "#56b8a5",
    chip: "bg-lagoon/10 text-lagoon border-lagoon/35",
  },
};

export const ASPECTS: Record<
  AspectKey,
  { w: number; h: number; vbW: number; vbH: number }
> = {
  "16:9": { w: 1024, h: 576, vbW: 800, vbH: 450 },
  "1:1": { w: 768, h: 768, vbW: 620, vbH: 620 },
  "9:16": { w: 576, h: 1024, vbW: 450, vbH: 800 },
  "4:3": { w: 1024, h: 768, vbW: 720, vbH: 540 },
};

export const ASPECT_KEYS = Object.keys(ASPECTS) as AspectKey[];

export interface StyleDef {
  id: string;
  name: string;
  block: string;
  swatch: [string, string, string];
}

export const STYLES: StyleDef[] = [
  {
    id: "claymation",
    name: "Claymation",
    block:
      "claymation style, medieval fantasy, D&D marketplace, soft lighting, charming tabletop RPG illustration, clean composition",
    swatch: ["#e8b06a", "#a5552f", "#7d9c5c"],
  },
  {
    id: "stop-motion-clay",
    name: "Stop-Motion Clay",
    block:
      "stop motion clay style, visible fingerprints, medieval fantasy, D&D marketplace, warm practical lighting, charming tabletop RPG illustration, clean composition",
    swatch: ["#d99a5b", "#8f4a2c", "#5f7d4e"],
  },
  {
    id: "paper-cutout",
    name: "Paper Cutout",
    block:
      "paper cutout style, layered cardstock textures, medieval fantasy, D&D marketplace, soft side lighting, charming tabletop RPG illustration, clean composition",
    swatch: ["#e5c98f", "#b06a3a", "#88a06b"],
  },
  {
    id: "shadow-puppet",
    name: "Shadow Puppet",
    block:
      "shadow puppet style, medieval fantasy silhouette, warm lantern light, charming tabletop RPG illustration, clean composition",
    swatch: ["#f0b45a", "#3a2a1c", "#1d1410"],
  },
  {
    id: "low-poly",
    name: "Low-Poly Stylized",
    block:
      "low-poly stylized fantasy, flat shaded facets, medieval D&D marketplace, soft rim lighting, charming tabletop RPG illustration, clean composition",
    swatch: ["#d8a35e", "#9c5a34", "#6f9464"],
  },
];

export const ERROR_POOL = [
  "429 rate_limited — quota exceeded, retry after 60s",
  "502 bad_gateway — image endpoint timed out after 60s",
  "content_filter — prompt flagged by moderation layer",
  "decoding_error — malformed base64 payload from endpoint",
  "500 model_overloaded — upstream returned empty response",
];
