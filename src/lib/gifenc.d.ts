/**
 * Types for gifenc, which ships without any.
 * Only the handful of things makeGif.ts actually uses.
 */
declare module "gifenc" {
  export interface GifEncoderFrameOptions {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    repeat?: number;
    dispose?: number;
  }

  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifEncoderFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
    bytesView(): Uint8Array<ArrayBuffer>;
    reset(): void;
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance;

  export function quantize(
    data: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean; clearAlpha?: boolean }
  ): number[][];

  export function applyPalette(
    data: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444"
  ): Uint8Array;

  export function nearestColorIndex(palette: number[][], pixel: number[]): number;
}
