import { describe, expect, it } from "vitest";
import {
  DEFAULT_LADDER,
  callsFor,
  countCall,
  currentRung,
  emptyUsage,
  freshUsage,
  isAllowanceError,
  stepDown,
  summariseDay,
  today,
} from "../src/lib/modelLadder";

const L = DEFAULT_LADDER;

describe("the default ladder", () => {
  it("ends on something with a big allowance", () => {
    expect(L.length).toBeGreaterThanOrEqual(3);
    expect(L[L.length - 1].dailyHint).toMatch(/500|safety/i);
  });

  it("names every rung and never repeats a model", () => {
    const ids = L.map((r) => r.model);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of L) expect(r.label.length).toBeGreaterThan(3);
  });
});

describe("counting calls", () => {
  it("starts at nothing", () => {
    expect(callsFor(emptyUsage(), "gemini-3.7-flash")).toBe(0);
  });

  it("adds up per model", () => {
    let u = emptyUsage();
    u = countCall(u, "a");
    u = countCall(u, "a");
    u = countCall(u, "b");
    expect(callsFor(u, "a")).toBe(2);
    expect(callsFor(u, "b")).toBe(1);
  });

  it("throws the tally away when the day changes", () => {
    const stale = { day: "2020-01-01", calls: { a: 99 }, exhausted: ["a"] };
    const u = freshUsage(stale);
    expect(u.day).toBe(today());
    expect(u.calls).toEqual({});
    expect(u.exhausted).toEqual([]);
  });
});

describe("walking down the ladder", () => {
  it("starts on the best model", () => {
    expect(currentRung(L, emptyUsage())?.model).toBe(L[0].model);
  });

  it("moves to the next one and says how many calls the old one managed", () => {
    let u = emptyUsage();
    for (let i = 0; i < 20; i++) u = countCall(u, L[0].model);

    const s = stepDown(L, u, L[0].model);
    expect(s.callsMade).toBe(20);
    expect(s.movedTo?.model).toBe(L[1].model);
    expect(s.message).toContain("20 calls");
    expect(s.message).toContain(L[0].label);
    expect(s.message).toContain(L[1].label);
  });

  it("says '1 call' rather than '1 calls'", () => {
    const u = countCall(emptyUsage(), L[0].model);
    const msg = stepDown(L, u, L[0].model).message;
    expect(msg).toContain("1 call.");
    expect(msg).not.toContain("1 calls");
  });

  it("keeps stepping until the ladder is spent", () => {
    let u = emptyUsage();
    for (const rung of L) {
      const s = stepDown(L, u, rung.model);
      u = s.usage;
    }
    expect(currentRung(L, u)).toBeNull();
  });

  it("says plainly when there is nothing left", () => {
    let u = emptyUsage();
    for (const rung of L.slice(0, -1)) u = stepDown(L, u, rung.model).usage;
    const last = stepDown(L, u, L[L.length - 1].model);
    expect(last.movedTo).toBeNull();
    expect(last.message).toMatch(/nothing left|until tomorrow/i);
  });

  it("does not list the same model as exhausted twice", () => {
    let u = emptyUsage();
    u = stepDown(L, u, L[0].model).usage;
    u = stepDown(L, u, L[0].model).usage;
    expect(u.exhausted.filter((m) => m === L[0].model)).toHaveLength(1);
  });

  it("copes with a model that is not on the ladder at all", () => {
    const s = stepDown(L, emptyUsage(), "some-other-model");
    expect(s.exhausted.label).toBe("some-other-model");
    expect(s.movedTo?.model).toBe(L[0].model);
  });
});

describe("summariseDay", () => {
  it("says nothing has happened yet", () => {
    expect(summariseDay(L, emptyUsage())).toMatch(/no text-model calls/);
  });

  it("reports what each model did, and marks the spent ones", () => {
    let u = emptyUsage();
    for (let i = 0; i < 3; i++) u = countCall(u, L[0].model);
    u = stepDown(L, u, L[0].model).usage;
    u = countCall(u, L[1].model);

    const line = summariseDay(L, u);
    expect(line).toContain(`${L[0].label} 3 (out)`);
    expect(line).toContain(`${L[1].label} 1`);
  });
});

describe("telling an allowance problem from a real error", () => {
  it("treats 429 as out of allowance", () => {
    expect(isAllowanceError(429)).toBe(true);
  });

  it("treats a quota-flavoured 403 as out of allowance", () => {
    expect(isAllowanceError(403, '{"error":"Quota exceeded for model"}')).toBe(true);
  });

  it("does not mistake a plain 403 for an allowance problem", () => {
    expect(isAllowanceError(403, "API key not valid")).toBe(false);
  });

  it("leaves ordinary failures alone", () => {
    expect(isAllowanceError(500)).toBe(false);
    expect(isAllowanceError(400, "bad request")).toBe(false);
  });
});
