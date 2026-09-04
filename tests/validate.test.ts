import { describe, expect, it } from "vitest";
import { autoFixFilename, RULES, validateFilename, violationCount } from "../src/lib/validate";
import type { ManifestRow } from "../src/types";

const check = (name: string, category: Parameters<typeof validateFilename>[1] = "shop", others: { id: number; filename: string }[] = []) =>
  Object.fromEntries(validateFilename(name, category, others, 1).map((c) => [c.id, c.pass]));

describe("validateFilename", () => {
  it("passes a well-formed name", () => {
    expect(Object.values(check("shop_bakery.png"))).not.toContain(false);
  });

  it("catches uppercase and spaces, each by its own rule", () => {
    expect(check("Shop_Bakery.png").lowercase).toBe(false);
    expect(check("shop bakery.png").nospace).toBe(false);
  });

  it("reserves 'no special characters' for what a filesystem actually refuses", () => {
    // It used to reject capitals too, which quietly did the lowercase rule's
    // job — and since this rule cannot be switched off, turning "lowercase
    // only" off changed nothing. An exclamation mark is a legal filename
    // character; a question mark is not.
    expect(check("image_bakery!.png").nospecial).toBe(true);
    expect(check("image_Bakery.png").nospecial).toBe(true);
    for (const bad of ["image_a?.png", "image_a*.png", "image_a<b.png", "image_a|b.png"]) {
      expect(check(bad).nospecial, bad).toBe(false);
    }
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

describe("switching filename rules off", () => {
  it("enforces everything by default", () => {
    const checks = validateFilename("Shop Thing.PNG", "image", [], 1);
    expect(checks.filter((c) => !c.pass).length).toBeGreaterThan(2);
  });

  it("lets a rule be switched off, and then it passes", () => {
    const off = { lowercase: false, nospace: false, underscores: false, prefix: false };
    const checks = validateFilename("image_A_Thing.png", "image", [], 1, off);
    expect(checks.find((c) => c.id === "lowercase")?.pass).toBe(true);
    expect(checks.find((c) => c.id === "lowercase")?.enabled).toBe(false);
  });

  it("refuses to switch off the three that protect your files", () => {
    // unique: a second row with the same name overwrites the first when saved.
    // nospecial: Windows cannot write those characters at all.
    // ext: the engines return PNG, whatever the name claims.
    const tryAll = { unique: false, nospecial: false, ext: false };
    const checks = validateFilename("bad?name.jpg", "image", [{ id: 2, filename: "bad?name.jpg" }], 1, tryAll);
    for (const id of ["unique", "nospecial", "ext"]) {
      const c = checks.find((x) => x.id === id);
      expect(c?.enabled, id).toBe(true);
      expect(c?.pass, id).toBe(false);
    }
  });

  it("says why each rule exists, so switching one off is an informed choice", () => {
    for (const r of RULES) {
      expect(r.why.length, r.id).toBeGreaterThan(15);
      expect(r.label.length, r.id).toBeGreaterThan(5);
    }
  });

  it("marks exactly three rules as unswitchable", () => {
    expect(RULES.filter((r) => !r.optional).map((r) => r.id).sort()).toEqual(["ext", "nospecial", "unique"]);
  });

  it("stops counting a row as broken once its rule is off", () => {
    const rows = [{ id: 1, filename: "image_A.png", category: "image" }] as never;
    expect(violationCount(rows)).toBe(1);
    expect(violationCount(rows, { lowercase: false })).toBe(0);
  });
});
