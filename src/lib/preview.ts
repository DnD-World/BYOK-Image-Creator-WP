import type { ManifestRow } from "../types";
import { ASPECTS } from "../types";

/* ---------------- seeded randomness ---------------- */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ctx {
  W: number;
  H: number;
  rnd: () => number;
  pal: Palette;
}
interface Palette {
  sky1: string;
  sky2: string;
  wall: string;
  wallD: string;
  awn1: string;
  awn2: string;
  glow: string;
  ground: string;
  accent: string;
  robe: string;
}

const PALETTES: Palette[] = [
  { sky1: "#43304f", sky2: "#c96f3b", wall: "#cf8f52", wallD: "#8a5630", awn1: "#d95f3b", awn2: "#eec17c", glow: "#ffd98c", ground: "#5b4630", accent: "#7d9c5c", robe: "#5d4470" },
  { sky1: "#2f3a55", sky2: "#d98a4a", wall: "#c07e4c", wallD: "#7e4e2a", awn1: "#b8452e", awn2: "#e8b06a", glow: "#ffcf7a", ground: "#54412d", accent: "#88a06b", robe: "#4c5a78" },
  { sky1: "#4c3348", sky2: "#c2653e", wall: "#d89a5e", wallD: "#96603a", awn1: "#c25038", awn2: "#f0c98a", glow: "#ffe0a1", ground: "#63492f", accent: "#6f9464", robe: "#6e4a5e" },
  { sky1: "#35414e", sky2: "#cd7c42", wall: "#c4854e", wallD: "#84532c", awn1: "#ad3f2c", awn2: "#e5b573", glow: "#ffd489", ground: "#584531", accent: "#93a86a", robe: "#54506e" },
];

const pick = <T,>(rnd: () => number, arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const rf = (rnd: () => number, a: number, b: number) => a + rnd() * (b - a);

function star(x: number, y: number, s: number, fill: string, op = 0.9): string {
  return `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z" fill="${fill}" opacity="${op}"/>`;
}

function qp(t: number, p0: number, p1: number, p2: number) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function bunting(x0: number, y0: number, x2: number, y2: number, n: number, colors: string[]): string {
  const xm = (x0 + x2) / 2;
  const ym = Math.max(y0, y2) + 26;
  let out = `<path d="M${x0} ${y0} Q${xm} ${ym} ${x2} ${y2}" stroke="#f4e8d4" stroke-width="2.5" fill="none" opacity="0.55"/>`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = qp(t, x0, xm, x2);
    const y = qp(t, y0, ym, y2);
    const c = colors[i % colors.length];
    out += `<path d="M${x - 9} ${y} L${x + 9} ${y} L${x} ${y + 17} Z" fill="${c}" opacity="0.92"/>`;
  }
  return out;
}

const DEFS = (pal: Palette) => `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${pal.sky1}"/><stop offset="1" stop-color="${pal.sky2}"/>
  </linearGradient>
  <radialGradient id="lamp"><stop offset="0" stop-color="${pal.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient>
  <radialGradient id="vig"><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/></radialGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#1a0f06" flood-opacity="0.32"/></filter>
  <filter id="clay"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.8  0 0 0 0.05 0"/></filter>
</defs>`;

const WRAP = (W: number, H: number, inner: string, pal: Palette) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS(pal)}${inner}<rect width="${W}" height="${H}" filter="url(#clay)"/><rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;

/* ---------------- scenes ---------------- */

function shopScene({ W, H, rnd, pal }: Ctx): string {
  const gy = H * 0.8;
  const bw = Math.min(W * 0.52, H * 0.8);
  const bh = H * 0.52;
  const cx = W / 2;
  const left = cx - bw / 2;
  const top = gy - bh;
  let s = "";
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  for (let i = 0; i < 7; i++) s += `<circle cx="${rf(rnd, W * 0.03, W * 0.97)}" cy="${rf(rnd, H * 0.03, H * 0.3)}" r="${rf(rnd, 1.4, 2.6)}" fill="#f4e8d4" opacity="${rf(rnd, 0.3, 0.7)}"/>`;
  s += `<circle cx="${W * 0.82}" cy="${H * 0.2}" r="${H * 0.17}" fill="url(#lamp)"/><circle cx="${W * 0.82}" cy="${H * 0.2}" r="${H * 0.055}" fill="${pal.glow}" opacity="0.85"/>`;
  s += `<ellipse cx="${W * 0.16}" cy="${gy + H * 0.05}" rx="${W * 0.42}" ry="${H * 0.12}" fill="${pal.wallD}" opacity="0.35"/>`;
  s += bunting(W * 0.02, H * 0.07, W * 0.58, H * 0.1, 6, [pal.awn1, pal.awn2, pal.accent]);
  // chimney + smoke
  const chX = left + bw * 0.66;
  s += `<g transform="rotate(-1.3 ${cx} ${gy})">`;
  s += `<rect x="${chX}" y="${top - bh * 0.2}" width="${bw * 0.11}" height="${bh * 0.26}" rx="5" fill="${pal.wallD}"/>`;
  for (let i = 0; i < 3; i++)
    s += `<circle cx="${chX + bw * 0.05 + i * 9}" cy="${top - bh * 0.26 - i * 17}" r="${6 + i * 4}" fill="#f4e8d4" opacity="${0.2 - i * 0.05}"/>`;
  // wall + trim
  s += `<rect x="${left}" y="${top}" width="${bw}" height="${bh}" rx="16" fill="${pal.wall}" filter="url(#soft)"/>`;
  s += `<rect x="${left - 9}" y="${top - 9}" width="${bw + 18}" height="15" rx="7" fill="${pal.wallD}"/>`;
  // awning
  const awY = top + bh * 0.28;
  const n = 7;
  const sw = bw / n;
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? pal.awn1 : pal.awn2;
    s += `<rect x="${left + i * sw}" y="${awY}" width="${sw + 0.6}" height="${bh * 0.16}" fill="${c}"/>`;
    s += `<circle cx="${left + i * sw + sw / 2}" cy="${awY + bh * 0.16}" r="${sw / 2}" fill="${c}"/>`;
  }
  // windows
  const wy = top + bh * 0.55;
  for (const wx of [left + bw * 0.12, left + bw * 0.68]) {
    s += `<rect x="${wx}" y="${wy}" width="${bw * 0.2}" height="${bh * 0.17}" rx="9" fill="${pal.glow}" opacity="0.92"/>`;
    s += `<path d="M${wx + bw * 0.1} ${wy} V${wy + bh * 0.17} M${wx} ${wy + bh * 0.085} H${wx + bw * 0.2}" stroke="${pal.wallD}" stroke-width="3.5" opacity="0.75"/>`;
  }
  // door
  const dw = bw * 0.19;
  s += `<rect x="${cx - dw / 2}" y="${gy - bh * 0.36}" width="${dw}" height="${bh * 0.36}" rx="${dw / 2}" fill="#452c19"/>`;
  s += `<circle cx="${cx + dw * 0.28}" cy="${gy - bh * 0.16}" r="3.6" fill="${pal.glow}"/>`;
  // hanging sign
  const sgX = left + bw + 4;
  s += `<path d="M${sgX} ${top + bh * 0.4} h${bw * 0.17}" stroke="${pal.wallD}" stroke-width="5"/>`;
  s += `<rect x="${sgX + bw * 0.02}" y="${top + bh * 0.4}" width="${bw * 0.15}" height="${bh * 0.15}" rx="7" fill="${pal.wallD}" stroke="${pal.glow}" stroke-width="2"/>`;
  s += `<circle cx="${sgX + bw * 0.095}" cy="${top + bh * 0.475}" r="${bh * 0.032}" fill="${pal.glow}"/>`;
  s += `</g>`;
  // lantern post
  const lx = left - bw * 0.16;
  s += `<rect x="${lx - 3}" y="${gy - H * 0.21}" width="6" height="${H * 0.21}" rx="3" fill="#3c2a1a"/>`;
  s += `<rect x="${lx - 10}" y="${gy - H * 0.26}" width="20" height="24" rx="6" fill="#3c2a1a" stroke="${pal.glow}" stroke-width="2"/>`;
  s += `<circle cx="${lx}" cy="${gy - H * 0.245}" r="${H * 0.12}" fill="url(#lamp)"/>`;
  s += `<circle cx="${lx}" cy="${gy - H * 0.248}" r="5" fill="${pal.glow}"/>`;
  // crates
  s += `<g transform="rotate(2.5 ${left + bw + bw * 0.2} ${gy})"><rect x="${left + bw + bw * 0.08}" y="${gy - 30}" width="44" height="30" rx="6" fill="${pal.wallD}"/><rect x="${left + bw + bw * 0.13}" y="${gy - 56}" width="34" height="26" rx="6" fill="${pal.accent}"/></g>`;
  // ground + cobbles
  s += `<rect y="${gy}" width="${W}" height="${H - gy}" fill="${pal.ground}"/>`;
  for (let i = 0; i < 9; i++)
    s += `<ellipse cx="${rf(rnd, 0, W)}" cy="${rf(rnd, gy + 8, H - 6)}" rx="${rf(rnd, 10, 26)}" ry="${rf(rnd, 3, 6)}" fill="#1a0f06" opacity="0.16"/>`;
  return s;
}

function itemScene({ W, H, rnd, pal }: Ctx): string {
  const cx = W / 2;
  const cy = H * 0.44;
  const m = Math.min(W, H);
  const r = m * 0.34;
  let s = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 1.28}" fill="url(#lamp)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ecd9ac" stroke="${pal.wallD}" stroke-width="6" filter="url(#soft)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="none" stroke="${pal.wallD}" stroke-width="2" opacity="0.25"/>`;
  s += `<ellipse cx="${cx}" cy="${cy + r * 0.62}" rx="${r * 0.5}" ry="${r * 0.12}" fill="#1a0f06" opacity="0.22"/>`;
  const v = Math.floor(rnd() * 4);
  if (v === 0) {
    // longsword
    s += `<g transform="rotate(22 ${cx} ${cy})">`;
    s += `<polygon points="${cx - 11},${cy + 78} ${cx + 11},${cy + 78} ${cx + 6},${cy - 92} ${cx},${cy - 108} ${cx - 6},${cy - 92}" fill="#d9dee3" stroke="#878e96" stroke-width="3"/>`;
    s += `<line x1="${cx}" y1="${cy - 96}" x2="${cx}" y2="${cy + 72}" stroke="#aab1b8" stroke-width="3"/>`;
    s += `<rect x="${cx - 36}" y="${cy + 74}" width="72" height="14" rx="7" fill="${pal.glow}" stroke="#a97e2e" stroke-width="2.5"/>`;
    s += `<rect x="${cx - 9}" y="${cy + 86}" width="18" height="46" rx="8" fill="#6b4226"/>`;
    for (let i = 0; i < 4; i++) s += `<line x1="${cx - 9}" y1="${cy + 95 + i * 10}" x2="${cx + 9}" y2="${cy + 91 + i * 10}" stroke="#4a2c16" stroke-width="3"/>`;
    s += `<circle cx="${cx}" cy="${cy + 138}" r="12" fill="${pal.glow}" stroke="#a97e2e" stroke-width="2.5"/>`;
    s += `</g>`;
  } else if (v === 1) {
    // potion
    s += `<circle cx="${cx}" cy="${cy + 26}" r="${r * 0.34}" fill="#cfe3dd" opacity="0.5" stroke="#8fb0a4" stroke-width="3"/>`;
    s += `<path d="M${cx - r * 0.3} ${cy + 26 + r * 0.16} A ${r * 0.34} ${r * 0.34} 0 0 0 ${cx + r * 0.3} ${cy + 26 + r * 0.16} Z" fill="${pal.accent}" opacity="0.95"/>`;
    s += `<rect x="${cx - 13}" y="${cy - 78}" width="26" height="42" rx="9" fill="#cfe3dd" opacity="0.6" stroke="#8fb0a4" stroke-width="3"/>`;
    s += `<rect x="${cx - 16}" y="${cy - 92}" width="32" height="18" rx="6" fill="#8a5a33" stroke="#5e3c1e" stroke-width="2.5"/>`;
    for (let i = 0; i < 3; i++) s += `<circle cx="${cx + rf(rnd, -16, 16)}" cy="${cy + rf(rnd, 6, 34)}" r="${rf(rnd, 3, 6)}" fill="${pal.glow}" opacity="0.8"/>`;
  } else if (v === 2) {
    // shield
    s += `<path d="M${cx - r * 0.36} ${cy - r * 0.4} h${r * 0.72} v${r * 0.34} q0 ${r * 0.4} ${-r * 0.36} ${r * 0.56} q${-r * 0.36} ${-r * 0.16} ${-r * 0.36} ${-r * 0.56} Z" fill="${pal.wallD}" stroke="#54331a" stroke-width="5"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.11}" fill="${pal.glow}" stroke="#a97e2e" stroke-width="3"/>`;
    s += `<path d="M${cx} ${cy - r * 0.3} l${r * 0.09} ${r * 0.12} l${-r * 0.09} ${r * 0.12} l${-r * 0.09} ${-r * 0.12} Z" fill="${pal.accent}"/>`;
    for (const [px, py] of [[-0.26, -0.28], [0.26, -0.28], [-0.2, 0.2], [0.2, 0.2]])
      s += `<circle cx="${cx + r * px}" cy="${cy + r * py}" r="4" fill="${pal.glow}"/>`;
  } else {
    // spellbook
    s += `<rect x="${cx - r * 0.38}" y="${cy + 6}" width="${r * 0.76}" height="${r * 0.16}" rx="6" fill="#7a4a2c"/>`;
    s += `<rect x="${cx - r * 0.34}" y="${cy - r * 0.12}" width="${r * 0.68}" height="${r * 0.16}" rx="6" fill="#946437"/>`;
    s += `<rect x="${cx - r * 0.38}" y="${cy - r * 0.32}" width="${r * 0.76}" height="${r * 0.18}" rx="6" fill="#8f3a2a" stroke="#5e241a" stroke-width="3"/>`;
    s += `<rect x="${cx + r * 0.28}" y="${cy - r * 0.3}" width="${r * 0.07}" height="${r * 0.52}" rx="4" fill="#e8d3a8"/>`;
    s += `<circle cx="${cx}" cy="${cy - r * 0.23}" r="${r * 0.05}" fill="${pal.glow}"/>`;
    for (let i = 0; i < 3; i++)
      s += `<line x1="${cx - r * 0.26 + i * r * 0.12}" y1="${cy - r * 0.27}" x2="${cx - r * 0.2 + i * r * 0.12}" y2="${cy - r * 0.19}" stroke="${pal.glow}" stroke-width="3" stroke-linecap="round"/>`;
  }
  s += star(cx - r * 0.85, cy - r * 0.7, 13, pal.glow);
  s += star(cx + r * 0.9, cy - r * 0.4, 9, pal.glow, 0.8);
  s += star(cx + r * 0.55, cy + r * 0.95, 11, pal.glow, 0.7);
  s += `<rect y="${H * 0.86}" width="${W}" height="${H * 0.14}" fill="${pal.ground}"/>`;
  return s;
}

function eventScene({ W, H, rnd, pal }: Ctx): string {
  const gy = H * 0.76;
  let s = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  s += `<circle cx="${W * 0.18}" cy="${H * 0.16}" r="${H * 0.14}" fill="url(#lamp)"/><circle cx="${W * 0.18}" cy="${H * 0.16}" r="${H * 0.045}" fill="${pal.glow}" opacity="0.85"/>`;
  // roofline silhouettes
  s += `<polygon points="${-10},${gy} ${W * 0.06},${H * 0.42} ${W * 0.2},${gy}" fill="${pal.wallD}" opacity="0.55"/>`;
  s += `<polygon points="${W * 0.8},${gy} ${W * 0.92},${H * 0.4} ${W * 1.02},${gy}" fill="${pal.wallD}" opacity="0.55"/>`;
  // poles + bunting
  const p1x = W * 0.1, p2x = W * 0.9, py = H * 0.3;
  s += `<rect x="${p1x - 4}" y="${py}" width="8" height="${gy - py}" rx="4" fill="#4a331c"/>`;
  s += `<rect x="${p2x - 4}" y="${py}" width="8" height="${gy - py}" rx="4" fill="#4a331c"/>`;
  s += bunting(p1x, py + 4, p2x, py + 4, 9, [pal.awn1, pal.awn2, pal.accent, pal.glow]);
  // left stall
  const stx = W * 0.16;
  s += `<rect x="${stx}" y="${gy - H * 0.2}" width="${W * 0.16}" height="${H * 0.07}" rx="6" fill="${pal.wallD}"/>`;
  for (let i = 0; i < 5; i++) {
    const c = i % 2 === 0 ? pal.awn1 : pal.awn2;
    s += `<rect x="${stx - 8 + (i * (W * 0.16 + 16)) / 5}" y="${gy - H * 0.27}" width="${(W * 0.16 + 16) / 5 + 0.5}" height="${H * 0.075}" fill="${c}"/>`;
  }
  s += `<rect x="${stx + 6}" y="${gy - H * 0.13}" width="${W * 0.16 - 12}" height="${H * 0.13}" rx="5" fill="${pal.wall}"/>`;
  for (let i = 0; i < 3; i++) s += `<circle cx="${stx + W * 0.04 + i * W * 0.04}" cy="${gy - H * 0.155}" r="${H * 0.018}" fill="${pal.glow}"/>`;
  // barrels right
  for (const [bx, by, rr] of [[W * 0.82, gy - 26, 26], [W * 0.865, gy - 22, 22], [W * 0.845, gy - 62, 22]] as const) {
    s += `<ellipse cx="${bx}" cy="${by}" rx="${rr}" ry="${rr * 0.82}" fill="${pal.wallD}" stroke="#54331a" stroke-width="3"/>`;
    s += `<line x1="${bx - rr * 0.8}" y1="${by}" x2="${bx + rr * 0.8}" y2="${by}" stroke="#54331a" stroke-width="3"/>`;
  }
  // ground
  s += `<rect y="${gy}" width="${W}" height="${H - gy}" fill="${pal.ground}"/>`;
  for (let i = 0; i < 8; i++)
    s += `<ellipse cx="${rf(rnd, 0, W)}" cy="${rf(rnd, gy + 8, H - 6)}" rx="${rf(rnd, 10, 24)}" ry="${rf(rnd, 3, 5)}" fill="#1a0f06" opacity="0.16"/>`;
  // fallen crate + apples
  s += `<g transform="rotate(22 ${W * 0.32} ${gy})"><rect x="${W * 0.29}" y="${gy - 34}" width="52" height="34" rx="6" fill="${pal.wallD}"/><line x1="${W * 0.29}" y1="${gy - 17}" x2="${W * 0.29 + 52}" y2="${gy - 17}" stroke="#54331a" stroke-width="3"/></g>`;
  for (const [ax, ay] of [[0.36, 0.94], [0.395, 0.965], [0.345, 0.975]])
    s += `<circle cx="${W * ax}" cy="${H * ay}" r="8" fill="${pal.awn1}"/>`;
  // THE GOAT
  const gx = W * 0.56;
  const gyc = gy - H * 0.02;
  const bw2 = W * 0.085;
  s += `<g transform="rotate(-9 ${gx} ${gyc - H * 0.06})" filter="url(#soft)">`;
  s += `<ellipse cx="${gx}" cy="${gyc - H * 0.06}" rx="${bw2}" ry="${H * 0.052}" fill="#e9dfc9" stroke="#8a7a5e" stroke-width="3"/>`;
  // legs
  for (const [lx, rot] of [[-0.7, 24], [-0.25, -18], [0.3, 20], [0.75, -24]] as const)
    s += `<g transform="rotate(${rot} ${gx + bw2 * lx} ${gyc - H * 0.03})"><rect x="${gx + bw2 * lx - 5}" y="${gyc - H * 0.03}" width="10" height="${H * 0.085}" rx="5" fill="#d8cdb4"/><rect x="${gx + bw2 * lx - 5}" y="${gyc - H * 0.03 + H * 0.07}" width="10" height="${H * 0.015}" rx="4" fill="#5e5138"/></g>`;
  // head
  const hx = gx + bw2 * 1.05;
  const hy = gyc - H * 0.115;
  s += `<circle cx="${hx}" cy="${hy}" r="${H * 0.042}" fill="#e9dfc9" stroke="#8a7a5e" stroke-width="3"/>`;
  s += `<ellipse cx="${hx + H * 0.035}" cy="${hy + H * 0.012}" rx="${H * 0.02}" ry="${H * 0.014}" fill="#d8cdb4"/>`;
  s += `<circle cx="${hx + H * 0.008}" cy="${hy - H * 0.01}" r="3.4" fill="#241a10"/>`;
  s += `<ellipse cx="${hx - H * 0.03}" cy="${hy - H * 0.028}" rx="${H * 0.02}" ry="${H * 0.009}" fill="#d8cdb4" transform="rotate(-28 ${hx - H * 0.03} ${hy - H * 0.028})"/>`;
  s += `<path d="M${hx - H * 0.01} ${hy - H * 0.045} q${-H * 0.02} ${-H * 0.03} ${-H * 0.045} ${-H * 0.028}" stroke="#c9b28a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M${hx + H * 0.015} ${hy - H * 0.045} q${H * 0.012} ${-H * 0.034} ${-H * 0.008} ${-H * 0.05}" stroke="#c9b28a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M${hx + H * 0.03} ${hy + H * 0.03} q${H * 0.004} ${H * 0.02} ${-H * 0.006} ${H * 0.028}" stroke="#8a7a5e" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  // tail
  s += `<circle cx="${gx - bw2 * 1.02}" cy="${gyc - H * 0.075}" r="${H * 0.018}" fill="#d8cdb4"/>`;
  s += `</g>`;
  // motion lines + dust
  for (let i = 0; i < 3; i++)
    s += `<path d="M${gx - bw2 * 1.5} ${gyc - H * (0.05 + i * 0.035)} q${-W * 0.035} ${H * 0.008} ${-W * 0.06} 0" stroke="#f4e8d4" stroke-width="4" fill="none" opacity="${0.5 - i * 0.13}" stroke-linecap="round"/>`;
  for (let i = 0; i < 4; i++)
    s += `<circle cx="${gx - bw2 * (1.1 + i * 0.22)}" cy="${gyc - rf(rnd, 0, H * 0.02)}" r="${rf(rnd, 5, 11)}" fill="#f4e8d4" opacity="${0.22 - i * 0.04}"/>`;
  return s;
}

function npcScene({ W, H, rnd, pal }: Ctx): string {
  const cx = W / 2;
  const baseY = H * 0.88;
  let s = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // arch window
  const aw = Math.min(W * 0.72, H * 0.6);
  s += `<path d="M${cx - aw / 2} ${H * 0.62} V${H * 0.3} Q${cx - aw / 2} ${H * 0.08} ${cx} ${H * 0.08} Q${cx + aw / 2} ${H * 0.08} ${cx + aw / 2} ${H * 0.3} V${H * 0.62} Z" fill="${pal.sky1}" stroke="${pal.wallD}" stroke-width="7" filter="url(#soft)"/>`;
  s += `<circle cx="${cx + aw * 0.2}" cy="${H * 0.22}" r="${H * 0.06}" fill="${pal.glow}" opacity="0.9"/>`;
  s += `<circle cx="${cx + aw * 0.2}" cy="${H * 0.22}" r="${H * 0.12}" fill="url(#lamp)"/>`;
  for (let i = 0; i < 5; i++) s += `<circle cx="${rf(rnd, cx - aw / 2, cx + aw / 2)}" cy="${rf(rnd, H * 0.1, H * 0.5)}" r="2" fill="#f4e8d4" opacity="${rf(rnd, 0.3, 0.7)}"/>`;
  // ground
  s += `<rect y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="${pal.ground}"/>`;
  s += `<ellipse cx="${cx}" cy="${baseY}" rx="${Math.min(W * 0.3, H * 0.16)}" ry="${H * 0.025}" fill="#1a0f06" opacity="0.3"/>`;
  const sc = Math.min(W / 620, H / 620) * 1.15;
  s += `<g transform="translate(${cx} ${baseY}) scale(${sc})" filter="url(#soft)">`;
  // cloak
  s += `<path d="M-88 0 C-97 -150 -62 -228 0 -236 C62 -228 97 -150 88 0 Z" fill="${pal.robe}" stroke="#241a20" stroke-width="5"/>`;
  s += `<path d="M-60 -40 Q0 -20 60 -40 L66 0 L-66 0 Z" fill="#241a20" opacity="0.18"/>`;
  // hood + face
  s += `<circle cx="0" cy="-228" r="52" fill="${pal.robe}" stroke="#241a20" stroke-width="5"/>`;
  s += `<circle cx="0" cy="-220" r="35" fill="#2c2133"/>`;
  s += `<circle cx="-12" cy="-224" r="4.5" fill="${pal.glow}"/><circle cx="12" cy="-224" r="4.5" fill="${pal.glow}"/>`;
  s += `<circle cx="-20" cy="-210" r="5" fill="#e2593f" opacity="0.3"/><circle cx="20" cy="-210" r="5" fill="#e2593f" opacity="0.3"/>`;
  // rope belt
  s += `<path d="M-70 -110 Q0 -88 70 -110" stroke="#c9a35e" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  // staff + orb
  s += `<line x1="96" y1="0" x2="124" y2="-286" stroke="#7a5a38" stroke-width="10" stroke-linecap="round"/>`;
  s += `<circle cx="127" cy="-300" r="40" fill="url(#lamp)"/>`;
  s += `<circle cx="127" cy="-300" r="17" fill="${pal.glow}" stroke="#a97e2e" stroke-width="3"/>`;
  s += `</g>`;
  // cat companion
  const kx = cx - Math.min(W * 0.3, 150);
  s += `<g transform="translate(${kx} ${baseY}) scale(${sc * 0.8})">`;
  s += `<path d="M-22 0 C-26 -34 -14 -52 2 -52 C18 -52 26 -34 22 0 Z" fill="#241a20"/>`;
  s += `<circle cx="2" cy="-56" r="15" fill="#241a20"/>`;
  s += `<polygon points="-8,-66 -12,-80 0,-70" fill="#241a20"/><polygon points="12,-66 16,-80 4,-70" fill="#241a20"/>`;
  s += `<circle cx="-3" cy="-57" r="2.4" fill="${pal.glow}"/><circle cx="7" cy="-57" r="2.4" fill="${pal.glow}"/>`;
  s += `<path d="M22 -6 q26 -6 22 -30" stroke="#241a20" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  s += `</g>`;
  s += star(cx + Math.min(W * 0.32, 170), H * 0.3, 12, pal.glow, 0.85);
  s += star(cx - Math.min(W * 0.34, 180), H * 0.2, 9, pal.glow, 0.7);
  s += star(cx + Math.min(W * 0.14, 90), H * 0.14, 8, pal.glow, 0.6);
  return s;
}

function brokenTablet({ W, H, rnd, pal }: Ctx): string {
  const cx = W / 2;
  const cy = H * 0.46;
  const tw = Math.min(W * 0.6, H * 0.62);
  const th = tw * 0.78;
  let s = `<rect width="${W}" height="${H}" fill="#241b14"/>`;
  s += `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="18" fill="none" stroke="#e2593f" stroke-width="3" stroke-dasharray="12 9" opacity="0.45"/>`;
  s += `<g transform="rotate(${rf(rnd, -2.5, 2.5)} ${cx} ${cy})" filter="url(#soft)">`;
  s += `<rect x="${cx - tw / 2}" y="${cy - th / 2}" width="${tw}" height="${th}" rx="22" fill="#6b5d4d" stroke="#463b2e" stroke-width="6"/>`;
  let px = cx - tw * 0.22;
  let py = cy - th / 2;
  let crack = `M${px} ${py}`;
  for (let i = 0; i < 5; i++) {
    px += rf(rnd, -tw * 0.12, tw * 0.18);
    py += th / 5;
    crack += ` L${px} ${py}`;
  }
  s += `<path d="${crack}" stroke="#3a3128" stroke-width="5" fill="none" stroke-linejoin="round"/>`;
  const xs = th * 0.16;
  s += `<line x1="${cx - xs}" y1="${cy - xs}" x2="${cx + xs}" y2="${cy + xs}" stroke="#e2593f" stroke-width="14" stroke-linecap="round"/>`;
  s += `<line x1="${cx + xs}" y1="${cy - xs}" x2="${cx - xs}" y2="${cy + xs}" stroke="#e2593f" stroke-width="14" stroke-linecap="round"/>`;
  s += `</g>`;
  s += `<text x="${cx}" y="${H - H * 0.08}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="${Math.max(13, H * 0.035)}" letter-spacing="5" fill="#97876d">IMG_ERR · NO PAYLOAD</text>`;
  return s;
}

/* ---------------- public API ---------------- */

export function renderPreview(row: ManifestRow): string {
  const dims = ASPECTS[row.aspect_ratio] ?? ASPECTS["16:9"];
  const rnd = mulberry32(hash(row.filename || "untitled") + (row.seed || 0));
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const ctx: Ctx = { W: dims.vbW, H: dims.vbH, rnd, pal };
  const inner =
    row.status === "failed"
      ? brokenTablet(ctx)
      : row.category === "shop"
        ? shopScene(ctx)
        : row.category === "item"
          ? itemScene(ctx)
          : row.category === "event"
            ? eventScene(ctx)
            : npcScene(ctx);
  return "data:image/svg+xml;utf8," + encodeURIComponent(WRAP(dims.vbW, dims.vbH, inner, pal));
}

export function svgUrl(raw: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(raw);
}
