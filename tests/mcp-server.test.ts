import { describe, expect, it } from "vitest";
import { SCHEMAS, TOOLS, safeFilename } from "../scripts/mcp-server.js";

describe("safeFilename", () => {
  it("accepts the app's own naming convention", () => {
    expect(safeFilename("shop_bakery.png")).toBe("shop_bakery.png");
    expect(safeFilename("item_lantern_2.png")).toBe("item_lantern_2.png");
  });

  it.each([
    "../../etc/passwd.png",
    "..\\..\\windows\\system32\\evil.png",
    "/absolute/path.png",
    "C:\\Users\\me\\thing.png",
    "sub/dir/shop.png",
  ])("refuses to escape the output folder with %j", (name) => {
    expect(() => safeFilename(name)).toThrow(/unsafe filename/);
  });

  it.each(["Shop_Bakery.png", "shop bakery.png", "shop-bakery.png", "shop_bakery.jpg", "shop_bakery", "", "  "])(
    "refuses malformed name %j",
    (name) => {
      expect(() => safeFilename(name)).toThrow(/unsafe filename/);
    }
  );
});

describe("tool declarations", () => {
  it("advertises a valid JSON Schema for every tool", () => {
    for (const tool of TOOLS) {
      expect(tool.name, "tool name").toMatch(/^forge_/);
      expect(tool.description.length).toBeGreaterThan(10);
      const s = tool.inputSchema as Record<string, unknown>;
      expect(s.type, `${tool.name}.inputSchema.type`).toBe("object");
      expect(s.properties, `${tool.name}.inputSchema.properties`).toBeTypeOf("object");
      expect(Array.isArray(s.required)).toBe(true);
      // every declared property must itself be a typed JSON Schema node
      for (const [prop, def] of Object.entries(s.properties as Record<string, { type?: string }>) ) {
        expect(def.type, `${tool.name}.${prop}.type`).toBeTypeOf("string");
      }
      // and everything required must actually be declared
      for (const req of s.required as string[]) expect(Object.keys(s.properties as object)).toContain(req);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it("validates arguments before doing any work", () => {
    expect(SCHEMAS.forge_add_row.safeParse({ filename: "shop_a.png", prompt: "a shop" }).success).toBe(true);
    expect(SCHEMAS.forge_add_row.safeParse({ filename: "shop_a.png" }).success).toBe(false);
    expect(SCHEMAS.forge_add_row.safeParse({ filename: "shop_a.png", prompt: "a", seed: 0 }).success).toBe(false);
    expect(SCHEMAS.forge_add_row.safeParse({ filename: "shop_a.png", prompt: "a", category: "dragon" }).success).toBe(false);
    expect(SCHEMAS.forge_add_row.safeParse({ filename: "shop_a.png", prompt: "a", model: "not-a-model" }).success).toBe(false);
    expect(SCHEMAS.forge_generate_pending.safeParse({ limit: "10" }).success).toBe(false);
    expect(SCHEMAS.forge_generate_one.safeParse({}).success).toBe(false);
  });

  it("applies the documented defaults", () => {
    const parsed = SCHEMAS.forge_add_row.parse({ filename: "shop_a.png", prompt: "a shop" });
    expect(parsed.category).toBe("item");
    expect(parsed.aspect_ratio).toBe("1:1");
  });

  it("keeps a seed space wide enough to avoid collisions in big batches", () => {
    const seed = SCHEMAS.forge_add_row.shape.seed;
    expect(seed.safeParse(1_000_000).success).toBe(true);
    expect(seed.safeParse(2_147_483_648).success).toBe(false);
  });

  it("declares a schema for every advertised tool and nothing more", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual(Object.keys(SCHEMAS).sort());
  });
});
