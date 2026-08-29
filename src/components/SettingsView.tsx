import { useState } from "react";
import type { Toast } from "../types";
import { STYLES } from "../types";
import type { ApiKey, ForgeSettings, ProviderId } from "../lib/providers";
import { MODELS, PROVIDER_META, formatCountdown, newKey, usedToday, scribeChat, SCRIBE_SYSTEMS } from "../lib/providers";
import { SUBFOLDERS, fsSupported } from "../lib/output";
import type { FolderState } from "./SettingsDrawer";
import { BorderGlow } from "./effects";
import { Btn, IAlert, ICheck, IFolder, ITrash, IX } from "./ui";

export type SettingsSection = "engines" | "styles" | "text" | "prompts" | "filenames" | "folders" | "wp" | "appearance";

const SECTIONS: { id: SettingsSection; label: string; hint: string }[] = [
  { id: "engines", label: "Image engines", hint: "who paints" },
  { id: "styles", label: "Image styles", hint: "the look" },
  { id: "text", label: "Text engines", hint: "who writes" },
  { id: "prompts", label: "Text prompts", hint: "how they write" },
  { id: "filenames", label: "Filenames", hint: "the rules" },
  { id: "folders", label: "Folders", hint: "where files go" },
  { id: "wp", label: "WP connections", hint: "the hand-off" },
  { id: "appearance", label: "Appearance", hint: "the vibe" },
];

const H = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-display text-2xl text-cream ${className}`}>{children}</h2>
);
const P = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[13.5px] leading-relaxed text-parch ${className}`}>{children}</p>
);
const field = "w-full rounded-lg border border-line bg-[#191310] px-3 py-2 text-[13px] text-cream placeholder:text-dust/60";

function KeyPoolEditor({
  title,
  hint,
  pool,
  onChange,
  pushToast,
}: {
  title: string;
  hint: string;
  pool: ApiKey[];
  onChange: (k: ApiKey[]) => void;
  pushToast: (kind: Toast["kind"], msg: string) => void;
}) {
  const [draft, setDraft] = useState("");
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
      <p className="mt-2 text-[11px] text-dust">
        On a 429 the current key rests and the next one retries the same row immediately. A row parks only when every key is resting.
      </p>
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
  pushToast,
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
  pushToast: (kind: Toast["kind"], msg: string) => void;
}) {
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState("");

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
            <KeyPoolEditor
              title="Gemini key pool (Google Imagen)"
              hint="free keys at aistudio.google.com/apikey · ≈ 25 images/day per model per key"
              pool={settings.geminiKeys}
              onChange={(k) => patchSettings({ geminiKeys: k })}
              pushToast={pushToast}
            />
            <KeyPoolEditor
              title="OpenAI-compatible key pool"
              hint="OpenAI, Together, OpenRouter, local SD WebUI — anything with /images/generations"
              pool={settings.openaiKeys}
              onChange={(k) => patchSettings({ openaiKeys: k })}
              pushToast={pushToast}
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
          </>
        )}

        {section === "styles" && (
          <>
            <H>Image styles</H>
            <P>Styles live in the library now — lock them, add your own languages, keep every batch consistent.</P>
            <Btn variant="primary" onClick={onGoStyles}>Open the style library →</Btn>
            <div className="rounded-xl border border-line bg-panel/50 p-4">
              <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">quick look</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <span key={s.id} className="flex items-center gap-2 rounded-lg border border-line bg-[#191310] px-2.5 py-1.5">
                    <span className="flex overflow-hidden rounded">
                      {s.swatch.map((c) => (
                        <span key={c} className="h-3.5 w-3.5" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="font-mono text-[11px] text-parch">{s.name}</span>
                  </span>
                ))}
              </div>
            </div>
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
            <P>The forge's weather. Turn things off if you like it quieter.</P>
            <div className="space-y-2.5">
              {(
                [
                  ["dots", "Dot field background", "the grid of dots that parts around your cursor"],
                  ["glow", "Lantern glows", "the slow warm lights drifting behind panels"],
                  ["sparkle", "Sparkling embers", "~3% of the dots twinkle like stray sparks"],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-line bg-panel/50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={settings.ambient[key]}
                    onChange={(e) => patchSettings({ ambient: { ...settings.ambient, [key]: e.target.checked } })}
                    className="h-4 w-4 accent-[#f2a33c]"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-cream">{label}</span>
                    <span className="block text-[11.5px] text-dust">{hint}</span>
                  </span>
                  {settings.ambient[key] && <ICheck size={15} className="ml-auto text-moss" />}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
