/**
 * Saved conversations.
 *
 * Deliberately the same shape everyone already knows: a list on the left,
 * newest first, grouped under Today / Yesterday / and so on. There is nothing
 * to gain from inventing a new idea of what a chat history looks like — people
 * arrive knowing how this works, and the only job is not to surprise them.
 *
 * The grouping is pure and lives here rather than in the component, so the
 * fiddly parts — what counts as "yesterday" across a month boundary, what
 * happens at midnight — can be tested without rendering anything.
 */

import type { ChatPlan } from "./chatPlan";

export interface StoredTurn {
  who: "you" | "forge";
  text: string;
  plan?: ChatPlan | null;
  corrections?: string[];
  rowId?: number;
}

export interface Conversation {
  id: string;
  /** taken from the first thing the user said, so it means something */
  title: string;
  /** the text model that answered, so history can be grouped by it */
  model: string;
  createdAt: number;
  updatedAt: number;
  turns: StoredTurn[];
}

const LS_CHATS = "image-forge-chats-v1";
/** Old conversations are not worth losing the whole store over. */
const MAX_KEPT = 200;

export function loadChats(): Conversation[] {
  try {
    const raw = localStorage.getItem(LS_CHATS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Conversation =>
        Boolean(c) && typeof (c as Conversation).id === "string" && Array.isArray((c as Conversation).turns)
    );
  } catch {
    // A corrupt store must not take the whole page down with it.
    return [];
  }
}

export function saveChats(chats: Conversation[]): void {
  try {
    const trimmed = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_KEPT);
    localStorage.setItem(LS_CHATS, JSON.stringify(trimmed));
  } catch {
    /* storage full — the conversation still works, it just will not be kept */
  }
}

export const newChatId = (): string => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * A name for the conversation, from the first thing the user said.
 * Truncated on a word boundary, because a title cut mid-word looks broken.
 */
export function titleFrom(text: string, max = 42): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/* ---------------- grouping ---------------- */

export interface Group {
  label: string;
  items: Conversation[];
}

const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Group by when, the way every chat app does.
 *
 * Compared by calendar day rather than by elapsed hours: something from 11pm
 * last night is "Yesterday" at 1am, not "20 hours ago". That is what a person
 * means.
 */
export function groupByDate(chats: Conversation[], now = Date.now()): Group[] {
  const today = startOfDay(now);
  const DAY = 86_400_000;
  const buckets: { label: string; from: number; items: Conversation[] }[] = [
    { label: "Today", from: today, items: [] },
    { label: "Yesterday", from: today - DAY, items: [] },
    { label: "Previous 7 days", from: today - 7 * DAY, items: [] },
    { label: "Previous 30 days", from: today - 30 * DAY, items: [] },
    { label: "Older", from: -Infinity, items: [] },
  ];

  for (const c of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const bucket = buckets.find((b) => c.updatedAt >= b.from) ?? buckets[buckets.length - 1];
    bucket.items.push(c);
  }
  return buckets.filter((b) => b.items.length > 0).map(({ label, items }) => ({ label, items }));
}

/** Group by which model answered. Most-used first, so the list is stable. */
export function groupByModel(chats: Conversation[]): Group[] {
  const byModel = new Map<string, Conversation[]>();
  for (const c of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const key = c.model?.trim() || "unknown model";
    byModel.set(key, [...(byModel.get(key) ?? []), c]);
  }
  return [...byModel.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([label, items]) => ({ label, items }));
}

export const groupChats = (chats: Conversation[], by: "date" | "model", now = Date.now()): Group[] =>
  by === "model" ? groupByModel(chats) : groupByDate(chats, now);
