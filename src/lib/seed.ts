import type { ManifestRow } from "../types";

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

const P = (base: string, style: string) => `${base}, ${style}`;
const CLAY = "claymation style, soft warm lighting, charming handmade illustration, clean composition";
const DND = "medieval fantasy, D&D marketplace, tabletop RPG charm";

const ROWS: ManifestRow[] = [
  {
    id: 1, filename: "image_blacksmith.png",
    prompt: P("medieval blacksmith shop front, warm lantern light, wooden sign with hammer icon, cozy fantasy marketplace, glowing forge window", CLAY),
    category: "image", item_id: "", shop_id: "12", event_id: "", style: "claymation", aspect_ratio: "16:9",
    seed: 41, model: "nano-banana-2", status: "done", error: "", generated_at: iso(26 * 3600e3), imported_attachment_id: "",
  },
  {
    id: 2, filename: "image_potions.png",
    prompt: P("fantasy potion shop, glowing bottles in the window, crooked chimney, purple and green light spilling onto cobbles", CLAY),
    category: "image", item_id: "", shop_id: "13", event_id: "", style: "claymation", aspect_ratio: "16:9",
    seed: 77, model: "nano-banana-2", status: "done", error: "", generated_at: iso(25 * 3600e3), imported_attachment_id: "",
  },
  {
    id: 3, filename: "image_tavern.png",
    prompt: P("ramshackle medieval tavern at dusk, hanging sign with a foaming tankard, smoke from the chimney, warm windows", CLAY),
    category: "image", item_id: "", shop_id: "14", event_id: "", style: "claymation", aspect_ratio: "16:9",
    seed: 8, model: "nano-banana-2-lite", status: "pending", error: "", generated_at: "", imported_attachment_id: "",
  },
  {
    id: 4, filename: "image_longsword.png",
    prompt: P("fantasy longsword item icon on parchment background, simple item card, polished steel blade, leather-wrapped grip", CLAY),
    category: "image", item_id: "543", shop_id: "", event_id: "", style: "claymation", aspect_ratio: "1:1",
    seed: 3, model: "flux", status: "done", error: "", generated_at: iso(20 * 3600e3), imported_attachment_id: "",
  },
  {
    id: 5, filename: "image_potion_of_healing.png",
    prompt: P("potion of healing item icon, round glass flask with glowing red liquid, cork stopper, tiny bubbles, parchment background", CLAY),
    category: "image", item_id: "544", shop_id: "", event_id: "", style: "claymation", aspect_ratio: "1:1",
    seed: 19, model: "flux", status: "failed", error: "429 rate_limited — quota exceeded, retry after cooldown",
    generated_at: "", imported_attachment_id: "",
  },
  {
    id: 6, filename: "image_escaped_goat.png",
    prompt: P("medieval street event, escaped goat sprinting through the market, knocked apple crate, children chasing it, comedic chaos", CLAY),
    category: "image", item_id: "", shop_id: "", event_id: "201", style: "claymation", aspect_ratio: "16:9",
    seed: 55, model: "nano-banana-2-lite", status: "pending", error: "", generated_at: "", imported_attachment_id: "",
  },
  {
    id: 7, filename: "image_bard_performance.png",
    prompt: P("bard performing on a crate in the market square, small crowd tossing copper, lute raised high, evening lanterns", CLAY),
    category: "image", item_id: "", shop_id: "", event_id: "202", style: "claymation", aspect_ratio: "16:9",
    seed: 90, model: "", status: "pending", error: "", generated_at: "", imported_attachment_id: "",
  },
  {
    id: 8, filename: "image_city_guard.png",
    prompt: P("tired city guard NPC portrait, dented helmet, halberd over shoulder, warm lantern rim light, kind eyes", CLAY),
    category: "image", item_id: "", shop_id: "", event_id: "", style: "claymation", aspect_ratio: "4:3",
    seed: 23, model: "nano-banana-2", status: "imported", error: "", generated_at: iso(49 * 3600e3), imported_attachment_id: "8231",
  },
];

export const SEED_ROWS: ManifestRow[] = ROWS.map((r) => ({ ...r, kind: "dnd" }));
