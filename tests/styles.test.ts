import { describe, expect, it } from "vitest";
import {
  STYLE_CATALOGUE,
  STYLE_GROUPS,
  TEXT_DEPENDENT_STYLES,
  availableModelsForStyle,
  defaultModelForStyle,
  isFreeModel,
  styleById,
  stylesInGroup,
} from "../src/lib/styleCatalogue";
import { MODELS } from "../src/lib/engines.mjs";
import { STYLES } from "../src/types";

const nothingSetUp = {};
const localOnly = { localBase: "http://localhost:8080/v1", localModel: "flux.2-klein-4b" };
const cloudflareOnly = { cloudflare: { accountId: "a", token: "t" } };
const googleOnly = { geminiKeys: [{ key: "k" }] };
const everything = {
  ...localOnly,
  ...cloudflareOnly,
  ...googleOnly,
  pollinationsToken: "tok",
  openaiKeys: [{ key: "k" }],
};

describe("the catalogue itself", () => {
  it("is what the app actually uses", () => {
    expect(STYLES).toBe(STYLE_CATALOGUE);
  });

  it("has a decent spread of looks", () => {
    expect(STYLE_CATALOGUE.length).toBeGreaterThanOrEqual(30);
  });

  it("gives every style a unique id", () => {
    const ids = STYLE_CATALOGUE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the original five ids, so saved manifests still resolve", () => {
    for (const id of ["claymation", "stop-motion-clay", "paper-cutout", "shadow-puppet", "low-poly"]) {
      expect(styleById(id), id).toBeDefined();
    }
  });

  it("fills in every field on every style", () => {
    for (const s of STYLE_CATALOGUE) {
      expect(s.name.length, `${s.id}.name`).toBeGreaterThan(2);
      expect(s.blurb.length, `${s.id}.blurb`).toBeGreaterThan(15);
      expect(s.block.length, `${s.id}.block`).toBeGreaterThan(25);
      expect(s.negative.length, `${s.id}.negative`).toBeGreaterThan(5);
      expect(s.swatch, `${s.id}.swatch`).toHaveLength(3);
      for (const c of s.swatch) expect(c, `${s.id} swatch colour`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(STYLE_GROUPS.map((g) => g.id), `${s.id}.group`).toContain(s.group);
    }
  });

  it("offers at least three models for every style", () => {
    for (const s of STYLE_CATALOGUE) {
      expect(s.recommended.length, `${s.id} needs 3+ models`).toBeGreaterThanOrEqual(3);
      expect(new Set(s.recommended).size, `${s.id} lists a model twice`).toBe(s.recommended.length);
    }
  });

  it("only ever names a model that exists", () => {
    const known = new Set([...MODELS.map((m) => m.id), "local"]);
    for (const s of STYLE_CATALOGUE) {
      for (const m of s.recommended) expect(known, `${s.id} → ${m}`).toContain(m);
    }
  });

  it("offers a local option and a free cloud option wherever it sensibly can", () => {
    for (const s of STYLE_CATALOGUE) {
      if (s.needsText) continue; // nothing free can spell — that is the point
      expect(s.recommended, `${s.id} should offer your own machine`).toContain("local");
      expect(s.recommended.some(isFreeModel), `${s.id} needs a free option`).toBe(true);
    }
  });

  it("puts every group to use", () => {
    for (const g of STYLE_GROUPS) expect(stylesInGroup(g.id).length, `${g.id} is empty`).toBeGreaterThan(0);
  });

  it("marks the looks that depend on readable words", () => {
    expect(TEXT_DEPENDENT_STYLES).toContain("infographic");
    expect(TEXT_DEPENDENT_STYLES).toContain("poster-typographic");
    expect(TEXT_DEPENDENT_STYLES).not.toContain("claymation");
  });

  it("restricts text-dependent looks to the Nano Banana family, by request", () => {
    // Deliberately narrow: DALL-E and gemini-3-pro-image can spell too, but the
    // owner asked to be consulted before either is offered for a text style.
    const allowed = new Set(["nano-banana-2", "nano-banana-2-lite", "nano-banana"]);
    for (const id of TEXT_DEPENDENT_STYLES) {
      for (const m of styleById(id)!.recommended) expect(allowed, `${id} → ${m}`).toContain(m);
    }
  });

  it("includes the looks that were asked for", () => {
    for (const id of [
      "claymation",
      "animated-feature-3d",
      "hand-drawn-animation",
      "crochet-diorama",
      "paper-diorama",
      "stick-figures",
      "photoreal",
      "infographic",
      "anime-modern",
      "anime-chibi",
      "creature-collector",
      "rpg-item-icon",
      "rpg-map",
    ]) {
      expect(styleById(id), `missing ${id}`).toBeDefined();
    }
  });

  it("names no trademarked studio in a style name", () => {
    const trademarks = /pixar|disney|pokemon|ghibli|marvel|nintendo/i;
    for (const s of STYLE_CATALOGUE) {
      expect(trademarks.test(s.name), `${s.id} name`).toBe(false);
      expect(trademarks.test(s.block), `${s.id} prompt`).toBe(false);
    }
  });
});

describe("which models you can actually use", () => {
  it("offers nothing when nothing is set up", () => {
    expect(availableModelsForStyle(styleById("claymation")!, nothingSetUp)).toEqual([]);
  });

  it("counts your own machine only once it has an address and a model", () => {
    expect(availableModelsForStyle(styleById("claymation")!, localOnly)).toContain("local");
    expect(availableModelsForStyle(styleById("claymation")!, { localBase: "http://x" })).not.toContain("local");
  });

  it("counts Cloudflare only when both boxes are filled", () => {
    expect(availableModelsForStyle(styleById("claymation")!, cloudflareOnly)).toContain("cloudflare-flux");
    expect(
      availableModelsForStyle(styleById("claymation")!, { cloudflare: { accountId: "a", token: "" } })
    ).not.toContain("cloudflare-flux");
  });

  it("ignores a key that is only whitespace", () => {
    expect(availableModelsForStyle(styleById("infographic")!, { geminiKeys: [{ key: "   " }] })).toEqual([]);
  });
});

describe("what a style will use by default", () => {
  it("prefers your own machine when it is set up, because it is free", () => {
    expect(defaultModelForStyle(styleById("claymation")!, everything)).toBe("local");
  });

  it("falls back to a free cloud model when there is no local one", () => {
    expect(defaultModelForStyle(styleById("claymation")!, { ...cloudflareOnly, ...googleOnly })).toBe("cloudflare-flux");
  });

  it("uses a paid model when that is all you have", () => {
    expect(defaultModelForStyle(styleById("claymation")!, googleOnly)).toBe("nano-banana-2-lite");
  });

  it("never picks a free model that cannot spell for a look that needs words", () => {
    const pick = defaultModelForStyle(styleById("infographic")!, everything);
    expect(isFreeModel(pick)).toBe(false);
    expect(pick).toBe("nano-banana-2");
  });

  it("still answers when nothing at all is set up", () => {
    const pick = defaultModelForStyle(styleById("photoreal")!, nothingSetUp);
    expect(pick).toBe(styleById("photoreal")!.recommended[0]);
  });
});
