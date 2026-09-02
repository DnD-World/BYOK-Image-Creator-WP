/** Type surface for the Google batch-job helper (geminiBatch.mjs). */

import type { EngineRow } from "./engines.d.mts";

export interface BatchRow extends EngineRow {
  filename: string;
}

export interface SubmittedJob {
  name: string;
  model: string;
  count: number;
  filenames: string[];
  submittedAt: string;
}

export interface BatchStatus {
  raw: unknown;
  state: string;
  done: boolean;
  failed: boolean;
  label: string;
}

export interface CollectedImage {
  filename: string;
  bytes: Uint8Array<ArrayBuffer>;
  mime: string;
}

export declare function batchRequestFor(
  row: BatchRow,
  opts?: { aspectRatio?: string; imageSize?: string }
): Record<string, unknown>;

export declare function submitBatch(
  rows: BatchRow[],
  opts: { apiKey: string; modelId: string; imageSize?: string; displayName?: string }
): Promise<SubmittedJob>;

export declare function checkBatch(name: string, apiKey: string): Promise<BatchStatus>;

export declare function collectBatch(
  job: unknown,
  filenames?: string[]
): { images: CollectedImage[]; failures: { filename: string; error: string }[] };

export declare function describeJob(job: { count: number; model: string; submittedAt?: string }): string;
