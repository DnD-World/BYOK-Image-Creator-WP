import { describe, expect, it } from "vitest";
import { autoFixFilename, validateFilename, violationCount } from "../src/lib/validate";
import type { ManifestRow } from "../src/types";

const check = (name: string, category: Parameters<typeof validateFilename>[1] = "shop", others: { id: number; filename: string }[] = []) =>
  Object.fromEntries(validateFilename(name, category, others, 1).map((c) => [c.id, c.pass]));

describe("validateFilename", () => {
  it("passes a well-formed name", () => {
    expect(Object.values(check("shop_bakery.png"))).not.toContain(false);
  });

  it("catches uppercase, spaces and punctuation", () => {
    expect(check("Shop_Bakery.png").lowercase).toBe(false);
    expect(check("shop bakery.png").nospace).toBe(false);
    expect(check("shop-bakery!.png").nospecial).toBe(false);
  });

  it("requires the category prefix and the .png extension", () => {
    expect(check("bakery.png").prefix).toBe(false);
    expect(check("shop_bakery.jpg").ext).toBe(false);
  });

  it("flags a name already used by another row", () => {
    expect(check("shop_bakery.png", "shop", [{ id: 2, filename: "shop_bakery.png" }]).unique).toBe(false);
  });

  it("does not flag the row against itself", () => {
    expect(check("shop_bakery.png", "shop", [{ id: 1, filename: "shop_bakery.png" }]).unique).toBe(true);
  });
});

describe("autoFixFilename", () => {
  it.each([
    ["The Grand Bakery", "shop", "shop_the_grand_bakery.png"],
    ["shop_bakery.png", "shop", "shop_bakery.png"],
    ["Bakery!!! (fancy)", "shop", "shop_bakery_fancy.png"],
    ["item_lantern", "shop", "shop_lantern.png"],
    ["  spaced  out  ", "item", "item_spaced_out.png"],
    ["???", "npc", "npc_untitled.png"],
  ])("turns %j into %j", (raw, category, expected) => {
    expect(autoFixFilename(raw, category as Parameters<typeof autoFixFilename>[1])).toBe(expected);
  });

  it("always produces a name that passes validation", () => {
    const fixed = autoFixFilename("A Very -- Odd // Name.PNG", "event");
    expect(Object.values(check(fixed, "event"))).not.toContain(false);
  });
});

describe("violationCount", () => {
  it("counts only the rows that break a rule", () => {
    const rows = [
      { id: 1, filename: "shop_bakery.png", category: "shop" },
      { id: 2, filename: "Bad Name.png", category: "item" },
    ] as ManifestRow[];
    expect(violationCount(rows)).toBe(1);
  });
});

describe("the filename rules across the category change", () => {
  it("accepts a new-style name", () => {
    expect(validateFilename("image_bakery.png", "image", [], 1).every((r) => r.pass)).toBe(true);
  });

  it("still accepts a file named before the categories changed", () => {
    // shop_blacksmith.png exists on disk. Migrating its category is free;
    // renaming the actual file is not, so an old name must keep passing
    // rather than marking a whole existing manifest broken.
    for (const old of ["shop_blacksmith.png", "item_potion.png", "event_market.png", "npc_baker.png"]) {
      const prefix = validateFilename(old, "image", [], 1).find((r) => r.id === "prefix");
      expect(prefix?.pass, old).toBe(true);
    }
  });

  it("does not let a legacy prefix stand in for the other new categories", () => {
    // Only "image" inherits them — a vector called shop_x.png is just wrong.
    expect(validateFilename("shop_thing.png", "svg", [], 1).find((r) => r.id === "prefix")?.pass).toBe(false);
  });

  it("still rejects a prefix that was never valid", () => {
    expect(validateFilename("dragon_thing.png", "image", [], 1).find((r) => r.id === "prefix")?.pass).toBe(false);
  });
});
