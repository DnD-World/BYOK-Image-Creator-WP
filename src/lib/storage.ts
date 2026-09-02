/**
 * The browser keeps everything the forge remembers in one small box. It is
 * usually about 5 MB, and when it fills up the browser does NOT ask — it just
 * refuses the write, and whatever you just did is gone.
 *
 * This module makes that visible instead of silent:
 *   · measure how full the box is
 *   · save in a way that reports failure instead of swallowing it
 *   · say, in plain words, what to do about it
 */

/** Rough ceiling browsers give a single site. Conservative on purpose. */
const ASSUMED_LIMIT_BYTES = 5 * 1024 * 1024;

export interface StorageReport {
  usedBytes: number;
  limitBytes: number;
  pct: number;
  /** biggest keys first, so we can say WHAT is filling it */
  biggest: { key: string; bytes: number }[];
}

const byteLength = (s: string): number => {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length * 2;
  }
};

/** How full the box is right now. */
export function measureStorage(): StorageReport {
  let usedBytes = 0;
  const entries: { key: string; bytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) ?? "";
      const bytes = byteLength(key) + byteLength(value);
      usedBytes += bytes;
      entries.push({ key, bytes });
    }
  } catch {
    /* storage blocked entirely (private window, blocked cookies) */
  }
  entries.sort((a, b) => b.bytes - a.bytes);
  return {
    usedBytes,
    limitBytes: ASSUMED_LIMIT_BYTES,
    pct: Math.min(100, Math.round((usedBytes / ASSUMED_LIMIT_BYTES) * 100)),
    biggest: entries.slice(0, 5),
  };
}

export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export type SaveResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: "full" | "blocked"; message: string; bytes: number };

/**
 * Save one value. Unlike a bare localStorage.setItem this tells you when it
 * failed and why, in words worth showing to a person.
 */
export function safeSet(key: string, value: string): SaveResult {
  const bytes = byteLength(value);
  try {
    localStorage.setItem(key, value);
    return { ok: true, bytes };
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    const full = /quota|exceeded/i.test(name) || /quota|exceeded/i.test(String(e));
    if (full) {
      return {
        ok: false,
        reason: "full",
        bytes,
        message:
          "The browser's storage is full, so that change was NOT saved. " +
          "Link a folder and export your manifest to a CSV now, then clear old batches in Settings → Advanced.",
      };
    }
    return {
      ok: false,
      reason: "blocked",
      bytes,
      message:
        "The browser refused to save. This usually means a private window, or site data is blocked. " +
        "Your work is still on screen — export it to a CSV before closing this tab.",
    };
  }
}

/** Plain-words warning when the box is getting full, or null when it is fine. */
export function storageWarning(report: StorageReport, warnAtPct: number): string | null {
  if (report.pct < warnAtPct) return null;
  if (report.pct >= 95) {
    return `Storage is ${report.pct}% full — you are about to start losing work. Export your manifest now.`;
  }
  return `Storage is ${report.pct}% full (${formatBytes(report.usedBytes)}). Export a CSV backup soon, or clear old batches.`;
}
