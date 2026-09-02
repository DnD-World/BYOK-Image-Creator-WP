/**
 * Working out WHERE the lettering should go.
 *
 * Three ways, cheapest first — and they stack, so you are never stuck:
 *
 *   1. you drag it yourself                    free, instant, always right
 *   2. the app finds the quietest patch        free, instant, no model
 *   3. a vision model finds the actual sign     costs a call, understands
 *                                               "put it on the signboard"
 *
 * (3) proposes, (1) corrects. That is the whole idea: the model gets you 90% of
 * the way and you nudge the corners rather than starting from nothing.
 */

import type { ForgeSettings } from "./providers";
import { quadFromRect, type Quad } from "./warp";

/* ---------------- 2. the free one: find the quietest patch ---------------- */

/**
 * Score a grid of candidate boxes by how *busy* the picture is inside them, and
 * return the calmest one. Busy is measured as average difference between
 * neighbouring pixels — flat sky scores low, a pile of barrels scores high.
 */
export function findQuietQuad(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { boxW?: number; boxH?: number; grid?: number } = {}
): Quad {
  const boxW = opts.boxW ?? 0.6;
  const boxH = opts.boxH ?? 0.18;
  const grid = opts.grid ?? 7;

  let best = { score: Infinity, x: (1 - boxW) / 2, y: (1 - boxH) / 2 };

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = ((1 - boxW) * gx) / Math.max(1, grid - 1);
      const y = ((1 - boxH) * gy) / Math.max(1, grid - 1);
      const px = Math.round(x * w);
      const py = Math.round(y * h);
      const pw = Math.max(1, Math.round(boxW * w));
      const ph = Math.max(1, Math.round(boxH * h));

      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(px, py, pw, ph).data;
      } catch {
        continue;
      }

      // sample sparsely — we only need a ranking, not a precise number
      let busy = 0;
      let n = 0;
      const stride = 4 * Math.max(1, Math.floor(pw / 40));
      for (let i = 0; i + stride + 2 < data.length; i += stride) {
        busy += Math.abs(data[i] - data[i + stride]) + Math.abs(data[i + 1] - data[i + stride + 1]);
        n++;
      }
      const score = n ? busy / n : Infinity;

      // a gentle nudge towards the lower third, where captions usually sit
      const placementBonus = gy >= grid - 3 ? -2 : 0;
      const total = score + placementBonus;

      if (total < best.score) best = { score: total, x, y };
    }
  }

  return quadFromRect(best.x, best.y, boxW, boxH);
}

/* ---------------- 3. the clever one: ask a vision model ---------------- */

export const SPOT_SYSTEM = `You look at a picture and say where a caption should be placed.

Reply with ONLY a JSON object, no prose and no code fences:
{
  "quad": [[x,y],[x,y],[x,y],[x,y]],
  "surface": "a few words naming what you found, e.g. 'the hanging wooden sign'",
  "confident": true|false
}

The four points are the corners of the area the text should fill, CLOCKWISE
starting from the TOP-LEFT of the text as it should read. Each x and y is a
fraction of the picture: 0,0 is the top-left corner, 1,1 the bottom-right.

If the picture contains a surface clearly meant to carry writing — a signboard,
a banner, a label, a book cover, a screen — return the corners OF THAT SURFACE,
following its perspective. The four corners will not form a rectangle if the
surface is seen at an angle, and that is correct and wanted.

If there is no such surface, choose the calmest empty area where a caption would
sit comfortably without covering the subject, and set "confident" to false.

Leave a small margin inside the surface so the letters do not touch its edge.`;

export interface SpotResult {
  quad: Quad;
  surface: string;
  confident: boolean;
  /** which model answered, so the ladder can be reported */
  model?: string;
  problem?: string;
}

const asQuad = (raw: unknown): Quad | null => {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const pts = raw.map((p) => {
    if (Array.isArray(p) && p.length >= 2) return { x: Number(p[0]), y: Number(p[1]) };
    if (p && typeof p === "object" && "x" in p && "y" in p) {
      return { x: Number((p as { x: unknown }).x), y: Number((p as { y: unknown }).y) };
    }
    return null;
  });
  if (pts.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  // keep them on the picture, with a little slack for corners just off-frame
  return pts.map((p) => ({
    x: Math.max(-0.1, Math.min(1.1, p!.x)),
    y: Math.max(-0.1, Math.min(1.1, p!.y)),
  })) as Quad;
};

/**
 * Ask a vision model where the caption belongs.
 *
 * Uses the Gemini key pool and the text-model ladder, so it costs nothing while
 * a free tier lasts and steps down when one runs out.
 */
export async function findTextSpotWithVision(
  pngBase64: string,
  instruction: string,
  settings: ForgeSettings,
  model: string,
  signal?: AbortSignal
): Promise<SpotResult & { status?: number; body?: string }> {
  const key = settings.geminiKeys.find((k) => k.key.trim() && k.exhaustedUntil <= Date.now())?.key.trim();
  if (!key) {
    return {
      quad: quadFromRect(0.15, 0.7, 0.7, 0.18),
      surface: "",
      confident: false,
      problem: "no Google key available — add one in Settings → Engines",
    };
  }

  const body = {
    contents: [
      {
        parts: [
          { text: `${SPOT_SYSTEM}\n\nWhat the caption is for: ${instruction || "a short caption"}` },
          { inline_data: { mime_type: "image/png", data: pngBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    return {
      quad: quadFromRect(0.15, 0.7, 0.7, 0.18),
      surface: "",
      confident: false,
      problem: (e as { message?: string })?.message ?? "could not reach Google",
    };
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return {
      quad: quadFromRect(0.15, 0.7, 0.7, 0.18),
      surface: "",
      confident: false,
      model,
      status: res.status,
      body: text,
      problem: `the vision model answered ${res.status}`,
    };
  }

  try {
    const json = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const answer = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const cleaned = answer.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
    const parsed = JSON.parse(cleaned) as { quad?: unknown; surface?: string; confident?: boolean };
    const quad = asQuad(parsed.quad);
    if (!quad) throw new Error("the model did not return four usable corners");
    return {
      quad,
      surface: String(parsed.surface ?? "").slice(0, 80),
      confident: parsed.confident !== false,
      model,
    };
  } catch (e) {
    return {
      quad: quadFromRect(0.15, 0.7, 0.7, 0.18),
      surface: "",
      confident: false,
      model,
      problem: (e as { message?: string })?.message ?? "could not read the model's answer",
    };
  }
}
