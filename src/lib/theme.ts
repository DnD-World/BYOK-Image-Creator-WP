/**
 * The dark the app sits on, tinted by whichever accent you picked.
 *
 * The six surface tones used to be fixed warm browns — #17120e and friends —
 * hand-picked to sit under the ember accent. That meant changing the accent to
 * Glacier gave you a cold blue button on a warm brown page: the highlight
 * moved and the room it was in did not.
 *
 * These are now derived from the accent's own hue. The saturation and
 * lightness curve is taken from the original brown set, so ember comes out
 * within a shade of where it always was and every other accent gets the same
 * treatment in its own colour — dark blood red for Dragonfire, dark sea blue
 * for Glacier, near-black purple for Potion.
 *
 * Only surfaces. Text stays the warm off-white it was: tinting the text as
 * well drops contrast at exactly the point where it matters, and a page can
 * be moody without being hard to read.
 */

/** The saturation/lightness of each surface, measured from the original set. */
const SURFACES: { name: string; s: number; l: number }[] = [
  { name: "ink", s: 24, l: 7 },
  { name: "coal", s: 27, l: 9 },
  { name: "panel", s: 29, l: 11 },
  { name: "panel2", s: 31, l: 14 },
  { name: "raise", s: 30, l: 17 },
  { name: "line", s: 30, l: 19 },
  { name: "line2", s: 28, l: 24 },
];

/** #rrggbb → {h,s,l}, with h in degrees. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 33, s: 87, l: 59 }; // ember, so a bad value is not a black page
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = h * 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * The surface tones for an accent, as CSS custom properties.
 *
 * A grey accent (saturation near zero) would otherwise produce a flat black
 * page with no depth at all, so the tint is floored — the room always keeps a
 * little colour even when the highlight has none.
 */
export function surfacesFor(accentHex: string): Record<string, string> {
  const { h, s } = hexToHsl(accentHex);
  // A very desaturated accent still gets a readable amount of tint.
  const strength = s < 20 ? 0.45 : 1;
  const out: Record<string, string> = {};
  for (const surface of SURFACES) {
    out[`--color-${surface.name}`] = hslToHex(h, surface.s * strength, surface.l);
  }
  return out;
}
