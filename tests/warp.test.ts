/**
 * The four-corner warp is the part that has to be exactly right — if the maths
 * is wrong the lettering slides off the sign. These tests pin the geometry.
 */
import { describe, expect, it } from "vitest";
import {
  homographyFromUnitSquare,
  isDrawableQuad,
  project,
  quadArea,
  quadBounds,
  quadFromRect,
  quadFromRotatedRect,
  quadToPixels,
  quadToUnit,
  type Quad,
} from "../src/lib/warp";

const near = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);
const nearPoint = (p: { x: number; y: number }, x: number, y: number, tol = 1e-6) => {
  near(p.x, x, tol);
  near(p.y, y, tol);
};

describe("homography onto a plain rectangle", () => {
  const rect = quadFromRect(10, 20, 100, 50);

  it("sends the four unit corners to the four rectangle corners", () => {
    const m = homographyFromUnitSquare(rect)!;
    expect(m).not.toBeNull();
    nearPoint(project(m, 0, 0), 10, 20);
    nearPoint(project(m, 1, 0), 110, 20);
    nearPoint(project(m, 1, 1), 110, 70);
    nearPoint(project(m, 0, 1), 10, 70);
  });

  it("puts the middle in the middle", () => {
    const m = homographyFromUnitSquare(rect)!;
    nearPoint(project(m, 0.5, 0.5), 60, 45);
  });
});

describe("homography onto a genuine perspective quad", () => {
  // a signboard seen at an angle: the right edge is shorter than the left
  const sign: Quad = [
    { x: 100, y: 100 },
    { x: 300, y: 140 },
    { x: 300, y: 220 },
    { x: 100, y: 300 },
  ];

  it("still lands every corner exactly", () => {
    const m = homographyFromUnitSquare(sign)!;
    nearPoint(project(m, 0, 0), 100, 100, 1e-5);
    nearPoint(project(m, 1, 0), 300, 140, 1e-5);
    nearPoint(project(m, 1, 1), 300, 220, 1e-5);
    nearPoint(project(m, 0, 1), 100, 300, 1e-5);
  });

  it("is a real perspective transform, not just a skew", () => {
    const m = homographyFromUnitSquare(sign)!;
    // in a perspective map the centre is pulled towards the shorter edge,
    // so it does not sit at the average of the corners
    const avgY = (100 + 140 + 220 + 300) / 4;
    const centre = project(m, 0.5, 0.5);
    expect(Math.abs(centre.y - avgY)).toBeGreaterThan(0.5);
  });

  it("keeps straight lines straight", () => {
    const m = homographyFromUnitSquare(sign)!;
    const a = project(m, 0, 0.5);
    const b = project(m, 0.5, 0.5);
    const c = project(m, 1, 0.5);
    // the three points must be collinear
    const cross = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });
});

describe("degenerate corners", () => {
  it("refuses a quad collapsed to a line", () => {
    const line: Quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    expect(isDrawableQuad(line)).toBe(false);
  });

  it("refuses a quad with two corners on top of each other", () => {
    const pinched: Quad = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(isDrawableQuad(pinched)).toBe(false);
  });

  it("refuses corners that are not numbers", () => {
    const bad: Quad = [
      { x: NaN, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(isDrawableQuad(bad)).toBe(false);
  });

  it("accepts an ordinary rectangle", () => {
    expect(isDrawableQuad(quadFromRect(0, 0, 5, 5))).toBe(true);
  });

  it("handles a parallelogram through the affine path", () => {
    const par: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 20 },
      { x: 120, y: 80 },
      { x: 20, y: 60 },
    ];
    const m = homographyFromUnitSquare(par)!;
    expect(m).not.toBeNull();
    nearPoint(project(m, 1, 1), 120, 80, 1e-5);
  });
});

describe("quad helpers", () => {
  it("measures area, and knows clockwise from anticlockwise", () => {
    expect(Math.abs(quadArea(quadFromRect(0, 0, 10, 4)))).toBeCloseTo(40, 6);
    const reversed = [...quadFromRect(0, 0, 10, 4)].reverse() as Quad;
    expect(Math.sign(quadArea(reversed))).toBe(-Math.sign(quadArea(quadFromRect(0, 0, 10, 4))));
  });

  it("rotates a rectangle about its centre without changing its size", () => {
    const q = quadFromRotatedRect(50, 50, 40, 20, 30);
    expect(Math.abs(quadArea(q))).toBeCloseTo(800, 4);
    // the centre must not have moved
    const cx = q.reduce((s, p) => s + p.x, 0) / 4;
    const cy = q.reduce((s, p) => s + p.y, 0) / 4;
    near(cx, 50, 1e-6);
    near(cy, 50, 1e-6);
  });

  it("rotating by zero gives the plain rectangle back", () => {
    const q = quadFromRotatedRect(10, 10, 20, 10, 0);
    nearPoint(q[0], 0, 5);
    nearPoint(q[2], 20, 15);
  });

  it("converts between 0..1 and pixels without drift", () => {
    const unit = quadFromRect(0.1, 0.2, 0.5, 0.25);
    const px = quadToPixels(unit, 800, 600);
    nearPoint(px[0], 80, 120);
    const back = quadToUnit(px, 800, 600);
    nearPoint(back[0], 0.1, 0.2);
    nearPoint(back[2], 0.6, 0.45);
  });

  it("finds the box around a tilted quad", () => {
    const b = quadBounds(quadFromRotatedRect(0, 0, 10, 10, 45));
    const halfDiag = Math.sqrt(200) / 2;
    near(b.w, halfDiag * 2, 1e-6);
    near(b.h, halfDiag * 2, 1e-6);
  });
});
