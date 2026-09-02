/**
 * The chat proposes; these make sure nothing it says is trusted.
 *
 * A language model told "only use these ids" will still invent one sometimes.
 * That is not a prompting failure to try harder at — it is what they do, and
 * it is the same thing that turned a hard-coded pixtral-large-latest into a
 * 404 on a live account. So every field is checked against the real catalogue
 * and every correction is reported rather than applied silently.
 */
import { describe, expect, it } from "vitest";
import { filenameFor, parseReply } from "../src/lib/chatPlan";
import { STYLE_CATALOGUE } from "../src/lib/styleCatalogue";
import type { ForgeSettings } from "../src/lib/providers";

// Everything free configured, so the catalogue has real choices to offer.
const settings = (over: Record<string, unknown> = {}) =>
  ({
    localBase: "http://localhost:8080/v1",
    localModel: "flux.2-klein-4b",
    cloudflare: { accountId: "acct", token: "tok" },
    pollinationsToken: "tok",
    geminiKeys: [{ id: "a", label: "a", key: "k", exhaustedUntil: 0 }],
    geminiPaidKeys: [],
    openaiKeys: [],
    ...over,
  }) as unknown as ForgeSettings;

const realStyle = STYLE_CATALOGUE[0].id;
const line = (o: Record<string, unknown>) => `FORGE: ${JSON.stringify(o)}`;

describe("a reply with no plan", () => {
  it("is passed through untouched — it is just talking", () => {
    const r = parseReply("Which one did you have in mind, warm or cold?", settings());
    expect(r.plan).toBeNull();
    expect(r.say).toBe("Which one did you have in mind, warm or cold?");
    expect(r.corrections).toEqual([]);
  });

  it("keeps an app answer intact", () => {
    const answer = "Cloudflare gives about 690 pictures a day, free, with no card.";
    expect(parseReply(answer, settings()).say).toBe(answer);
  });
});

describe("a well-formed plan", () => {
  it("is accepted, and the machine line is stripped from what the user sees", () => {
    const reply = `Here is one to try.\n${line({ style: realStyle, model: "cloudflare-flux", prompt: "a warm bakery", aspect: "1:1" })}`;
    const r = parseReply(reply, settings());
    expect(r.say).toBe("Here is one to try.");
    expect(r.plan).toEqual({ style: realStyle, model: "cloudflare-flux", prompt: "a warm bakery", aspect: "1:1" });
    expect(r.corrections).toEqual([]);
  });
});

describe("things the model invents", () => {
  it("replaces a style that does not exist, and says so", () => {
    const r = parseReply(line({ style: "vaporwave-dreamcore", model: "cloudflare-flux", prompt: "x", aspect: "1:1" }), settings());
    expect(r.plan?.style).toBe(STYLE_CATALOGUE[0].id);
    expect(r.corrections.join(" ")).toMatch(/no style called "vaporwave-dreamcore"/);
  });

  it("replaces a model that does not exist, and says so", () => {
    const r = parseReply(line({ style: realStyle, model: "dall-e-9-ultra", prompt: "x", aspect: "1:1" }), settings());
    expect(r.plan?.model).not.toBe("dall-e-9-ultra");
    expect(r.corrections.join(" ")).toMatch(/no model called "dall-e-9-ultra"/);
  });

  it("replaces a shape that is not one of the four", () => {
    // 4:5 and 3:2 look plausible and are not in AspectKey.
    const r = parseReply(line({ style: realStyle, model: "cloudflare-flux", prompt: "x", aspect: "4:5" }), settings());
    expect(r.plan?.aspect).toBe("16:9");
    expect(r.corrections.join(" ")).toMatch(/not a shape the forge knows/);
  });

  it("keeps the words when it garbles the JSON, rather than guessing", () => {
    const r = parseReply('Try this.\nFORGE: {"style": "broken", ', settings());
    expect(r.plan).toBeNull();
    expect(r.say).toContain("Try this.");
  });

  it("refuses a plan with no prompt", () => {
    const r = parseReply(line({ style: realStyle, model: "cloudflare-flux", prompt: "   ", aspect: "1:1" }), settings());
    expect(r.plan).toBeNull();
    expect(r.corrections.join(" ")).toMatch(/no prompt/);
  });
});

describe("a model that exists but cannot do the job", () => {
  it("is swapped for one that can, and the swap is explained", () => {
    // A style needing readable words must not run on a model that cannot spell.
    const texty = STYLE_CATALOGUE.find((s) => s.needsText);
    if (!texty) return;
    const r = parseReply(line({ style: texty.id, model: "cloudflare-flux", prompt: "a poster reading OPEN", aspect: "1:1" }), settings());
    expect(r.plan?.model).not.toBe("cloudflare-flux");
    expect(r.corrections.join(" ")).toMatch(/cannot do the/);
  });
});

describe("filenames the chat produces", () => {
  it("obeys the rules: lowercase, underscores, category prefix, .png", () => {
    const n = filenameFor("A Warm Village Bakery at Dawn!", "item");
    expect(n).toMatch(/^item_[a-z0-9_]+\.png$/);
    expect(n).not.toMatch(/[A-Z ]/);
  });

  it("never collides with a name already in the manifest", () => {
    const first = filenameFor("a cat", "item");
    const second = filenameFor("a cat", "item", [first]);
    expect(second).not.toBe(first);
    expect(second).toMatch(/_2\.png$/);
  });

  it("still produces something usable from an unhelpful prompt", () => {
    expect(filenameFor("!!!", "npc")).toBe("npc_picture.png");
  });
});
