import { describe, expect, it } from "vitest";
import {
  SHEET_DEFS,
  cellPosition,
  frameCount,
  frameFilename,
  framePrompt,
  layoutFor,
  oneShotPrompt,
  referencePrompt,
  seedForFrame,
  sheetByKind,
  sheetFilename,
  stripFor,
  visemesForText,
} from "../src/lib/sheets";

const CHAR = "a stout dwarf blacksmith with a red beard";

describe("the sheet definitions", () => {
  it("covers sprites, a turnaround, mouth shapes and expressions", () => {
    for (const k of ["sprite-walk", "sprite-actions", "turnaround", "visemes", "expressions"] as const) {
      expect(sheetByKind(k), k).toBeDefined();
    }
  });

  it("fills in every field", () => {
    for (const d of SHEET_DEFS) {
      expect(d.label.length, d.kind).toBeGreaterThan(3);
      expect(d.blurb.length, d.kind).toBeGreaterThan(15);
      // Three, not five. This floor was five back when every sheet was a set
      // of poses. The avatar sheets are deliberately three: a blink is
      // open/half/shut, and brows are down/neutral/up. Padding them to five
      // would mean inventing frames nobody needs and paying to generate them.
      expect(d.frames.length, d.kind).toBeGreaterThanOrEqual(3);
      expect(d.columns, d.kind).toBeGreaterThan(0);
      expect(d.common, d.kind).toContain("identical character");
      expect(d.negative, d.kind).toContain("multiple characters");
    }
  });

  it("gives every frame a unique id and a real direction", () => {
    for (const d of SHEET_DEFS) {
      const ids = d.frames.map((f) => f.id);
      expect(new Set(ids).size, `${d.kind} has a duplicate frame id`).toBe(ids.length);
      for (const f of d.frames) {
        expect(f.direction.length, `${d.kind}/${f.id}`).toBeGreaterThan(15);
        expect(f.label.length, `${d.kind}/${f.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("uses the animator's ten mouth shapes, grouping sounds that look alike", () => {
    const v = sheetByKind("visemes")!;
    expect(v.frames).toHaveLength(10);
    const ids = v.frames.map((f) => f.id);
    expect(ids).toContain("rest");
    expect(ids).toContain("mbp"); // m, b and p are one drawing, not three
    expect(ids).toContain("fv");
    // the resting shape must come first, since it becomes the reference frame
    expect(v.frames[0].id).toBe("rest");
  });

  it("keeps faces to head-and-shoulders and sprites to full body", () => {
    expect(sheetByKind("visemes")!.common).toContain("head and shoulders");
    expect(sheetByKind("expressions")!.common).toContain("head and shoulders");
    expect(sheetByKind("sprite-walk")!.common).toContain("full body");
  });
});

describe("frame prompts", () => {
  it("insists the character stays the same and only one thing changes", () => {
    const d = sheetByKind("visemes")!;
    const p = framePrompt(d, d.frames[1], CHAR);
    expect(p).toContain("Keep this exact character unchanged");
    expect(p).toContain("Change ONLY the shape of the mouth");
    expect(p).toContain(CHAR);
  });

  it("says the right 'only' for each kind of sheet", () => {
    expect(framePrompt(sheetByKind("turnaround")!, sheetByKind("turnaround")!.frames[1], "")).toContain(
      "Change ONLY which way the character is facing"
    );
    expect(framePrompt(sheetByKind("sprite-walk")!, sheetByKind("sprite-walk")!.frames[1], "")).toContain(
      "Change ONLY the pose"
    );
    expect(framePrompt(sheetByKind("expressions")!, sheetByKind("expressions")!.frames[1], "")).toContain(
      "Change ONLY the expression"
    );
  });

  it("copes with no character description at all", () => {
    const d = sheetByKind("visemes")!;
    const p = framePrompt(d, d.frames[0], "   ");
    expect(p).not.toContain("The character is");
    expect(p.length).toBeGreaterThan(50);
  });

  it("builds the reference picture from the first frame", () => {
    const d = sheetByKind("visemes")!;
    const p = referencePrompt(d, CHAR);
    expect(p).toContain(CHAR);
    expect(p).toContain(d.frames[0].direction);
  });

  it("asks for a proper grid in the one-shot prompt", () => {
    const d = sheetByKind("sprite-actions")!;
    const p = oneShotPrompt(d, CHAR);
    expect(p).toContain("4 by 2 grid");
    expect(p).toContain("same size");
    expect(p).toContain("left to right, top to bottom");
    for (const f of d.frames) expect(p).toContain(f.direction);
  });
});

describe("seeds per frame", () => {
  it("gives every frame a different seed", () => {
    const seeds = Array.from({ length: 10 }, (_, i) => seedForFrame(7, i));
    expect(new Set(seeds).size).toBe(10);
  });

  it("is repeatable for the same base and index", () => {
    expect(seedForFrame(42, 3)).toBe(seedForFrame(42, 3));
  });

  it("never returns the base seed itself, which would reproduce the reference", () => {
    for (let i = 0; i < 12; i++) expect(seedForFrame(7, i)).not.toBe(7);
  });

  it("always returns a positive integer a provider will accept", () => {
    for (const base of [0, 1, -5, 2147483647, NaN]) {
      for (let i = 0; i < 5; i++) {
        const s = seedForFrame(base, i);
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThan(0);
        expect(s).toBeLessThanOrEqual(2147483647);
      }
    }
  });
});

describe("counting the cost", () => {
  it("one shot is a single picture", () => {
    expect(frameCount(sheetByKind("visemes")!, "one-shot")).toBe(1);
  });

  it("from a reference is one per frame, plus the reference", () => {
    expect(frameCount(sheetByKind("visemes")!, "from-reference")).toBe(11);
    expect(frameCount(sheetByKind("turnaround")!, "from-reference")).toBe(6);
  });
});

describe("naming", () => {
  it("names each frame after the character, the sheet and the frame", () => {
    expect(frameFilename("npc_smith.png", "visemes", "mbp")).toBe("npc_smith_visemes_mbp.png");
    expect(frameFilename("hero", "sprite-walk", "03_pass")).toBe("hero_sprite_walk_03_pass.png");
  });

  it("names the assembled sheet", () => {
    expect(sheetFilename("npc_smith.png", "visemes")).toBe("npc_smith_visemes_sheet.png");
  });
});

describe("laying out the grid", () => {
  it("wraps into rows", () => {
    const l = layoutFor(10, 5, 256, 256);
    expect(l).toMatchObject({ columns: 5, rows: 2, width: 1280, height: 512 });
  });

  it("never makes more columns than there are frames", () => {
    expect(layoutFor(3, 8, 100, 100).columns).toBe(3);
  });

  it("puts each frame in the right cell", () => {
    const l = layoutFor(10, 5, 100, 80);
    expect(cellPosition(0, l)).toEqual({ x: 0, y: 0 });
    expect(cellPosition(4, l)).toEqual({ x: 400, y: 0 });
    expect(cellPosition(5, l)).toEqual({ x: 0, y: 80 });
    expect(cellPosition(9, l)).toEqual({ x: 400, y: 80 });
  });

  it("handles a single frame without dividing by zero", () => {
    const l = layoutFor(1, 4, 50, 50);
    expect(l).toMatchObject({ columns: 1, rows: 1, width: 50, height: 50 });
  });
});

describe("handing frames to the animator", () => {
  it("gives every sheet a sensible way to play back", () => {
    for (const d of SHEET_DEFS) {
      const s = stripFor(d);
      expect(s.order.length, d.kind).toBe(d.frames.length);
      expect(s.frameMs, d.kind).toBeGreaterThan(0);
      expect(s.label.length, d.kind).toBeGreaterThan(4);
      // every id must exist on the sheet
      for (const id of s.order) expect(d.frames.some((f) => f.id === id), `${d.kind}/${id}`).toBe(true);
    }
  });

  it("never plays a walk cycle backwards, which would moonwalk", () => {
    expect(stripFor(sheetByKind("sprite-walk")!).pingPong).toBe(false);
  });

  it("turns a turnaround out and back, which reads better", () => {
    expect(stripFor(sheetByKind("turnaround")!).pingPong).toBe(true);
  });
});

describe("making a face say something", () => {
  it("maps vowels to their own mouth shapes", () => {
    expect(visemesForText("a").order).toContain("ai");
    expect(visemesForText("e").order).toContain("e");
    expect(visemesForText("o").order).toContain("o");
    expect(visemesForText("u").order).toContain("u");
  });

  it("closes the lips for m, b and p", () => {
    for (const c of ["m", "b", "p"]) expect(visemesForText(c).order).toContain("mbp");
  });

  it("treats 'th' as one shape, not two", () => {
    const o = visemesForText("the").order;
    expect(o).toContain("th");
    expect(o.filter((x) => x === "th")).toHaveLength(1);
  });

  it("rests between words", () => {
    const o = visemesForText("hi there").order;
    expect(o.filter((x) => x === "rest").length).toBeGreaterThanOrEqual(2);
  });

  it("only ever names shapes the viseme sheet actually has", () => {
    const ids = new Set(sheetByKind("visemes")!.frames.map((f) => f.id));
    for (const id of visemesForText("the quick brown fox jumps over a lazy dog").order) {
      expect(ids, id).toContain(id);
    }
  });

  it("says something rather than nothing for empty text", () => {
    expect(visemesForText("").order).toEqual(["rest"]);
    expect(visemesForText("   ").order).toEqual(["rest"]);
  });

  it("ignores punctuation and digits", () => {
    const ids = new Set(sheetByKind("visemes")!.frames.map((f) => f.id));
    for (const id of visemesForText("hi!!! 123 ...").order) expect(ids, id).toContain(id);
  });
});
