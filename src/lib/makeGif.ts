/**
 * Rendering a motion plan onto a still picture, then packing it into a GIF.
 *
 * Every frame is the same picture, drawn through a slightly different camera:
 * a bit closer, a bit further left, a touch brighter. Because the pixels never
 * change, the loop is perfectly stable — no flickering between regenerated
 * frames, which is what makes AI-generated "animation" look cheap.
 */

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { MotionPlan } from "./motionPlan";

/** Where along the loop we are, 0..1, after easing. */
function eased(t: number, easing: MotionPlan["easing"]): number {
  if (easing === "linear") return t;
  if (easing === "bounce") {
    // a soft overshoot, then settle
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export interface GifOptions {
  /** longest edge of the finished GIF; smaller means a much smaller file */
  maxSize?: number;
  /** 1–30; lower is better quality and a bigger file */
  quality?: number;
  onProgress?: (done: number, total: number) => void;
}

/** How far through the loop frame `i` is, honouring ping-pong. */
export function loopPosition(i: number, frames: number, pingPong: boolean): number {
  if (frames <= 1) return 0;
  const t = i / frames;
  return pingPong ? 1 - Math.abs(1 - 2 * t) : t;
}

/**
 * Draw one frame of the plan onto a canvas context.
 * Exported so the on-screen preview and the GIF encoder stay identical.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  plan: MotionPlan,
  frameIndex: number
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const raw = loopPosition(frameIndex, plan.frames, plan.pingPong);
  const t = eased(raw, plan.easing);
  const wobble = Math.sin(raw * Math.PI * 2 * plan.cycles);

  // Always start a little zoomed in, so panning never exposes the edge.
  const headroom = 1.06 + Math.max(0, plan.pan.x ? Math.abs(plan.pan.x) : 0) + Math.abs(plan.pan.y);
  const scale = headroom * (1 + (plan.zoom - 1) * t) * (1 + plan.sway * 0.2 * wobble);

  const dx = plan.pan.x * w * t + plan.sway * w * wobble;
  const dy = plan.pan.y * h * t + plan.bob * h * wobble;
  const angle = ((plan.rotate * t + plan.rotate * 0.25 * wobble) * Math.PI) / 180;

  const light = 1 + plan.brighten * t + plan.flicker * wobble;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.filter = `brightness(${Math.max(0.2, light).toFixed(3)})`;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.filter = "none";

  void imgW;
  void imgH;
}

/** Build the animated GIF. Returns a Blob ready to save or preview. */
export async function makeGif(
  source: CanvasImageSource & { width?: number; height?: number },
  plan: MotionPlan,
  opts: GifOptions = {}
): Promise<Blob> {
  const maxSize = opts.maxSize ?? 480;
  const srcW = Number((source as { width?: number }).width) || maxSize;
  const srcH = Number((source as { height?: number }).height) || maxSize;

  const ratio = Math.min(1, maxSize / Math.max(srcW, srcH));
  const w = Math.max(2, Math.round(srcW * ratio / 2) * 2);
  const h = Math.max(2, Math.round(srcH * ratio / 2) * 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser would not give us a canvas to draw on.");

  const gif = GIFEncoder();
  const quality = opts.quality ?? 10;

  for (let i = 0; i < plan.frames; i++) {
    drawFrame(ctx, source, srcW, srcH, plan, i);
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256, { format: "rgb565" });
    const index = applyPalette(data, palette, "rgb565");
    gif.writeFrame(index, w, h, { palette, delay: plan.frameMs, transparent: false });
    opts.onProgress?.(i + 1, plan.frames);
    // let the browser breathe, so the window does not freeze on long loops
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }

  gif.finish();
  void quality;
  return new Blob([gif.bytesView()], { type: "image/gif" });
}

/** Roughly how big the finished GIF will be, for a warning before you commit. */
export const estimateGifKb = (w: number, h: number, frames: number): number =>
  Math.round((w * h * frames * 0.28) / 1024);

/** shop_bakery.png → shop_bakery.gif */
export const gifNameFor = (filename: string): string => filename.replace(/\.[a-z0-9]+$/i, "") + ".gif";
