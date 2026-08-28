import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category, LogEntry, ManifestRow, Status, Toast } from "./types";
import { ERROR_POOL, STYLES } from "./types";
import { SEED_ROWS } from "./lib/seed";
import { downloadCsv, parseCsv, rowsFromCsv, rowsToCsv } from "./lib/csv";
import { renderPreview } from "./lib/preview";
import { styleDriftCount, violationCount } from "./lib/validate";
import Sidebar from "./components/Sidebar";
import ManifestView from "./components/ManifestView";
import PipelineView from "./components/PipelineView";
import SpecView from "./components/SpecView";
import { IAnvil, IDownload, IPlay, IUpload, ToastHost } from "./components/ui";

const LS_KEY = "image-forge-manifest-v1";

const withPreview = (r: ManifestRow): ManifestRow =>
  r.status === "done" || r.status === "imported" ? { ...r, preview: renderPreview(r) } : { ...r, preview: undefined };

function loadInitial(): ManifestRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { rows?: ManifestRow[] };
      if (Array.isArray(parsed.rows) && parsed.rows.length >= 0) {
        return parsed.rows
          .map((r) => (r.status === "generating" ? { ...r, status: "pending" as Status } : r))
          .map(withPreview);
      }
    }
  } catch {
    /* fall through to seed */
  }
  return SEED_ROWS.map(withPreview);
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const nowTime = () =>
  new Date().toLocaleTimeString("en-GB", { hour12: false });

type Tab = "manifest" | "pipeline" | "spec";

export default function App() {
  const [rows, setRows] = useState<ManifestRow[]>(loadInitial);
  const [tab, setTab] = useState<Tab>("manifest");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [styleLock, setStyleLockState] = useState("claymation");
  const [appendStyle, setAppendStyle] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const stopRef = useRef(false);
  const toastId = useRef(1);

  /* ---------- persistence ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          rows: rows.map(({ preview: _p, ...r }) => r),
          styleLock,
          appendStyle,
        })
      );
    } catch {
      /* storage full — non-fatal */
    }
  }, [rows, styleLock, appendStyle]);

  /* ---------- helpers ---------- */
  const pushToast = useCallback((kind: Toast["kind"], msg: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const pushLog = useCallback((msg: string, kind: LogEntry["kind"]) => {
    setLog((l) => [...l.slice(-80), { t: nowTime(), msg, kind }]);
  }, []);

  const patchRow = useCallback((id: number, patch: Partial<ManifestRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  /* ---------- the strike (one generation attempt) ---------- */
  const strike = useCallback(
    async (id: number): Promise<"done" | "failed" | "stopped" | "gone"> => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) return "gone";
      patchRow(id, { status: "generating", error: "" });
      pushLog(`→ ${row.filename || `row#${id}`} sent to image endpoint · ${row.aspect_ratio} · seed ${row.seed}`, "run");
      await sleep(1000 + Math.random() * 1100);
      if (stopRef.current) {
        setRows((prev) => prev.map((r) => (r.id === id && r.status === "generating" ? { ...r, status: "pending" } : r)));
        pushLog(`· ${row.filename} halted mid-strike, returned to pending`, "info");
        return "stopped";
      }
      const failChance = row.error ? 0.1 : 0.2;
      if (Math.random() < failChance) {
        const err = ERROR_POOL[Math.floor(Math.random() * ERROR_POOL.length)];
        patchRow(id, { status: "failed", error: err, preview: undefined });
        pushLog(`✗ ${row.filename} ${err}`, "err");
        return "failed";
      }
      const doneRow = { ...row, status: "done" as Status };
      const preview = renderPreview(doneRow);
      patchRow(id, { status: "done", generated_at: new Date().toISOString(), preview, error: "" });
      pushLog(`✓ ${row.filename} struck · saved to /generated-images/`, "ok");
      return "done";
    },
    [patchRow, pushLog]
  );

  const runQueue = useCallback(
    async (targets?: number[]) => {
      if (isRunning) return;
      const ids =
        targets ??
        rowsRef.current.filter((r) => r.status === "pending" || r.status === "failed").map((r) => r.id);
      if (ids.length === 0) return;
      stopRef.current = false;
      setIsRunning(true);
      pushLog(`── forge lit · ${ids.length} row${ids.length > 1 ? "s" : ""} in the queue ──`, "info");
      let done = 0;
      let failed = 0;
      for (const id of ids) {
        if (stopRef.current) break;
        const res = await strike(id);
        if (res === "done") done++;
        else if (res === "failed") failed++;
        else if (res === "stopped") break;
      }
      setIsRunning(false);
      const halted = stopRef.current;
      pushLog(`── run ${halted ? "halted" : "complete"} · ${done} struck · ${failed} failed ──`, failed > 0 ? "err" : "ok");
      pushToast(
        failed > 0 ? "err" : "ok",
        halted
          ? `Forge halted — ${done} struck before the halt.`
          : failed > 0
            ? `Run finished: ${done} struck, ${failed} failed. Retry them from the queue.`
            : `Run finished: ${done} image${done === 1 ? "" : "s"} struck and saved.`
      );
    },
    [isRunning, strike, pushLog, pushToast]
  );

  /* ---------- row actions ---------- */
  const addRow = useCallback(() => {
    const maxId = rowsRef.current.reduce((m, r) => Math.max(m, r.id), 0);
    const row: ManifestRow = {
      id: maxId + 1,
      filename: `item_new_${maxId + 1}.png`,
      prompt: "",
      category: "item",
      item_id: "",
      shop_id: "",
      event_id: "",
      style: styleLock,
      aspect_ratio: "1:1",
      seed: Math.floor(Math.random() * 98) + 1,
      status: "pending",
      error: "",
      generated_at: "",
      imported_attachment_id: "",
    };
    setRows((prev) => [...prev, row]);
    setSelectedId(row.id);
    setTab("manifest");
    pushLog(`+ row #${row.id} added to the manifest`, "info");
  }, [styleLock, pushLog]);

  const deleteRow = useCallback(
    (id: number) => {
      const r = rowsRef.current.find((x) => x.id === id);
      setRows((prev) => prev.filter((x) => x.id !== id));
      setSelectedId((s) => (s === id ? null : s));
      pushLog(`− ${r?.filename ?? `row#${id}`} removed from manifest`, "info");
      pushToast("info", `${r?.filename ?? "Row"} removed from the manifest.`);
    },
    [pushLog, pushToast]
  );

  const duplicateRow = useCallback(
    (id: number) => {
      const src = rowsRef.current.find((x) => x.id === id);
      if (!src) return;
      const maxId = rowsRef.current.reduce((m, r) => Math.max(m, r.id), 0);
      const copy: ManifestRow = {
        ...src,
        id: maxId + 1,
        filename: src.filename.replace(/\.png$/, `_copy.png`),
        status: "pending",
        generated_at: "",
        imported_attachment_id: "",
        error: "",
        preview: undefined,
      };
      setRows((prev) => [...prev, copy]);
      setSelectedId(copy.id);
      pushLog(`⧉ ${src.filename} duplicated → ${copy.filename}`, "info");
    },
    [pushLog]
  );

  const generateOne = useCallback(
    (id: number) => {
      if (isRunning) {
        pushToast("info", "The forge is busy — wait for the current run to finish.");
        return;
      }
      runQueue([id]);
    },
    [isRunning, runQueue, pushToast]
  );

  const markSkipped = useCallback(
    (id: number) => {
      const r = rowsRef.current.find((x) => x.id === id);
      patchRow(id, { status: "skipped", error: "" });
      pushLog(`» ${r?.filename} marked skipped`, "info");
    },
    [patchRow, pushLog]
  );

  const setToPending = useCallback(
    (id: number) => {
      patchRow(id, { status: "pending", error: "" });
    },
    [patchRow]
  );

  const markImported = useCallback(
    (id: number) => {
      const r = rowsRef.current.find((x) => x.id === id);
      if (!r) return;
      const att = String(8200 + id * 13 + Math.floor(Math.random() * 9));
      patchRow(id, { status: "imported", imported_attachment_id: att });
      pushLog(`⇪ ${r.filename} uploaded to WP Media Library · attachment #${att}`, "ok");
      pushToast("ok", `${r.filename} imported — Imagify will optimize it. Attachment #${att} stored.`);
    },
    [patchRow, pushLog, pushToast]
  );

  const simulateImport = useCallback(() => {
    const done = rowsRef.current.filter((r) => r.status === "done");
    if (done.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        r.status === "done"
          ? { ...r, status: "imported" as Status, imported_attachment_id: String(8200 + r.id * 13 + Math.floor(Math.random() * 9)) }
          : r
      )
    );
    pushLog(`⇪ WP importer ran · ${done.length} file(s) moved into the Media Library`, "ok");
    pushToast("ok", `${done.length} image${done.length > 1 ? "s" : ""} imported into WordPress. Imagify is on it.`);
  }, [pushLog, pushToast]);

  const exportCsv = useCallback(() => {
    downloadCsv("marketplace-images.csv", rowsToCsv(rowsRef.current));
    pushLog(`↓ marketplace-images.csv exported · ${rowsRef.current.length} rows`, "ok");
    pushToast("ok", "marketplace-images.csv exported with the full schema.");
  }, [pushLog, pushToast]);

  const importCsv = useCallback(
    (text: string, mode: "merge" | "replace") => {
      try {
        const { headers, records } = parseCsv(text);
        if (headers.length === 0 || records.length === 0) {
          pushToast("err", "No rows found in that CSV — check the header line.");
          return;
        }
        const taken = new Set(mode === "replace" ? [] : rowsRef.current.map((r) => r.id));
        const { rows: imported, skipped } = rowsFromCsv(headers, records, taken);
        if (imported.length === 0) {
          pushToast("err", "Nothing importable — every row was missing a filename.");
          return;
        }
        setRows((prev) => (mode === "replace" ? imported.map(withPreview) : [...prev, ...imported.map(withPreview)]));
        pushLog(`⇡ manifest ${mode === "replace" ? "replaced" : "merged"} · ${imported.length} rows in, ${skipped} skipped`, "ok");
        pushToast("ok", `Imported ${imported.length} row${imported.length > 1 ? "s" : ""} (${mode}).`);
      } catch {
        pushToast("err", "Could not parse that CSV — is it comma-separated with a header?");
      }
    },
    [pushLog, pushToast]
  );

  const setStyleLock = useCallback(
    (s: string) => {
      setStyleLockState(s);
      const name = STYLES.find((x) => x.id === s)?.name ?? s;
      pushToast("info", `Visual language locked to “${name}”. Drifting rows will be flagged.`);
    },
    [pushToast]
  );

  /* ---------- derived ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (q && !r.filename.toLowerCase().includes(q) && !r.prompt.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, catFilter, search]);

  const drift = useMemo(() => styleDriftCount(rows, styleLock), [rows, styleLock]);
  const violations = useMemo(() => violationCount(rows), [rows]);
  const queueLen = rows.filter((r) => r.status === "pending" || r.status === "failed").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const doneCount = rows.filter((r) => r.status === "done").length;

  const reviewFailed = useCallback(() => {
    setTab("manifest");
    setStatusFilter("failed");
  }, []);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "manifest", label: "Manifest", count: rows.length },
    { id: "pipeline", label: "Pipeline" },
    { id: "spec", label: "Rules & Brief" },
  ];

  return (
    <div className="grain relative flex h-screen flex-col overflow-hidden bg-ink">
      {/* ambient lantern glows */}
      <div className="lantern-glow" style={{ top: -140, left: -120, width: 460, height: 460, background: "rgba(242,163,60,0.16)" }} />
      <div className="lantern-glow" style={{ bottom: -180, right: -140, width: 520, height: 520, background: "rgba(177,140,224,0.1)", animationDelay: "-3.4s" }} />
      <div className="lantern-glow" style={{ top: "38%", right: "22%", width: 300, height: 300, background: "rgba(86,184,165,0.06)", animationDelay: "-5.2s" }} />

      {/* header */}
      <header className="relative z-20 flex shrink-0 items-center gap-5 border-b border-line bg-coal/85 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="plaque flex h-10 w-10 items-center justify-center rounded-xl text-ember">
            <IAnvil size={24} />
          </span>
          <div>
            <h1 className="font-display text-[19px] leading-none tracking-wide text-cream">
              IMAGE <span className="text-ember">FORGE</span>
            </h1>
            <p className="mt-1 font-mono text-[9.5px] tracking-[0.14em] text-dust uppercase">
              manifest-driven image pipeline · marketplace-assets
            </p>
          </div>
        </div>

        <nav className="ml-6 flex h-full items-end gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`tab-underline btn-press px-3.5 pb-2.5 font-display text-[13px] tracking-wide transition-colors ${
                tab === t.id ? "text-cream" : "text-dust hover:text-parch"
              }`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 font-mono text-[10px] text-ember">{t.count}</span>}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-md border border-line bg-panel/60 px-2.5 py-1 font-mono text-[10px] text-dust lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            OPENAI_IMAGE_KEY=sk-•••• env
          </span>
          <span className="hidden font-mono text-[10.5px] text-dust md:block">
            {queueLen > 0 ? `${queueLen} awaiting the hammer` : "queue clear"}
          </span>
          <button
            onClick={() => runQueue()}
            disabled={isRunning || queueLen === 0}
            className={`btn-press flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold ${
              isRunning
                ? "stripes-live text-[#241503]"
                : "bg-ember text-[#241503] shadow-[0_2px_0_#8a5a17,0_10px_24px_rgba(242,163,60,0.22)] hover:bg-[#ffb654] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
            }`}
          >
            <IPlay size={13} />
            {isRunning ? "Forging…" : `Run queue · ${queueLen}`}
          </button>
        </div>
      </header>

      {/* body */}
      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar
          rows={rows}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          styleLock={styleLock}
          isRunning={isRunning}
          onRun={() => runQueue()}
          onStop={() => {
            stopRef.current = true;
          }}
          drift={drift}
          violations={violations}
          onJumpSpec={() => setTab("spec")}
        />
        <main className="relative flex min-w-0 flex-1">
          {tab === "manifest" ? (
            <ManifestView
              rows={filtered}
              allRows={rows}
              total={rows.length}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              catFilter={catFilter}
              setCatFilter={setCatFilter}
              selectedId={selectedId}
              onSelect={setSelectedId}
              addRow={addRow}
              updateRow={patchRow}
              deleteRow={deleteRow}
              duplicateRow={duplicateRow}
              generateOne={generateOne}
              setToPending={setToPending}
              markSkipped={markSkipped}
              markImported={markImported}
              importCsv={importCsv}
              exportCsv={exportCsv}
              log={log}
              isRunning={isRunning}
              styleLock={styleLock}
              appendStyle={appendStyle}
              setAppendStyle={setAppendStyle}
            />
          ) : tab === "pipeline" ? (
            <div className="min-w-0 flex-1 overflow-y-auto">
              <PipelineView
                rows={rows}
                onExport={exportCsv}
                onRunAll={() => runQueue()}
                onRetryFailed={() => runQueue(rowsRef.current.filter((r) => r.status === "failed").map((r) => r.id))}
                onSimulateImport={simulateImport}
                onReviewFailed={reviewFailed}
                isRunning={isRunning}
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1 overflow-y-auto">
              <SpecView styleLock={styleLock} setStyleLock={setStyleLock} />
            </div>
          )}
        </main>
      </div>

      <ToastHost toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
