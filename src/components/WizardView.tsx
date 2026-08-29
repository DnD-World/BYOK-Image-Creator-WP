import { useMemo, useState } from "react";
import type { Category } from "../types";
import { ASPECTS, STYLES } from "../types";
import type { ForgeSettings } from "../lib/providers";
import { MODELS, newKey } from "../lib/providers";
import type { BatchSetup, FactoryItem, SavedSetup } from "../lib/batches";
import { DEFAULT_SETUP, generateIdeas, ideaCategories } from "../lib/batches";
import { fsSupported } from "../lib/output";
import PromptFactory from "./PromptFactory";
import { BorderGlow } from "./effects";
import { Btn, ICheck, IChevron, IFolder, IPlay, IQuill, ISparkle, IWand, IX } from "./ui";
import type { FolderState } from "./SettingsDrawer";

interface StepDef {
  id: string;
  title: string;
  plain: string;
}

const STEPS: StepDef[] = [
  { id: "start", title: "Fresh or saved?", plain: "Every batch starts with one question: brand new, or build on something you already set up?" },
  { id: "name", title: "Name the batch", plain: "A short name helps you find this batch later. Like a label on a box of drawings." },
  { id: "style", title: "Pick the look", plain: "One look for every picture in this batch — so they all feel like they belong together." },
  { id: "model", title: "Pick the painter", plain: "Who draws the pictures? Some painters are free forever, some need a key. If a painter needs a key, you add it right here." },
  { id: "sizes", title: "Picture shape", plain: "Wide shapes suit shop fronts and street scenes. Square shapes suit item icons." },
  { id: "ideas", title: "What pictures?", plain: "The biggest step. Let the AI write a big list of picture ideas, paste your own list, or upload a CSV file." },
  { id: "avoid", title: "What to avoid?", plain: "Optional. Tell the painter what must NOT appear — like “no text, no watermarks”. Applies to every picture unless one says otherwise." },
  { id: "output", title: "Where do they go?", plain: "Pick a folder on your computer and every finished picture saves itself there, sorted into sub-folders." },
  { id: "go", title: "Ready!", plain: "One last look, then the forge takes over. You can also save this setup as a recipe for next time." },
];

const MODEL_GROUPS: { label: string; ids: string[]; hint: string }[] = [
  { label: "Free · no key needed", ids: ["flux", "turbo"], hint: "real AI pictures, unlimited fair use, can be slower" },
  { label: "Google Imagen · free daily allowance", ids: ["imagen-4-ultra", "imagen-4", "imagen-4-fast", "gemini-flash-image"], hint: "≈ 25 pictures per day per model, per key" },
  { label: "OpenAI-compatible", ids: ["dall-e-3", "gpt-image-1"], hint: "OpenAI or any endpoint that speaks its language" },
  { label: "Offline", ids: ["forge"], hint: "practice run — the forge paints placeholder plates, no internet" },
];

export default function WizardView({
  preset,
  setups,
  settings,
  patchSettings,
  folder,
  onLinkFolder,
  onFinish,
  onExit,
  pushToast,
}: {
  preset: SavedSetup | null;
  setups: SavedSetup[];
  settings: ForgeSettings;
  patchSettings: (p: Partial<ForgeSettings>) => void;
  folder: FolderState;
  onLinkFolder: () => void;
  onFinish: (setup: BatchSetup, items: FactoryItem[], saveTemplateAs: string | null) => void;
  onExit: () => void;
  pushToast: (kind: "ok" | "err" | "info", msg: string) => void;
}) {
  const [step, setStep] = useState(preset ? 1 : 0);
  const [setup, setSetup] = useState<BatchSetup>(
    preset ? { ...preset.data, name: preset.data.name ? `${preset.data.name} (copy)` : "" } : { ...DEFAULT_SETUP, name: `Batch ${new Date().toLocaleDateString("en-GB")}` }
  );
  const [items, setItems] = useState<FactoryItem[]>([]);
  const [recipeName, setRecipeName] = useState("");

  const patch = (p: Partial<BatchSetup>) => setSetup((s) => ({ ...s, ...p }));
  const allStyles = useMemo(
    () => [
      ...STYLES,
      ...settings.customStyles.map((c) => ({ ...c, swatch: ["#f4e8d4", "#97876d", "#57432c"] as [string, string, string] })),
    ],
    [settings.customStyles]
  );
  const styleDef = allStyles.find((s) => s.id === setup.styleId) ?? allStyles[0];

  const geminiHealthy = settings.geminiKeys.some((k) => k.key.trim() && k.exhaustedUntil <= Date.now());
  const openaiHealthy = settings.openaiKeys.some((k) => k.key.trim() && k.exhaustedUntil <= Date.now());
  const modelReady = (id: string) => {
    if (id === "flux" || id === "turbo" || id === "forge") return true;
    if (id.startsWith("imagen") || id.startsWith("gemini")) return geminiHealthy;
    return openaiHealthy;
  };

  const needsKeyInline = (id: string): "geminiKeys" | "openaiKeys" | null => {
    if (id.startsWith("imagen") || id.startsWith("gemini")) return geminiHealthy ? null : "geminiKeys";
    if (id === "dall-e-3" || id === "gpt-image-1") return openaiHealthy ? null : "openaiKeys";
    return null;
  };

  const [keyDraft, setKeyDraft] = useState("");
  const keyPool = needsKeyInline(setup.model);
  const saveKey = () => {
    if (!keyDraft.trim()) return;
    if (keyPool === "geminiKeys") patchSettings({ geminiKeys: [...settings.geminiKeys.filter((k) => k.key.trim()), { ...newKey(`key-${settings.geminiKeys.length + 1}`), key: keyDraft.trim() }] });
    else patchSettings({ openaiKeys: [...settings.openaiKeys.filter((k) => k.key.trim()), { ...newKey(`key-${settings.openaiKeys.length + 1}`), key: keyDraft.trim() }] });
    setKeyDraft("");
    pushToast("ok", "Key saved — you can add more any time in Settings → Image engines. The forge swaps to the next one automatically on a rate limit.");
  };

  const canNext = () => {
    switch (STEPS[step].id) {
      case "start": return false;
      case "name": return setup.name.trim().length > 0;
      case "style": return true;
      case "model": return setup.model.length > 0;
      case "sizes": return true;
      case "ideas": return items.some((i) => i.filename.trim() && i.prompt.trim());
      case "avoid": return true;
      case "output": return true;
      default: return true;
    }
  };

  const finish = () => {
    const clean = items.filter((i) => i.filename.trim() && i.prompt.trim());
    onFinish({ ...setup, name: setup.name.trim() }, clean, recipeName.trim() || null);
  };

  const stepDef = STEPS[step];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* progress rail */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">batch wizard</p>
          <button onClick={onExit} className="btn-press flex items-center gap-1.5 font-mono text-[10.5px] text-dust hover:text-cream">
            <IX size={11} /> leave the wizard
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => i <= step && setStep(i)}
              title={s.title}
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                i < step ? "bg-moss" : i === step ? "bg-ember pulse-dot" : "bg-line"
              } ${i <= step ? "cursor-pointer" : "cursor-default"}`}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] tracking-widest text-dust uppercase">
          step {step + 1} of {STEPS.length} · {stepDef.title}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* the one decision */}
        <section key={step} className="rise-in">
          <h2 className="font-display text-3xl text-cream">{stepDef.title}</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-parch">{stepDef.plain}</p>

          <div className="mt-6">
            {stepDef.id === "start" && (
              <div className="space-y-3">
                <BorderGlow radius={14} glow="rgba(242,163,60,0.55)" idle="#3e2f21" innerClassName="bg-[#241b14]" className="cursor-pointer" >
                  <button onClick={() => setStep(1)} className="btn-press flex w-full items-center gap-4 p-5 text-left">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ember/40 bg-ember/10 text-ember">
                      <IWand size={20} />
                    </span>
                    <span>
                      <span className="block font-display text-[17px] tracking-wide text-cream">Start a fresh batch</span>
                      <span className="mt-0.5 block text-[12.5px] text-parch">answer six quick questions, get a whole batch of picture ideas</span>
                    </span>
                  </button>
                </BorderGlow>
                {setups.length > 0 && (
                  <>
                    <p className="pt-2 font-mono text-[10px] tracking-[0.22em] text-dust uppercase">or start from a saved recipe</p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {setups.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSetup({ ...t.data });
                            pushToast("info", `Recipe “${t.name}” loaded — you can still change anything.`);
                            setStep(1);
                          }}
                          className="btn-press rounded-xl border border-line bg-panel/60 p-4 text-left transition hover:border-ember/50"
                        >
                          <span className="block font-display text-[14px] tracking-wide text-cream">{t.name}</span>
                          <span className="mt-1 block font-mono text-[10.5px] text-dust">
                            {t.data.styleId} · {t.data.model || "default painter"} · saved {new Date(t.createdAt).toLocaleDateString("en-GB")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {stepDef.id === "name" && (
              <input
                autoFocus
                value={setup.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Summer market drop"
                className="w-full max-w-lg rounded-xl border border-line bg-[#191310] px-4 py-3.5 font-display text-xl tracking-wide text-cream placeholder:font-body placeholder:text-[14px] placeholder:text-dust/60"
              />
            )}

            {stepDef.id === "style" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {allStyles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => patch({ styleId: s.id })}
                    className={`btn-press rounded-xl border p-4 text-left transition ${
                      setup.styleId === s.id ? "border-ember/60 bg-ember/8" : "border-line bg-panel/50 hover:border-line2"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex overflow-hidden rounded-md border border-line">
                        {s.swatch.map((c) => (
                          <span key={c} className="h-5 w-5" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="font-display text-[14px] tracking-wide text-cream">{s.name}</span>
                      {setup.styleId === s.id && <ICheck size={14} className="ml-auto text-ember" />}
                    </span>
                    <span className="mt-2 block font-mono text-[10.5px] leading-relaxed text-dust">{s.block}</span>
                  </button>
                ))}
              </div>
            )}

            {stepDef.id === "model" && (
              <div className="space-y-5">
                {MODEL_GROUPS.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 font-mono text-[10px] tracking-[0.22em] text-dust uppercase">{g.label}</p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {g.ids.map((id) => {
                        const def = MODELS.find((m) => m.id === id);
                        const ready = modelReady(id);
                        const selected = setup.model === id;
                        return (
                          <button
                            key={id}
                            onClick={() => patch({ model: id })}
                            className={`btn-press rounded-xl border p-3.5 text-left transition ${
                              selected ? "border-ember/60 bg-ember/8" : ready ? "border-line bg-panel/50 hover:border-line2" : "border-line bg-panel/30 opacity-70"
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span className="font-mono text-[13px] text-cream">{id}</span>
                              {selected && <ICheck size={13} className="text-ember" />}
                            </span>
                            <span className="mt-1 block text-[11px] text-dust">{def?.free ?? "offline rehearsal"}</span>
                            {!ready && <span className="mt-1 block font-mono text-[10px] text-ember">needs a key — add it below after choosing</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {keyPool && (
                  <div className="rise-in max-w-xl rounded-xl border border-ember/40 bg-ember/6 p-4">
                    <p className="font-display text-[14px] tracking-wide text-cream">
                      Add your {keyPool === "geminiKeys" ? "Gemini" : "endpoint"} key (URL and model are already set — one box to fill)
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-parch">
                      {keyPool === "geminiKeys" ? (
                        <>Free at <span className="font-mono text-ember">aistudio.google.com/apikey</span>. Add as many keys as you like — each brings its own daily allowance and the forge rotates between them automatically.</>
                      ) : (
                        <>Any key for your <span className="font-mono text-ember">{settings.openaiBase}</span> endpoint.</>
                      )}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={keyDraft}
                        onChange={(e) => setKeyDraft(e.target.value)}
                        type="password"
                        placeholder={keyPool === "geminiKeys" ? "AIza…" : "sk-…"}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-[#191310] px-3 py-2 font-mono text-[12.5px] text-cream"
                      />
                      <Btn variant="primary" onClick={saveKey} disabled={!keyDraft.trim()}>
                        <ICheck size={12} /> Save key
                      </Btn>
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-dust">keys never leave this browser except to call the image engine</p>
                  </div>
                )}
              </div>
            )}

            {stepDef.id === "sizes" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["per-category", "Match each picture", "shops & events wide, items square, portraits 4:3 — the forge decides per picture"],
                  ["16:9", "All wide", "like a shop front or a street scene"],
                  ["1:1", "All square", "like item icons or portraits"],
                  ["4:3", "All 4:3", "a classic photograph shape"],
                ] as const).map(([val, title, sub]) => (
                  <button
                    key={val}
                    onClick={() => patch({ aspect: val })}
                    className={`btn-press rounded-xl border p-4 text-left transition ${
                      setup.aspect === val ? "border-ember/60 bg-ember/8" : "border-line bg-panel/50 hover:border-line2"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {val === "per-category" ? (
                        <span className="flex gap-1">
                          <span className="h-4 w-7 rounded-sm border border-ember/60 bg-ember/15" />
                          <span className="h-4 w-4 rounded-sm border border-ember/60 bg-ember/15" />
                        </span>
                      ) : (
                        <span
                          className="rounded-sm border border-ember/60 bg-ember/15"
                          style={{ width: val === "16:9" ? 30 : val === "1:1" ? 17 : 24, height: val === "16:9" ? 17 : val === "1:1" ? 17 : 18 }}
                        />
                      )}
                      <span>
                        <span className="block font-display text-[14px] tracking-wide text-cream">{title}</span>
                        <span className="block text-[11.5px] text-dust">{sub}</span>
                      </span>
                      {setup.aspect === val && <ICheck size={14} className="ml-auto text-ember" />}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {stepDef.id === "ideas" && (
              <PromptFactory
                settings={settings}
                styleId={setup.styleId}
                styleBlock={styleDef.block}
                compact
                items={items}
                setItems={setItems}
                pushToast={pushToast}
              />
            )}

            {stepDef.id === "avoid" && (
              <div className="max-w-xl space-y-3">
                <textarea
                  value={setup.defaultNegative}
                  onChange={(e) => patch({ defaultNegative: e.target.value })}
                  rows={3}
                  placeholder="text, watermark, logo, extra fingers, modern objects, blurry…"
                  className="w-full rounded-xl border border-line bg-[#191310] px-4 py-3 text-[13.5px] text-cream placeholder:text-dust/60"
                />
                <p className="text-[12px] leading-relaxed text-dust">
                  Leave empty if nothing bothers you. Individual pictures can override this later in their row drawer.
                </p>
              </div>
            )}

            {stepDef.id === "output" && (
              <div className="max-w-xl space-y-4">
                <div className={`rounded-xl border p-4 ${folder.linked ? "border-moss/50 bg-moss/8" : "border-line bg-panel/50"}`}>
                  <div className="flex items-center gap-3">
                    <IFolder size={18} className={folder.linked ? "text-moss" : "text-dust"} />
                    <div className="flex-1">
                      <p className="font-display text-[14px] tracking-wide text-cream">
                        {folder.linked ? `Saving into “${folder.name}”` : "No folder linked yet"}
                      </p>
                      <p className="text-[12px] text-parch">
                        {folder.linked
                          ? "finished pictures appear in shops/ items/ events/ npcs/ automatically — your pre-made folders are used as-is"
                          : "pick any folder; the forge creates shops/ items/ events/ npcs/ inside it (needs Chrome or Edge)"}
                      </p>
                    </div>
                    {fsSupported() && (
                      <Btn onClick={onLinkFolder}>{folder.linked ? "Change" : "Pick folder…"}</Btn>
                    )}
                  </div>
                  {folder.error && <p className="mt-2 text-[11.5px] text-blood">{folder.error}</p>}
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-parch">
                  <input type="checkbox" checked={setup.linkFolder} onChange={(e) => patch({ linkFolder: e.target.checked })} className="accent-[#f2a33c]" />
                  Ask me to link a folder if none is linked when I finish
                </label>
                <p className="text-[12px] leading-relaxed text-dust">
                  No folder? No problem — you can always download everything as a ZIP from the top bar later.
                </p>
              </div>
            )}

            {stepDef.id === "go" && (
              <div className="max-w-xl space-y-4">
                <div className="rounded-xl border border-line bg-panel/50 p-4">
                  <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">your batch, in one breath</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-parch">
                    <span className="font-semibold text-cream">{items.filter((i) => i.filename.trim()).length} pictures</span> for{" "}
                    <span className="font-semibold text-cream">“{setup.name}”</span>, painted in{" "}
                    <span className="font-semibold text-ember">{styleDef.name}</span> by{" "}
                    <span className="font-mono text-potion">{setup.model}</span>,{" "}
                    {setup.aspect === "per-category" ? "each shape matched to its kind" : `all ${setup.aspect}`}.
                    {folder.linked ? ` Files land in “${folder.name}”.` : " You'll download files as a ZIP."}
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">
                    save this setup as a recipe? (optional)
                  </label>
                  <input
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="e.g. Marketplace standard"
                    className="w-full rounded-lg border border-line bg-[#191310] px-3 py-2.5 text-[13px] text-cream placeholder:text-dust/60"
                  />
                  <p className="mt-1.5 text-[11.5px] text-dust">next batch, the wizard offers it as a starting point on step one.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-parch">
                  <input type="checkbox" checked={setup.runAfter} onChange={(e) => patch({ runAfter: e.target.checked })} className="accent-[#f2a33c]" />
                  start painting as soon as I finish (you can still halt at any time)
                </label>
              </div>
            )}
          </div>

          {/* nav */}
          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <Btn onClick={() => setStep(step - 1)}>
                <IChevron size={13} className="rotate-90" /> Back
              </Btn>
            )}
            {step < STEPS.length - 1 ? (
              <Btn variant="primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>
                Next · {STEPS[step + 1].title}
              </Btn>
            ) : (
              <Btn variant="primary" onClick={finish}>
                <IPlay size={13} /> Arrange {items.filter((i) => i.filename.trim()).length} pictures
              </Btn>
            )}
            {!canNext() && step > 0 && (
              <span className="font-mono text-[10.5px] text-dust">
                {STEPS[step].id === "name" ? "a name, even a silly one" : STEPS[step].id === "model" ? "pick a painter" : "add at least one picture idea"}
              </span>
            )}
          </div>
        </section>

        {/* summary rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-3 rounded-2xl border border-line bg-panel/60 p-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">so far…</p>
            {[
              ["name", setup.name || "—"],
              ["look", styleDef.name],
              ["painter", setup.model || "—"],
              ["shape", setup.aspect === "per-category" ? "matched per picture" : setup.aspect],
              ["pictures", `${items.filter((i) => i.filename.trim()).length} ideas`],
              ["avoid", setup.defaultNegative.trim() ? setup.defaultNegative.trim().slice(0, 40) + "…" : "nothing"],
              ["folder", folder.linked ? folder.name : setup.linkFolder ? "will ask" : "ZIP later"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/50 pb-2 text-[12px] last:border-0">
                <span className="font-mono text-[10px] tracking-widest text-dust uppercase">{k}</span>
                <span className="truncate text-right text-parch">{v}</span>
              </div>
            ))}
            <p className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed text-dust">
              <ISparkle size={12} className="mt-0.5 shrink-0 text-ember" />
              One choice per step. Nothing here is permanent — every answer can be changed later, per batch and even per picture.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
