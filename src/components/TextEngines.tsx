/**
 * Where the writing, code and vision models are set up.
 *
 * What this replaces: three boxes, the first styled unlike the other two, each
 * asking for its own address, key and model. Nothing showed which keys you
 * actually had, the same Mistral key had to be typed three times, and a banner
 * announced "all three set up on one key" whether or not that was true.
 *
 * The shape now matches how people think about it:
 *
 *   · one card at the top for the accounts — address and key, with presets for
 *     the ones worth knowing, a button to check the key and a button to fetch
 *     that account's model list
 *   · three identical cards below, one per job, each choosing from the models
 *     those accounts returned
 *
 * Each job is tested for the job it does. A model that answers is not
 * necessarily a model that can write code or look at a picture, and finding
 * that out later — in a broken vector, or lettering placed at random — is a
 * much worse way to learn it.
 */
import { useCallback, useState } from "react";
import type { ForgeSettings } from "../lib/providers";
import { listChatModels } from "../lib/visionEngine";
import { testCode, testConnection, testVision, type TestResult } from "../lib/testConnection";
import { Btn, IAlert, ICheck, IFlask, IQuill, ISparkle, ITrash } from "./ui";

type Provider = ForgeSettings["textProviders"][number];
type JobId = "scribe" | "coder" | "vision";

/** Accounts worth offering by name, so nobody has to look up a URL. */
const PRESETS: { label: string; base: string; note: string; free: boolean; keyUrl: string }[] = [
  { label: "Mistral", base: "https://api.mistral.ai/v1", note: "free tier, and it can do all three jobs", free: true, keyUrl: "https://console.mistral.ai/api-keys" },
  { label: "OpenAI", base: "https://api.openai.com/v1", note: "paid", free: false, keyUrl: "https://platform.openai.com/api-keys" },
  { label: "OpenRouter", base: "https://openrouter.ai/api/v1", note: "one key, hundreds of models", free: false, keyUrl: "https://openrouter.ai/keys" },
  { label: "Google", base: "https://generativelanguage.googleapis.com/v1beta/openai", note: "Gemini and Gemma, via the OpenAI-shaped endpoint", free: false, keyUrl: "https://aistudio.google.com/apikey" },
  { label: "NVIDIA", base: "https://integrate.api.nvidia.com/v1", note: "free credits to start", free: false, keyUrl: "https://build.nvidia.com/" },
  { label: "Your own machine", base: "http://localhost:8080/v1", note: "free, private, no internet", free: true, keyUrl: "" },
];

const JOBS: { id: JobId; title: string; what: string; icon: React.ReactNode; testLabel: string }[] = [
  { id: "scribe", title: "Writing", what: "Writes prompts, answers in the chat, names things.", icon: <IQuill size={15} />, testLabel: "Can it hold a conversation?" },
  { id: "coder", title: "Code", what: "Writes SVG and Lottie. Vectors are code, not pictures.", icon: <IFlask size={15} />, testLabel: "Can it write code?" },
  { id: "vision", title: "Vision", what: "Looks at a picture, to place lettering on it.", icon: <ISparkle size={15} />, testLabel: "Can it see a picture?" },
];

const field = "w-full rounded-lg border border-line bg-[var(--color-field)] px-3 py-2 text-[13px] text-cream placeholder:text-dust/60";

export default function TextEngines({
  settings,
  patchSettings,
}: {
  settings: ForgeSettings;
  patchSettings: (p: Partial<ForgeSettings>) => void;
}) {
  /** Models each account returned, keyed by provider id. Not persisted. */
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const providers = settings.textProviders;
  const setProviders = (next: Provider[]) => patchSettings({ textProviders: next });

  const addProvider = (preset?: (typeof PRESETS)[number]) =>
    setProviders([
      ...providers,
      {
        id: `p${Date.now().toString(36)}`,
        label: preset?.label ?? "New account",
        base: preset?.base ?? "",
        key: "",
      },
    ]);

  const patchProvider = (id: string, patch: Partial<Provider>) =>
    setProviders(providers.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const loadModels = useCallback(
    async (p: Provider) => {
      setBusy(p.id);
      setNotes((n) => ({ ...n, [p.id]: "" }));
      const r = await listChatModels({ base: p.base, key: p.key, model: "" });
      if (r.ok) {
        setModels((m) => ({ ...m, [p.id]: r.models }));
        setNotes((n) => ({ ...n, [p.id]: `${r.models.length} models on this account.` }));
      } else {
        setNotes((n) => ({ ...n, [p.id]: r.problem }));
      }
      setBusy(null);
    },
    []
  );

  /** Every model from every account, labelled with where it came from. */
  const allModels = providers.flatMap((p) =>
    (models[p.id] ?? []).map((m) => ({ providerId: p.id, providerLabel: p.label, model: m }))
  );

  const runTest = useCallback(
    async (job: JobId) => {
      setBusy(job);
      const engine = settings[job];
      const result =
        job === "vision" ? await testVision(engine) : job === "coder" ? await testCode(engine) : await testConnection("scribe", settings);
      setResults((r) => ({ ...r, [job]: result }));
      setBusy(null);
    },
    [settings]
  );

  return (
    <>
      {/* ---------- the accounts ---------- */}
      <div className="rounded-xl border border-line bg-panel/50 p-4">
        <p className="font-display text-[15px] tracking-wide text-cream">Your accounts</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-dust">
          The addresses and keys the three jobs below draw from. Enter an account once here, load its models, and every
          job can choose from them. One Mistral key can cover all three.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => addProvider(preset)}
              title={`${preset.note}${preset.keyUrl ? ` · key: ${preset.keyUrl}` : ""}`}
              className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-dust transition hover:border-ember/50 hover:text-cream"
            >
              + {preset.label}
              {preset.free && <span className="ml-1.5 font-mono text-[9.5px] text-moss">free</span>}
            </button>
          ))}
          <button
            onClick={() => addProvider()}
            className="rounded-lg border border-dashed border-line px-2.5 py-1 text-[12px] text-dust transition hover:text-cream"
          >
            + something else
          </button>
        </div>

        {providers.length === 0 && (
          <p className="mt-3 rounded-lg border border-ember/40 bg-ember/10 p-3 text-[12.5px] text-parch">
            Nothing set up yet. <span className="text-cream">Mistral</span> is the quickest start — it is free and one
            key covers writing, code and vision.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border border-line bg-[var(--color-field)] p-3">
              <div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr]">
                <input
                  value={p.label}
                  onChange={(e) => patchProvider(p.id, { label: e.target.value })}
                  placeholder="a name for it"
                  className={field}
                />
                <input
                  value={p.base}
                  onChange={(e) => patchProvider(p.id, { base: e.target.value.trim() })}
                  placeholder="https://api.example.com/v1"
                  className={field}
                />
                <input
                  type="password"
                  value={p.key}
                  onChange={(e) => patchProvider(p.id, { key: e.target.value.trim() })}
                  placeholder="paste the key"
                  className={field}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Btn onClick={() => void loadModels(p)} disabled={busy === p.id || !p.base.trim()}>
                  {busy === p.id ? "asking…" : "Load its models"}
                </Btn>
                <button
                  onClick={() => setProviders(providers.filter((x) => x.id !== p.id))}
                  title="Remove this account"
                  className="rounded-lg p-1.5 text-dust transition hover:text-rust"
                >
                  <ITrash size={13} />
                </button>
                {models[p.id] && (
                  <span className="font-mono text-[10.5px] text-moss">{models[p.id].length} models loaded</span>
                )}
                {notes[p.id] && !models[p.id] && <span className="text-[11.5px] text-rust">{notes[p.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- the three jobs ---------- */}
      {JOBS.map((job) => {
        const engine = settings[job.id];
        const chosen = allModels.find((m) => m.model === engine.model);
        const result = results[job.id];
        return (
          <div key={job.id} className="rounded-xl border border-line bg-panel/50 p-4">
            <p className="flex items-center gap-2 font-display text-[15px] tracking-wide text-cream">
              <span className="text-dust">{job.icon}</span>
              {job.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-dust">{job.what}</p>

            <div className="mt-3">
              <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">model</label>
              <select
                value={engine.model}
                onChange={(e) => {
                  const picked = allModels.find((m) => m.model === e.target.value);
                  const from = providers.find((p) => p.id === picked?.providerId);
                  // Take the account's address and key with the model, so the
                  // engine still works if that account is later removed.
                  patchSettings({
                    [job.id]: from
                      ? { base: from.base, key: from.key, model: e.target.value }
                      : { ...engine, model: e.target.value },
                  } as Partial<ForgeSettings>);
                  setResults((r) => ({ ...r, [job.id]: undefined as unknown as TestResult }));
                }}
                className={field}
              >
                {engine.model && !chosen && <option value={engine.model}>{engine.model} (already set)</option>}
                {allModels.length === 0 && <option value="">load an account's models above first</option>}
                {providers.map((p) =>
                  (models[p.id] ?? []).length > 0 ? (
                    <optgroup key={p.id} label={p.label}>
                      {(models[p.id] ?? []).map((m) => (
                        <option key={`${p.id}:${m}`} value={m}>
                          {m}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                )}
              </select>
              {engine.key.trim() ? (
                <p className="mt-1.5 font-mono text-[10.5px] text-dust">
                  using {chosen?.providerLabel ?? engine.base.replace(/^https?:\/\//, "")}
                </p>
              ) : (
                <p className="mt-1.5 text-[11.5px] text-ember">no key yet — pick a model from an account above</p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn onClick={() => void runTest(job.id)} disabled={busy === job.id || !engine.key.trim()}>
                {busy === job.id ? "trying…" : job.testLabel}
              </Btn>
              {result && (
                <span className={`flex items-center gap-1.5 text-[12px] ${result.ok ? "text-moss" : "text-rust"}`}>
                  {result.ok ? <ICheck size={13} /> : <IAlert size={13} />}
                  {result.message}
                </span>
              )}
            </div>
            {result?.detail && <p className="mt-1.5 text-[11.5px] leading-relaxed text-dust">{result.detail}</p>}
          </div>
        );
      })}
    </>
  );
}
