import { useState } from "react";
import type { Toast } from "../types";
import { ACCENTS, STYLES } from "../types";
import type { ApiKey, ForgeSettings, ProviderId } from "../lib/providers";
import { MODELS, MODEL_TRAITS, PROVIDER_META, formatCountdown, formatUsd, newKey, usedToday, scribeChat, SCRIBE_SYSTEMS } from "../lib/providers";
import { SUBFOLDERS, fsSupported } from "../lib/output";
import {
  findDuplicateKeys,
  summarisePool,
  testConnection,
  testPool,
  type TestResult,
  type TestTarget,
} from "../lib/testConnection";
import { WHY_MANUAL_DATE, creditNoteFor } from "../lib/paidGuard";
import { VISION_PRESETS, listChatModels } from "../lib/visionEngine";
import {
  STYLE_CATALOGUE,
  STYLE_GROUPS,
  availableModelsForStyle,
  defaultModelForStyle,
  stylesInGroup,
} from "../lib/styleCatalogue";
import type { FolderState } from "./SettingsDrawer";
import { BorderGlow } from "./effects";
import { Btn, IAlert, ICheck, IDownload, IFolder, IRetry, ISparkle, ITrash, IX } from "./ui";

export type SettingsSection =
  | "engines"
  | "styles"
  | "text"
  | "prompts"
  | "filenames"
  | "folders"
  | "wp"
  | "appearance"
  | "advanced";

const SECTIONS: { id: SettingsSection; label: string; hint: string }[] = [
  { id: "engines", label: "Image engines", hint: "who paints" },
  { id: "styles", label: "Image styles", hint: "the look" },
  { id: "text", label: "Text engines", hint: "who writes" },
  { id: "prompts", label: "Text prompts", hint: "how they write" },
  { id: "filenames", label: "Filenames", hint: "the rules" },
  { id: "folders", label: "Folders", hint: "where files go" },
  { id: "wp", label: "WP connections", hint: "the hand-off" },
  { id: "appearance", label: "Appearance", hint: "the vibe" },
  { id: "advanced", label: "Advanced", hint: "care & updates" },
];

const H = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-display text-2xl text-cream ${className}`}>{children}</h2>
);
const P = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[13.5px] leading-relaxed text-parch ${className}`}>{children}</p>
);
const field = "w-full rounded-lg border border-line bg-[#191310] px-3 py-2 text-[13px] text-cream placeholder:text-dust/60";

/** One "does this work?" button, with its answer underneath. */
function TestButton({
  target,
  settings,
  label = "Test it",
}: {
  target: TestTarget;
  settings: ForgeSettings;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TestResult | null>(null);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Btn
          onClick={async () => {
            setBusy(true);
            setRes(null);
            setRes(await testConnection(target, settings));
            setBusy(false);
          }}
          disabled={busy}
        >
          {busy ? "checking…" : label}
        </Btn>
        {res && (
          <span className={`text-[11.5px] ${res.ok ? "text-moss" : "text-blood"}`}>
            {res.ok ? "✓ " : "✗ "}
            {res.message}
          </span>
        )}
        {res?.ok && res.free && <span className="font-mono text-[9.5px] text-dust">cost nothing</span>}
      </div>
      {res?.detail && <p className="mt-1 text-[11px] leading-snug text-dust">{res.detail}</p>}
    </div>
  );
}

function KeyPoolEditor({
  title,
  hint,
  pool,
  onChange,
  pushToast,
  test,
  settings,
  credits,
}: {
  title: string;
  hint: string;
  pool: ApiKey[];
  onChange: (k: ApiKey[]) => void;
  pushToast: (kind: Toast["kind"], msg: string) => void;
  test?: TestTarget;
  settings?: ForgeSettings;
  /** show a credit label and end date beside each key — for paid pools */
  credits?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [poolBusy, setPoolBusy] = useState("");
  const [poolNote, setPoolNote] = useState("");
  const [poolResults, setPoolResults] = useState<{ id: string; label: string; result: TestResult }[]>([]);
  return (
    <div className="rounded-xl border border-line bg-panel/50 p-4">
      <p className="font-display text-[15px] tracking-wide text-cream">{title}</p>
      <p className="mt-1 text-[12px] text-dust">{hint}</p>
      <div className="mt-3 space-y-2">
        {pool.map((k, i) => {
          const benched = k.exhaustedUntil > Date.now();
          return (
            <div key={k.id} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${benched ? "bg-blood" : k.key.trim() ? "bg-moss" : "bg-dust/40"}`} />
              <input
                value={k.key}
                type="password"
                placeholder="paste key…"
                onChange={(e) => onChange(pool.map((x) => (x.id === k.id ? { ...x, key: e.target.value } : x)))}
                className={`${field} font-mono !text-[12px]`}
              />
              {benched ? (
                <span className="shrink-0 rounded-md border border-blood/40 bg-blood/10 px-2 py-1 font-mono text-[9.5px] whitespace-nowrap text-blood" title="click to un-bench early">
                  resting {formatCountdown(k.exhaustedUntil)}
                  <button className="ml-1.5 underline" onClick={() => onChange(pool.map((x) => (x.id === k.id ? { ...x, exhaustedUntil: 0 } : x)))}>
                    wake
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => onChange(pool.filter((x) => x.id !== k.id))}
                  disabled={pool.length === 1}
                  className="btn-press shrink-0 rounded-md p-1.5 text-dust hover:bg-blood/15 hover:text-blood disabled:opacity-30"
                >
                  <ITrash size={13} />
                </button>
              )}
              <span className="hidden font-mono text-[9.5px] text-dust sm:block">#{i + 1}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} type="password" placeholder="add another key — more keys, more daily allowance" className={`${field} font-mono !text-[12px]`} />
        <Btn
          variant="primary"
          disabled={!draft.trim()}
          onClick={() => {
            onChange([...pool, { ...newKey(`key-${pool.length + 1}`), key: draft.trim() }]);
            setDraft("");
            pushToast("ok", "Key added to the rotation pool.");
          }}
        >
          Add key
        </Btn>
      </div>
      {credits && (
        <div className="mt-3 space-y-2 rounded-lg border border-line bg-[#191310] p-3">
          <p className="font-mono text-[10px] tracking-[0.2em] text-dust uppercase">when does each credit run out?</p>
          {pool
            .filter((k) => k.key.trim())
            .map((k, i) => {
              const note = creditNoteFor(k);
              return (
                <div key={k.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-[10px] text-dust">#{i + 1}</span>
                  <input
                    value={k.creditLabel ?? ""}
                    onChange={(e) => onChange(pool.map((x) => (x.id === k.id ? { ...x, creditLabel: e.target.value } : x)))}
                    placeholder="what is this credit?"
                    className={`${field} !w-auto min-w-[9rem] flex-1 !py-1.5 !text-[12px]`}
                  />
                  <input
                    type="date"
                    value={k.creditEndsOn ?? ""}
                    onChange={(e) => onChange(pool.map((x) => (x.id === k.id ? { ...x, creditEndsOn: e.target.value } : x)))}
                    className={`${field} !w-auto !py-1.5 !text-[12px]`}
                  />
                  {note.endsOn && (
                    <span
                      className={`font-mono text-[10px] ${
                        note.expired ? "text-blood" : note.endingSoon ? "text-ember" : "text-moss"
                      }`}
                    >
                      {note.expired ? "expired" : `${note.daysLeft}d left`}
                    </span>
                  )}
                </div>
              );
            })}
          <p className="text-[11px] leading-snug text-dust">{WHY_MANUAL_DATE}</p>
        </div>
      )}
      {test && settings && (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <TestButton target={test} settings={settings} label="Check the first key" />
          {(test === "gemini-free" || test === "gemini-paid" || test === "openai") && pool.filter((k) => k.key.trim()).length > 1 && (
            <Btn
              onClick={async () => {
                setPoolBusy("checking…");
                setPoolResults([]);
                const dupes = await findDuplicateKeys(pool);
                const results = await testPool(
                  pool,
                  test === "openai" ? settings.openaiModel : settings.geminiModel,
                  test === "openai" ? "openai" : "gemini",
                  settings.openaiBase,
                  (done, total) => setPoolBusy(`checking ${done} of ${total}…`)
                );
                setPoolResults(results);
                setPoolNote(
                  summarisePool(results).message +
                    (dupes.length ? ` · the same key appears twice: ${dupes.join("; ")}` : "")
                );
                setPoolBusy("");
              }}
              disabled={Boolean(poolBusy)}
            >
              {poolBusy || `Check all ${pool.filter((k) => k.key.trim()).length} keys`}
            </Btn>
          )}
        </div>
      )}

      {poolNote && (
        <p className="mt-2 rounded-lg border border-line bg-[#191310] px-3 py-2 text-[11.5px] text-parch">{poolNote}</p>
      )}
      {poolResults.length > 0 && (
        <div className="mt-2 space-y-1">
          {poolResults.map((r, i) => (
            <div key={r.id} className="flex items-start gap-2 text-[11.5px]">
              <span className="w-10 shrink-0 font-mono text-[10px] text-dust">#{i + 1}</span>
              <span className={r.result.ok ? "text-moss" : "text-blood"}>
                {r.result.ok ? "✓" : "✗"} {r.result.message}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-dust">
        On a 429 the current key rests and the next one retries the same row immediately. A row parks only when every key is resting.
      </p>
    </div>
  );
}

/**
 * One key, three jobs.
 *
 * The forge needs three different kinds of model — one to write, one to write
 * code, one to look at pictures — and it is easy to end up with the writer
 * still pointing at a provider you have no key for. Mistral serves all three
 * from a single free key, and every model named here was confirmed present on
 * a live account on 2026-09-02, so this is not a guess at what exists.
 */
function OneKeyForAll({
  settings,
  patchSettings,
  pushToast,
}: {
  settings: ForgeSettings;
  patchSettings: (patch: Partial<ForgeSettings>) => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
}) {
  const MISTRAL = "https://api.mistral.ai/v1";
  const jobs = [
    { name: "writing", of: settings.scribe },
    { name: "code", of: settings.coder },
    { name: "vision", of: settings.vision },
  ];
  const ready = jobs.filter((j) => j.of.key.trim());
  const missing = jobs.filter((j) => !j.of.key.trim());
  // Any key already pasted into one of the three, preferring a Mistral one.
  const known =
    jobs.find((j) => j.of.key.trim() && j.of.base.includes("mistral"))?.of.key ?? jobs.find((j) => j.of.key.trim())?.of.key ?? "";

  const applyAll = () => {
    patchSettings({
      scribe: { base: MISTRAL, key: known, model: "mistral-medium-latest" },
      coder: { base: MISTRAL, key: known, model: "codestral-latest" },
      vision: { base: MISTRAL, key: known, model: "mistral-medium-latest" },
    });
    pushToast("ok", "All three text jobs now run on your Mistral key. Test each one below.");
  };

  if (missing.length === 0 && ready.every((j) => j.of.base.includes("mistral"))) {
    return (
      <div className="rounded-xl border border-moss/40 bg-moss/10 p-4">
        <p className="text-[13px] text-cream">
          <span className="font-display text-[15px]">All three set up on one key.</span> Writing, code and vision are
          all running on Mistral. Nothing else to do here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ember/40 bg-ember/10 p-4">
      <p className="font-display text-[15px] tracking-wide text-cream">One key for all three</p>
      <p className="mt-1 text-[12px] text-parch">
        The forge uses three different models: one to <span className="text-cream">write</span>, one to write{" "}
        <span className="text-cream">code</span> (for SVG and Lottie), and one that can{" "}
        <span className="text-cream">see</span> (to place lettering). Mistral serves all three from a single free key.
      </p>
      <ul className="mt-2 space-y-1 text-[12px]">
        {jobs.map((j) => (
          <li key={j.name} className={j.of.key.trim() ? "text-moss" : "text-rust"}>
            {j.of.key.trim() ? "✓" : "·"} {j.name}
            {j.of.key.trim() ? ` — ${j.of.model || "no model chosen"}` : " — no key yet"}
          </li>
        ))}
      </ul>
      {known ? (
        <>
          <Btn variant="primary" className="mt-3" onClick={applyAll}>
            Use that one key for all three
          </Btn>
          <p className="mt-2 text-[11px] text-dust">
            Sets writing and vision to <span className="font-mono text-cream">mistral-medium-latest</span> and code to{" "}
            <span className="font-mono text-cream">codestral-latest</span>. You can change any of them afterwards.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[12px] text-dust">
          Paste a Mistral key into any one of the three boxes below and this will offer to fill in the other two.{" "}
          <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer" className="text-ember underline">
            Get a free one
          </a>
          .
        </p>
      )}
    </div>
  );
}

/**
 * The vision engine — a model that can LOOK at a picture.
 *
 * Deliberately not a fixed dropdown of model names. Providers rename and retire
 * models faster than this app ships, and a stale name baked into our code turns
 * into the user's 404. So: presets fill in an address, and "Load models" asks
 * the endpoint what it really has today.
 */
function VisionEngineBox({
  settings,
  patchSettings,
}: {
  settings: ForgeSettings;
  patchSettings: (patch: Partial<ForgeSettings>) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const v = settings.vision;
  const setV = (patch: Partial<ForgeSettings["vision"]>) => patchSettings({ vision: { ...v, ...patch } });

  const preset = VISION_PRESETS.find((p) => p.base === v.base);
  const hostOf = (u: string) => {
    try {
      return new URL(u).host;
    } catch {
      return "";
    }
  };
  const sameHost = hostOf(v.base) !== "" && hostOf(v.base) === hostOf(settings.coder.base);

  const load = async () => {
    setBusy(true);
    setNote("");
    setModels([]);
    const r = await listChatModels(v);
    if (r.ok) {
      // Most endpoints serve hundreds of models, nearly all of them text-only.
      // Float the ones whose names suggest they can see, but keep the rest —
      // naming is a hint, not a guarantee, and guessing wrong would hide the
      // very model the user came for.
      const looksVisual = (m: string) => /vision|vl|pixtral|omni|multimodal|image|4o|glimmer|mistral-medium|mistral-small|magistral/i.test(m);
      const sorted = [...r.models].sort((a, b) => Number(looksVisual(b)) - Number(looksVisual(a)));
      setModels(sorted);
      const n = r.models.filter(looksVisual).length;
      setNote(`${r.models.length} models on this endpoint${n ? ` · ${n} look like they can see pictures, listed first` : ""}.`);
    } else {
      setNote(r.problem);
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-line bg-panel/50 p-4">
      <p className="font-display text-[15px] tracking-wide text-cream">
        Vision engine <span className="ml-1 font-mono text-[10px] text-dust">a model that can look at a picture</span>
      </p>
      <p className="mt-1 text-[12px] text-dust">
        Used by the <span className="text-cream">Letterer</span> to find where a caption belongs — “put it on the
        signboard” only works if something can see the signboard. Any endpoint that speaks the OpenAI chat shape will
        do, so you are not tied to one company.
      </p>
      <p className="mt-1 text-[12px] text-dust">
        Without it nothing breaks: the Letterer falls back to finding the quietest patch of the picture, free and
        instantly, and you drag the corners yourself.
      </p>

      <div className="mt-3">
        <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">start from</label>
        <div className="flex flex-wrap gap-2">
          {VISION_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setV({ base: p.base, model: p.model });
                setModels([]);
                setNote("");
              }}
              className={`rounded-lg border px-3 py-1.5 text-[12px] transition ${
                preset?.id === p.id ? "border-ember bg-ember/15 text-cream" : "border-line text-dust hover:text-cream"
              }`}
            >
              {p.label}
              {p.free && <span className="ml-1.5 font-mono text-[9.5px] text-moss">free</span>}
            </button>
          ))}
        </div>
        {preset && (
          <p className="mt-2 text-[11.5px] text-dust">
            {preset.note}
            {preset.keyUrl && (
              <>
                {" "}
                <a href={preset.keyUrl} target="_blank" rel="noreferrer" className="text-ember underline">
                  Get a key
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">address</label>
          <input value={v.base} onChange={(e) => setV({ base: e.target.value.trim() })} placeholder="https://api.mistral.ai/v1" className={field} />
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">key</label>
          <input type="password" value={v.key} onChange={(e) => setV({ key: e.target.value.trim() })} placeholder="paste your key" className={field} />
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">model</label>
          <input
            value={v.model}
            onChange={(e) => setV({ model: e.target.value.trim() })}
            placeholder="mistral-medium-latest"
            list="vision-models"
            className={field}
          />
          <datalist id="vision-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Mistral serves the code model and the vision model from one key, so there is
          no reason to make anyone paste the same string twice. */}
      {!v.key.trim() && settings.coder.key.trim() && (
        <button
          onClick={() => setV({ key: settings.coder.key })}
          className="mt-2 rounded-lg border border-moss/50 bg-moss/10 px-3 py-1.5 text-[12px] text-cream transition hover:bg-moss/20"
        >
          Use the same key as the code engine
          {sameHost && <span className="ml-1.5 font-mono text-[10px] text-moss">same provider — it will work</span>}
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn onClick={load} disabled={busy || !v.base.trim()}>
          {busy ? "asking…" : "Load models"}
        </Btn>
        <TestButton target="vision" settings={settings} label="Test the vision engine" />
      </div>
      {note && <p className="mt-2 text-[11.5px] text-dust">{note}</p>}
      {models.length > 0 && (
        <p className="mt-1 text-[11px] text-dust">
          Click the model box above to pick from the list, or keep typing to filter it.
        </p>
      )}
    </div>
  );
}

/**
 * Switch an engine off without dismantling it.
 *
 * A provider having a bad month should not cost you your key setup. Paused
 * rows fail instantly with a sentence naming the reason, which is far kinder
 * than a queue of timeouts.
 */
function PauseSwitch({
  engine,
  label,
  note,
  settings,
  patchSettings,
}: {
  engine: string;
  label: string;
  note: string;
  settings: ForgeSettings;
  patchSettings: (patch: Partial<ForgeSettings>) => void;
}) {
  const paused = settings.pausedEngines.includes(engine);
  const toggle = () =>
    patchSettings({
      pausedEngines: paused
        ? settings.pausedEngines.filter((e) => e !== engine)
        : [...settings.pausedEngines, engine],
    });

  return (
    <div className={`rounded-xl border p-4 ${paused ? "border-rust/60 bg-rust/10" : "border-line bg-panel/50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-[15px] tracking-wide text-cream">
            {label} {paused && <span className="ml-1 font-mono text-[10px] text-rust">PAUSED</span>}
          </p>
          <p className="mt-1 max-w-2xl text-[12px] text-dust">{note}</p>
        </div>
        <Btn variant={paused ? "primary" : undefined} onClick={toggle}>
          {paused ? `Switch ${label} back on` : `Pause ${label}`}
        </Btn>
      </div>
    </div>
  );
}

export default function SettingsView({
  section,
  onSection,
  settings,
  patchSettings,
  folder,
  onLinkFolder,
  onUnlinkFolder,
  onSyncAll,
  onGoStyles,
  onRepair,
  onBackup,
  onReset,
  onPullManifest,
  onCheckUpdate,
  appVersion,
  pushToast,
  styleLock,
  onLockStyle,
}: {
  section: SettingsSection;
  onSection: (s: SettingsSection) => void;
  settings: ForgeSettings;
  patchSettings: (p: Partial<ForgeSettings>) => void;
  folder: FolderState;
  onLinkFolder: () => void;
  onUnlinkFolder: () => void;
  onSyncAll: () => void;
  onGoStyles: () => void;
  onRepair: () => void;
  onBackup: () => void;
  onReset: (c: { rows: boolean; recipes: boolean; settings: boolean; market: boolean }) => void;
  onPullManifest: (mode: "merge" | "replace") => void;
  onCheckUpdate: () => void;
  appVersion: string;
  pushToast: (kind: Toast["kind"], msg: string) => void;
  /** the look every new row starts with */
  styleLock?: string;
  onLockStyle?: (id: string) => void;
}) {
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [repairBusy, setRepairBusy] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [pullMode, setPullMode] = useState<"merge" | "replace">("merge");
  const [resetChecks, setResetChecks] = useState({ rows: false, recipes: false, settings: false, market: false });
  const [confirmReset, setConfirmReset] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localBusy, setLocalBusy] = useState(false);
  const [localNote, setLocalNote] = useState("");

  const testText = async () => {
    setTestBusy(true);
    setTestResult("");
    try {
      const out = await scribeChat(settings.scribe, "Reply with exactly: the forge is lit.", "ready?");
      setTestResult(out);
      pushToast("ok", "Text engine answered — the connection works.");
    } catch (e) {
      pushToast("err", `Text engine test failed — ${(e as { message?: string })?.message ?? "unknown"}`);
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-10">
      {/* rail */}
      <nav className="hidden w-52 shrink-0 md:block">
        <p className="mb-3 font-mono text-[10px] tracking-[0.28em] text-dust uppercase">settings</p>
        <div className="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              className={`btn-press flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left ${
                section === s.id ? "bg-ember/12 text-cream" : "text-parch hover:bg-raise/50"
              }`}
            >
              <span className="text-[13px] font-semibold">{s.label}</span>
              <span className="font-mono text-[9px] text-dust">{s.hint}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1 space-y-5">
        {/* mobile rail */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-[10.5px] uppercase ${
                section === s.id ? "border-ember/60 bg-ember/10 text-ember" : "border-line text-dust"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === "engines" && (
          <>
            <div>
              <H>Image engines</H>
              <P className="mt-1">
                The default engine paints rows whose <span className="font-mono text-cream">model</span> column is empty. Rows with a model of their own always win.
              </P>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(PROVIDER_META) as ProviderId[]).map((id) => {
                const m = PROVIDER_META[id];
                const active = settings.provider === id;
                return (
                  <BorderGlow key={id} radius={14} glow={active ? "rgba(242,163,60,0.65)" : "rgba(242,163,60,0.4)"} idle={active ? "rgba(242,163,60,0.55)" : "#3e2f21"} innerClassName={active ? "bg-[#2a1e12]" : "bg-[#241b14]"}>
                    <button onClick={() => patchSettings({ provider: id })} className="btn-press w-full p-4 text-left">
                      <span className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.dot }} />
                        <span className="font-display text-[15px] tracking-wide text-cream">{m.name}</span>
                        {active && <span className="ml-auto font-mono text-[9px] tracking-widest text-ember uppercase">active</span>}
                      </span>
                      <span className="mt-2 block text-[12px] leading-relaxed text-parch">{m.note}</span>
                      <span className="mt-2 block font-mono text-[10.5px] text-ember">{m.free}</span>
                    </button>
                  </BorderGlow>
                );
              })}
            </div>
            {/* ---- your own machine ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">
                Your own machine <span className="ml-1 font-mono text-[10px] text-moss">free · unlimited · private</span>
              </p>
              <p className="mt-1 text-[12px] text-dust">
                If you run LocalAI, ComfyUI, LM Studio or an SD WebUI, point the forge at it. No key, no limit, nothing
                leaves your computer. The model name must match exactly what your server calls it.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">server address</label>
                  <input
                    value={settings.localBase}
                    onChange={(e) => patchSettings({ localBase: e.target.value.trim() })}
                    placeholder="http://localhost:8080/v1"
                    className={field}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">model</label>
                  {localModels.length > 0 ? (
                    <select
                      value={settings.localModel}
                      onChange={(e) => patchSettings({ localModel: e.target.value })}
                      className={field}
                    >
                      {!localModels.includes(settings.localModel) && (
                        <option value={settings.localModel}>{settings.localModel} (not on the server)</option>
                      )}
                      {localModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={settings.localModel}
                      onChange={(e) => patchSettings({ localModel: e.target.value.trim() })}
                      placeholder="flux.2-klein-4b"
                      className={field}
                    />
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Btn
                  onClick={async () => {
                    setLocalBusy(true);
                    setLocalNote("");
                    try {
                      const base = settings.localBase.replace(/\/+$/, "");
                      const res = await fetch(`${base}/models`, {
                        headers: settings.localKey.trim() ? { Authorization: `Bearer ${settings.localKey.trim()}` } : {},
                      });
                      if (!res.ok) throw new Error(`the server answered ${res.status}`);
                      const json = (await res.json()) as { data?: { id?: string }[] };
                      const ids = (json.data ?? []).map((d) => d.id).filter((x): x is string => Boolean(x)).sort();
                      if (!ids.length) throw new Error("the server has no models loaded");
                      setLocalModels(ids);
                      setLocalNote(`Found ${ids.length} model${ids.length > 1 ? "s" : ""}.`);
                      pushToast("ok", `Found ${ids.length} models on your machine.`);
                    } catch (e) {
                      const why = (e as { message?: string })?.message ?? "unknown";
                      setLocalNote(`Could not reach it — ${why}. Is the server running at that address?`);
                      pushToast("err", `Could not reach your local server — ${why}`);
                    } finally {
                      setLocalBusy(false);
                    }
                  }}
                  disabled={localBusy || !settings.localBase.trim()}
                >
                  {localBusy ? "Looking…" : "Find my models"}
                </Btn>
                {localNote && <span className="text-[11.5px] text-dust">{localNote}</span>}
              </div>
              <TestButton target="local" settings={settings} label="Check the connection" />
              <p className="mt-2 text-[11px] text-dust">
                Leave the key blank unless your server asks for one. Local pictures are slow — the forge waits up to
                fifteen minutes before giving up on one. A row's own <span className="font-mono text-cream">model</span>{" "}
                column still wins, so you can mix models within one batch (at the cost of a reload between them).
              </p>
            </div>

            {/* ---- Cloudflare: the free one ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">
                Cloudflare — the free option <span className="ml-1 font-mono text-[10px] text-moss">recommended</span>
              </p>
              <p className="mt-1 text-[12px] text-dust">
                About 690 pictures a day, free, resetting at midnight UTC. No card needed. Get both of these from your
                Cloudflare dashboard: the account id is in the address bar when you are logged in, and you make a token
                under My Profile → API Tokens with the “Workers AI” permission.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">account id</label>
                  <input
                    value={settings.cloudflare.accountId}
                    onChange={(e) => patchSettings({ cloudflare: { ...settings.cloudflare, accountId: e.target.value.trim() } })}
                    placeholder="a1b2c3d4e5f6…"
                    className={field}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">api token</label>
                  <input
                    type="password"
                    value={settings.cloudflare.token}
                    onChange={(e) => patchSettings({ cloudflare: { ...settings.cloudflare, token: e.target.value.trim() } })}
                    placeholder="paste your Workers AI token"
                    className={field}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">
                  quality · {settings.cloudflareSteps} steps
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={settings.cloudflareSteps}
                  onChange={(e) => patchSettings({ cloudflareSteps: Number(e.target.value) })}
                  className="h-1.5 w-full accent-[#f2a33c]"
                />
                <p className="mt-1.5 text-[11px] text-dust">
                  More steps means a better picture and fewer pictures per day, because Cloudflare charges by the step.
                  At 4 steps you get roughly 690 a day; at 8 steps roughly 380. Four is the model's intended setting.
                </p>
              </div>
              <TestButton target="cloudflare" settings={settings} label="Check the account and token" />
            </div>

            {/* ---- Pollinations: free, but needs a token now ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Pollinations token</p>
              <p className="mt-1 text-[12px] text-dust">
                Pollinations stopped serving anonymous requests — without a token every picture fails with “Missing
                Turnstile token”. A free token at <span className="font-mono text-cream">auth.pollinations.ai</span> fixes
                it and removes the watermark. Unlimited in total, but paced to one picture every few seconds.
              </p>
              <div className="mt-3">
                <input
                  type="password"
                  value={settings.pollinationsToken}
                  onChange={(e) => patchSettings({ pollinationsToken: e.target.value.trim() })}
                  placeholder="paste your free Pollinations token"
                  className={field}
                />
              </div>
              <TestButton target="pollinations" settings={settings} label="Check the token" />
            </div>

            <PauseSwitch
              engine="gemini"
              label="Google"
              settings={settings}
              patchSettings={patchSettings}
              note="Paused means rows routed to Google stop immediately with a plain message, instead of spending thirty seconds each proving the account still has no credit. Your keys and settings are kept exactly as they are."
            />

            <KeyPoolEditor
              title="Google keys — FREE accounts"
              hint="keys at aistudio.google.com/apikey · tried first, and expected to run out. Add one per project to stretch the allowance further."
              pool={settings.geminiKeys}
              onChange={(k) => patchSettings({ geminiKeys: k })}
              pushToast={pushToast}
              test="gemini-free"
              settings={settings}
            />
            <KeyPoolEditor
              title="Google keys — PAID accounts"
              hint="only reached once every free key above is resting, so a free allowance is never wasted while money is spent."
              pool={settings.geminiPaidKeys}
              onChange={(k) => patchSettings({ geminiPaidKeys: k })}
              pushToast={pushToast}
              test="gemini-paid"
              settings={settings}
              credits
            />
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">
                    default Google model
                  </label>
                  <select
                    value={settings.geminiModel}
                    onChange={(e) => patchSettings({ geminiModel: e.target.value })}
                    className={field}
                  >
                    {MODELS.filter((m) => m.engine === "gemini").map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — {formatUsd(m.priceUsd)}/image
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">picture size</label>
                  <select
                    value={settings.geminiImageSize}
                    onChange={(e) => patchSettings({ geminiImageSize: e.target.value })}
                    className={field}
                  >
                    <option value="512px">512px — cheapest</option>
                    <option value="1K">1K — the usual choice</option>
                    <option value="2K">2K — costs more</option>
                    <option value="4K">4K — costs most</option>
                  </select>
                </div>
              </div>
            </div>
            <KeyPoolEditor
              title="OpenAI-compatible key pool"
              hint="OpenAI, Together, OpenRouter, local SD WebUI — anything with /images/generations"
              pool={settings.openaiKeys}
              onChange={(k) => patchSettings({ openaiKeys: k })}
              pushToast={pushToast}
              test="openai"
              settings={settings}
            />
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">endpoint base URL</label>
                  <input value={settings.openaiBase} onChange={(e) => patchSettings({ openaiBase: e.target.value })} className={field} />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">default model id</label>
                  <input value={settings.openaiModel} onChange={(e) => patchSettings({ openaiModel: e.target.value })} className={field} />
                </div>
              </div>
            </div>
            {/* ---- what each picture costs ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">What each picture costs</p>
              <p className="mt-1 text-[12px] text-dust">
                Checked against the providers on 2 September 2026. “Batch” is Google's half price for pictures you are
                happy to wait for.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="font-mono text-[9.5px] tracking-[0.18em] text-dust uppercase">
                      <th className="py-1.5 pr-3">model</th>
                      <th className="py-1.5 pr-3">each</th>
                      <th className="py-1.5 pr-3">batch</th>
                      <th className="py-1.5">free allowance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map((m) => (
                      <tr key={m.id} className="border-t border-line/60">
                        <td className="py-1.5 pr-3">
                          <span className="block font-mono text-[11.5px] text-cream">{m.id}</span>
                          <span className="block text-[10.5px] text-dust">{m.label}</span>
                          {m.retiresOn && (
                            <span className="block font-mono text-[9.5px] text-rust">switched off {m.retiresOn}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 font-mono text-[11.5px] text-cream">{formatUsd(m.priceUsd)}</td>
                        <td className="py-1.5 pr-3 font-mono text-[11.5px] text-moss">
                          {m.batchPriceUsd === null ? "—" : formatUsd(m.batchPriceUsd)}
                        </td>
                        <td className="py-1.5 text-[11px] text-parch">{m.allowance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ---- writing inside pictures ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Writing inside pictures</p>
              <p className="mt-1 text-[12px] text-dust">
                Most models cannot spell. Ask a small model for a shop sign and you get convincing gibberish. Only
                Google's models and DALL·E write real words reliably.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-[#191310] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={settings.suppressTextOnWeakModels}
                  onChange={(e) => patchSettings({ suppressTextOnWeakModels: e.target.checked })}
                  className="h-4 w-4 accent-[#f2a33c]"
                />
                <span>
                  <span className="block text-[13px] font-semibold text-cream">
                    Tell weak models not to attempt writing
                  </span>
                  <span className="block text-[11.5px] text-dust">
                    Quietly adds “no text, letters, words, watermark” to the negatives whenever the chosen model is bad
                    at spelling. Your manifest is not changed. Models that write well are left alone.
                  </span>
                </span>
                {settings.suppressTextOnWeakModels && <ICheck size={15} className="ml-auto shrink-0 text-moss" />}
              </label>
              <div className="mt-3">
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">
                  how good is YOUR local model at writing?
                </label>
                <select
                  value={settings.localTextQuality}
                  onChange={(e) => patchSettings({ localTextQuality: e.target.value as typeof settings.localTextQuality })}
                  className={field}
                >
                  <option value="poor">Poor — it produces gibberish (FLUX klein, Z-Image, SD 1.5)</option>
                  <option value="fair">Fair — short words usually survive</option>
                  <option value="good">Good — it writes real sentences</option>
                </select>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead>
                    <tr className="font-mono text-[9.5px] tracking-[0.18em] text-dust uppercase">
                      <th className="py-1 pr-3">model</th>
                      <th className="py-1">can it write?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map((m) => {
                      const q = MODEL_TRAITS[m.id]?.textQuality ?? "fair";
                      const tone = q === "good" ? "text-moss" : q === "fair" ? "text-ember" : "text-rust";
                      return (
                        <tr key={m.id} className="border-t border-line/60">
                          <td className="py-1 pr-3 font-mono text-cream">{m.id}</td>
                          <td className={`py-1 font-mono ${tone}`}>{q}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ---- prompt tailor ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">
                Tailor prompts to the model <span className="ml-1 font-mono text-[10px] text-dust">off by default</span>
              </p>
              <p className="mt-1 text-[12px] text-dust">
                Different painters want different instructions. Google reads long flowing sentences; a small model on
                your own machine wants one short concrete line. Switch this on and your text model (Settings → Text
                engines) rewrites each prompt to suit whoever is drawing it — just before sending, never in your
                manifest. If the text model is unreachable the original prompt is used and the forge says so.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-[#191310] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={settings.tailorPrompts}
                  onChange={(e) => patchSettings({ tailorPrompts: e.target.checked })}
                  className="h-4 w-4 accent-[#f2a33c]"
                />
                <span>
                  <span className="block text-[13px] font-semibold text-cream">Rewrite each prompt for its model</span>
                  <span className="block text-[11.5px] text-dust">
                    Costs one small text request per picture. Repeated prompts are remembered, so a re-run is free.
                  </span>
                </span>
                {settings.tailorPrompts && <ICheck size={15} className="ml-auto shrink-0 text-moss" />}
              </label>
              {settings.tailorPrompts && !settings.scribe.key.trim() && (
                <p className="mt-2 rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-[11.5px] text-blood">
                  You have no text-engine key yet, so this will do nothing. Add one under Settings → Text engines.
                </p>
              )}
            </div>

            {/* ---- speed dial ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Speed — how many at once</p>
              <p className="mt-1 text-[12px] text-dust">
                1 means one picture at a time, exactly as the forge has always worked. Turning it up finishes big batches
                faster, at the cost of hitting rate limits sooner — the forge already handles that by resting the key and
                moving on, so the risk is a slower run, not lost work.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={settings.concurrency}
                  onChange={(e) => patchSettings({ concurrency: Number(e.target.value) })}
                  className="h-1.5 flex-1 accent-[#f2a33c]"
                />
                <span className="w-28 shrink-0 text-right font-mono text-[12px] text-cream">
                  {settings.concurrency === 1 ? "one at a time" : `${settings.concurrency} at once`}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Cooldowns — you choose the wait</p>
              <p className="mt-1 text-[12px] text-dust">hours a row rests after its whole key pool is rate-limited. 24h suits daily quotas; 0 retries at once.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MODELS.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-[#191310] px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[11.5px] text-cream">{m.id}</span>
                      <span className="block font-mono text-[9px] text-dust">{m.free} · used {usedToday(settings.usage, m.id)}/day</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={settings.cooldowns[m.id] ?? m.defaultCooldownH}
                      onChange={(e) => patchSettings({ cooldowns: { ...settings.cooldowns, [m.id]: Math.max(0, parseFloat(e.target.value) || 0) } })}
                      className="w-16 rounded-md border border-line bg-panel2 px-2 py-1 text-right font-mono text-[12px] text-cream"
                    />
                    <span className="font-mono text-[10px] text-dust">h</span>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel/50 px-4 py-3">
              <input
                type="checkbox"
                checked={settings.autoRetry}
                onChange={(e) => patchSettings({ autoRetry: e.target.checked })}
                className="h-4 w-4 accent-[#f2a33c]"
              />
              <span>
                <span className="block text-[13.5px] font-semibold text-cream">Automatic retry</span>
                <span className="block text-[11.5px] text-dust">
                  when a parked row's cooldown expires, the forge quietly puts it back in the queue
                </span>
              </span>
              {settings.autoRetry && <ICheck size={15} className="ml-auto text-moss" />}
            </label>
          </>
        )}

        {section === "styles" && (
          <>
            <H>Image styles</H>
            <P>Styles live in the library now — lock them, add your own languages, keep every batch consistent.</P>
            <Btn variant="primary" onClick={onGoStyles}>Open the style library →</Btn>
            <P className="mt-1">
              {STYLE_CATALOGUE.length} looks, grouped. Each one knows which models suit it and which of those you have
              set up. The <span className="text-moss">green</span> model is what it will use if you change nothing — always
              the best free option you have, except where the look needs readable words.
            </P>

            {STYLE_GROUPS.map((group) => {
              const inGroup = stylesInGroup(group.id);
              if (!inGroup.length) return null;
              return (
                <div key={group.id} className="rounded-xl border border-line bg-panel/50 p-4">
                  <p className="font-display text-[15px] tracking-wide text-cream">
                    {group.label} <span className="ml-1 font-mono text-[10px] text-dust">{group.hint}</span>
                  </p>
                  <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
                    {inGroup.map((st) => {
                      const usable = availableModelsForStyle(st, settings);
                      const pick = defaultModelForStyle(st, settings);
                      const locked = styleLock === st.id;
                      return (
                        <div
                          key={st.id}
                          className={`rounded-lg border p-3 ${locked ? "border-ember/60 bg-ember/8" : "border-line bg-[#191310]"}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex shrink-0 overflow-hidden rounded">
                              {st.swatch.map((c) => (
                                <span key={c} className="h-4 w-4" style={{ background: c }} />
                              ))}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-cream">
                                {st.name}
                                {st.needsText && (
                                  <span className="ml-1.5 font-mono text-[9px] tracking-wider text-ember uppercase">
                                    needs words
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-[11.5px] leading-snug text-dust">{st.blurb}</p>
                            </div>
                            <button
                              onClick={() => onLockStyle?.(st.id)}
                              className={`btn-press shrink-0 rounded-md px-2 py-1 font-mono text-[9.5px] tracking-wider uppercase ${
                                locked ? "bg-ember text-[#241503]" : "border border-line text-dust hover:text-cream"
                              }`}
                            >
                              {locked ? "in use" : "use"}
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {st.recommended.map((m) => {
                              const have = usable.includes(m);
                              const isPick = m === pick;
                              const label = m === "local" ? "your machine" : m;
                              return (
                                <span
                                  key={m}
                                  title={
                                    have
                                      ? isPick
                                        ? "this is what it will use"
                                        : "set up and available"
                                      : "not set up yet — add it under Image engines"
                                  }
                                  className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] ${
                                    isPick
                                      ? "bg-moss/20 text-moss"
                                      : have
                                        ? "border border-line text-parch"
                                        : "border border-line/50 text-dust/50 line-through"
                                  }`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                            {!usable.length && (
                              <span className="font-mono text-[9.5px] text-blood">no engine set up for this yet</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {section === "text" && (
          <>
            <div>
              <H>Text engines</H>
              <P className="mt-1">
                The writer behind the prompt factory, the scribe and all the clever bits. Anything that speaks{" "}
                <span className="font-mono text-cream">/chat/completions</span> works — OpenAI, OpenRouter, Together, a local LLM.
              </P>
            </div>
            <OneKeyForAll settings={settings} patchSettings={patchSettings} pushToast={pushToast} />

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">base URL</label>
                <input value={settings.scribe.base} onChange={(e) => patchSettings({ scribe: { ...settings.scribe, base: e.target.value } })} className={field} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">API key</label>
                <input type="password" value={settings.scribe.key} onChange={(e) => patchSettings({ scribe: { ...settings.scribe, key: e.target.value } })} className={field} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">model</label>
                <input value={settings.scribe.model} onChange={(e) => patchSettings({ scribe: { ...settings.scribe, model: e.target.value } })} className={field} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Btn variant="primary" onClick={testText} disabled={testBusy || !settings.scribe.key.trim()}>
                {testBusy ? "asking…" : "Test the connection"}
              </Btn>
              {testResult && <span className="font-mono text-[11.5px] text-moss">“{testResult.slice(0, 60)}”</span>}
            </div>

            {/* ---- the code engine, kept separate on purpose ---- */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">
                Code engine <span className="ml-1 font-mono text-[10px] text-dust">for SVG, icons and Lottie</span>
              </p>
              <p className="mt-1 text-[12px] text-dust">
                Vectors and animated icons are <span className="text-cream">code</span>, not pictures — an image model
                cannot make them. A model trained on code can. This is kept separate from the writer above because they
                are different jobs, and you may well want a different model, or a different account, for each.
              </p>
              <p className="mt-1 text-[12px] text-dust">
                Mistral serves both from one key: use{" "}
                <span className="font-mono text-cream">https://api.mistral.ai/v1</span> and{" "}
                <span className="font-mono text-cream">codestral-latest</span>.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">address</label>
                  <input
                    value={settings.coder.base}
                    onChange={(e) => patchSettings({ coder: { ...settings.coder, base: e.target.value.trim() } })}
                    placeholder="https://api.mistral.ai/v1"
                    className={field}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">key</label>
                  <input
                    type="password"
                    value={settings.coder.key}
                    onChange={(e) => patchSettings({ coder: { ...settings.coder, key: e.target.value.trim() } })}
                    placeholder="paste your Mistral key"
                    className={field}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">model</label>
                  <input
                    value={settings.coder.model}
                    onChange={(e) => patchSettings({ coder: { ...settings.coder, model: e.target.value.trim() } })}
                    placeholder="codestral-latest"
                    className={field}
                  />
                </div>
              </div>
              <TestButton target="coder" settings={settings} label="Test the code engine" />
              {!settings.coder.key.trim() && (
                <p className="mt-2 text-[11px] text-dust">
                  Leave this empty and vectors fall back to the writer above — it works, but a code model does it better.
                </p>
              )}
            </div>

            <VisionEngineBox settings={settings} patchSettings={patchSettings} />
          </>
        )}

        {section === "prompts" && (
          <>
            <div>
              <H>Text prompts</H>
              <P className="mt-1">
                These are the instructions the writer follows. Empty means “use the built-in”. Change them to bend the
                AI to your taste — adjust image prompts, filename forging, style picking, WordPress metadata, and the factory itself.
              </P>
            </div>
            {(
              [
                ["promptWriter", "Image prompt writer", "rewrites short notes into full prompts ending in the style block"],
                ["factory", "Prompt factory", "invents whole lists of ideas with filenames and negative prompts"],
                ["filenameForger", "Filename forger", "turns prompts into rule-perfect filenames"],
                ["stylePicker", "Style picker", "chooses the visual language for a subject"],
                ["wpMeta", "WordPress metadata", "writes title / alt / caption JSON"],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} className="rounded-xl border border-line bg-panel/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display text-[14px] tracking-wide text-cream">{label}</p>
                  {settings.metaPrompts[key] && (
                    <button onClick={() => patchSettings({ metaPrompts: { ...settings.metaPrompts, [key]: "" } })} className="btn-press font-mono text-[10px] text-dust underline hover:text-blood">
                      reset to built-in
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[11.5px] text-dust">{hint}</p>
                <textarea
                  value={settings.metaPrompts[key]}
                  onChange={(e) => patchSettings({ metaPrompts: { ...settings.metaPrompts, [key]: e.target.value } })}
                  rows={3}
                  placeholder="(built-in instructions — type here to override)"
                  className={`${field} mt-2 resize-y font-mono !text-[11.5px]`}
                />
              </div>
            ))}
          </>
        )}

        {section === "filenames" && (
          <>
            <H>Filenames</H>
            <P>The seven rules every filename must pass. The drawer checks them live and auto-fixes with one click.</P>
            <ul className="space-y-2">
              {[
                "lowercase only",
                "no spaces",
                "no special characters — only a–z, 0–9 and underscores",
                "words joined with underscores",
                "starts with its category prefix: shop_ · item_ · event_ · npc_",
                "ends with .png",
                "unique across the whole manifest",
              ].map((r, i) => (
                <li key={r} className="flex items-center gap-3 rounded-xl border border-line bg-panel/50 px-4 py-2.5 text-[13px] text-parch">
                  <span className="font-display text-[15px] text-ember">{i + 1}</span> {r}
                </li>
              ))}
            </ul>
          </>
        )}

        {section === "folders" && (
          <>
            <H>Folders</H>
            <P className="max-w-2xl">
              Link one folder and every finished picture saves itself into <span className="font-mono text-cream">{SUBFOLDERS.join(" / ")}</span>. Your
              pre-created subfolders are used as-is; missing ones are created. Point it at your Google Drive sync folder and files float to the cloud.
            </P>
            <div className={`rounded-xl border p-4 ${folder.linked ? "border-moss/50 bg-moss/8" : "border-line bg-panel/50"}`}>
              <div className="flex items-center gap-3">
                <IFolder size={20} className={folder.linked ? "text-moss" : "text-dust"} />
                <div className="flex-1">
                  <p className="font-display text-[15px] tracking-wide text-cream">{folder.linked ? folder.name : folder.pendingName ? `${folder.pendingName} (needs one click)` : "No folder linked"}</p>
                  <p className="text-[12px] text-parch">
                    {folder.linked ? "auto-save is on · the CSV refreshes after every run" : folder.pendingName ? "the browser wants you to re-confirm permission once" : "needs Chrome or Edge · the ZIP door always works"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {fsSupported() && <Btn variant="primary" onClick={onLinkFolder}>{folder.linked ? "Change" : folder.pendingName ? "Re-link" : "Link folder…"}</Btn>}
                  {folder.linked && (
                    <>
                      <Btn onClick={onSyncAll}>Sync all now</Btn>
                      <Btn variant="danger" onClick={onUnlinkFolder}>
                        <IX size={12} /> Unlink
                      </Btn>
                    </>
                  )}
                </div>
              </div>
              {folder.error && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-blood/30 bg-blood/8 px-3 py-2 text-[12px] text-blood">
                  <IAlert size={13} className="mt-0.5 shrink-0" /> {folder.error}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-parch">
              <input type="checkbox" checked={settings.writeCsvOnSync} onChange={(e) => patchSettings({ writeCsvOnSync: e.target.checked })} className="accent-[#f2a33c]" />
              refresh marketplace-images.csv inside the folder after each run
            </label>
          </>
        )}

        {section === "wp" && (
          <>
            <div>
              <H>WP connections</H>
              <P className="mt-1">
                The forge can upload finished plates straight into a WordPress Media Library using an{" "}
                <span className="font-mono text-cream">application password</span> (Users → Profile → Application Passwords in WP admin). Imagify
                then optimizes whatever lands there, and attachment IDs are written back into the manifest.
              </P>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">site URL</label>
                <input value={settings.wp.url} onChange={(e) => patchSettings({ wp: { ...settings.wp, url: e.target.value } })} placeholder="https://example.com" className={field} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">username</label>
                <input value={settings.wp.user} onChange={(e) => patchSettings({ wp: { ...settings.wp, user: e.target.value } })} className={field} />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">application password</label>
                <input type="password" value={settings.wp.appPassword} onChange={(e) => patchSettings({ wp: { ...settings.wp, appPassword: e.target.value } })} placeholder="xxxx xxxx xxxx xxxx" className={field} />
              </div>
            </div>
            <p className="text-[12px] text-dust">
              CORS note: many hosts allow browser requests to <span className="font-mono">/wp-json/wp/v2/media</span>; if yours doesn't, the Agents &amp; API page in Docs has the n8n-friendly recipe.
            </p>
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">what an upload writes back</p>
              <p className="mt-1.5 font-mono text-[11.5px] text-parch">
                status → <span className="text-lagoon">imported</span> · imported_attachment_id → <span className="text-lagoon">{"{the id WordPress returns}"}</span>
              </p>
            </div>
          </>
        )}

        {section === "appearance" && (
          <>
            <H>Appearance</H>
            <P>The forge's weather. Everything here updates live — pick what feels good, turn off what doesn't.</P>

            <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">main color</p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const active = settings.ambient.accent === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => patchSettings({ ambient: { ...settings.ambient, accent: a.id } })}
                    className={`btn-press flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${active ? "border-line2 bg-raise" : "border-line bg-panel/50 hover:border-line2"}`}
                  >
                    <span className="h-6 w-6 rounded-full border border-black/30" style={{ background: a.hex, boxShadow: active ? `0 0 14px ${a.hex}88` : "none" }} />
                    <span className="text-left">
                      <span className={`block text-[12.5px] font-semibold ${active ? "text-cream" : "text-parch"}`}>{a.name}</span>
                      <span className="block font-mono text-[9.5px] text-dust">{a.hex}</span>
                    </span>
                    {active && <ICheck size={13} className="text-moss" />}
                  </button>
                );
              })}
            </div>
            <P>The main color paints the run button, highlights, card glows and the cursor light. Status colors stay fixed so done/failed always read the same.</P>

            <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">background</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: "none", name: "Quiet", hint: "plain dark canvas" },
                  { id: "dots", name: "Dot field", hint: "dots that part around your cursor" },
                  { id: "embers", name: "Rising embers", hint: "sparks drifting up from the forge" },
                  { id: "stars", name: "Night sky", hint: "twinkling stars, the odd shooting star" },
                ] as { id: ForgeSettings["ambient"]["background"]; name: string; hint: string }[]
              ).map((b) => (
                <button
                  key={b.id}
                  onClick={() => patchSettings({ ambient: { ...settings.ambient, background: b.id } })}
                  className={`btn-press rounded-xl border px-3.5 py-3 text-left ${settings.ambient.background === b.id ? "border-ember/60 bg-ember/8" : "border-line bg-panel/50 hover:border-line2"}`}
                >
                  <span className={`block text-[13px] font-semibold ${settings.ambient.background === b.id ? "text-ember" : "text-cream"}`}>{b.name}</span>
                  <span className="block text-[10.5px] text-dust">{b.hint}</span>
                </button>
              ))}
            </div>
            {settings.ambient.background !== "none" && (
              <div className="rounded-xl border border-line bg-panel/40 p-4">
                <label className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-dust uppercase">
                  density
                  <span className="text-cream">{settings.ambient.density}</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={140}
                  value={settings.ambient.density}
                  onChange={(e) => patchSettings({ ambient: { ...settings.ambient, density: Number(e.target.value) } })}
                  className="mt-2 w-full accent-[var(--color-ember)]"
                />
                {settings.ambient.background === "dots" && (
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-parch">
                      <input type="checkbox" checked={settings.ambient.wave} onChange={(e) => patchSettings({ ambient: { ...settings.ambient, wave: e.target.checked } })} className="accent-[var(--color-ember)]" />
                      gentle wave
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-parch">
                      <input type="checkbox" checked={settings.ambient.sparkle} onChange={(e) => patchSettings({ ambient: { ...settings.ambient, sparkle: e.target.checked } })} className="accent-[var(--color-ember)]" />
                      sparkling dots
                    </label>
                  </div>
                )}
              </div>
            )}

            <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">card glow</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "off", name: "Off", hint: "plain hairline borders" },
                  { id: "accent", name: "Accent glow", hint: "borders light up in the main color where you hover" },
                  { id: "prismatic", name: "Prismatic", hint: "the glow slowly cycles through every hue" },
                ] as { id: ForgeSettings["ambient"]["glow"]; name: string; hint: string }[]
              ).map((g) => (
                <button
                  key={g.id}
                  onClick={() => patchSettings({ ambient: { ...settings.ambient, glow: g.id } })}
                  className={`btn-press rounded-xl border px-3.5 py-3 text-left ${settings.ambient.glow === g.id ? "border-ember/60 bg-ember/8" : "border-line bg-panel/50 hover:border-line2"}`}
                >
                  <span className={`block text-[13px] font-semibold ${settings.ambient.glow === g.id ? "text-ember" : "text-cream"}`}>{g.name}</span>
                  <span className="block text-[10.5px] text-dust">{g.hint}</span>
                </button>
              ))}
            </div>

            <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">cursor</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "none", name: "Plain", hint: "the usual pointer, nothing extra" },
                  { id: "lantern", name: "Lantern", hint: "a soft light follows your cursor with a lazy sway" },
                  { id: "sparks", name: "Sparkle trail", hint: "tiny sparks drip off the cursor as you move" },
                ] as { id: ForgeSettings["ambient"]["cursor"]; name: string; hint: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  onClick={() => patchSettings({ ambient: { ...settings.ambient, cursor: c.id } })}
                  className={`btn-press rounded-xl border px-3.5 py-3 text-left ${settings.ambient.cursor === c.id ? "border-ember/60 bg-ember/8" : "border-line bg-panel/50 hover:border-line2"}`}
                >
                  <span className={`block text-[13px] font-semibold ${settings.ambient.cursor === c.id ? "text-ember" : "text-cream"}`}>{c.name}</span>
                  <span className="block text-[10.5px] text-dust">{c.hint}</span>
                </button>
              ))}
            </div>
            {settings.ambient.cursor !== "none" && (
              <div className="rounded-xl border border-line bg-panel/40 p-4">
                <label className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-dust uppercase">
                  {settings.ambient.cursor === "lantern" ? "lantern size" : "sparkle spread"}
                  <span className="text-cream">{settings.ambient.cursorSize}px</span>
                </label>
                <input
                  type="range"
                  min={120}
                  max={420}
                  step={20}
                  value={settings.ambient.cursorSize}
                  onChange={(e) => patchSettings({ ambient: { ...settings.ambient, cursorSize: Number(e.target.value) } })}
                  className="mt-2 w-full accent-[var(--color-ember)]"
                />
              </div>
            )}
            <P>All animation honors your system's “reduce motion” setting automatically.</P>
          </>
        )}

        {section === "advanced" && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <H>Advanced</H>
                <P className="mt-1">Care, recovery and updates for the forge itself.</P>
              </div>
              <span className="shrink-0 rounded-lg border border-line bg-panel/60 px-3 py-1.5 font-mono text-[11px] text-parch">
                v{appVersion}
              </span>
            </div>

            {/* repair */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Repair</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dust">
                If the forge is acting strange, this fixes the usual suspects in one pass: rows stuck mid-strike go back
                to <span className="font-mono text-parch">pending</span>, duplicate filenames get a suffix, the
                shops/items/events/npcs structure in your linked folder is re-created, and a fresh CSV is written there.
              </p>
              <Btn
                variant="primary"
                className="mt-3"
                disabled={repairBusy}
                onClick={async () => {
                  setRepairBusy(true);
                  try {
                    await onRepair();
                  } finally {
                    setRepairBusy(false);
                  }
                }}
              >
                <IRetry size={13} /> {repairBusy ? "Repairing…" : "Run repair"}
              </Btn>
            </div>

            {/* update from github */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Sync &amp; update from GitHub</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dust">
                Point the forge at its repository. Then you can pull the manifest straight from the repo (great when an
                agent or a teammate edits the CSV there), and check whether a newer installer has been published.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[9.5px] tracking-[0.2em] text-dust uppercase">repo owner</label>
                  <input value={settings.github.owner} onChange={(e) => patchSettings({ github: { ...settings.github, owner: e.target.value } })} placeholder="your-github-name" className={`${field} font-mono !text-[12px]`} />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[9.5px] tracking-[0.2em] text-dust uppercase">repo name</label>
                  <input value={settings.github.repo} onChange={(e) => patchSettings({ github: { ...settings.github, repo: e.target.value } })} placeholder="image-forge" className={`${field} font-mono !text-[12px]`} />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[9.5px] tracking-[0.2em] text-dust uppercase">branch</label>
                  <input value={settings.github.branch} onChange={(e) => patchSettings({ github: { ...settings.github, branch: e.target.value } })} placeholder="main" className={`${field} font-mono !text-[12px]`} />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[9.5px] tracking-[0.2em] text-dust uppercase">manifest path in repo</label>
                  <input value={settings.github.csvPath} onChange={(e) => patchSettings({ github: { ...settings.github, csvPath: e.target.value } })} placeholder="marketplace-images.csv" className={`${field} font-mono !text-[12px]`} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-lg border border-line">
                  {(["merge", "replace"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPullMode(m)}
                      className={`btn-press px-3 py-2 font-mono text-[10.5px] uppercase ${pullMode === m ? "bg-ember/15 text-ember" : "text-dust hover:text-cream"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <Btn
                  onClick={async () => {
                    setPullBusy(true);
                    try {
                      await onPullManifest(pullMode);
                    } finally {
                      setPullBusy(false);
                    }
                  }}
                  disabled={pullBusy}
                >
                  <IDownload size={13} /> {pullBusy ? "Pulling…" : "Pull manifest"}
                </Btn>
                <Btn
                  variant="moss"
                  onClick={async () => {
                    setUpdateBusy(true);
                    try {
                      await onCheckUpdate();
                    } finally {
                      setUpdateBusy(false);
                    }
                  }}
                  disabled={updateBusy}
                >
                  <ISparkle size={13} /> {updateBusy ? "Checking…" : "Check for app update"}
                </Btn>
              </div>
              <p className="mt-2 text-[11px] text-dust">
                Pull reads <span className="font-mono text-parch">raw.githubusercontent.com</span> — the repo must be public (or use a gist).
                The update check reads the repo's latest release and downloads its <span className="font-mono text-parch">Setup.exe</span> if it's newer.
              </p>
            </div>

            {/* reset */}
            <div className="rounded-xl border border-blood/25 bg-blood/4 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Reset — start from a clean slate</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dust">
                Wipes local app data <em>only</em> — images already written to your folders on disk are never touched.
                Tick exactly what should go, then confirm twice.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { key: "rows", label: "Manifest & generated previews", desc: "every row, status, cooldown and note" },
                    { key: "recipes", label: "Recipes & previous batches", desc: "saved wizard setups and batch history" },
                    { key: "settings", label: "Settings, styles & API keys", desc: "engines, keys, cooldowns, appearance" },
                    { key: "market", label: "Marketplace progress", desc: "Emberfair purse, satchel, standing" },
                  ] as const
                ).map((o) => (
                  <label key={o.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-[#191310] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={resetChecks[o.key]}
                      onChange={(e) => {
                        setResetChecks((c) => ({ ...c, [o.key]: e.target.checked }));
                        setConfirmReset(false);
                      }}
                      className="mt-0.5 accent-[#e2593f]"
                    />
                    <span>
                      <span className="block text-[12.5px] font-semibold text-parch">{o.label}</span>
                      <span className="block text-[10.5px] text-dust">{o.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Btn onClick={onBackup}>
                  <IDownload size={13} /> Download backup first
                </Btn>
                <Btn
                  variant="danger"
                  disabled={!resetChecks.rows && !resetChecks.recipes && !resetChecks.settings && !resetChecks.market}
                  onClick={() => {
                    if (!confirmReset) {
                      setConfirmReset(true);
                      pushToast("info", "One more click to really erase — this cannot be undone.");
                      return;
                    }
                    onReset(resetChecks);
                  }}
                >
                  <ITrash size={13} /> {confirmReset ? "Click again — erase for real" : "Reset the checked things"}
                </Btn>
              </div>
            </div>

            {/* uninstall */}
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-display text-[15px] tracking-wide text-cream">Uninstall the desktop app</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-dust">
                The installer registered a proper Windows uninstaller. Use the Start Menu entry or Windows Settings —
                on the way out it asks whether to also remove your forge data from{" "}
                <span className="font-mono text-parch">%APPDATA%\Image Forge</span>. Say no if you plan to reinstall;
                your data survives either way until you opt in.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href="ms-settings:appsfeatures"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-press inline-flex items-center gap-2 rounded-lg border border-line bg-panel2/70 px-3.5 py-2 text-[13px] font-semibold text-cream hover:border-line2"
                >
                  <IFolder size={14} /> Open Windows “Installed apps”
                </a>
                <span className="font-mono text-[10.5px] text-dust">…then find “Image Forge” → Uninstall</span>
              </div>
              <p className="mt-2.5 text-[11px] text-dust">
                Prefer to keep the app but lose the data? The reset above does exactly that without uninstalling anything.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
