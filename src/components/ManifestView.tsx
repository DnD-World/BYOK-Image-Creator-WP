import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AspectKey, Category, LogEntry, ManifestRow, Status } from "../types";
import { ASPECTS, ASPECT_KEYS, CATEGORIES, CATEGORY_META, STATUSES, STATUS_META, STYLES } from "../types";
import { autoFixFilename, validateFilename } from "../lib/validate";
import {
  Btn,
  CatChip,
  CAT_ICON,
  ICheck,
  IDownload,
  IPlus,
  IRetry,
  ISearch,
  ISkip,
  ITrash,
  IUpload,
  IX,
  Modal,
  StatusChip,
} from "./ui";

export interface ManifestViewProps {
  rows: ManifestRow[]; // filtered
  allRows: ManifestRow[];
  total: number;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: Status | "all";
  setStatusFilter: (s: Status | "all") => void;
  catFilter: Category | "all";
  setCatFilter: (c: Category | "all") => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  addRow: () => void;
  updateRow: (id: number, patch: Partial<ManifestRow>) => void;
  deleteRow: (id: number) => void;
  duplicateRow: (id: number) => void;
  generateOne: (id: number) => void;
  setToPending: (id: number) => void;
  markSkipped: (id: number) => void;
  markImported: (id: number) => void;
  importCsv: (text: string, mode: "merge" | "replace") => void;
  exportCsv: () => void;
  log: LogEntry[];
  isRunning: boolean;
  styleLock: string;
  appendStyle: boolean;
  setAppendStyle: (b: boolean) => void;
}

const timeAgo = (iso: string) => {
  if (!iso) return "—";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function ManifestView(p: ManifestViewProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const selected = p.allRows.find((r) => r.id === p.selectedId) ?? null;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [p.log.length, logOpen]);

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-coal/50 px-5 py-3">
        <div className="relative">
          <ISearch size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-dust" />
          <input
            value={p.search}
            onChange={(e) => p.setSearch(e.target.value)}
            placeholder="search filename or prompt…"
            className="w-[240px] rounded-lg border border-line bg-panel py-1.5 pr-3 pl-8 font-mono text-[12px] text-cream placeholder:text-dust/70"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => p.setStatusFilter("all")}
            className={`btn-press rounded-md px-2 py-1 font-mono text-[11px] ${
              p.statusFilter === "all" ? "bg-raise text-cream" : "text-dust hover:text-cream"
            }`}
          >
            all · {p.total}
          </button>
          {STATUSES.map((s) => {
            const n = p.allRows.filter((r) => r.status === s).length;
            if (n === 0 && p.statusFilter !== s) return null;
            return (
              <button
                key={s}
                onClick={() => p.setStatusFilter(p.statusFilter === s ? "all" : s)}
                className={`btn-press flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] ${
                  p.statusFilter === s ? "bg-raise text-cream" : "text-dust hover:text-cream"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
                {s} · {n}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-panel2/50 px-2.5 py-1.5 font-mono text-[11px] text-parch">
            <input
              type="checkbox"
              checked={p.appendStyle}
              onChange={(e) => p.setAppendStyle(e.target.checked)}
              className="accent-[#f2a33c]"
            />
            append style block
          </label>
          <Btn onClick={() => setImportOpen(true)}>
            <IUpload size={13} /> Import CSV
          </Btn>
          <Btn onClick={p.exportCsv}>
            <IDownload size={13} /> Export
          </Btn>
          <Btn variant="primary" onClick={p.addRow}>
            <IPlus size={13} /> Row
          </Btn>
        </div>
      </div>

      {/* table */}
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-1">
        {p.total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="plaque flex h-20 w-20 items-center justify-center rounded-2xl text-ember">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 15 5-4 4 3 3-2 6 4" />
                <circle cx="9" cy="9.5" r="1.4" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg text-cream">The manifest is empty</p>
              <p className="mt-1 max-w-sm text-[13px] text-dust">
                Add rows by hand or import an existing <span className="font-mono text-parch">marketplace-images.csv</span>.
              </p>
            </div>
            <div className="flex gap-2">
              <Btn variant="primary" onClick={p.addRow}>
                <IPlus size={13} /> Add first row
              </Btn>
              <Btn onClick={() => setImportOpen(true)}>
                <IUpload size={13} /> Import CSV
              </Btn>
            </div>
          </div>
        ) : p.rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="font-display text-base text-parch">No rows match the current filters</p>
            <Btn
              onClick={() => {
                p.setStatusFilter("all");
                p.setCatFilter("all");
                p.setSearch("");
              }}
            >
              <IX size={12} /> Clear filters
            </Btn>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {["preview / filename", "category", "aspect", "style", "status", "generated", ""].map((h, i) => (
                  <th
                    key={h + i}
                    className="sticky top-0 z-10 border-b border-line bg-[#1b1410]/95 px-3 py-2.5 text-left font-mono text-[10px] tracking-[0.18em] text-dust uppercase backdrop-blur"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.rows.map((row, i) => (
                <tr
                  key={`${row.id}-${row.status}`}
                  onClick={() => p.onSelect(row.id)}
                  className={`row-flash group cursor-pointer transition-colors ${
                    p.selectedId === row.id ? "bg-raise/70" : "hover:bg-panel2/60"
                  }`}
                  style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                >
                  <td className="border-b border-line/60 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative h-11 w-[74px] shrink-0 overflow-hidden rounded-lg border border-line bg-[#191310]"
                        style={{ aspectRatio: ASPECTS[row.aspect_ratio].w / ASPECTS[row.aspect_ratio].h }}
                      >
                        {row.status === "generating" ? (
                          <div className="shimmer absolute inset-0 flex items-center justify-center">
                            <span className="font-mono text-[9px] tracking-widest text-ember/80">GEN…</span>
                          </div>
                        ) : row.preview ? (
                          <img
                            key={row.generated_at || row.status}
                            src={row.preview}
                            alt={row.filename}
                            className="develop h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-dust/50">
                            {row.status === "failed" ? (
                              <IX size={14} className="text-blood/70" />
                            ) : (
                              <span className="font-mono text-[9px]">—</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[13px] text-cream">{row.filename || "unnamed.png"}</div>
                        <div className="mt-0.5 max-w-[420px] truncate text-[11.5px] text-dust">
                          {row.error ? (
                            <span className="text-blood/90">⚠ {row.error}</span>
                          ) : (
                            row.prompt || <span className="italic">no prompt yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-line/60 px-3 py-2.5">
                    <CatChip category={row.category} />
                  </td>
                  <td className="border-b border-line/60 px-3 py-2.5 font-mono text-[12px] text-parch">
                    {row.aspect_ratio}
                    <span className="ml-1.5 text-[10px] text-dust">
                      {ASPECTS[row.aspect_ratio].w}×{ASPECTS[row.aspect_ratio].h}
                    </span>
                  </td>
                  <td className="border-b border-line/60 px-3 py-2.5">
                    <span
                      className={`font-mono text-[12px] ${row.style === p.styleLock ? "text-parch" : "text-ember"}`}
                      title={row.style === p.styleLock ? "matches locked style" : "drifts from locked style"}
                    >
                      {row.style}
                      {row.style !== p.styleLock && " *"}
                    </span>
                  </td>
                  <td className="border-b border-line/60 px-3 py-2.5">
                    <StatusChip status={row.status} pulse />
                  </td>
                  <td className="border-b border-line/60 px-3 py-2.5 font-mono text-[11px] whitespace-nowrap text-dust">
                    {timeAgo(row.generated_at)}
                    {row.imported_attachment_id && (
                      <span className="ml-2 rounded bg-lagoon/10 px-1.5 py-0.5 text-[10px] text-lagoon">
                        att #{row.imported_attachment_id}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-line/60 px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {(row.status === "pending" || row.status === "failed" || row.status === "skipped") && (
                        <button
                          title="generate now"
                          onClick={(e) => {
                            e.stopPropagation();
                            p.generateOne(row.id);
                          }}
                          className="btn-press rounded-md p-1.5 text-ember hover:bg-ember/15"
                        >
                          {row.status === "failed" ? <IRetry size={14} /> : <IPlayMini />}
                        </button>
                      )}
                      {row.status === "done" && (
                        <button
                          title="mark imported"
                          onClick={(e) => {
                            e.stopPropagation();
                            p.markImported(row.id);
                          }}
                          className="btn-press rounded-md p-1.5 text-lagoon hover:bg-lagoon/15"
                        >
                          <IUpload size={14} />
                        </button>
                      )}
                      <button
                        title="delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          p.deleteRow(row.id);
                        }}
                        className="btn-press rounded-md p-1.5 text-dust hover:bg-blood/15 hover:text-blood"
                      >
                        <ITrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* console */}
      <div className="shrink-0 border-t border-line bg-[#161009]">
        <button
          onClick={() => setLogOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-5 py-1.5 font-mono text-[10px] tracking-[0.2em] text-dust uppercase transition hover:text-parch"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${p.isRunning ? "bg-ember pulse-dot" : "bg-moss"}`} />
          forge console · {p.log.length} entries
          <span className="ml-auto">{logOpen ? "▾" : "▸"}</span>
        </button>
        {logOpen && (
          <div ref={logRef} className="h-[104px] overflow-y-auto px-5 pb-2 font-mono text-[11px] leading-[1.7]">
            {p.log.length === 0 && <div className="text-dust/60">$ waiting for the first strike…</div>}
            {p.log.map((e, i) => (
              <div key={i} className="whitespace-nowrap">
                <span className="text-dust/60">{e.t}</span>{" "}
                <span
                  className={
                    e.kind === "ok" ? "text-moss" : e.kind === "err" ? "text-blood" : e.kind === "run" ? "text-ember" : "text-parch"
                  }
                >
                  {e.msg}
                </span>
              </div>
            ))}
            {p.isRunning && (
              <div className="text-ember">
                $ hammering<span className="blink">▊</span>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && <RowDrawer row={selected} {...p} />}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(text, mode) => {
          p.importCsv(text, mode);
          setImportOpen(false);
        }}
      />
    </div>
  );
}

const IPlayMini = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.8v14.4L19 12 7 4.8Z" />
  </svg>
);

/* ================= row drawer ================= */

function RowDrawer({
  row,
  allRows,
  updateRow,
  deleteRow,
  duplicateRow,
  generateOne,
  setToPending,
  markSkipped,
  markImported,
  onSelect,
  styleLock,
  appendStyle,
}: {
  row: ManifestRow;
  allRows: ManifestRow[];
  updateRow: (id: number, patch: Partial<ManifestRow>) => void;
  deleteRow: (id: number) => void;
  duplicateRow: (id: number) => void;
  generateOne: (id: number) => void;
  setToPending: (id: number) => void;
  markSkipped: (id: number) => void;
  markImported: (id: number) => void;
  onSelect: (id: number | null) => void;
  styleLock: string;
  appendStyle: boolean;
}) {
  const checks = useMemo(
    () =>
      validateFilename(
        row.filename,
        row.category,
        allRows.map((r) => ({ id: r.id, filename: r.filename })),
        row.id
      ),
    [row, allRows]
  );
  const styleDef = STYLES.find((s) => s.id === row.style) ?? STYLES[0];
  const needsBlock = appendStyle && !row.prompt.toLowerCase().includes(styleDef.block.slice(0, 24).toLowerCase());
  const sentPrompt = needsBlock ? `${row.prompt}, ${styleDef.block}` : row.prompt;

  const field = "w-full rounded-lg border border-line bg-[#191310] px-3 py-2 font-mono text-[12.5px] text-cream";

  return (
    <div className="slide-in-right absolute top-0 right-0 bottom-0 z-30 flex w-[392px] flex-col border-l border-line bg-[#201812]/98 shadow-[-24px_0_60px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-dust">ROW #{row.id}</span>
          <StatusChip status={row.status} pulse />
        </div>
        <button onClick={() => onSelect(null)} className="btn-press text-dust hover:text-cream">
          <IX size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {/* preview */}
        <div
          className="relative w-full overflow-hidden rounded-xl border border-line bg-[#191310]"
          style={{ aspectRatio: ASPECTS[row.aspect_ratio].w / ASPECTS[row.aspect_ratio].h, maxHeight: 240 }}
        >
          {row.status === "generating" ? (
            <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-2">
              <IHammerSpin />
              <span className="font-mono text-[10px] tracking-[0.25em] text-ember">STRIKING…</span>
            </div>
          ) : row.preview ? (
            <img key={row.generated_at || row.status} src={row.preview} alt={row.filename} className="develop h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-dust/60">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 15 5-4 4 3 3-2 6 4" />
              </svg>
              <span className="font-mono text-[10px] tracking-widest uppercase">no plate yet</span>
            </div>
          )}
        </div>

        {/* filename + rules */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="font-mono text-[10px] tracking-[0.2em] text-dust uppercase">filename</label>
            <button
              onClick={() => updateRow(row.id, { filename: autoFixFilename(row.filename, row.category) })}
              className="btn-press rounded-md border border-line2 bg-panel2/60 px-2 py-0.5 font-mono text-[10px] text-parch hover:border-ember/50 hover:text-cream"
            >
              auto-fix
            </button>
          </div>
          <input value={row.filename} onChange={(e) => updateRow(row.id, { filename: e.target.value })} className={field} />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {checks.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 text-[10.5px]">
                {c.pass ? <ICheck size={10} className="shrink-0 text-moss" /> : <IX size={10} className="shrink-0 text-blood" />}
                <span className={c.pass ? "text-dust" : "text-blood"}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* prompt */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="font-mono text-[10px] tracking-[0.2em] text-dust uppercase">prompt</label>
            <span className="font-mono text-[10px] text-dust">{row.prompt.length} chars</span>
          </div>
          <textarea
            value={row.prompt}
            onChange={(e) => updateRow(row.id, { prompt: e.target.value })}
            rows={4}
            className={`${field} resize-y leading-relaxed`}
            placeholder="Claymation-style medieval …"
          />
          {needsBlock && (
            <p className="mt-1.5 rounded-lg border border-ember/25 bg-ember/8 px-2.5 py-1.5 text-[11px] leading-snug text-ember/90">
              style block will be appended on send → <span className="font-mono">…, {styleDef.block.slice(0, 58)}…</span>
            </p>
          )}
        </div>

        {/* selects */}
        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">category</label>
            <select
              value={row.category}
              onChange={(e) => updateRow(row.id, { category: e.target.value as Category })}
              className={field}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">aspect</label>
            <select
              value={row.aspect_ratio}
              onChange={(e) => updateRow(row.id, { aspect_ratio: e.target.value as AspectKey })}
              className={field}
            >
              {ASPECT_KEYS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">seed</label>
            <input
              type="number"
              value={row.seed}
              onChange={(e) => updateRow(row.id, { seed: parseInt(e.target.value, 10) || 0 })}
              className={field}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">style</label>
          <select value={row.style} onChange={(e) => updateRow(row.id, { style: e.target.value })} className={field}>
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.id === styleLock ? " · locked" : ""}
              </option>
            ))}
          </select>
          {row.style !== styleLock && (
            <p className="mt-1.5 text-[11px] text-ember">⚠ drifts from the locked visual language “{styleLock}”</p>
          )}
        </div>

        {/* meta */}
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["item_id", row.item_id],
              ["shop_id", row.shop_id],
              ["event_id", row.event_id],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">{k}</label>
              <input value={v} onChange={(e) => updateRow(row.id, { [k]: e.target.value } as Partial<ManifestRow>)} className={field} placeholder="—" />
            </div>
          ))}
          <div>
            <label className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-dust uppercase">wp attachment</label>
            <input value={row.imported_attachment_id} disabled className={`${field} opacity-50`} placeholder="set on import" />
          </div>
        </div>

        {row.error && (
          <div className="rounded-lg border border-blood/30 bg-blood/8 px-3 py-2">
            <p className="font-mono text-[10px] tracking-[0.2em] text-blood uppercase">last error</p>
            <p className="mt-1 font-mono text-[11.5px] text-blood/90">{row.error}</p>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="space-y-2 border-t border-line px-5 py-4">
        <div className="flex gap-2">
          {row.status === "generating" ? (
            <Btn className="flex-1 justify-center" disabled>
              generating…
            </Btn>
          ) : row.status === "done" || row.status === "imported" ? (
            <>
              <Btn variant="primary" className="flex-1 justify-center" onClick={() => generateOne(row.id)}>
                <IRetry size={13} /> Regenerate
              </Btn>
              {row.status === "done" && (
                <Btn variant="moss" className="flex-1 justify-center" onClick={() => markImported(row.id)}>
                  <IUpload size={13} /> Mark imported
                </Btn>
              )}
            </>
          ) : (
            <>
              <Btn variant="primary" className="flex-1 justify-center" onClick={() => generateOne(row.id)}>
                <IRetry size={13} /> {row.status === "failed" ? "Retry strike" : "Generate now"}
              </Btn>
              <Btn onClick={() => (row.status === "skipped" ? setToPending(row.id) : markSkipped(row.id))}>
                <ISkip size={13} /> {row.status === "skipped" ? "Unskip" : "Skip"}
              </Btn>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Btn className="flex-1 justify-center" onClick={() => duplicateRow(row.id)}>
            <IPlus size={13} /> Duplicate
          </Btn>
          <Btn variant="danger" className="flex-1 justify-center" onClick={() => deleteRow(row.id)}>
            <ITrash size={13} /> Delete
          </Btn>
        </div>
        <p className="text-center font-mono text-[10px] text-dust/70">
          sent to endpoint → <span className="text-parch">{sentPrompt.length} chars</span> · dims{" "}
          {ASPECTS[row.aspect_ratio].w}×{ASPECTS[row.aspect_ratio].h}
        </p>
      </div>
    </div>
  );
}

const IHammerSpin = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f2a33c" strokeWidth="2" className="hammer-swing">
    <path d="M11 3.5 15 2l6 6-1.5 4L13 8.5 11 3.5Z" fill="#f2a33c" stroke="none" />
    <path d="m12.5 9.5-9 9L6 21l9-9" />
  </svg>
);

/* ================= import modal ================= */

function ImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (text: string, mode: "merge" | "replace") => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [preview, setPreview] = useState<{ ok: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setText("");
      setPreview(null);
    }
  }, [open]);

  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    const lines = text.split("\n").filter((l) => l.trim());
    const hasHeader = lines[0]?.toLowerCase().includes("filename");
    setPreview({ ok: Math.max(0, lines.length - (hasHeader ? 1 : 0)), skipped: 0 });
  }, [text]);

  return (
    <Modal open={open} onClose={onClose} title="IMPORT MARKETPLACE-IMAGES.CSV">
      <div className="space-y-4 p-5">
        <p className="text-[13px] leading-relaxed text-parch">
          Paste CSV or choose a file. Both the <span className="font-mono text-cream">simple</span> and{" "}
          <span className="font-mono text-cream">full</span> schemas are accepted — unknown columns are ignored, missing
          ones get sane defaults.
        </p>
        <div className="flex items-center gap-2">
          <Btn onClick={() => fileRef.current?.click()}>
            <IUpload size={13} /> Choose .csv file
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const rd = new FileReader();
              rd.onload = () => setText(String(rd.result ?? ""));
              rd.readAsText(f);
              e.target.value = "";
            }}
          />
          {preview && (
            <span className="font-mono text-[11px] text-moss">
              {preview.ok} row{preview.ok === 1 ? "" : "s"} detected
            </span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"filename,prompt,category,style,aspect_ratio,status,error,generated_at\nshop_tavern.png,\"Claymation-style medieval tavern at dusk…\",shop,claymation,16:9,pending,,"}
          className="w-full resize-y rounded-xl border border-line bg-[#191310] px-3.5 py-3 font-mono text-[12px] leading-relaxed text-cream placeholder:text-dust/50"
        />
        <div className="flex items-center gap-4">
          {(
            [
              ["merge", "merge — append new rows, keep existing"],
              ["replace", "replace — wipe manifest first"],
            ] as const
          ).map(([m, label]) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-parch">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="accent-[#f2a33c]" />
              {label}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!text.trim()} onClick={() => onImport(text, mode)}>
            <ICheck size={13} /> Import rows
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
