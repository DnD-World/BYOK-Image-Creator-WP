/**
 * Putting a flat rectangle onto four arbitrary corners.
 *
 * This is the "free transform / distort" you get in Photoshop when you drag the
 * four corners of a text box onto the four corners of a signboard. It is a
 * projective transform (a homography), and it is what makes overlaid lettering
 * sit *on* a surface rather than floating in front of it.
 *
 * Canvas can only do affine transforms directly, so the rectangle is cut into a
 * grid of small pieces and each piece is drawn with its own affine transform.
 * With enough pieces the seams disappear and the result is indistinguishable
 * from a true perspective warp.
 *
 * Everything here is pure maths — no canvas, no DOM — so it can be tested.
 */

export interface Point {
  x: number;
  y: number;
}

/** Four corners, clockwise from the top-left. */
export type Quad = [Point, Point, Point, Point];

/** A 3x3 projective matrix, row-major. */
export type Matrix3 = number[];

/**
 * The homography taking the unit square (0,0)-(1,1) onto `dst`.
 * Returns null when the corners are degenerate (three in a line, or coincident).
 */
export function homographyFromUnitSquare(dst: Quad): Matrix3 | null {
  const [p0, p1, p2, p3] = dst; // TL, TR, BR, BL

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;

  const den = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(den) || Math.abs(den) < 1e-12) {
    // Affine case: the quad is a parallelogram (or it is degenerate).
    if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) return null;
    return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0, 1];
  }

  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;

  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
}

/** Push a point in the unit square through the matrix. */
export function project(m: Matrix3, u: number, v: number): Point {
  const w = m[6] * u + m[7] * v + m[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return { x: NaN, y: NaN };
  return {
    x: (m[0] * u + m[1] * v + m[2]) / w,
    y: (m[3] * u + m[4] * v + m[5]) / w,
  };
}

/** Is this a quad we can actually draw onto? */
export function isDrawableQuad(q: Quad): boolean {
  if (q.length !== 4) return false;
  for (const p of q) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  // reject if any two corners sit on top of each other
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (Math.hypot(q[i].x - q[j].x, q[i].y - q[j].y) < 1e-6) return false;
    }
  }
  return Math.abs(quadArea(q)) > 1e-6;
}

/** Signed area — negative means the corners run anticlockwise. */
export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return a / 2;
}

/** A plain upright rectangle as a quad, clockwise from top-left. */
export function quadFromRect(x: number, y: number, w: number, h: number): Quad {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** A rectangle rotated about its own centre. */
export function quadFromRotatedRect(cx: number, cy: number, w: number, h: number, degrees: number): Quad {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corners: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  return corners.map(([dx, dy]) => ({
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  })) as Quad;
}

/** Scale a 0..1 quad up to pixels. */
export const quadToPixels = (q: Quad, w: number, h: number): Quad =>
  q.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;

/** Bring a pixel quad back to 0..1. */
export const quadToUnit = (q: Quad, w: number, h: number): Quad =>
  q.map((p) => ({ x: p.x / w, y: p.y / h })) as Quad;

/** The smallest upright box containing the quad. */
export function quadBounds(q: Quad): { x: number; y: number; w: number; h: number } {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Draw `source` so that its four corners land on `dst`.
 *
 * The source is cut into `steps` x `steps` cells; each cell is drawn with its
 * own affine transform, clipped to its own outline. 16 is plenty for text.
 */
export function drawWarped(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  dst: Quad,
  steps = 16
): void {
  const m = homographyFromUnitSquare(dst);
  if (!m || !isDrawableQuad(dst)) return;

  const n = Math.max(1, Math.min(64, Math.round(steps)));
  // A hair of overlap, so neighbouring cells do not show a seam.
  const bleed = 0.5;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const v0 = j / n;
      const v1 = (j + 1) / n;

      const a = project(m, u0, v0);
      const b = project(m, u1, v0);
      const c = project(m, u1, v1);
      const d = project(m, u0, v1);
      if (![a, b, c, d].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;

      // Two triangles per cell, each with an exact affine map.
      drawTriangle(ctx, source, srcW, srcH, u0, v0, u1, v0, u0, v1, a, b, d, bleed);
      drawTriangle(ctx, source, srcW, srcH, u1, v0, u1, v1, u0, v1, b, c, d, bleed);
    }
  }
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  p0: Point,
  p1: Point,
  p2: Point,
  bleed: number
): void {
  const x0 = u0 * srcW;
  const y0 = v0 * srcH;
  const x1 = u1 * srcW;
  const y1 = v1 * srcH;
  const x2 = u2 * srcW;
  const y2 = v2 * srcH;

  const denom = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(denom) < 1e-12) return;

  const a = ((p1.x - p0.x) * (y2 - y0) - (p2.x - p0.x) * (y1 - y0)) / denom;
  const b = ((p2.x - p0.x) * (x1 - x0) - (p1.x - p0.x) * (x2 - x0)) / denom;
  const c = ((p1.y - p0.y) * (y2 - y0) - (p2.y - p0.y) * (y1 - y0)) / denom;
  const d = ((p2.y - p0.y) * (x1 - x0) - (p1.y - p0.y) * (x2 - x0)) / denom;
  const e = p0.x - a * x0 - b * y0;
  const f = p0.y - c * x0 - d * y0;

  ctx.save();
  ctx.beginPath();
  // grow the triangle very slightly about its centroid to hide seams
  const gx = (p0.x + p1.x + p2.x) / 3;
  const gy = (p0.y + p1.y + p2.y) / 3;
  const grow = (p: Point) => {
    const dx = p.x - gx;
    const dy = p.y - gy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * bleed, y: p.y + (dy / len) * bleed };
  };
  const g0 = grow(p0);
  const g1 = grow(p1);
  const g2 = grow(p2);
  ctx.moveTo(g0.x, g0.y);
  ctx.lineTo(g1.x, g1.y);
  ctx.lineTo(g2.x, g2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, c, b, d, e, f);
  ctx.drawImage(source, 0, 0, srcW, srcH);
  ctx.restore();
}
