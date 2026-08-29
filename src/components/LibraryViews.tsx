import { useState } from "react";
import type { ManifestRow } from "../types";
import { STYLES } from "../types";
import type { ForgeSettings } from "../lib/providers";
import { formatCountdown } from "../lib/providers";
import type { Batch, SavedSetup } from "../lib/batches";
import { ASPECTS } from "../types";
import { BorderGlow } from "./effects";
import { Btn, CatChip, ICheck, IHammer, IPlay, IRetry, ITrash, IWand, IX, StatusChip } from "./ui";

const RatioThumb = ({ row, width = 150 }: { row: ManifestRow; width?: number }) => {
  const dims = ASPECTS[row.aspect_ratio];
  const h = Math.round((width * dims.h) / dims.w);
  if (!row.preview)
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-line2 bg-[#191310]" style={{ width, height: h }}>
        <span className="font-mono text-[10px] text-dust">no plate yet</span>
      </div>
    );
  const isSvg = row.preview.startsWith("<svg") || row.preview.startsWith("data:image/svg");
  return (
    <div className="thumb-zoom overflow-hidden rounded-lg border border-line" style={{ width, height: h }}>
      {isSvg ? (
        <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: row.preview }} />
      ) : (
        <img src={row.preview} alt={row.filename} className="h-full w-full object-cover" />
      )}
    </div>
  );
};

/* ---------------- images ---------------- */

export function ImageLibrary({
  rows,
  batches,
  updateRow,
  onRedo,
}: {
  rows: ManifestRow[];
  batches: Batch[];
  updateRow: (id: number, patch: Partial<ManifestRow>) => void;
  onRedo: (ids: number[]) => void;
}) {
  const [onlyMarked, setOnlyMarked] = useState(false);
  const shown = rows.filter((r) => {
    if (onlyMarked) return r.status === "failed" || ((r.note ?? "").trim() !== "" && (r.status === "done" || r.status === "imported"));
    return true;
  });
  const batchName = (id: number) => batches.find((b) => b.rowIds.includes(id))?.name;
  const marked = rows.filter((r) => r.status === "failed" || ((r.note ?? "").trim() !== "" && (r.status === "done" || r.status === "imported")));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">library</p>
          <h2 className="mt-1 font-display text-3xl text-cream">Every picture</h2>
          <p className="mt-2 max-w-xl text-[13.5px] text-parch">
            Don't like one? Write a note about what should be better, mark it, and redo it — your note becomes part of
            the new prompt automatically. No note? It just gets painted again.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn variant={onlyMarked ? "primary" : "ghost"} onClick={() => setOnlyMarked(!onlyMarked)}>
            {onlyMarked ? "showing marked" : `marked & failed · ${marked.length}`}
          </Btn>
          <Btn variant="moss" disabled={marked.length === 0} onClick={() => onRedo(marked.map((r) => r.id))}>
            <IRetry size={13} /> Redo marked · {marked.length}
          </Btn>
        </div>
      </header>

      {shown.length === 0 ? (
        <p className="py-16 text-center font-display text-xl text-dust">Nothing here yet — the wizard fixes that.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((r) => (
            <BorderGlow key={r.id} radius={14} glow="rgba(242,163,60,0.45)" idle="#3e2f21" innerClassName="bg-[#241b14]">
              <div className="p-3">
                <div className="flex justify-center">
                  <RatioThumb row={r} width={220} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-cream">{r.filename}</p>
                  <StatusChip status={r.status} />
                </div>
                <p className="mt-1 font-mono text-[9.5px] text-dust">
                  <CatChip category={r.category} /> {batchName(r.id) ? `· ${batchName(r.id)}` : ""}
                </p>
                <input
                  value={r.note ?? ""}
                  onChange={(e) => updateRow(r.id, { note: e.target.value || undefined })}
                  placeholder="✎ what should be better…"
                  className="mt-2 w-full rounded-lg border border-line bg-[#191310] px-2.5 py-1.5 text-[11.5px] text-cream placeholder:text-dust/50"
                />
                <div className="mt-2 flex gap-1.5">
                  {(r.status === "done" || r.status === "imported") && (
                    <Btn variant="danger" className="flex-1 justify-center !px-2 !py-1.5 !text-[11px]" onClick={() => updateRow(r.id, { status: "failed", error: "marked by hand" })}>
                      <IX size={11} /> Mark failed
                    </Btn>
                  )}
                  <Btn variant="ghost" className="flex-1 justify-center !px-2 !py-1.5 !text-[11px]" onClick={() => onRedo([r.id])}>
                    <IHammer size={11} /> Redo
                  </Btn>
                </div>
              </div>
            </BorderGlow>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- styles ---------------- */

export function StyleLibrary({
  settings,
  patchSettings,
  styleLock,
  setStyleLock,
}: {
  settings: ForgeSettings;
  patchSettings: (p: Partial<ForgeSettings>) => void;
  styleLock: string;
  setStyleLock: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const all = [...STYLES, ...settings.customStyles.map((c) => ({ ...c, swatch: ["#f4e8d4", "#97876d", "#57432c"] as [string, string, string] }))];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">library</p>
        <h2 className="mt-1 font-display text-3xl text-cream">Visual languages</h2>
        <p className="mt-2 max-w-xl text-[13.5px] text-parch">
          Pick one language per batch so every picture belongs together. Locking one makes the wizard and the scribe use
          its style block everywhere.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {all.map((s) => {
          const active = styleLock === s.id;
          return (
            <BorderGlow key={s.id} radius={14} glow={active ? "rgba(242,163,60,0.6)" : "rgba(242,163,60,0.4)"} idle={active ? "rgba(242,163,60,0.5)" : "#3e2f21"} innerClassName={active ? "bg-[#2a1e12]" : "bg-[#241b14]"}>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex overflow-hidden rounded-md border border-line">
                    {s.swatch.map((c) => (
                      <span key={c} className="h-5 w-5" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="flex-1 font-display text-[15px] tracking-wide text-cream">{s.name}</span>
                  {active && <span className="rounded-md border border-ember/50 bg-ember/12 px-2 py-0.5 font-mono text-[9px] tracking-widest text-ember uppercase">locked</span>}
                </div>
                <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-dust">{s.block}</p>
                <div className="mt-3 flex gap-2">
                  <Btn variant={active ? "ghost" : "primary"} className="!px-2.5 !py-1.5 !text-[11px]" onClick={() => setStyleLock(s.id)}>
                    {active ? "locked ✓" : "Lock this look"}
                  </Btn>
                  {settings.customStyles.some((c) => c.id === s.id) && (
                    <Btn variant="danger" className="!px-2.5 !py-1.5 !text-[11px]" onClick={() => patchSettings({ customStyles: settings.customStyles.filter((c) => c.id !== s.id) })}>
                      <ITrash size={11} /> Remove
                    </Btn>
                  )}
                </div>
              </div>
            </BorderGlow>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-panel/50 p-5">
        <p className="font-display text-[15px] tracking-wide text-cream">Add your own language</p>
        <div className="mt-3 grid gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name — e.g. Ink & Wash" className="w-full rounded-lg border border-line bg-[#191310] px-3 py-2.5 text-[13px] text-cream placeholder:text-dust/60" />
          <textarea value={block} onChange={(e) => setBlock(e.target.value)} rows={2} placeholder="the style block appended to every prompt — e.g. ink and brush wash style, muted earth tones…" className="w-full resize-y rounded-lg border border-line bg-[#191310] px-3 py-2.5 text-[12.5px] text-cream placeholder:text-dust/60" />
          <Btn
            variant="primary"
            className="justify-self-start"
            disabled={!name.trim() || !block.trim()}
            onClick={() => {
              const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
              patchSettings({ customStyles: [...settings.customStyles, { id: id || `custom-${Date.now()}`, name: name.trim(), block: block.trim() }] });
              setName("");
              setBlock("");
            }}
          >
            <ICheck size={12} /> Add to the library
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- templates ---------------- */

export function TemplateLibrary({
  setups,
  onDelete,
  onUse,
}: {
  setups: SavedSetup[];
  onDelete: (id: string) => void;
  onUse: (t: SavedSetup) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">library</p>
        <h2 className="mt-1 font-display text-3xl text-cream">Saved recipes</h2>
        <p className="mt-2 max-w-xl text-[13.5px] text-parch">
          Every setup you save at the end of the wizard lands here. Next batch, the wizard offers them as starting
          points on step one.
        </p>
      </header>
      {setups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line2 p-12 text-center">
          <IWand size={26} className="mx-auto text-dust" />
          <p className="mt-3 font-display text-xl text-cream">No recipes yet.</p>
          <p className="mt-1 text-[13px] text-parch">Finish a wizard run and give your setup a name — it appears here.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {setups.map((t) => (
            <BorderGlow key={t.id} radius={14} glow="rgba(177,140,224,0.45)" idle="#3e2f21" innerClassName="bg-[#241b14]">
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-[16px] tracking-wide text-cream">{t.name}</p>
                  <button onClick={() => onDelete(t.id)} className="btn-press rounded-md p-1.5 text-dust hover:bg-blood/15 hover:text-blood">
                    <ITrash size={13} />
                  </button>
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-dust">
                  {t.data.styleId} · {t.data.model || "default painter"} · {t.data.aspect === "per-category" ? "mixed shapes" : t.data.aspect} · saved {new Date(t.createdAt).toLocaleDateString("en-GB")}
                </p>
                <div className="mt-3">
                  <Btn variant="primary" onClick={() => onUse(t)}>
                    <IPlay size={12} /> Start wizard from here
                  </Btn>
                </div>
              </div>
            </BorderGlow>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- batches ---------------- */

export function BatchLibrary({
  batches,
  rows,
  onOpen,
  onRerun,
  onDelete,
}: {
  batches: Batch[];
  rows: ManifestRow[];
  onOpen: (id: string) => void;
  onRerun: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">library</p>
        <h2 className="mt-1 font-display text-3xl text-cream">Previous batches</h2>
        <p className="mt-2 max-w-xl text-[13.5px] text-parch">Every batch you arranged, with a live score. Open one to see just its pictures on the workbench.</p>
      </header>
      {batches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line2 p-12 text-center">
          <p className="font-display text-xl text-cream">No batches yet.</p>
          <p className="mt-1 text-[13px] text-parch">The wizard arranges your first one in about two minutes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => {
            const bRows = rows.filter((r) => b.rowIds.includes(r.id));
            const done = bRows.filter((r) => r.status === "done" || r.status === "imported").length;
            const failed = bRows.filter((r) => r.status === "failed").length;
            const cooling = bRows.filter((r) => r.retry_at && Date.parse(r.retry_at) > Date.now()).length;
            return (
              <BorderGlow key={b.id} radius={14} glow="rgba(86,184,165,0.4)" idle="#3e2f21" innerClassName="bg-[#241b14]">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[16px] tracking-wide text-cream">{b.name}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-dust">
                      {new Date(b.createdAt).toLocaleString("en-GB")} · {bRows.length} pictures{b.setupName ? ` · recipe “${b.setupName}”` : ""}
                    </p>
                    <div className="mt-2 flex h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#191310]">
                      {done > 0 && <div className="h-full bg-moss transition-all duration-700" style={{ width: `${(done / Math.max(bRows.length, 1)) * 100}%` }} />}
                      {failed > 0 && <div className="h-full bg-blood transition-all duration-700" style={{ width: `${(failed / Math.max(bRows.length, 1)) * 100}%` }} />}
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-dust">
                      {done}/{bRows.length} struck{failed > 0 ? ` · ${failed} failed` : ""}{cooling > 0 ? ` · ${cooling} cooling ${formatCountdown(Date.parse(bRows.find((r) => r.retry_at && Date.parse(r.retry_at) > Date.now())!.retry_at!))}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Btn onClick={() => onOpen(b.id)}>Open</Btn>
                    <Btn variant="ghost" onClick={() => onRerun(b.id)} disabled={failed === 0 && !bRows.some((r) => r.status === "pending")}>
                      <IRetry size={12} /> Rerun failures
                    </Btn>
                    <Btn variant="danger" onClick={() => onDelete(b.id)}>
                      <ITrash size={12} />
                    </Btn>
                  </div>
                </div>
              </BorderGlow>
            );
          })}
        </div>
      )}
    </div>
  );
}
