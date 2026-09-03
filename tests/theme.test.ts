/**
 * The page takes its tint from the accent.
 *
 * The surfaces used to be fixed warm browns chosen to sit under ember, so
 * picking Glacier gave a cold blue button on a warm brown page — the highlight
 * moved and the room it was in did not.
 */
import { describe, expect, it } from "vitest";
import { hexToHsl, hslToHex, surfacesFor } from "../src/lib/theme";
import { ACCENTS } from "../src/types";

describe("colour conversion", () => {
  it("round-trips a colour", () => {
    for (const hex of ["#f2a33c", "#56b8a5", "#7db8d8", "#17120e"]) {
      const { h, s, l } = hexToHsl(hex);
      expect(hslToHex(h, s, l)).toBe(hex.toLowerCase());
    }
  });

  it("reads the hue of each accent as the eye would", () => {
    expect(Math.round(hexToHsl("#f2a33c").h)).toBeGreaterThan(20); // ember: orange
    expect(Math.round(hexToHsl("#f2a33c").h)).toBeLessThan(45);
    expect(Math.round(hexToHsl("#7db8d8").h)).toBeGreaterThan(180); // glacier: blue
    expect(Math.round(hexToHsl("#b18ce0").h)).toBeGreaterThan(250); // potion: purple
  });

  it("does not return a black page for a nonsense colour", () => {
    const s = surfacesFor("not a colour");
    expect(s["--color-ink"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(s["--color-ink"]).not.toBe("#000000");
  });
});

describe("the surfaces", () => {
  it("gives every surface the accent's hue", () => {
    for (const accent of ACCENTS) {
      const want = Math.round(hexToHsl(accent.hex).h);
      for (const [name, hex] of Object.entries(surfacesFor(accent.hex))) {
        const got = Math.round(hexToHsl(hex).h);
        // A near-black has very few 8-bit values to land on, so the hue can
        // quantise a few degrees off. At 7% lightness that is invisible; what
        // matters is that it is the accent's hue and not a fixed brown.
        expect(Math.abs(got - want), `${accent.id} ${name}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it("keeps every surface dark enough to read light text on", () => {
    for (const accent of ACCENTS) {
      for (const [name, hex] of Object.entries(surfacesFor(accent.hex))) {
        expect(hexToHsl(hex).l, `${accent.id} ${name}`).toBeLessThan(28);
      }
    }
  });

  it("keeps them in order, darkest first, so depth still reads", () => {
    const s = surfacesFor("#f2a33c");
    const order = ["ink", "coal", "panel", "panel2", "raise", "line"];
    const ls = order.map((n) => hexToHsl(s[`--color-${n}`]).l);
    for (let i = 1; i < ls.length; i++) expect(ls[i], order[i]).toBeGreaterThan(ls[i - 1]);
  });

  it("stays close to the original browns for ember, which was the reference", () => {
    // The curve was measured from the hand-picked set, so ember should land
    // within a shade of where it always was.
    const ink = hexToHsl(surfacesFor("#f2a33c")["--color-ink"]);
    const wasInk = hexToHsl("#17120e");
    expect(Math.abs(ink.l - wasInk.l)).toBeLessThan(2);
    expect(Math.abs(ink.h - wasInk.h)).toBeLessThan(4);
  });

  it("actually differs between a warm and a cold accent", () => {
    // The whole point: the page must not stay brown when the accent is blue.
    const warm = surfacesFor("#e2593f")["--color-panel"];
    const cold = surfacesFor("#7db8d8")["--color-panel"];
    expect(warm).not.toBe(cold);
    expect(Math.abs(hexToHsl(warm).h - hexToHsl(cold).h)).toBeGreaterThan(90);
  });

  it("still tints when the accent has almost no colour of its own", () => {
    const grey = surfacesFor("#9a9a9a");
    expect(hexToHsl(grey["--color-panel"]).l).toBeGreaterThan(5);
  });
});
