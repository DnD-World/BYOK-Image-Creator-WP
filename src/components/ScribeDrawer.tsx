import { useState } from "react";
import type { ManifestRow, Toast } from "../types";
import { STYLES } from "../types";
import type { ForgeSettings } from "../lib/providers";
import { SCRIBE_SYSTEMS, scribeChat } from "../lib/providers";
import { autoFixFilename, validateFilename } from "../lib/validate";
import { Btn, CopyBtn, ICheck, IQuill, IX } from "./ui";

type Action = "prompt" | "filename" | "style" | "wp";

const ACTIONS: { id: Action; label: string; hint: string }[] = [
  { id: "prompt", label: "Write prompt", hint: "short note → full image prompt" },
  { id: "filename", label: "Forge filename", hint: "rule-perfect, auto-verified" },
  { id: "style", label: "Suggest style", hint: "best visual language" },
  { id: "wp", label: "WP metadata", hint: "title / alt / caption JSON" },
];

export default function ScribeDrawer({
  row,
  settings,
  styleLock,
  onClose,
  onPatch,
  pushToast,
}: {
  row: ManifestRow;
  settings: ForgeSettings;
  styleLock: string;
  onClose: () => void;
  onPatch: (patch: Partial<ManifestRow>) => void;
  pushToast: (kind: Toast["kind"], msg: string) => void;
}) {
  const [action, setAction] = useState<Action>("prompt");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const allStyles = [...STYLES, ...settings.customStyles];
  const styleDef = allStyles.find((s) => s.id === row.style) ?? STYLES[0];
  const hasKey = settings.scribe.key.trim().length > 0;
  const mp = settings.metaPrompts;

  const run = async () => {
    setBusy(true);
    setError("");
    setResult("");
    const userMsg =
      action === "prompt"
        ? `Short description: ${brief || row.filename.replace(/_/g, " ").replace(".png", "")}\nCurrent prompt (context): ${row.prompt}`
        : action === "filename"
          ? `Prompt: ${row.prompt || brief}\nCategory: ${row.category}`
          : action === "style"
            ? `Subject: ${row.prompt || brief || row.filename}\nAvailable styles: ${allStyles.map((s) => s.id).join(", ")}`
            : `filename: ${row.filename}\nprompt: ${row.prompt}`;
    const system =
      action === "prompt"
        ? SCRIBE_SYSTEMS.promptWriter(styleDef.block, row.category, mp.promptWriter)
        : action === "filename"
          ? SCRIBE_SYSTEMS.filenameForger(row.category, mp.filenameForger)
          : action === "style"
            ? SCRIBE_SYSTEMS.styleSuggester(mp.stylePicker)
            : SCRIBE_SYSTEMS.wpMetadata(mp.wpMeta);
    try {
      setResult(await scribeChat(settings.scribe, system, userMsg));
    } catch (e) {
      setError((e as { message?: string })?.message ?? "the scribe stayed silent");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result.trim()) return;
    if (action === "prompt") {
      onPatch({ prompt: result.trim() });
      pushToast("ok", "Prompt rewritten by the scribe.");
    } else if (action === "filename") {
      const raw = result.trim().split(/\s+/)[0].replace(/[`"']/g, "");
      const fixed = autoFixFilename(raw, row.category);
      onPatch({ filename: fixed });
      pushToast("ok", fixed === raw ? "Filename forged." : `Forged & auto-fixed → ${fixed}`);
    } else if (action === "style") {
      const id = result.trim().split(/\s+/)[0].toLowerCase();
      if (allStyles.some((s) => s.id === id)) {
        onPatch({ style: id });
        pushToast("ok", `Style set to ${id}.`);
      } else {
        pushToast("err", `“${id}” isn't in the style library — nothing changed.`);
      }
    } else {
      pushToast("info", "WP metadata ready — copy it for your importer.");
    }
  };

  const checks =
    action === "filename" && result
      ? validateFilename(autoFixFilename(result.trim().split(/\s+/)[0], row.category), row.category, [], -1).filter((c) => c.id !== "unique")
      : [];

  return (
    <aside className="slide-in-right fixed right-0 top-0 z-40 flex h-full w-[390px] flex-col border-l border-line bg-coal/95 p-4 shadow-[-24px_0_60px_rgba(0,0,0,0.5)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-[15px] tracking-wide text-parch">
          <IQuill size={16} className="text-potion" /> The scribe · <span className="text-cream">{row.filename}</span>
        </h3>
        <button onClick={onClose} className="btn-press rounded-lg p-1.5 text-dust hover:bg-raise hover:text-cream">
          <IX size={14} />
        </button>
      </div>

      {!hasKey && (
        <div className="mb-3 rounded-xl border border-potion/35 bg-potion/8 p-3">
          <p className="text-[12px] leading-relaxed text-parch">
            The scribe needs a text-engine key — set base URL, key and model in{" "}
            <span className="font-semibold text-cream">Settings → Text engines</span>. Anything that speaks{" "}
            <span className="font-mono text-parch">/chat/completions</span> works.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              setAction(a.id);
              setResult("");
              setError("");
            }}
            className={`btn-press rounded-xl border px-3 py-2.5 text-left ${
              action === a.id ? "border-potion/60 bg-potion/10" : "border-line bg-panel/50 hover:border-line2"
            }`}
          >
            <span className={`block text-[12.5px] font-semibold ${action === a.id ? "text-potion" : "text-cream"}`}>{a.label}</span>
            <span className="block text-[10.5px] text-dust">{a.hint}</span>
          </button>
        ))}
      </div>

      {action === "prompt" && (
        <div className="mt-3">
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">describe it in a few words</label>
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. a flooded potion cellar"
            className="w-full rounded-lg border border-line bg-[#191310] px-3 py-2.5 text-[13px] text-cream placeholder:text-dust/60"
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Btn variant="primary" className="flex-1 justify-center" onClick={run} disabled={busy || !hasKey}>
          {busy ? "writing…" : "Ask the scribe"}
        </Btn>
      </div>

      {error && <p className="mt-3 rounded-lg border border-blood/35 bg-blood/8 px-3 py-2 text-[12px] text-blood">{error}</p>}

      {result && (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <div className="rounded-xl border border-potion/35 bg-[#1c1420] p-3.5">
            <pre className="font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-cream">{result}</pre>
          </div>
          {checks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {checks.map((c) => (
                <span key={c.id} className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] ${c.pass ? "border-moss/35 text-moss" : "border-blood/40 text-blood"}`}>
                  {c.pass ? <ICheck size={9} /> : <IX size={9} />} {c.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Btn variant="moss" onClick={apply}>
              <ICheck size={12} /> Apply to row
            </Btn>
            <CopyBtn text={result} />
          </div>
        </div>
      )}

      <p className="mt-auto pt-3 font-mono text-[10px] leading-relaxed text-dust/70">
        instructions editable in Settings → Text prompts · style block “{styleLock}” appended by rule
      </p>
    </aside>
  );
}
