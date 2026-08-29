/* The Emberfair — the night market of Lanternrow.
   Entity ids deliberately match the Image Forge manifest
   (shop_id / item_id / event_id) so the pipeline is visible. */

export interface Ware {
  id: string;
  name: string;
  price: number;
  stock: number;
  rarity: "common" | "fine" | "rare";
  blurb: string;
  seed: number;
  shopId: string;
  forgeId?: string;
}

export interface Shop {
  id: string;
  name: string;
  sign: string;
  keeper: string;
  keeperLine: string;
  haggleLine: string;
  blurb: string;
  hours: string;
  stripe: [string, string];
  seed: number;
  forgeId?: string;
}

export interface Happening {
  id: string;
  title: string;
  time: string;
  live?: boolean;
  blurb: string;
  seed: number;
  forgeId?: string;
}

export interface Folk {
  id: string;
  name: string;
  role: string;
  lines: string[];
  seed: number;
  forgeId?: string;
}

export const SHOPS: Shop[] = [
  {
    id: "12",
    name: "Soot & Hammer",
    sign: "The Soot & Hammer",
    keeper: "Bramm Copperbeard",
    keeperLine: "Mind the sparks. Everything's sharp, everything's honest.",
    haggleLine: "Fine — five percent, because you waited while the forge was hot.",
    blurb: "Smithy and smith together since before the wall. Blades, horseshoes, and the occasional apology.",
    hours: "till the coals die",
    stripe: ["#e2593f", "#3a2a1c"],
    seed: 41,
    forgeId: "shop_blacksmith.png",
  },
  {
    id: "13",
    name: "Crooked Wick",
    sign: "The Crooked Wick",
    keeper: "Maelis of the Green Flame",
    keeperLine: "Don't drink the purple one. The purple one drinks back.",
    haggleLine: "A discount? Hm. The bottles like you. Ten percent, no more.",
    blurb: "Potions, tinctures, and one suspicious jar that hums on Tuesdays. The chimney leans. So do the prices, occasionally.",
    hours: "dusk till the candles win",
    stripe: ["#b18ce0", "#5f7d4e"],
    seed: 77,
    forgeId: "shop_potions.png",
  },
  {
    id: "14",
    name: "Foaming Tankard",
    sign: "The Foaming Tankard",
    keeper: "Old Petra",
    keeperLine: "Ale's cold, stew's hot, and the bed upstairs only squeaks a little.",
    haggleLine: "Alright, alright — you've got the look of someone who'll tell stories about my stew.",
    blurb: "Inn, tavern, and unofficial town parliament. Every rumor in Lanternrow passes through Petra's taproom first.",
    hours: "always, somehow",
    stripe: ["#8cb56f", "#cdbc9f"],
    seed: 8,
    forgeId: "shop_tavern.png",
  },
  {
    id: "25",
    name: "Glim's Scrolls",
    sign: "Glim's Scrolls & Sundries",
    keeper: "Glim",
    keeperLine: "No refunds once a spell is read. It knows you now.",
    haggleLine: "You remind me of me, which is unfortunate for my margins.",
    blurb: "Maps, cantrips, and ink that bites. Glim claims to have sold a scroll to a dragon. The burn marks are convincing.",
    hours: "when the ink dries",
    stripe: ["#56b8a5", "#241b14"],
    seed: 63,
  },
  {
    id: "26",
    name: "Tin Shield",
    sign: "The Tin Shield",
    keeper: "Widow Anka",
    keeperLine: "Armor won't make you brave, but it'll keep you breathing while you work on it.",
    haggleLine: "For you? Two silver off. Tell nobody — I have a reputation for kindness to lose.",
    blurb: "Shields, rope, lanterns, and blunt advice. Anka's late husband's armor hangs over the door. It still fits no one.",
    hours: "sun-up to moon-up",
    stripe: ["#97876d", "#e2593f"],
    seed: 12,
  },
];

export const WARES: Ware[] = [
  { id: "543", name: "Longsword, honest steel", price: 18, stock: 3, rarity: "fine", blurb: "Balanced, unglamorous, alive. Bramm guarantees it against everything except misuse and destiny.", seed: 3, shopId: "12", forgeId: "item_longsword.png" },
  { id: "w101", name: "Dagger “Rustbite”", price: 6, stock: 7, rarity: "common", blurb: "Ugly as a debt. Never jams, never shines, never lets go.", seed: 30, shopId: "12" },
  { id: "w102", name: "Warhammer “Bellringer”", price: 25, stock: 1, rarity: "rare", blurb: "Rings doors, armor, and the occasional conscience. Two hands recommended.", seed: 51, shopId: "12" },
  { id: "544", name: "Potion of Healing", price: 12, stock: 5, rarity: "fine", blurb: "Tastes like cherries and regret. Knits what was cut, mostly in the right order.", seed: 19, shopId: "13", forgeId: "item_potion_of_healing.png" },
  { id: "w103", name: "Draught of Courage", price: 9, stock: 4, rarity: "fine", blurb: "One hour of borrowed bravery. Side effects include ballads.", seed: 44, shopId: "13" },
  { id: "w104", name: "Bottled Fog", price: 15, stock: 2, rarity: "rare", blurb: "Uncork for one narrow alley of instant weather. Maelis asks that you don't tell the guards.", seed: 88, shopId: "13" },
  { id: "w105", name: "Tankard of Petra's Best", price: 2, stock: 99, rarity: "common", blurb: "Dark as the well it came from. The foam has opinions.", seed: 15, shopId: "14" },
  { id: "w106", name: "Room till Dawn", price: 8, stock: 4, rarity: "common", blurb: "Clean sheets, a door that locks, and a window that faces the good part of town.", seed: 70, shopId: "14" },
  { id: "w107", name: "Spellbook of Sparks", price: 30, stock: 1, rarity: "rare", blurb: "Four cantrips, one grudge. The book chooses the reader, not the other way around.", seed: 27, shopId: "25" },
  { id: "w108", name: "Map of the Undercity", price: 11, stock: 3, rarity: "fine", blurb: "Mostly accurate. The parts that aren't are marked with a tiny skull, which helps.", seed: 59, shopId: "25" },
  { id: "w109", name: "Iron Shield, riveted", price: 9, stock: 6, rarity: "common", blurb: "Dented once, lovingly. A shield with history stops more than arrows.", seed: 9, shopId: "26" },
  { id: "w110", name: "Hempen Rope, 50 ft", price: 2, stock: 12, rarity: "common", blurb: "Coiled by Anka herself, which is to say: coiled properly.", seed: 36, shopId: "26" },
  { id: "w111", name: "Brass Lantern", price: 5, stock: 8, rarity: "common", blurb: "Holds a flame through wind, rain, and most bad decisions.", seed: 74, shopId: "26" },
];

export const HAPPENINGS: Happening[] = [
  { id: "201", title: "The Goat Is Loose", time: "now · third hour of the run", live: true, blurb: "A goat of unclear ownership has breached the apple crates. Children in pursuit. Betting opens at the fountain.", seed: 55, forgeId: "event_escaped_goat.png" },
  { id: "202", title: "Bard on a Crate", time: "at sundown", blurb: "A bard of modest fame and considerable volume performs the Ballad of the Brave Turnip. Copper appreciated.", seed: 90, forgeId: "event_bard_performance.png" },
  { id: "e3", title: "Fire-Eater's Drill", time: "at the ninth bell", blurb: "Sera the Ember-Tongued practices by the east gate. The guards have asked everyone to stop applauding mid-drill.", seed: 21 },
  { id: "e4", title: "The Tax Man Cometh", time: "tomorrow · dreadfully early", blurb: "Royal collector arrives at dawn. Stall fees, stall grumbling. Anka recommends looking poor.", seed: 47 },
];

export const FOLK: Folk[] = [
  { id: "f1", name: "Serenna", role: "city guard, third watch", lines: ["Quiet night. Quiet as it ever gets, anyway.", "If you see a goat, no you didn't.", "The lamps stay lit till the last honest soul's home. I'm on till then."], seed: 23, forgeId: "npc_city_guard.png" },
  { id: "f2", name: "Glim", role: "scrollmonger & raconteur", lines: ["I once sold a map to a minotaur. He tipped well. Lost it, mind you, but tipped.", "Ink's cheaper than blood. Remember that down there.", "Buy the red scroll. Trust me. No, the other red one."], seed: 66 },
  { id: "f3", name: "Old Petra", role: "innkeep of the Tankard", lines: ["Stew's got two new potatoes in it. Don't tell anyone — it's a celebration.", "Every hero who ever sat in my taproom started as somebody's problem.", "Sleep's eight coppers. Stories are free, but they'll cost you your evening."], seed: 81 },
  { id: "f4", name: "Aldous", role: "sage, retired adventurer", lines: ["The moon's in the Reed. Good for planting, bad for promises.", "I've seen three ends of the world. Each time, someone sold tickets.", "Ask the fountain a question. It won't answer, but you will."], seed: 5 },
  { id: "f5", name: "Tansy", role: "stable hand, goat suspect", lines: ["The goat is NOT mine. The goat belongs to the wind.", "If anyone asks, I was sweeping. All evening. Sweeping.", "That one's a good horse. That one bites. That one's a horse-shaped rumor."], seed: 39 },
];

export const CRIER_CALLS = [
  "Hear ye! The goat remains at large — reward: one apple and eternal gratitude.",
  "Petra's stew now contains two potatoes. This is not a drill.",
  "Bard seeks crowd at sundown. Crowds seek better bard. Compromise expected.",
  "Lost: one shadow, answers to “Greg”. Return to the Crooked Wick.",
  "The fountain is not a wishing well. It has filed a complaint.",
  "Tax collector arrives at dawn. Looking poor is a civic duty.",
];

export const START_COINS = 250;
