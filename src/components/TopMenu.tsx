import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ForgeSettings, ProviderId } from "../lib/providers";
import { MODELS, PROVIDER_META, formatCountdown } from "../lib/providers";
import { Btn, IChevron, IFlask, IFolder, IGear, IImage, IPlay, IQuill, IRetry, ISparkle, IUpload, IWand, IBook, IX } from "./ui";

export type View =
  | "workbench"
  | "wizard"
  | "factory"
  | "lib-images"
  | "lib-styles"
  | "lib-templates"
  | "lib-batches"
  | "settings"
  | "docs"
  | "agents";

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

function Dropdown({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`btn-press flex items-center gap-1 rounded-lg px-3 py-2 font-display text-[13px] tracking-wide transition-colors ${
          active || open ? "text-cream" : "text-dust hover:text-parch"
        }`}
      >
        {label}
        <IChevron size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pop-in absolute left-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-line2 bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const Item = ({
  onClick,
  icon,
  title,
  hint,
  badge,
}: {
  onClick: () => void;
  icon: ReactNode;
  title: string;
  hint?: string;
  badge?: string;
}) => (
  <button
    onClick={onClick}
    className="btn-press flex w-full items-center gap-3 border-b border-line/50 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-raise/60"
  >
    <span className="text-ember">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-semibold text-cream">{title}</span>
      {hint && <span className="block truncate text-[10.5px] text-dust">{hint}</span>}
    </span>
    {badge && <span className="rounded-md border border-ember/40 bg-ember/10 px-1.5 py-0.5 font-mono text-[9.5px] text-ember">{badge}</span>}
  </button>
);

function ModelSelector({
  provider,
  onProvider,
  settings,
}: {
  provider: ProviderId;
  onProvider: (p: ProviderId) => void;
  settings: ForgeSettings;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const geminiHealthy = settings.geminiKeys.filter((k) => k.key.trim() && k.exhaustedUntil <= Date.now()).length;
  const openaiHealthy = settings.openaiKeys.filter((k) => k.key.trim() && k.exhaustedUntil <= Date.now()).length;
  const benchedGemini = settings.geminiKeys.filter((k) => k.key.trim() && k.exhaustedUntil > Date.now());

  const options: { id: ProviderId; label: string; sub: string; ok: boolean }[] = [
    { id: "simulated", label: "Simulated Forge", sub: "offline rehearsal · free", ok: true },
    {
      id: "local",
      label: "Your own machine",
      sub: settings.localBase.trim() ? `${settings.localModel || "no model set"} · free, unlimited` : "set the address in Settings",
      ok: Boolean(settings.localBase.trim() && settings.localModel.trim()),
    },
    {
      id: "cloudflare",
      label: "Cloudflare · FLUX",
      sub: settings.cloudflare.accountId.trim() && settings.cloudflare.token.trim()
        ? "free · about 690 pictures a day"
        : "add an account id + token in Settings",
      ok: Boolean(settings.cloudflare.accountId.trim() && settings.cloudflare.token.trim()),
    },
    {
      id: "pollinations",
      label: "Pollinations · FLUX",
      sub: settings.pollinationsToken.trim() ? "free · one every few seconds" : "needs a free token — Settings",
      ok: Boolean(settings.pollinationsToken.trim()),
    },
    {
      id: "gemini",
      label: "Google · Nano Banana",
      sub:
        geminiHealthy > 0
          ? `${geminiHealthy} key${geminiHealthy > 1 ? "s" : ""} healthy${benchedGemini.length ? ` · ${benchedGemini.length} resting ${formatCountdown(benchedGemini[0].exhaustedUntil)}` : ""}`
          : "add a Google key in Settings",
      ok: geminiHealthy > 0,
    },
    {
      id: "openai",
      label: "OpenAI-compatible",
      sub: openaiHealthy > 0 ? `${openaiHealthy} key${openaiHealthy > 1 ? "s" : ""} · ${settings.openaiModel}` : "add a key in Settings",
      ok: openaiHealthy > 0,
    },
  ];

  const current = options.find((o) => o.id === provider) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-press flex items-center gap-2 rounded-lg border border-line bg-panel/70 px-3 py-2 hover:border-line2"
        title="Active engine — only engines that are ready to work appear here"
      >
        <span className={`h-2 w-2 rounded-full ${provider !== "simulated" ? "pulse-dot" : ""}`} style={{ background: PROVIDER_META[provider].dot }} />
        <span className="font-mono text-[10.5px] tracking-wide text-parch uppercase">{PROVIDER_META[provider].short}</span>
        <IChevron size={11} className={`text-dust transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-line2 bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
          <p className="border-b border-line bg-[#191310] px-3.5 py-2 font-mono text-[9px] tracking-[0.2em] text-dust uppercase">
            active engine — unavailable ones are hidden
          </p>
          {options.map((o) => {
            if (!o.ok) return null;
            return (
              <button
                key={o.id}
                onClick={() => {
                  onProvider(o.id);
                  setOpen(false);
                }}
                className={`btn-press flex w-full items-center gap-2.5 border-b border-line/50 px-3.5 py-2.5 text-left last:border-0 hover:bg-raise/60 ${
                  provider === o.id ? "bg-ember/8" : ""
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PROVIDER_META[o.id].dot }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-cream">{o.label}</span>
                  <span className="block text-[10.5px] text-dust">{o.sub}</span>
                </span>
                {provider === o.id && <span className="font-mono text-[9px] tracking-widest text-ember uppercase">active</span>}
              </button>
            );
          })}
          <p className="px-3.5 py-2 text-[10px] leading-relaxed text-dust">
            Row-level <span className="font-mono text-parch">model</span> column overrides this for any single row.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TopMenu({
  view,
  onNav,
  provider,
  onProvider,
  settings,
  markedCount,
  templateCount,
  batchCount,
  doneCount,
  onRerunMarked,
  onWpImport,
  onZip,
}: {
  view: View;
  onNav: (v: View, section?: SettingsSection) => void;
  provider: ProviderId;
  onProvider: (p: ProviderId) => void;
  settings: ForgeSettings;
  markedCount: number;
  templateCount: number;
  batchCount: number;
  doneCount: number;
  onRerunMarked: () => void;
  onWpImport: () => void;
  onZip: () => void;
}) {
  return (
    <nav className="flex items-center gap-1">
      <Dropdown label="Wizards" active={view === "wizard" || view === "factory"}>
        {(close) => (
          <>
            <Item
              onClick={() => { onNav("wizard"); close(); }}
              icon={<IWand size={15} />}
              title="Start the wizard"
              hint="a new batch, one easy choice at a time"
            />
            <Item
              onClick={() => { onNav("factory"); close(); }}
              icon={<ISparkle size={15} />}
              title="Prompt factory"
              hint="write a huge list — AI or your own CSV"
            />
            <Item
              onClick={() => { onRerunMarked(); close(); }}
              icon={<IRetry size={15} />}
              title="Rerun marked & failed"
              hint="notes become extra instructions"
              badge={markedCount > 0 ? String(markedCount) : undefined}
            />
            <Item
              onClick={() => { onWpImport(); close(); }}
              icon={<IUpload size={15} />}
              title="Import to WordPress"
              hint="real upload with an app password"
              badge={doneCount > 0 ? String(doneCount) : undefined}
            />
          </>
        )}
      </Dropdown>

      <Dropdown
        label="Library"
        active={view === "lib-images" || view === "lib-styles" || view === "lib-templates" || view === "lib-batches"}
      >
        {(close) => (
          <>
            <Item onClick={() => { onNav("lib-images"); close(); }} icon={<IImage size={15} />} title="Images" hint="mark, note and redo any picture" />
            <Item onClick={() => { onNav("lib-styles"); close(); }} icon={<IFlask size={15} />} title="Styles" hint="the five languages + your own" />
            <Item onClick={() => { onNav("lib-templates"); close(); }} icon={<IWand size={15} />} title="Templates" hint="saved setups, ready to reuse" badge={templateCount > 0 ? String(templateCount) : undefined} />
            <Item onClick={() => { onNav("lib-batches"); close(); }} icon={<IFolder size={15} />} title="Previous batches" badge={batchCount > 0 ? String(batchCount) : undefined} />
          </>
        )}
      </Dropdown>

      <Dropdown label="Settings" active={view === "settings"}>
        {(close) => (
          <>
            <Item onClick={() => { onNav("settings", "engines"); close(); }} icon={<IImage size={15} />} title="Image engines" hint="keys, models, cooldowns" />
            <Item onClick={() => { onNav("settings", "styles"); close(); }} icon={<IFlask size={15} />} title="Image styles" />
            <Item onClick={() => { onNav("settings", "text"); close(); }} icon={<IQuill size={15} />} title="Text engines" hint="the AI that writes for you" />
            <Item onClick={() => { onNav("settings", "prompts"); close(); }} icon={<ISparkle size={15} />} title="Text prompts" hint="tune how the AI writes" />
            <Item onClick={() => { onNav("settings", "filenames"); close(); }} icon={<IBook size={15} />} title="Filenames" hint="the seven rules" />
            <Item onClick={() => { onNav("settings", "folders"); close(); }} icon={<IFolder size={15} />} title="Folders" hint="where images land on disk" />
            <Item onClick={() => { onNav("settings", "wp"); close(); }} icon={<IUpload size={15} />} title="WP connections" />
            <Item onClick={() => { onNav("settings", "appearance"); close(); }} icon={<IGear size={15} />} title="Appearance" />
            <Item onClick={() => { onNav("settings", "advanced"); close(); }} icon={<ISparkle size={15} />} title="Advanced" hint="repair · reset · update" />
          </>
        )}
      </Dropdown>

      <Dropdown label="Docs" active={view === "docs" || view === "agents"}>
        {(close) => (
          <>
            <Item onClick={() => { onNav("docs"); close(); }} icon={<IBook size={15} />} title="The manual" hint="setup to WordPress, step by step" />
            <Item onClick={() => { onNav("agents"); close(); }} icon={<ISparkle size={15} />} title="Agents & API" hint="n8n · MCP · LangChain recipes" />
          </>
        )}
      </Dropdown>

      <div className="ml-3 flex items-center gap-2 border-l border-line pl-3">
        <ModelSelector provider={provider} onProvider={onProvider} settings={settings} />
        <button
          onClick={() => onNav("settings", "engines")}
          title="Settings"
          className="btn-press rounded-lg border border-line bg-panel/70 p-2 text-dust hover:border-line2 hover:text-cream"
        >
          <IGear size={14} />
        </button>
        <button
          onClick={onZip}
          title="Download finished plates as ZIP"
          className="btn-press hidden items-center gap-1.5 rounded-lg border border-line bg-panel/70 px-2.5 py-2 text-parch hover:border-line2 sm:flex"
        >
          <IX size={0} className="hidden" />
          <IImage size={13} className="text-dust" />
          <span className="font-mono text-[10px] text-dust">{doneCount}</span>
        </button>
        <span className="hidden lg:block">
          <Btn variant="primary" onClick={() => onNav("wizard")}>
            <IPlay size={12} /> New batch
          </Btn>
        </span>
      </div>
    </nav>
  );
}
