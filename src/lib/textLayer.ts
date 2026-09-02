/**
 * Real lettering on top of a generated picture.
 *
 * Image models cannot spell. Rather than fighting that, this does what people
 * did before AI: make the picture, then set the type on top. The words are real
 * text, so they are always correct, in any font, in any language, and they stay
 * editable long after the picture is finished.
 *
 * Each layer owns four corners. Drag them onto the corners of a signboard and
 * the lettering takes on the perspective of the sign — the same "distort" you
 * would do by hand in Photoshop.
 */

import { drawWarped, quadFromRotatedRect, quadToPixels, type Quad } from "./warp";

export type TextAlign = "left" | "center" | "right";

export interface TextLayer {
  id: string;
  text: string;
  /** css font family list */
  font: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  /** cap height as a fraction of the layer box height */
  sizeRatio: number;
  lineHeight: number;
  letterSpacing: number;
  align: TextAlign;
  color: string;
  opacity: number;
  strokeColor: string;
  /** outline thickness as a fraction of the font size; 0 = none */
  strokeRatio: number;
  shadow: number;
  /** the four corners, 0..1 of the picture, clockwise from top-left */
  quad: Quad;
  /** true when the corners were dragged individually */
  freeform: boolean;
}

export const FONT_CHOICES: { id: string; label: string; stack: string }[] = [
  { id: "display", label: "Heavy slab", stack: "'Alfa Slab One', Georgia, serif" },
  { id: "sans", label: "Clean sans", stack: "'Instrument Sans', system-ui, sans-serif" },
  { id: "mono", label: "Typewriter", stack: "'JetBrains Mono', ui-monospace, monospace" },
  { id: "serif", label: "Book serif", stack: "Georgia, 'Times New Roman', serif" },
  { id: "system", label: "System", stack: "system-ui, sans-serif" },
];

let seq = 0;
export const newLayerId = (): string => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A sensible starting layer, sitting across the middle of the picture. */
export function newTextLayer(text = "YOUR TEXT"): TextLayer {
  return {
    id: newLayerId(),
    text,
    font: FONT_CHOICES[0].stack,
    weight: 700,
    italic: false,
    uppercase: false,
    sizeRatio: 0.62,
    lineHeight: 1.15,
    letterSpacing: 0,
    align: "center",
    color: "#ffffff",
    opacity: 1,
    strokeColor: "#000000",
    strokeRatio: 0.08,
    shadow: 0.35,
    quad: quadFromRotatedRect(0.5, 0.5, 0.7, 0.18, 0),
    freeform: false,
  };
}

/** Move/resize/rotate the box without touching the freeform corners. */
export function boxQuad(cx: number, cy: number, w: number, h: number, rotation: number): Quad {
  return quadFromRotatedRect(cx, cy, w, h, rotation);
}

const lines = (layer: TextLayer): string[] => {
  const raw = layer.uppercase ? layer.text.toUpperCase() : layer.text;
  return raw.split("\n");
};

/**
 * Draw the lettering onto its own transparent canvas, at the size it will
 * occupy on the finished picture. Returns null when there is nothing to draw.
 */
export function renderTextToCanvas(layer: TextLayer, boxW: number, boxH: number): HTMLCanvasElement | null {
  const rows = lines(layer);
  if (!rows.some((r) => r.trim())) return null;

  const w = Math.max(2, Math.round(boxW));
  const h = Math.max(2, Math.round(boxH));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const setFont = (px: number) => {
    ctx.font = `${layer.italic ? "italic " : ""}${layer.weight} ${px}px ${layer.font}`;
  };

  ctx.textBaseline = "middle";
  ctx.textAlign = layer.align;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${layer.letterSpacing}em`;
  }

  // Size from the height first, then shrink until the longest line fits the
  // width. Without this, anything longer than a few characters runs off the
  // edge of the box and is silently clipped.
  let fontPx = Math.max(4, (h / rows.length) * layer.sizeRatio);
  const usableW = w * 0.96;
  setFont(fontPx);
  const widest = () => Math.max(...rows.map((r) => ctx.measureText(r).width || 0));
  const measured = widest();
  if (measured > usableW && measured > 0) {
    fontPx = Math.max(4, fontPx * (usableW / measured));
  }
  setFont(fontPx);

  const x = layer.align === "left" ? w * 0.02 : layer.align === "right" ? w * 0.98 : w / 2;
  const lineGap = fontPx * layer.lineHeight;
  const totalH = lineGap * rows.length;
  const startY = h / 2 - totalH / 2 + lineGap / 2;

  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

  rows.forEach((row, i) => {
    const y = startY + i * lineGap;
    if (layer.shadow > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${Math.min(1, layer.shadow)})`;
      ctx.shadowBlur = fontPx * 0.22;
      ctx.shadowOffsetY = fontPx * 0.05;
      ctx.fillStyle = layer.color;
      ctx.fillText(row, x, y);
      ctx.restore();
    }
    if (layer.strokeRatio > 0) {
      ctx.lineWidth = fontPx * layer.strokeRatio;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(row, x, y);
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(row, x, y);
  });

  return canvas;
}

/**
 * Paint every layer onto a context already holding the picture.
 * `w`/`h` are the pixel size of the target.
 */
export function drawLayers(ctx: CanvasRenderingContext2D, layers: TextLayer[], w: number, h: number): void {
  for (const layer of layers) {
    const px = quadToPixels(layer.quad, w, h);
    // render the type at the size of the quad's longest edges, so it stays sharp
    const topLen = Math.hypot(px[1].x - px[0].x, px[1].y - px[0].y);
    const botLen = Math.hypot(px[2].x - px[3].x, px[2].y - px[3].y);
    const leftLen = Math.hypot(px[3].x - px[0].x, px[3].y - px[0].y);
    const rightLen = Math.hypot(px[2].x - px[1].x, px[2].y - px[1].y);
    const boxW = Math.max(topLen, botLen);
    const boxH = Math.max(leftLen, rightLen);
    if (!(boxW > 1 && boxH > 1)) continue;

    const text = renderTextToCanvas(layer, boxW, boxH);
    if (!text) continue;
    drawWarped(ctx, text, text.width, text.height, px, 18);
  }
}

/** Picture plus lettering, as a PNG you can save. */
export async function compositeToBlob(
  image: CanvasImageSource & { width?: number; height?: number },
  layers: TextLayer[],
  opts: { width?: number; height?: number } = {}
): Promise<Blob> {
  const w = Math.round(opts.width ?? Number(image.width) ?? 1024);
  const h = Math.round(opts.height ?? Number(image.height) ?? 1024);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a canvas to draw on.");

  ctx.drawImage(image, 0, 0, w, h);
  drawLayers(ctx, layers, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not turn the canvas into a picture."))), "image/png");
  });
}

/** shop_sign.png → shop_sign_lettered.png */
export const letteredNameFor = (filename: string): string =>
  filename.replace(/(\.[a-z0-9]+)$/i, "_lettered$1").replace(/^([^.]+)$/, "$1_lettered.png");
