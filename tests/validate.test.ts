import { describe, expect, it } from "vitest";
import { autoFixFilename, nameForMime, RULES, validateFilename, violationCount } from "../src/lib/validate";
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

  it("requires the category prefix, and some recognisable extension", () => {
    expect(check("bakery.png").prefix).toBe(false);
    // .jpg is a fine answer now — Google returns JPEG whatever we ask for.
    expect(check("shop_bakery.jpg").ext).toBe(true);
    expect(check("shop_bakery.txt").ext).toBe(false);
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

  it("refuses to switch off the two that protect your files", () => {
    // unique: a second row with the same name overwrites the first when saved.
    // nospecial: Windows cannot write those characters at all.
    // Both cost you work. Everything else is house style, including the
    // extension — which used to be here on a premise that turned out false.
    const tryAll = { unique: false, nospecial: false };
    const checks = validateFilename("bad?name.jpg", "image", [{ id: 2, filename: "bad?name.jpg" }], 1, tryAll);
    for (const id of ["unique", "nospecial"]) {
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

  it("marks exactly two rules as unswitchable", () => {
    expect(RULES.filter((r) => !r.optional).map((r) => r.id).sort()).toEqual(["nospecial", "unique"]);
  });

  it("stops counting a row as broken once its rule is off", () => {
    const rows = [{ id: 1, filename: "image_A.png", category: "image" }] as never;
    expect(violationCount(rows)).toBe(1);
    expect(violationCount(rows, { lowercase: false })).toBe(0);
  });
});

/**
 * The extension tells the truth about the bytes.
 *
 * This used to be a rule that could not be switched off, justified by "the
 * engines return PNG". They do not — Google's image API refuses to return
 * anything but JPEG — so the rule was writing a false name and calling it
 * correctness. These tests pin the honest behaviour: any known extension is
 * acceptable, and the real one is settled from what came back.
 */
describe("the extension follows the bytes", () => {
  it("no longer insists on .png", () => {
    const jpg = validateFilename("image_a.jpg", "image", [], 1);
    expect(jpg.find((c) => c.id === "ext")?.pass).toBe(true);
  });

  it("still objects to a name with no extension at all", () => {
    const bare = validateFilename("image_a", "image", [], 1);
    expect(bare.find((c) => c.id === "ext")?.pass).toBe(false);
  });

  it("can be switched off now, unlike before", () => {
    const off = validateFilename("image_a", "image", [], 1, { ext: false });
    expect(off.find((c) => c.id === "ext")?.pass).toBe(true);
  });

  it("renames a Google picture to what Google actually sent", () => {
    // The specific case that made this necessary.
    expect(nameForMime("image_a.png", "image/jpeg")).toBe("image_a.jpg");
  });

  it("leaves a name that is already right alone", () => {
    expect(nameForMime("image_a.png", "image/png")).toBe("image_a.png");
  });

  it("does not churn a name over jpg versus jpeg", () => {
    // Both are correct. Renaming a file to settle a spelling argument is noise.
    expect(nameForMime("image_a.jpeg", "image/jpeg")).toBe("image_a.jpeg");
  });

  it("leaves the name alone when the type means nothing to us", () => {
    // Better a name we cannot confirm than a name we invented.
    expect(nameForMime("image_a.png", "application/octet-stream")).toBe("image_a.png");
    expect(nameForMime("image_a.png", "")).toBe("image_a.png");
  });

  it("adds an extension to a bare name rather than replacing nothing", () => {
    expect(nameForMime("image_a", "image/webp")).toBe("image_a.webp");
  });

  it("keeps the stem exactly, so a row keeps its identity", () => {
    expect(nameForMime("image_a.long.name.png", "image/jpeg")).toBe("image_a.long.name.jpg");
  });

  it("keeps the extension a name already wears when auto-fixing", () => {
    // Auto-fix used to force .png, which is how the lie got in.
    expect(autoFixFilename("Image A.webp", "image")).toBe("image_a.webp");
    // With nothing to go on, .png is still the commonest truth.
    expect(autoFixFilename("a cat", "image")).toBe("image_a_cat.png");
  });
});
