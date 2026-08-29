import type { AspectKey, Category, ManifestRow } from "../types";
import { ASPECTS } from "../types";
import { autoFixFilename } from "./validate";

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface BatchSetup {
  name: string;
  styleId: string;
  model: string;
  aspect: "per-category" | AspectKey;
  linkFolder: boolean;
  runAfter: boolean;
  defaultNegative: string;
}

export const DEFAULT_SETUP: BatchSetup = {
  name: "",
  styleId: "claymation",
  model: "",
  aspect: "per-category",
  linkFolder: true,
  runAfter: false,
  defaultNegative: "",
};

export interface SavedSetup {
  id: string;
  name: string;
  createdAt: string;
  data: BatchSetup;
}

export interface Batch {
  id: string;
  name: string;
  createdAt: string;
  setupName?: string;
  rowIds: number[];
}

export interface FactoryItem {
  filename: string;
  prompt: string;
  negative_prompt?: string;
  category?: Category;
}

/* ---------------- persistence ---------------- */

const LS_SETUPS = "image-forge-setups-v1";
const LS_BATCHES = "image-forge-batches-v1";

export function loadSetups(): SavedSetup[] {
  try {
    const raw = localStorage.getItem(LS_SETUPS);
    if (raw) return JSON.parse(raw) as SavedSetup[];
  } catch { /* fresh */ }
  return [];
}
export function saveSetups(s: SavedSetup[]): void {
  try { localStorage.setItem(LS_SETUPS, JSON.stringify(s)); } catch { /* full */ }
}
export function loadBatches(): Batch[] {
  try {
    const raw = localStorage.getItem(LS_BATCHES);
    if (raw) return JSON.parse(raw) as Batch[];
  } catch { /* fresh */ }
  return [];
}
export function saveBatches(b: Batch[]): void {
  try { localStorage.setItem(LS_BATCHES, JSON.stringify(b)); } catch { /* full */ }
}

/* ---------------- factory → rows ---------------- */

const CAT_ASPECT: Record<Category, AspectKey> = { shop: "16:9", item: "1:1", event: "16:9", npc: "4:3" };

export function factoryToRows(
  items: FactoryItem[],
  o: { styleId: string; model: string; aspect: BatchSetup["aspect"]; defaultNegative: string; startId: number }
): ManifestRow[] {
  let next = o.startId;
  return items
    .filter((i) => i.filename.trim() && i.prompt.trim())
    .map((i) => {
      const category: Category = i.category ?? "item";
      const aspect: AspectKey = o.aspect === "per-category" ? CAT_ASPECT[category] : o.aspect;
      return {
        id: next++,
        filename: autoFixFilename(i.filename, category),
        prompt: i.prompt.trim(),
        negative_prompt: i.negative_prompt?.trim() || o.defaultNegative.trim() || undefined,
        category,
        item_id: "", shop_id: "", event_id: "",
        style: o.styleId,
        aspect_ratio: aspect,
        seed: Math.floor(Math.random() * 98) + 1,
        model: o.model,
        status: "pending" as const,
        error: "",
        generated_at: "",
        imported_attachment_id: "",
      };
    });
}

/* ---------------- offline idea generator (fallback when no text engine) ---------------- */

const POOLS: Record<Category, string[][]> = {
  shop: [
    ["blacksmith forge", "glowing coals, hanging hammers, anvil in the window"],
    ["potion shop", "shelves of glowing flasks, crooked chimney, purple light"],
    ["tavern", "foaming tankard sign, warm windows, smoke curling from the chimney"],
    ["baker stall", "stacked bread loaves, flour dust in the lantern light"],
    ["scroll merchant", "towers of scrolls, ink pots, a sleeping cat on the counter"],
    ["armor shop", "polished breastplates, shield wall, oil-lamp shine"],
  ],
  item: [
    ["healing potion", "round glass flask, glowing red liquid, cork stopper, tiny bubbles"],
    ["longsword", "polished steel blade, leather-wrapped grip, on parchment"],
    ["iron shield", "riveted kite shield, painted sun emblem, worn edges"],
    ["spellbook", "cracked leather cover, brass clasp, faintly glowing runes"],
    ["coil of rope", "hempen rope, neatly coiled, merchant's knot on top"],
    ["lantern", "brass lantern, warm flame, moths circling the glass"],
  ],
  event: [
    ["escaped goat", "goat sprinting through the market, knocked apple crate, children chasing it"],
    ["bard performance", "bard on a crate, small crowd tossing copper, lute raised high"],
    ["market fire drill", "bucket brigade passing water, dramatic and comedic, dusk light"],
    ["royal herald", "herald on a cart reading a proclamation, crowd leaning in"],
    ["cart wheel mishap", "wagon tipped over, cabbages everywhere, apologetic driver"],
  ],
  npc: [
    ["city guard", "tired eyes, dented helmet, halberd over shoulder, lantern rim light"],
    ["street merchant", "wide grin, colorful scarves, scales in hand, warm stall light"],
    ["old sage", "long grey beard, twinkling eyes, staff with a crystal, soft study light"],
    ["stable hand", "freckles, straw hat, hay wisps, gentle smile, golden hour"],
    ["tavern keeper", "apron and rolled sleeves, tankard in hand, warm hearth behind"],
  ],
};

export function generateIdeas(topic: string, count: number): FactoryItem[] {
  const cats: Category[] = ["shop", "item", "event", "npc"];
  const out: FactoryItem[] = [];
  const t = topic.trim().toLowerCase();
  for (let i = 0; i < count; i++) {
    const cat = cats[i % cats.length];
    const pool = POOLS[cat];
    const pick = pool[(i * 7 + t.length) % pool.length];
    const name = pick[0].replace(/\s+/g, "_");
    out.push({
      filename: `${cat}_${name}.png`,
      prompt: `${t ? t + ", " : ""}${cat === "shop" ? pick[0] + " storefront" : cat === "item" ? pick[0] + " item icon" : cat === "event" ? pick[0] + " street scene" : pick[0] + " portrait"}, ${pick[1]}`,
      category: cat,
    });
  }
  return out;
}

export const ideaCategories = (): Category[] => ["shop", "item", "event", "npc"];
export const aspectFor = (a: BatchSetup["aspect"], c: Category): AspectKey =>
  a === "per-category" ? CAT_ASPECT[c] : a;
export const aspectDims = (a: AspectKey) => ASPECTS[a];
