/**
 * The page takes its tint from the accent.
 *
 * The surfaces used to be fixed warm browns chosen to sit under ember, so
 * picking Glacier gave a cold blue button on a warm brown page — the highlight
 * moved and the room it was in did not.
 */
import { describe, expect, it } from "vitest";
import { ACCENT_VARS, hexToHsl, hslToHex, SURFACE_VARS, surfacesFor, TEXT_VARS } from "../src/lib/theme";
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
  it("gives every token the accent's hue — surfaces, text and the accent roles", () => {
    for (const accent of ACCENTS) {
      const want = Math.round(hexToHsl(accent.hex).h);
      for (const [name, hex] of Object.entries(surfacesFor(accent.hex))) {
        const { h: got, l } = hexToHsl(hex);
        // How far the hue may drift depends on how dark the colour is: a
        // near-black has very few 8-bit values to land on, so it quantises.
        // At 7% lightness a several-degree shift is invisible; at 89% it
        // would not be, and the tolerance tightens accordingly.
        const tolerance = l < 10 ? 10 : l < 25 ? 6 : 2;
        expect(Math.abs(Math.round(got) - want), `${accent.id} ${name} (l=${Math.round(l)})`).toBeLessThanOrEqual(
          tolerance
        );
      }
    }
  });

  it("keeps every surface dark enough to read light text on", () => {
    for (const accent of ACCENTS) {
      const t = surfacesFor(accent.hex);
      for (const v of SURFACE_VARS) {
        expect(hexToHsl(t[v]).l, `${accent.id} ${v}`).toBeLessThan(28);
      }
    }
  });

  it("keeps the text light enough to read on them", () => {
    // The whole risk of tinting text is losing contrast. Saturation and
    // lightness are copied from the originals, so this must stay true.
    for (const accent of ACCENTS) {
      const t = surfacesFor(accent.hex);
      for (const v of TEXT_VARS) {
        expect(hexToHsl(t[v]).l, `${accent.id} ${v}`).toBeGreaterThan(45);
      }
      // the main reading colour must be far brighter than the page behind it
      expect(hexToHsl(t["--color-cream"]).l - hexToHsl(t["--color-ink"]).l).toBeGreaterThan(70);
    }
  });

  it("gives a button a lip darker than its face and a hover lighter", () => {
    for (const accent of ACCENTS) {
      const t = surfacesFor(accent.hex);
      const face = hexToHsl(accent.hex).l;
      expect(hexToHsl(t["--color-accent-deep"]).l, accent.id).toBeLessThan(face);
      expect(hexToHsl(t["--color-accent-lift"]).l, accent.id).toBeGreaterThan(face);
      // and text on the accent must be dark enough to read against it
      expect(face - hexToHsl(t["--color-on-accent"]).l, accent.id).toBeGreaterThan(35);
    }
  });

  it("names every token it returns", () => {
    const keys = Object.keys(surfacesFor("#f2a33c")).sort();
    expect(keys).toEqual([...SURFACE_VARS, ...TEXT_VARS, ...ACCENT_VARS].sort());
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
