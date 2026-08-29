import { useRef, useState } from "react";
import type { Category, Toast } from "../types";
import { CATEGORIES, STYLES } from "../types";
import type { ForgeSettings } from "../lib/providers";
import { SCRIBE_SYSTEMS, scribeChat } from "../lib/providers";
import type { FactoryItem } from "../lib/batches";
import { generateIdeas } from "../lib/batches";
import { autoFixFilename } from "../lib/validate";
import { parseCsv } from "../lib/csv";
import { Btn, CatChip, ICheck, IQuill, ISparkle, ITrash, IUpload, IX } from "./ui";

type Mode = "ai" | "paste" | "csv";

export default function PromptFactory({
  settings,
  styleId,
  styleBlock,
  pushToast,
  items,
  setItems,
  compact = false,
  onAdd,
}: {
  settings: ForgeSettings;
  styleId: string;
  styleBlock?: string;
  pushToast: (kind: Toast["kind"], msg: string) => void;
  items: FactoryItem[];
  setItems: (i: FactoryItem[]) => void;
  compact?: boolean;
  onAdd?: (items: FactoryItem[]) => void;
}) {
  const [mode, setMode] = useState<Mode>("ai");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(12);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const block = styleBlock ?? STYLES.find((s) => s.id === styleId)?.block ?? STYLES[0].block;
  const hasKey = settings.scribe.key.trim().length > 0;

  const patchItem = (i: number, p: Partial<FactoryItem>) =>
    setItems(items.map((x, xi) => (xi === i ? { ...x, ...p } : x)));

  const genAI = async () => {
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const out = await scribeChat(
        settings.scribe,
        SCRIBE_SYSTEMS.factory(block, settings.metaPrompts.factory),
        `Theme: ${topic || "a medieval fantasy marketplace"}\nCount: ${count}`,
        abortRef.current.signal
      );
      const start = out.indexOf("{");
      if (start < 0) throw new Error("the text engine answered without a list");
      const parsed = JSON.parse(out.slice(start)) as {
        rows?: { prompt?: string; filename?: string; negative_prompt?: string; category?: string }[];
      };
      const rows = (parsed.rows ?? []).filter((r) => r.prompt && r.filename);
      if (rows.length === 0) throw new Error("the list came back empty");
      setItems(
        rows.map((r) => ({
          filename: r.filename!,
          prompt: r.prompt!,
          negative_prompt: r.negative_prompt,
          category: (CATEGORIES as string[]).includes(r.category ?? "") ? (r.category as Category) : undefined,
        }))
      );
      pushToast("ok", `The writer invented ${rows.length} picture ideas.`);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      const msg = (e as { message?: string })?.message ?? "generation failed";
      if (msg.includes("no text-engine key")) {
        setItems(generateIdeas(topic, count));
        pushToast("info", "No text-engine key yet — used the offline idea generator instead. Add a key in Settings → Text engines for real AI lists.");
      } else {
        pushToast("err", `Could not write the list — ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const genOffline = () => {
    setItems(generateIdeas(topic, count));
    pushToast("ok", `${count} ideas sketched offline — edit any of them below.`);
  };

  const parsePaste = () => {
    const lines = paste
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const out: FactoryItem[] = lines.map((l) => {
      const parts = l.split("|").map((s) => s.trim());
      const [a, b, c] = parts;
      const hasName = /\.(png|jpg|webp)$/i.test(a);
      return hasName
        ? { filename: a, prompt: b || a, negative_prompt: c || undefined }
        : { filename: "", prompt: a, negative_prompt: b || undefined };
    });
    setItems(out);
    pushToast("ok", `${out.length} lines read — filenames are auto-forged when you arrange the batch.`);
  };

  const parseCsvFile = async (text: string) => {
    const { headers, records } = parseCsv(text);
    if (!headers.includes("filename") && !headers.includes("prompt")) {
      pushToast("err", "That CSV needs at least a filename or prompt column.");
      return;
    }
    const col = (h: string) => headers.indexOf(h);
    const get = (rec: string[], h: string) => {
      const i = col(h);
      return i >= 0 && i < rec.length ? rec[i].trim() : "";
    };
    const out: FactoryItem[] = records.map((rec) => ({
      filename: get(rec, "filename") || get(rec, "name"),
      prompt: get(rec, "prompt"),
      negative_prompt: get(rec, "negative_prompt") || get(rec, "negative") || undefined,
      category: (CATEGORIES as string[]).includes(get(rec, "category")) ? (get(rec, "category") as Category) : undefined,
    }));
    setItems(out);
    pushToast("ok", `${out.length} rows read from the CSV.`);
  };

  return (
    <div className={compact ? "" : "mx-auto w-full max-w-4xl px-6 py-10"}>
      {!compact && (
        <header className="mb-8">
          <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">huge lists, zero typing</p>
          <h2 className="mt-2 font-display text-3xl text-cream">The prompt factory</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-parch">
            Tell the AI what your batch is about and it writes every filename, prompt and negative prompt for you. Or
            paste your own list, or upload a CSV with <span className="font-mono text-cream">filename, model, prompt, negative_prompt</span> columns.
          </p>
        </header>
      )}

      {/* mode tabs */}
      <div className="mb-5 flex gap-1.5">
        {(
          [
            ["ai", "Write it with AI", <IQuill key="a" size={12} />],
            ["paste", "Paste a list", <ISparkle key="b" size={12} />],
            ["csv", "Upload a CSV", <IUpload key="c" size={12} />],
          ] as const
        ).map(([m, label, icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`btn-press flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] tracking-wide uppercase ${
              mode === m ? "border-ember/60 bg-ember/10 text-ember" : "border-line bg-panel2/50 text-dust hover:text-parch"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === "ai" && (
        <div className="rounded-xl border border-line bg-panel/50 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto]">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this batch about? e.g. a harbor town market"
              className="rounded-lg border border-line bg-[#191310] px-3 py-2.5 text-[13.5px] text-cream placeholder:text-dust/60"
            />
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))}
              className="rounded-lg border border-line bg-[#191310] px-3 py-2.5 text-[13.5px] text-cream"
              title="how many ideas"
            />
            <div className="flex gap-2">
              <Btn variant="primary" onClick={genAI} disabled={busy}>
                {busy ? "writing…" : hasKey ? "Write the list" : "Try it"}
              </Btn>
              {busy && (
                <Btn variant="danger" onClick={() => abortRef.current?.abort()}>
                  <IX size={12} />
                </Btn>
              )}
            </div>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-dust">
            {hasKey ? (
              <>
                Uses your text engine (<span className="font-mono text-parch">{settings.scribe.model}</span>) and the factory instructions from Settings → Text prompts.
              </>
            ) : (
              <>
                No text-engine key yet — <button onClick={genOffline} className="font-mono text-ember underline decoration-ember/40 underline-offset-2">use the offline idea generator</button>{" "}
                instead, or add a key in Settings → Text engines for fully AI-written prompts.
              </>
            )}
          </p>
        </div>
      )}

      {mode === "paste" && (
        <div className="rounded-xl border border-line bg-panel/50 p-4">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            placeholder={"one idea per line — with pipes for full control:\nshop_harbor_fishmonger.png | fish stall stacked with silver trout at dusk | text, watermark\na crooked wizard tower shop\nitem_brass_lantern.png | lantern with moths circling the flame"}
            className="w-full resize-y rounded-lg border border-line bg-[#191310] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-cream placeholder:text-dust/50"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-dust">
              <span className="font-mono text-parch">filename | prompt | negative</span> per line — filename and negative are optional
            </p>
            <Btn variant="primary" onClick={parsePaste} disabled={!paste.trim()}>
              <ICheck size={12} /> Read the list
            </Btn>
          </div>
        </div>
      )}

      {mode === "csv" && (
        <div className="rounded-xl border border-dashed border-line2 bg-panel/40 p-6 text-center">
          <IUpload size={22} className="mx-auto text-dust" />
          <p className="mt-2 text-[13px] text-parch">
            Columns the factory understands: <span className="font-mono text-cream">filename, prompt, negative_prompt, category, model</span>
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Btn onClick={() => fileRef.current?.click()}>
              <IUpload size={13} /> Choose .csv
            </Btn>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await parseCsvFile(await f.text());
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* results grid */}
      {items.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">
              {items.length} idea{items.length > 1 ? "s" : ""} — edit anything before arranging
            </p>
            <div className="flex gap-2">
              <Btn variant="subtle" onClick={() => setItems([])}>
                <ITrash size={12} /> clear
              </Btn>
              {!compact && onAdd && (
                <Btn
                  variant="primary"
                  onClick={() => onAdd(items.filter((i) => i.filename.trim() || i.prompt.trim()))}
                  disabled={!items.some((i) => (i.filename.trim() || i.prompt.trim()))}
                >
                  <ICheck size={12} /> Arrange {items.filter((i) => i.filename.trim() || i.prompt.trim()).length} on the workbench
                </Btn>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-[#191310] font-mono text-[9.5px] tracking-[0.18em] text-dust uppercase">
                  <th className="px-3 py-2 font-medium">filename</th>
                  <th className="w-24 px-3 py-2 font-medium">kind</th>
                  <th className="px-3 py-2 font-medium">prompt</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">negative</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-line/50 last:border-0 hover:bg-raise/30">
                    <td className="px-3 py-2">
                      <input
                        value={it.filename}
                        onBlur={(e) => {
                          const cat = it.category ?? "item";
                          const fixed = e.target.value.trim() ? autoFixFilename(e.target.value, cat) : it.filename;
                          if (fixed !== e.target.value) patchItem(i, { filename: fixed });
                        }}
                        onChange={(e) => patchItem(i, { filename: e.target.value })}
                        placeholder="item_thing.png"
                        className="w-full min-w-[140px] bg-transparent font-mono text-[11.5px] text-cream placeholder:text-dust/50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.category ?? "item"}
                        onChange={(e) => {
                          const cat = e.target.value as Category;
                          patchItem(i, {
                            category: cat,
                            filename: it.filename ? autoFixFilename(it.filename, cat) : it.filename,
                          });
                        }}
                        className="rounded-md border border-line bg-[#191310] px-1.5 py-1 font-mono text-[10.5px] text-parch"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={it.prompt}
                        onChange={(e) => patchItem(i, { prompt: e.target.value })}
                        className="w-full min-w-[200px] bg-transparent text-[12px] text-parch"
                      />
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      <input
                        value={it.negative_prompt ?? ""}
                        onChange={(e) => patchItem(i, { negative_prompt: e.target.value || undefined })}
                        placeholder="text, watermark…"
                        className="w-full min-w-[120px] bg-transparent font-mono text-[10.5px] text-dust placeholder:text-dust/40"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => setItems(items.filter((_, xi) => xi !== i))}
                        className="btn-press rounded-md p-1 text-dust hover:bg-blood/15 hover:text-blood"
                      >
                        <ITrash size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 font-mono text-[10px] text-dust">
            filenames straighten themselves on blur · <CatChip category="item" /> decides the output subfolder
          </p>
        </div>
      )}
    </div>
  );
}
