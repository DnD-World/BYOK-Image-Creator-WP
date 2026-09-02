/**
 * The timeline behind a talking avatar.
 *
 * Mouth shapes alone make a face that talks and never blinks, which people
 * read as dead or menacing without being able to say why. These pin the two
 * layers that fix it, and the timing facts behind them.
 */
import { describe, expect, it } from "vitest";
import { avatarTrackForText, framesNeededFor, SHEET_DEFS, sheetByKind, stripFor } from "../src/lib/sheets";

const line = "Hello there. How are you today?";

describe("the sheets an avatar needs", () => {
  it("offers eyes and brows, not just mouths", () => {
    expect(sheetByKind("avatar-eyes")?.frames).toHaveLength(3);
    expect(sheetByKind("avatar-brows")?.frames).toHaveLength(3);
  });

  it("gives a blink three drawings, not two", () => {
    // Cutting straight from open to shut reads as a glitch rather than a blink.
    const ids = sheetByKind("avatar-eyes")!.frames.map((f) => f.id);
    expect(ids).toEqual(["eyes_open", "eyes_half", "eyes_shut"]);
  });

  it("previews the eye sheet as an actual blink", () => {
    const strip = stripFor(sheetByKind("avatar-eyes")!);
    expect(strip.pingPong).toBe(true);
    expect(strip.frameMs).toBeLessThan(100);
  });

  it("tells the model to move only the part that should move", () => {
    const eyes = sheetByKind("avatar-eyes")!;
    expect(eyes.frames.every((f) => f.direction.length > 10)).toBe(true);
  });

  it("keeps every sheet reachable through the catalogue", () => {
    for (const def of SHEET_DEFS) expect(sheetByKind(def.kind)).toBe(def);
  });
});

describe("the track", () => {
  it("covers the whole line with mouth shapes", () => {
    const t = avatarTrackForText(line);
    expect(t.mouth.length).toBeGreaterThan(10);
    expect(t.durationMs).toBe(t.mouth.length * 90);
    expect(t.line).toBe(line);
  });

  it("blinks — the thing mouth shapes alone never do", () => {
    const t = avatarTrackForText("a ".repeat(200));
    expect(t.eyes.length).toBeGreaterThan(0);
    expect(t.eyes.some((c) => c.frame === "eyes_shut")).toBe(true);
  });

  it("closes and opens through the half-shut frame each time", () => {
    const t = avatarTrackForText("a ".repeat(300));
    const shut = t.eyes.findIndex((c) => c.frame === "eyes_shut");
    expect(t.eyes[shut - 1].frame).toBe("eyes_half");
    expect(t.eyes[shut + 1].frame).toBe("eyes_half");
  });

  it("does not blink in the first moments", () => {
    // A blink on frame one reads as a flinch.
    const t = avatarTrackForText("a ".repeat(300));
    expect(t.eyes[0].at).toBeGreaterThan(500);
  });

  it("spaces blinks the way people actually blink", () => {
    // Resting adults blink every few seconds, not on a metronome.
    const t = avatarTrackForText("a ".repeat(600));
    const starts = t.eyes.filter((c) => c.frame === "eyes_shut").map((c) => c.at);
    expect(starts.length).toBeGreaterThan(2);
    const gaps = starts.slice(1).map((s, i) => s - starts[i]);
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(2000);
      expect(g).toBeLessThanOrEqual(8200);
    }
    // and never perfectly even
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  it("never blinks past the end of the line", () => {
    const t = avatarTrackForText("hi");
    for (const c of t.eyes) expect(c.at + c.ms).toBeLessThanOrEqual(t.durationMs);
  });

  it("gives the same take twice for the same seed", () => {
    const a = avatarTrackForText(line, { seed: 7 });
    const b = avatarTrackForText(line, { seed: 7 });
    expect(a.eyes).toEqual(b.eyes);
  });

  it("gives a different take for a different seed", () => {
    const a = avatarTrackForText("a ".repeat(400), { seed: 1 });
    const b = avatarTrackForText("a ".repeat(400), { seed: 2 });
    expect(a.eyes).not.toEqual(b.eyes);
  });
});

describe("brows", () => {
  it("stay put unless asked to be lively", () => {
    const t = avatarTrackForText(line);
    expect(t.brows).toHaveLength(1);
    expect(t.brows[0].frame).toBe("brow_neutral");
  });

  it("raise on a question", () => {
    const t = avatarTrackForText("Are you sure?", { brow: "lively" });
    expect(t.brows[0].frame).toBe("brow_raised");
  });

  it("give each sentence its own brow", () => {
    const t = avatarTrackForText("One. Two. Three.", { brow: "lively" });
    expect(t.brows).toHaveLength(3);
  });
});

describe("what has to be generated", () => {
  it("lists only the frames the track uses", () => {
    const needed = framesNeededFor(avatarTrackForText("hi", { brow: "lively" }));
    expect(needed).toContain("eyes_open");
    expect(needed.every((f) => typeof f === "string" && f.length > 0)).toBe(true);
  });

  it("always includes the resting eyes, which are never cued", () => {
    // eyes_open is the default state between blinks, so nothing ever asks for
    // it explicitly — and forgetting to generate it leaves a hole in the video.
    expect(framesNeededFor(avatarTrackForText("hi"))).toContain("eyes_open");
  });
});
