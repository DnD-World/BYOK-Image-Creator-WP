/**
 * The storage guard exists so a full browser box never eats work silently.
 * These tests fake localStorage, including the failure people actually hit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatBytes, measureStorage, safeSet, storageWarning } from "../src/lib/storage";

class FakeStorage {
  private map = new Map<string, string>();
  failWith: Error | null = null;

  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWith) throw this.failWith;
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

let fake: FakeStorage;

beforeEach(() => {
  fake = new FakeStorage();
  vi.stubGlobal("localStorage", fake);
});

const quotaError = () => {
  const e = new Error("The quota has been exceeded.");
  e.name = "QuotaExceededError";
  return e;
};

describe("safeSet", () => {
  it("saves and reports how big the value was", () => {
    const res = safeSet("k", "hello");
    expect(res.ok).toBe(true);
    expect(fake.getItem("k")).toBe("hello");
  });

  it("reports a full box instead of swallowing it", () => {
    fake.failWith = quotaError();
    const res = safeSet("k", "hello");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("full");
    expect(res.message).toMatch(/NOT saved/);
    expect(res.message).toMatch(/CSV/);
  });

  it("tells a private window apart from a full box", () => {
    fake.failWith = new Error("access denied");
    const res = safeSet("k", "hello");
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("blocked");
    expect(res.message).toMatch(/private window/);
  });
});

describe("measureStorage", () => {
  it("adds up what is in the box and names the biggest culprits", () => {
    fake.setItem("small", "x");
    fake.setItem("big", "y".repeat(5000));
    const report = measureStorage();
    expect(report.usedBytes).toBeGreaterThan(5000);
    expect(report.biggest[0].key).toBe("big");
    expect(report.pct).toBeGreaterThanOrEqual(0);
  });

  it("returns zero rather than throwing when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      get length(): number {
        throw new Error("blocked");
      },
    });
    expect(measureStorage().usedBytes).toBe(0);
  });
});

describe("storageWarning", () => {
  const report = (pct: number) => ({ usedBytes: pct * 52428, limitBytes: 5242880, pct, biggest: [] });

  it("stays quiet while there is room", () => {
    expect(storageWarning(report(20), 70)).toBeNull();
  });

  it("warns once it passes the threshold", () => {
    expect(storageWarning(report(75), 70)).toMatch(/75% full/);
  });

  it("gets blunt when it is nearly full", () => {
    expect(storageWarning(report(97), 70)).toMatch(/losing work/);
  });
});

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [2048, "2 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
  ])("formats %i as %s", (n, expected) => {
    expect(formatBytes(n)).toBe(expected);
  });
});
