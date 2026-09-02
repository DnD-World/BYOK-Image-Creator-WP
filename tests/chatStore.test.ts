/**
 * Chat history: the grouping people already expect, and the edges that make it
 * wrong if you get lazy about them.
 */
import { describe, expect, it } from "vitest";
import { groupByDate, groupByModel, groupChats, titleFrom, type Conversation } from "../src/lib/chatStore";

const DAY = 86_400_000;
const chat = (over: Partial<Conversation> = {}): Conversation => ({
  id: Math.random().toString(36),
  title: "t",
  model: "mistral-medium-latest",
  createdAt: 0,
  updatedAt: 0,
  turns: [],
  ...over,
});

// A fixed mid-afternoon so tests do not drift near midnight.
const NOW = new Date("2026-09-02T15:00:00").getTime();
const at = (d: string) => new Date(d).getTime();

describe("grouping by date", () => {
  it("uses the labels every chat app uses, newest bucket first", () => {
    const groups = groupByDate(
      [
        chat({ updatedAt: at("2026-09-02T09:00:00") }),
        chat({ updatedAt: at("2026-09-01T09:00:00") }),
        chat({ updatedAt: at("2026-08-29T09:00:00") }),
        chat({ updatedAt: at("2026-08-10T09:00:00") }),
        chat({ updatedAt: at("2025-01-01T09:00:00") }),
      ],
      NOW
    );
    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Previous 30 days",
      "Older",
    ]);
  });

  it("counts by calendar day, not elapsed hours", () => {
    // 11pm last night is "Yesterday" when read at 1am — not "2 hours ago", and
    // certainly not "Today". This is the bug in every naive now-minus-24h check.
    const oneAm = new Date("2026-09-02T01:00:00").getTime();
    const lastNight = at("2026-09-01T23:00:00");
    const groups = groupByDate([chat({ updatedAt: lastNight })], oneAm);
    expect(groups[0].label).toBe("Yesterday");
  });

  it("puts this morning under Today even a minute after midnight", () => {
    const justAfterMidnight = new Date("2026-09-02T00:05:00").getTime();
    const groups = groupByDate([chat({ updatedAt: justAfterMidnight })], NOW);
    expect(groups[0].label).toBe("Today");
  });

  it("survives a month boundary", () => {
    const groups = groupByDate([chat({ updatedAt: at("2026-08-31T12:00:00") })], at("2026-09-01T12:00:00"));
    expect(groups[0].label).toBe("Yesterday");
  });

  it("hides buckets with nothing in them", () => {
    const groups = groupByDate([chat({ updatedAt: NOW })], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
  });

  it("sorts newest first inside a bucket", () => {
    const older = chat({ id: "older", updatedAt: at("2026-09-02T09:00:00") });
    const newer = chat({ id: "newer", updatedAt: at("2026-09-02T14:00:00") });
    const groups = groupByDate([older, newer], NOW);
    expect(groups[0].items.map((c) => c.id)).toEqual(["newer", "older"]);
  });

  it("returns nothing for no chats, rather than empty headings", () => {
    expect(groupByDate([], NOW)).toEqual([]);
  });
});

describe("grouping by model", () => {
  it("puts the most-used model first", () => {
    const groups = groupByModel([
      chat({ model: "codestral-latest" }),
      chat({ model: "mistral-medium-latest" }),
      chat({ model: "mistral-medium-latest" }),
    ]);
    expect(groups[0].label).toBe("mistral-medium-latest");
    expect(groups[0].items).toHaveLength(2);
  });

  it("names a chat with no model rather than showing a blank heading", () => {
    expect(groupByModel([chat({ model: "" })])[0].label).toBe("unknown model");
  });

  it("orders ties by name, so the list does not shuffle between renders", () => {
    const groups = groupByModel([chat({ model: "zeta" }), chat({ model: "alpha" })]);
    expect(groups.map((g) => g.label)).toEqual(["alpha", "zeta"]);
  });
});

describe("choosing how to group", () => {
  it("switches between the two", () => {
    const chats = [chat({ updatedAt: NOW, model: "m" })];
    expect(groupChats(chats, "date", NOW)[0].label).toBe("Today");
    expect(groupChats(chats, "model", NOW)[0].label).toBe("m");
  });
});

describe("naming a conversation", () => {
  it("uses what was actually asked", () => {
    expect(titleFrom("a cosy village bakery at dawn")).toBe("a cosy village bakery at dawn");
  });

  it("cuts on a word, never mid-word", () => {
    const source = "a very long request about a rain slick neon noodle stall in the rain";
    const t = titleFrom(source, 30);
    expect(t.endsWith("…")).toBe(true);
    // Every word kept must be a whole word from the original — that is what
    // "cuts on a word" actually means, and a truncated last word would fail it.
    const words = t.slice(0, -1).trim().split(" ");
    const sourceWords = source.split(" ");
    for (const w of words) expect(sourceWords).toContain(w);
  });

  it("does not add an ellipsis when nothing was cut", () => {
    expect(titleFrom("short", 30)).toBe("short");
  });

  it("still truncates a single word too long to keep", () => {
    // No space to break on. Better a hard cut than a title that overflows.
    const t = titleFrom("a".repeat(60), 20);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(21);
  });

  it("collapses runaway whitespace", () => {
    expect(titleFrom("  a    cat  ")).toBe("a cat");
  });

  it("falls back rather than showing an empty row", () => {
    expect(titleFrom("   ")).toBe("New chat");
  });
});
