import type { ManifestRow } from "../types";
import { ASPECTS } from "../types";

/* Deterministic PRNG so a filename + seed always paints the same plate. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashSeed = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const PALETTES = [
  { sky: "#2b2036", far: "#3a2b40", wall: "#8a5a34", wall2: "#6e4527", roof: "#4e3320", accent: "#f2a33c", glow: "#ffd88a" },
  { sky: "#23303d", far: "#2f4150", wall: "#9c6b3f", wall2: "#7c5230", roof: "#443020", accent: "#e2a35a", glow: "#ffe3a3" },
  { sky: "#2e2438", far: "#413350", wall: "#7d5433", wall2: "#5f3f26", roof: "#3c2a1c", accent: "#d98f4a", glow: "#ffcf7d" },
];

export function renderPreview(row: ManifestRow): string {
  const dims = ASPECTS[row.aspect_ratio] ?? ASPECTS["16:9"];
  const { vbW: W, vbH: H } = dims;
  const rnd = mulberry32(hashSeed(row.filename) + (row.seed || 7));
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const R = (min: number, max: number) => min + rnd() * (max - min);

  const stars = Array.from({ length: 14 }, () =>
    `<circle cx="${R(10, W - 10).toFixed(0)}" cy="${R(8, H * 0.3).toFixed(0)}" r="${R(0.7, 1.7).toFixed(1)}" fill="#f4e8d4" opacity="${R(0.15, 0.5).toFixed(2)}"/>`
  ).join("");

  const moon = `<circle cx="${(W * 0.82).toFixed(0)}" cy="${(H * 0.14).toFixed(0)}" r="${(H * 0.05).toFixed(0)}" fill="#f4e8d4" opacity="0.85"/>`;

  const hills = `<path d="M0 ${H * 0.62} Q ${W * 0.25} ${H * 0.5} ${W * 0.5} ${H * 0.6} T ${W} ${H * 0.56} V ${H} H 0 Z" fill="${pal.far}"/>`;
  const ground = `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#1d1611"/>
    <ellipse cx="${W / 2}" cy="${H * 0.98}" rx="${W * 0.75}" ry="${H * 0.16}" fill="#241b14"/>`;

  let scene = "";

  if (row.category === "shop") {
    const bw = W * 0.44, bh = H * 0.42, bx = W / 2 - bw / 2, by = H * 0.72 - bh;
    const roofH = bh * 0.34;
    scene = `
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${pal.wall}"/>
      <rect x="${bx}" y="${by}" width="${bw * 0.5}" height="${bh}" fill="${pal.wall2}"/>
      <path d="M${bx - bw * 0.08} ${by} L${W / 2} ${by - roofH} L${bx + bw * 1.08} ${by} Z" fill="${pal.roof}"/>
      <rect x="${(W / 2 - bw * 0.04).toFixed(0)}" y="${(by - roofH * 0.9).toFixed(0)}" width="${(bw * 0.07).toFixed(0)}" height="${(roofH * 0.7).toFixed(0)}" fill="${pal.wall2}"/>
      <circle cx="${(W / 2 - bw * 0.005).toFixed(0)}" cy="${(by - roofH * 1.05).toFixed(0)}" r="${(bw * 0.035).toFixed(0)}" fill="#cdbc9f" opacity="0.5"/>
      <rect x="${(bx + bw * 0.12).toFixed(0)}" y="${(by + bh * 0.42).toFixed(0)}" width="${(bw * 0.26).toFixed(0)}" height="${(bh * 0.58).toFixed(0)}" rx="4" fill="#312216"/>
      <rect x="${(bx + bw * 0.56).toFixed(0)}" y="${(by + bh * 0.18).toFixed(0)}" width="${(bw * 0.3).toFixed(0)}" height="${(bh * 0.3).toFixed(0)}" rx="3" fill="${pal.glow}" opacity="0.9"/>
      <rect x="${(bx + bw * 0.56).toFixed(0)}" y="${(by + bh * 0.18).toFixed(0)}" width="${(bw * 0.3).toFixed(0)}" height="${(bh * 0.3).toFixed(0)}" rx="3" fill="url(#win)"/>
      <rect x="${(bx + bw * 0.06).toFixed(0)}" y="${(by + bh * 0.06).toFixed(0)}" width="${(bw * 0.34).toFixed(0)}" height="${(bh * 0.14).toFixed(0)}" rx="3" fill="#312216"/>
      <circle cx="${(bx + bw * 0.23).toFixed(0)}" cy="${(by + bh * 0.13).toFixed(0)}" r="${(bw * 0.045).toFixed(0)}" fill="${pal.accent}"/>
      <line x1="${(bx + bw * 1.02).toFixed(0)}" y1="${(by + bh * 0.1).toFixed(0)}" x2="${(bx + bw * 1.18).toFixed(0)}" y2="${(by + bh * 0.1).toFixed(0)}" stroke="#312216" stroke-width="3"/>
      <circle cx="${(bx + bw * 1.18).toFixed(0)}" cy="${(by + bh * 0.2).toFixed(0)}" r="${(bw * 0.05).toFixed(0)}" fill="${pal.glow}"/>
      <circle cx="${(bx + bw * 1.18).toFixed(0)}" cy="${(by + bh * 0.2).toFixed(0)}" r="${(bw * 0.11).toFixed(0)}" fill="${pal.glow}" opacity="0.14"/>`;
    for (let i = 0; i < 5; i++) {
      const sx = bx + (bw / 5) * i;
      scene += `<rect x="${sx.toFixed(0)}" y="${(by + bh * 0.34).toFixed(0)}" width="${(bw / 5).toFixed(0)}" height="${(bh * 0.08).toFixed(0)}" fill="${i % 2 ? "#c9b18a" : "#a3502e"}"/>`;
    }
  } else if (row.category === "item") {
    const cx = W / 2, cy = H * 0.52;
    scene = `
      <rect x="${W * 0.14}" y="${H * 0.12}" width="${W * 0.72}" height="${H * 0.76}" rx="10" fill="#e9dcc0"/>
      <rect x="${W * 0.17}" y="${H * 0.15}" width="${W * 0.66}" height="${H * 0.7}" rx="8" fill="none" stroke="#b39b6f" stroke-width="2" stroke-dasharray="6 5"/>
      <circle cx="${cx}" cy="${cy}" r="${H * 0.24}" fill="${pal.glow}" opacity="0.25"/>`;
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) {
      scene += `
        <rect x="${cx - 6}" y="${cy - H * 0.24}" width="12" height="${H * 0.38}" rx="5" fill="#c9ced6" transform="rotate(-18 ${cx} ${cy})"/>
        <rect x="${cx - 3}" y="${cy - H * 0.24}" width="4" height="${H * 0.38}" fill="#f0f3f7" transform="rotate(-18 ${cx} ${cy})"/>
        <rect x="${cx - 26}" y="${cy + H * 0.12}" width="52" height="9" rx="4" fill="#8a5a34" transform="rotate(-18 ${cx} ${cy})"/>
        <circle cx="${(cx + 13).toFixed(0)}" cy="${(cy + H * 0.19).toFixed(0)}" r="7" fill="${pal.accent}"/>`;
    } else if (kind === 1) {
      scene += `
        <path d="M${cx - H * 0.09} ${cy - H * 0.02} q ${H * 0.09} ${-H * 0.16} ${H * 0.18} 0 q 0 ${H * 0.16} ${-H * 0.09} ${H * 0.16} q ${-H * 0.09} 0 ${-H * 0.09} ${-H * 0.16}" fill="#b23b36"/>
        <rect x="${cx - 7}" y="${cy - H * 0.16}" width="14" height="${H * 0.07}" rx="4" fill="#8a5a34"/>
        <circle cx="${(cx + H * 0.03).toFixed(0)}" cy="${(cy + H * 0.05).toFixed(0)}" r="5" fill="#ffd9d2" opacity="0.8"/>`;
    } else {
      scene += `
        <path d="M${cx} ${cy - H * 0.2} L${cx + H * 0.14} ${cy + H * 0.14} L${cx - H * 0.14} ${cy + H * 0.14} Z" fill="#5a6c7d"/>
        <path d="M${cx} ${cy - H * 0.2} L${cx + H * 0.14} ${cy + H * 0.14} L${cx} ${cy + H * 0.14} Z" fill="#74889a"/>
        <circle cx="${cx}" cy="${(cy + H * 0.02).toFixed(0)}" r="${(H * 0.05).toFixed(0)}" fill="${pal.accent}"/>`;
    }
  } else if (row.category === "event") {
    const gy = H * 0.8;
    scene = `<rect x="0" y="${gy}" width="${W}" height="${H * 0.04}" fill="#312216"/>`;
    for (let i = 0; i < 4; i++) {
      const x = W * (0.08 + i * 0.24);
      scene += `<rect x="${x.toFixed(0)}" y="${(gy - H * 0.3).toFixed(0)}" width="${(W * 0.13).toFixed(0)}" height="${(H * 0.3).toFixed(0)}" fill="${i % 2 ? pal.wall2 : pal.wall}"/>
        <path d="M${x.toFixed(0)} ${(gy - H * 0.3).toFixed(0)} l ${(W * 0.065).toFixed(0)} ${(-H * 0.08).toFixed(0)} l ${(W * 0.065).toFixed(0)} ${(H * 0.08).toFixed(0)} Z" fill="${pal.roof}"/>`;
    }
    const gx = W * R(0.35, 0.55), gyy = gy - H * 0.02;
    scene += `
      <ellipse cx="${gx.toFixed(0)}" cy="${(gyy - H * 0.07).toFixed(0)}" rx="${(W * 0.07).toFixed(0)}" ry="${(H * 0.055).toFixed(0)}" fill="#e8e0cf"/>
      <circle cx="${(gx + W * 0.065).toFixed(0)}" cy="${(gyy - H * 0.11).toFixed(0)}" r="${(H * 0.035).toFixed(0)}" fill="#e8e0cf"/>
      <path d="M${(gx + W * 0.085).toFixed(0)} ${(gyy - H * 0.13).toFixed(0)} l ${(W * 0.02).toFixed(0)} ${(-H * 0.02).toFixed(0)}" stroke="#e8e0cf" stroke-width="4" stroke-linecap="round"/>
      <line x1="${(gx - W * 0.05).toFixed(0)}" y1="${gyy}" x2="${(gx - W * 0.08).toFixed(0)}" y2="${(gyy + H * 0.02).toFixed(0)}" stroke="#e8e0cf" stroke-width="5" stroke-linecap="round"/>
      <line x1="${(gx + W * 0.04).toFixed(0)}" y1="${gyy}" x2="${(gx + W * 0.07).toFixed(0)}" y2="${(gyy + H * 0.02).toFixed(0)}" stroke="#e8e0cf" stroke-width="5" stroke-linecap="round"/>`;
    for (let i = 0; i < 3; i++) {
      const kx = W * R(0.62, 0.9);
      scene += `<circle cx="${kx.toFixed(0)}" cy="${(gy - H * 0.1).toFixed(0)}" r="${(H * 0.028).toFixed(0)}" fill="${["#c9b18a", "#a3502e", "#7d9c5c"][i]}"/>
        <rect x="${(kx - H * 0.018).toFixed(0)}" y="${(gy - H * 0.075).toFixed(0)}" width="${(H * 0.036).toFixed(0)}" height="${(H * 0.075).toFixed(0)}" rx="4" fill="${["#c9b18a", "#a3502e", "#7d9c5c"][i]}"/>`;
    }
    scene += `<path d="M${W * 0.05} ${H * 0.16} Q ${W * 0.3} ${H * 0.24} ${W * 0.55} ${H * 0.15} T ${W * 0.97} ${H * 0.18}" stroke="#cdbc9f" stroke-width="2" fill="none" opacity="0.7"/>`;
    for (let i = 0; i < 6; i++) {
      const fx = W * (0.1 + i * 0.15);
      scene += `<path d="M${fx.toFixed(0)} ${(H * 0.17 + (i % 2) * 8).toFixed(0)} l 10 14 l -20 0 Z" fill="${[pal.accent, "#b23b36", "#7d9c5c"][i % 3]}" opacity="0.9"/>`;
    }
  } else {
    const cx = W / 2, cy = H * 0.46;
    scene = `
      <circle cx="${cx}" cy="${cy}" r="${(H * 0.3).toFixed(0)}" fill="${pal.glow}" opacity="0.12"/>
      <path d="M${cx - H * 0.22} ${H * 0.95} q 0 ${-H * 0.42} ${H * 0.22} ${-H * 0.42} q ${H * 0.22} 0 ${H * 0.22} ${H * 0.42} Z" fill="${pal.wall2}"/>
      <circle cx="${cx}" cy="${(cy - H * 0.02).toFixed(0)}" r="${(H * 0.14).toFixed(0)}" fill="#e3c49c"/>
      <path d="M${cx - H * 0.16} ${(cy - H * 0.02).toFixed(0)} a ${H * 0.16} ${H * 0.16} 0 0 1 ${H * 0.32} 0 l 0 ${-H * 0.05} a ${H * 0.19} ${H * 0.19} 0 0 0 ${-H * 0.32} 0 Z" fill="${pal.roof}"/>
      <path d="M${(cx - H * 0.16).toFixed(0)} ${(cy - H * 0.04).toFixed(0)} q ${H * 0.16} ${-H * 0.24} ${H * 0.32} 0 l ${H * 0.03} ${H * 0.1} q ${-H * 0.19} ${-H * 0.16} ${-H * 0.38} 0 Z" fill="${pal.roof}"/>
      <circle cx="${(cx - H * 0.05).toFixed(0)}" cy="${(cy - H * 0.03).toFixed(0)}" r="${(H * 0.014).toFixed(0)}" fill="#312216"/>
      <circle cx="${(cx + H * 0.05).toFixed(0)}" cy="${(cy - H * 0.03).toFixed(0)}" r="${(H * 0.014).toFixed(0)}" fill="#312216"/>
      <path d="M${(cx - H * 0.03).toFixed(0)} ${(cy + H * 0.045).toFixed(0)} q ${H * 0.03} ${H * 0.02} ${H * 0.06} 0" stroke="#312216" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <rect x="${(cx + H * 0.2).toFixed(0)}" y="${(cy - H * 0.3).toFixed(0)}" width="${(H * 0.035).toFixed(0)}" height="${(H * 0.72).toFixed(0)}" rx="3" fill="#6e4527" transform="rotate(8 ${cx} ${cy})"/>
      <path d="M${(cx + H * 0.19).toFixed(0)} ${(cy - H * 0.32).toFixed(0)} l ${(H * 0.09).toFixed(0)} ${(-H * 0.05).toFixed(0)} l ${(H * 0.02).toFixed(0)} ${(H * 0.09).toFixed(0)} Z" fill="#8b97a5"/>`;
  }

  const vig = `<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.42"/></radialGradient>`;
  const win = `<linearGradient id="win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${dims.w}" height="${dims.h}">
  <defs>${vig}${win}</defs>
  <rect width="${W}" height="${H}" fill="${pal.sky}"/>
  ${stars}${moon}${hills}${ground}${scene}
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;
}
