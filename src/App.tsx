import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Category, LogEntry, ManifestRow, Status, Toast } from "./types";
import { ASPECTS, STYLES, accentHex } from "./types";
import { SEED_ROWS } from "./lib/seed";
import { downloadCsv, parseCsv, rowsFromCsv, rowsToCsv } from "./lib/csv";
import { renderPreview } from "./lib/preview";
import { styleDriftCount, violationCount } from "./lib/validate";
import {
  RateLimitError,
  bumpUsage,
  cooldownHoursFor,
  generateReal,
  normalizeSettings,
  resolveRoute,
  type ForgeSettings,
} from "./lib/providers";
import {
  buildZipBlob,
  clearDirHandle,
  dataUrlToBlob,
  downloadBlob,
  ensureSubfolders,
  fsSupported,
  loadDirHandle,
  pickOutputFolder,
  saveDirHandle,
  svgToPngBlob,
  writeImageFile,
  writeTextFile,
} from "./lib/output";
import type { Batch, BatchSetup, FactoryItem, SavedSetup } from "./lib/batches";
import { factoryToRows, loadBatches, loadSetups, saveBatches, saveSetups, uid } from "./lib/batches";
import Sidebar from "./components/Sidebar";
import ManifestView from "./components/ManifestView";
import DocsView from "./components/DocsView";
import AgentsView from "./components/AgentsView";
import SettingsView, { type SettingsSection } from "./components/SettingsView";
import WizardView from "./components/WizardView";
import PromptFactory from "./components/PromptFactory";
import { BatchLibrary, ImageLibrary, StyleLibrary, TemplateLibrary } from "./components/LibraryViews";
import WpImportModal from "./components/WpImportModal";
import ScribeDrawer from "./components/ScribeDrawer";
import TopMenu, { type View } from "./components/TopMenu";
import { CursorFX, DotField, EmberField, StarField } from "./components/effects";
import { Btn, IAnvil, IFolder, IPlay, IQuill, ToastHost, IX } from "./components/ui";
import type { FolderState } from "./components/SettingsDrawer";

const LS_KEY = "image-forge-manifest-v1";
const LS_SETTINGS = "image-forge-settings-v1";

const withPreview = (r: ManifestRow): ManifestRow =>
  r.status === "done" || r.status === "imported" ? { ...r, preview: renderPreview(r) } : { ...r, preview: undefined };

function loadInitial(): ManifestRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { rows?: ManifestRow[] };
      if (Array.isArray(parsed.rows)) {
        return parsed.rows.map((r) => (r.status === "generating" ? { ...r, status: "pending" as Status } : r)).map(withPreview);
      }
    }
  } catch {
    /* fall through to seed */
  }
  return SEED_ROWS.map(withPreview);
}

function loadSettings(): ForgeSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return normalizeSettings(JSON.parse(raw) as Partial<ForgeSettings>);
  } catch {
    /* defaults */
  }
  return normalizeSettings({});
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const nowTime = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

export default function App() {
  const [rows, setRows] = useState<ManifestRow[]>(loadInitial);
  const [view, setView] = useState<View>("workbench");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("engines");
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [styleLock, setStyleLockState] = useState("claymation");
  const [appendStyle, setAppendStyle] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [settings, setSettings] = useState<ForgeSettings>(loadSettings);
  const [scribeId, setScribeId] = useState<number | null>(null);
  const [folder, setFolder] = useState<FolderState>({ linked: false, name: "", pendingName: null, error: "" });
  const [batches, setBatches] = useState<Batch[]>(loadBatches);
  const [setups, setSetups] = useState<SavedSetup[]>(loadSetups);
  const [wpOpen, setWpOpen] = useState(false);
  const [wizardPreset, setWizardPreset] = useState<SavedSetup | null>(null);
  const [factoryItems, setFactoryItems] = useState<FactoryItem[]>([]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const stopRef = useRef(false);
  const folderRef = useRef<FileSystemDirectoryHandle | null>(null);
  const imagesRef = useRef<Map<string, Blob>>(new Map());
  const toastId = useRef(1);

  /* ---------- persistence ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ rows: rows.map(({ preview: _p, ...r }) => r), styleLock, appendStyle }));
    } catch { /* storage full — non-fatal */ }
  }, [rows, styleLock, appendStyle]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    } catch { /* non-fatal */ }
  }, [settings]);

  useEffect(() => saveBatches(batches), [batches]);
  useEffect(() => saveSetups(setups), [setups]);

  /* ---------- restore linked folder ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!fsSupported()) return;
      const h = await loadDirHandle();
      if (!h || !alive) return;
      try {
        const perm = await h.queryPermission({ mode: "readwrite" });
        if (!alive) return;
        if (perm === "granted") {
          folderRef.current = h;
          setFolder({ linked: true, name: h.name, pendingName: null, error: "" });
        } else {
          setFolder((f) => ({ ...f, pendingName: h.name }));
        }
      } catch { /* stale handle */ }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- helpers ---------- */
  const pushToast = useCallback((kind: Toast["kind"], msg: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  const pushLog = useCallback((msg: string, kind: LogEntry["kind"]) => {
    setLog((l) => [...l.slice(-90), { t: nowTime(), msg, kind }]);
  }, []);

  const patchRow = useCallback((id: number, patch: Partial<ManifestRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const patchSettings = useCallback((p: Partial<ForgeSettings>) => {
    setSettings((s) => ({ ...s, ...p }));
  }, []);

  const getBlobFor = useCallback(async (r: ManifestRow): Promise<Blob | null> => {
    const cached = imagesRef.current.get(r.filename);
    if (cached) return cached;
    if (!r.preview) return null;
    if (r.preview.startsWith("<svg") || r.preview.startsWith("data:image/svg")) {
      const dims = ASPECTS[r.aspect_ratio];
      try {
        return await svgToPngBlob(r.preview, dims.w, dims.h);
      } catch {
        return null;
      }
    }
    try {
      return dataUrlToBlob(r.preview);
    } catch {
      return null;
    }
  }, []);

  const saveToFolder = useCallback(
    async (row: ManifestRow, blob: Blob) => {
      const h = folderRef.current;
      if (!h) return;
      try {
        const path = await writeImageFile(h, row, blob);
        pushLog(`⤓ ${row.filename} → ${path}`, "ok");
      } catch {
        pushLog(`⚠ could not write ${row.filename} into the linked folder`, "err");
      }
    },
    [pushLog]
  );

  /* ---------- the strike ---------- */
  const strike = useCallback(
    async (id: number): Promise<"done" | "failed" | "parked" | "stopped" | "gone"> => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (!row) return "gone";
      const s = settingsRef.current;
      const route = resolveRoute(row, s);
      const halted = () => stopRef.current;
      const modelId = route.def?.id || row.model || "";
      const cdH = cooldownHoursFor(modelId || s.provider, s);
      const exhaust = (poolName: "geminiKeys" | "openaiKeys", keyId: string, untilMs: number) =>
        setSettings((prev) => ({
          ...prev,
          [poolName]: prev[poolName].map((k) => (k.id === keyId ? { ...k, exhaustedUntil: untilMs } : k)),
        }));

      patchRow(id, { status: "generating", error: "" });
      pushLog(`→ ${row.filename} via ${route.engine} · ${route.apiModel} · ${row.aspect_ratio}`, "run");

      if (route.engine === "simulated") {
        await sleep(900 + Math.random() * 1100);
        if (halted()) {
          setRows((prev) => prev.map((r) => (r.id === id && r.status === "generating" ? { ...r, status: "pending" } : r)));
          return "stopped";
        }
        const failChance = row.error ? 0.12 : 0.18;
        if (Math.random() < failChance) {
          patchRow(id, { status: "failed", error: "429 rate_limited — the demo endpoint said enough for now", preview: undefined });
          pushLog(`✗ ${row.filename} failed (simulated rate limit)`, "err");
          return "failed";
        }
        const preview = renderPreview({ ...row, status: "done" });
        patchRow(id, { status: "done", generated_at: new Date().toISOString(), preview, error: "" });
        pushLog(`✓ ${row.filename} struck`, "ok");
        if (folderRef.current) {
          try {
            const dims = ASPECTS[row.aspect_ratio];
            const png = await svgToPngBlob(preview, dims.w, dims.h);
            imagesRef.current.set(row.filename, png);
            await saveToFolder(row, png);
          } catch {
            pushLog(`⚠ ${row.filename}: folder write skipped`, "err");
          }
        }
        return "done";
      }

      const prompt = appendStyle && !row.prompt.includes(STYLES.find((x) => x.id === row.style)?.block ?? "")
        ? `${row.prompt}, ${STYLES.find((x) => x.id === row.style)?.block ?? row.style}`
        : row.prompt;

      try {
        const { blob, dataUrl } = await generateReal({ ...row, prompt }, s, undefined, exhaust, cdH * 3600e3);
        if (halted()) {
          setRows((prev) => prev.map((r) => (r.id === id && r.status === "generating" ? { ...r, status: "pending" } : r)));
          pushLog(`· ${row.filename} halted mid-strike`, "info");
          return "stopped";
        }
        imagesRef.current.set(row.filename, blob);
        patchRow(id, { status: "done", generated_at: new Date().toISOString(), preview: dataUrl, error: "" });
        pushLog(`✓ ${row.filename} struck · ${(blob.size / 1024).toFixed(0)} KB via ${route.engine}`, "ok");
        setSettings((prev) => ({ ...prev, usage: bumpUsage(prev.usage, modelId || s.provider) }));
        await saveToFolder(row, blob);
        return "done";
      } catch (e) {
        if (halted() || (e as { name?: string })?.name === "AbortError") {
          setRows((prev) => prev.map((r) => (r.id === id && r.status === "generating" ? { ...r, status: "pending" } : r)));
          return "stopped";
        }
        if (e instanceof RateLimitError) {
          const retryAt = Date.now() + cdH * 3600e3;
          patchRow(id, {
            status: "failed",
            error: `429 — every ${route.engine} key is resting · auto-retry in ${cdH}h`,
            retry_at: new Date(retryAt).toISOString(),
            preview: undefined,
          });
          pushLog(`⏸ ${row.filename} parked — retry in ${cdH}h (you choose this in Settings → Image engines)`, "err");
          return "parked";
        }
        const msg = (e as { message?: string })?.message ?? "request failed";
        patchRow(id, { status: "failed", error: msg.slice(0, 160), preview: undefined });
        pushLog(`✗ ${row.filename} — ${msg}`, "err");
        return "failed";
      }
    },
    [appendStyle, patchRow, pushLog, saveToFolder]
  );

  const runQueue = useCallback(
    async (targets?: number[]) => {
      if (isRunning) return;
      const ids = targets ?? rowsRef.current.filter((r) => r.status === "pending" || r.status === "failed").map((r) => r.id);
      if (ids.length === 0) return;
      stopRef.current = false;
      setIsRunning(true);
      pushLog(`── forge lit · ${ids.length} row${ids.length > 1 ? "s" : ""} in the queue ──`, "info");
      let done = 0;
      let failed = 0;
      for (const id of ids) {
        if (stopRef.current) break;
        const row = rowsRef.current.find((r) => r.id === id);
        if (!row) continue;
        if (!targets && row.retry_at && Date.parse(row.retry_at) > Date.now()) {
          pushLog(`· ${row.filename} cooling — retries ${new Date(row.retry_at).toLocaleString("en-GB")}`, "info");
          continue;
        }
        const res = await strike(id);
        if (res === "done") done++;
        else if (res === "failed" || res === "parked") failed++;
        else if (res === "stopped") break;
      }
      setIsRunning(false);
      const halted = stopRef.current;
      pushLog(`── run ${halted ? "halted" : "complete"} · ${done} struck · ${failed} failed ──`, failed > 0 ? "err" : "ok");
      if (!halted && folderRef.current && settingsRef.current.writeCsvOnSync) {
        try {
          await writeTextFile(folderRef.current, "marketplace-images.csv", rowsToCsv(rowsRef.current));
          pushLog(`⤓ marketplace-images.csv refreshed in ${folderRef.current.name}`, "ok");
        } catch { /* non-fatal */ }
      }
      pushToast(
        failed > 0 ? "err" : "ok",
        halted
          ? `Forge halted — ${done} struck before the halt.`
          : failed > 0
            ? `Run finished: ${done} struck, ${failed} need another look.`
            : `Run finished: ${done} image${done === 1 ? "" : "s"} struck.`
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
      model: "",
      status: "pending",
      error: "",
      generated_at: "",
      imported_attachment_id: "",
    };
    setRows((prev) => [...prev, row]);
    setSelectedId(row.id);
    setView("workbench");
    pushLog(`+ row #${row.id} added to the manifest`, "info");
  }, [styleLock, pushLog]);

  const deleteRow = useCallback(
    (id: number) => {
      const r = rowsRef.current.find((x) => x.id === id);
      setRows((prev) => prev.filter((x) => x.id !== id));
      setSelectedId((s) => (s === id ? null : s));
      pushToast("info", `${r?.filename ?? "Row"} removed from the manifest.`);
    },
    [pushToast]
  );

  const duplicateRow = useCallback((id: number) => {
    const src = rowsRef.current.find((x) => x.id === id);
    if (!src) return;
    const maxId = rowsRef.current.reduce((m, r) => Math.max(m, r.id), 0);
    setRows((prev) => [
      ...prev,
      { ...src, id: maxId + 1, filename: src.filename.replace(/\.png$/, "_copy.png"), status: "pending", generated_at: "", imported_attachment_id: "", error: "", preview: undefined },
    ]);
  }, []);

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

  const forceRetry = useCallback(
    (id: number) => {
      patchRow(id, { retry_at: "", status: "pending", error: "" });
      pushToast("info", "Cooldown cleared — that row will strike at once.");
      runQueue([id]);
    },
    [patchRow, pushToast, runQueue]
  );

  const markSkipped = useCallback((id: number) => patchRow(id, { status: "skipped", error: "" }), [patchRow]);
  const setToPending = useCallback((id: number) => patchRow(id, { status: "pending", error: "", retry_at: "" }), [patchRow]);

  const markImported = useCallback(
    (id: number) => {
      const att = String(8200 + id * 13 + Math.floor(Math.random() * 9));
      patchRow(id, { status: "imported", imported_attachment_id: att });
      pushToast("ok", `Marked imported — attachment #${att} stored.`);
    },
    [patchRow, pushToast]
  );

  const exportCsv = useCallback(() => {
    downloadCsv("marketplace-images.csv", rowsToCsv(rowsRef.current));
    pushToast("ok", "marketplace-images.csv exported with the full schema.");
  }, [pushToast]);

  const importCsv = useCallback(
    (text: string, mode: "merge" | "replace", forgeAfter: boolean) => {
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
        if (forgeAfter) setTimeout(() => runQueue(imported.map((r) => r.id)), 150);
      } catch {
        pushToast("err", "Could not parse that CSV — is it comma-separated with a header?");
      }
    },
    [pushLog, pushToast, runQueue]
  );

  const setStyleLock = useCallback(
    (s: string) => {
      setStyleLockState(s);
      const name = STYLES.find((x) => x.id === s)?.name ?? settingsRef.current.customStyles.find((x) => x.id === s)?.name ?? s;
      pushToast("info", `Visual language locked to “${name}”.`);
    },
    [pushToast]
  );

  /* ---------- output ---------- */
  const linkFolder = useCallback(async () => {
    if (!fsSupported()) {
      setFolder((f) => ({ ...f, error: "This browser can't link folders (needs Chrome or Edge). The ZIP door always works." }));
      pushToast("err", "Folder linking needs Chrome or Edge — use the ZIP instead.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setFolder((f) => ({ ...f, error: "The page must run on https (or localhost) for folder access." }));
      return;
    }
    try {
      const h = await pickOutputFolder();
      folderRef.current = h;
      await saveDirHandle(h);
      const { found, created } = await ensureSubfolders(h);
      setFolder({ linked: true, name: h.name, pendingName: null, error: "" });
      pushLog(`⤓ output folder linked: ${h.name} · found [${found.join(", ")}]${created.length ? ` · created [${created.join(", ")}]` : ""}`, "ok");
      pushToast("ok", created.length ? `Linked ${h.name} — created ${created.join(", ")}.` : `Linked ${h.name} — subfolders ready.`);
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") return;
      const msg =
        err?.name === "SecurityError"
          ? "The browser blocked folder access here (sandboxed preview). Open the app in a normal Chrome/Edge tab, or use the ZIP."
          : `Couldn't link that folder (${err?.message ?? "unknown reason"}).`;
      setFolder((f) => ({ ...f, error: msg }));
      pushToast("err", msg);
    }
  }, [pushLog, pushToast]);

  const unlinkFolder = useCallback(async () => {
    folderRef.current = null;
    await clearDirHandle();
    setFolder({ linked: false, name: "", pendingName: null, error: "" });
    pushToast("info", "Output folder unlinked.");
  }, [pushToast]);

  const syncAllToFolder = useCallback(async () => {
    const h = folderRef.current;
    if (!h) {
      pushToast("err", "Link an output folder first — Settings → Folders.");
      return;
    }
    const targets = rowsRef.current.filter((r) => r.status === "done" || r.status === "imported");
    if (targets.length === 0) {
      pushToast("info", "No finished plates to sync yet.");
      return;
    }
    let ok = 0;
    for (const r of targets) {
      const b = await getBlobFor(r);
      if (!b) continue;
      try {
        await writeImageFile(h, r, b);
        ok++;
      } catch { /* counted */ }
    }
    pushLog(`⤓ folder sync complete · ${ok}/${targets.length} plates written into ${h.name}`, "ok");
    pushToast("ok", `${ok} plate${ok === 1 ? "" : "s"} written to ${h.name}.`);
  }, [getBlobFor, pushLog, pushToast]);

  const zipAll = useCallback(async () => {
    const targets = rowsRef.current.filter((r) => r.status === "done" || r.status === "imported");
    if (targets.length === 0) {
      pushToast("info", "No finished plates yet — generate a row first.");
      return;
    }
    try {
      const { blob, count } = await buildZipBlob(rowsRef.current, getBlobFor, rowsToCsv(rowsRef.current));
      downloadBlob("marketplace-images.zip", blob);
      pushToast("ok", `ZIP ready — ${count} plate${count === 1 ? "" : "s"} in shops/items/events/npcs plus the CSV.`);
    } catch {
      pushToast("err", "ZIP packing failed.");
    }
  }, [getBlobFor, pushToast]);

  const downloadRow = useCallback(
    async (id: number) => {
      const r = rowsRef.current.find((x) => x.id === id);
      if (!r || !r.preview) {
        pushToast("info", "That row has no plate yet — generate it first.");
        return;
      }
      const b = await getBlobFor(r);
      if (!b) return;
      downloadBlob(r.filename, b);
    },
    [getBlobFor, pushToast]
  );

  /* ---------- batches, wizard, factory ---------- */
  const startBatch = useCallback(
    (setup: BatchSetup, items: FactoryItem[], saveTemplateAs: string | null) => {
      const startId = rowsRef.current.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      const newRows = factoryToRows(items, {
        styleId: setup.styleId,
        kind: setup.kind,
        model: setup.model,
        aspect: setup.aspect,
        defaultNegative: setup.defaultNegative,
        startId,
      });
      if (newRows.length === 0) return;
      setRows((prev) => [...prev, ...newRows]);
      const batch: Batch = {
        id: uid(),
        name: setup.name.trim() || "Unnamed batch",
        createdAt: new Date().toISOString(),
        setupName: saveTemplateAs ?? undefined,
        rowIds: newRows.map((r) => r.id),
      };
      setBatches((b) => [batch, ...b]);
      if (saveTemplateAs) {
        setSetups((s) => [{ id: uid(), name: saveTemplateAs, createdAt: new Date().toISOString(), data: setup }, ...s]);
        pushToast("ok", `Recipe “${saveTemplateAs}” saved to the template library.`);
      }
      setStyleLockState(setup.styleId);
      setBatchFilter(batch.id);
      setView("workbench");
      pushLog(`✦ batch “${batch.name}” arranged · ${newRows.length} pictures`, "ok");
      pushToast("ok", `Batch ready — ${newRows.length} picture ideas on the workbench.`);
      if (setup.linkFolder && !folderRef.current) void linkFolder();
      if (setup.runAfter) setTimeout(() => runQueue(newRows.map((r) => r.id)), 250);
    },
    [linkFolder, pushLog, pushToast, runQueue]
  );

  const rerunMarked = useCallback(
    (ids: number[]) => {
      const targets = rowsRef.current.filter((r) => ids.includes(r.id));
      if (targets.length === 0) return;
      setRows((prev) =>
        prev.map((r) => {
          if (!ids.includes(r.id)) return r;
          const note = (r.note ?? "").trim();
          return {
            ...r,
            status: "pending" as Status,
            retry_at: "",
            error: "",
            note: "",
            prompt: note ? `${r.prompt}, fix: ${note}` : r.prompt,
          };
        })
      );
      setView("workbench");
      pushLog(
        `↻ ${targets.length} picture${targets.length > 1 ? "s" : ""} sent back to the forge${
          targets.some((t) => (t.note ?? "").trim()) ? " — notes became instructions" : ""
        }`,
        "info"
      );
      setTimeout(() => runQueue(ids), 200);
    },
    [pushLog, runQueue]
  );

  const nav = useCallback((v: View, section?: SettingsSection) => {
    setView(v);
    if (section) setSettingsSection(section);
    if (v === "wizard") setWizardPreset(null);
  }, []);

  /* ---------- derived ---------- */
  const batchRows = useMemo(
    () => (batchFilter ? rows.filter((r) => batches.find((b) => b.id === batchFilter)?.rowIds.includes(r.id)) : rows),
    [rows, batches, batchFilter]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batchRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (q && !r.filename.toLowerCase().includes(q) && !r.prompt.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [batchRows, statusFilter, catFilter, search]);

  const drift = useMemo(() => styleDriftCount(rows, styleLock), [rows, styleLock]);
  const violations = useMemo(() => violationCount(rows), [rows]);
  const queueLen = rows.filter((r) => r.status === "pending" || r.status === "failed").length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const finishedCount = doneCount + rows.filter((r) => r.status === "imported").length;
  const markedCount = rows.filter((r) => r.status === "failed" || ((r.note ?? "").trim() !== "" && (r.status === "done" || r.status === "imported"))).length;
  const coolingCount = rows.filter((r) => r.retry_at && Date.parse(r.retry_at) > Date.now()).length;

  const scribeRow = scribeId !== null ? (rows.find((r) => r.id === scribeId) ?? null) : null;
  const activeBatch = batchFilter ? batches.find((b) => b.id === batchFilter) : null;
  const styleBlock = STYLES.find((s) => s.id === styleLock)?.block ?? settings.customStyles.find((s) => s.id === styleLock)?.block ?? "";
  const accent = accentHex(settings.ambient.accent);

  return (
    <div
      className="grain relative flex h-screen flex-col overflow-hidden bg-ink"
      data-glow={settings.ambient.glow}
      style={
        {
          "--color-ember": accent,
          "--fg-glow": `${accent}8c`,
          "--fg-glow-idle": `${accent}29`,
        } as CSSProperties
      }
    >
      {settings.ambient.background === "dots" && (
        <DotField
          className="absolute inset-0 z-0"
          dotSpacing={Math.round(46 - settings.ambient.density * 0.24)}
          dotRadius={1.25}
          cursorRadius={300}
          bulgeStrength={34}
          glowRadius={230}
          sparkle={settings.ambient.sparkle}
          waveAmplitude={settings.ambient.wave ? 2.2 : 0}
          gradientFrom="rgba(205,188,159,0.20)"
          gradientTo={`${accent}26`}
          glowColor={`${accent}14`}
        />
      )}
      {settings.ambient.background === "embers" && (
        <EmberField className="absolute inset-0 z-0" density={settings.ambient.density} color={accent} />
      )}
      {settings.ambient.background === "stars" && <StarField className="absolute inset-0 z-0" density={settings.ambient.density + 40} />}
      <CursorFX mode={settings.ambient.cursor} size={settings.ambient.cursorSize} color={accent} />
      {settings.ambient.background !== "none" && (
        <>
          <div className="lantern-glow" style={{ top: -140, left: -120, width: 460, height: 460, background: "rgba(242,163,60,0.16)" }} />
          <div className="lantern-glow" style={{ bottom: -180, right: -140, width: 520, height: 520, background: "rgba(177,140,224,0.1)", animationDelay: "-3.4s" }} />
          <div className="lantern-glow" style={{ top: "38%", right: "22%", width: 300, height: 300, background: "rgba(86,184,165,0.06)", animationDelay: "-5.2s" }} />
        </>
      )}

      {/* header */}
      <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-coal/85 px-5 py-3 backdrop-blur">
        <button onClick={() => nav("workbench")} className="btn-press flex items-center gap-3 text-left">
          <span className="plaque flex h-10 w-10 items-center justify-center rounded-xl text-ember">
            <IAnvil size={24} />
          </span>
          <span>
            <span className="block font-display text-[19px] leading-none tracking-wide text-cream">
              IMAGE <span className="text-ember">FORGE</span>
            </span>
            <span className="mt-1 block font-mono text-[9.5px] tracking-[0.14em] text-dust uppercase">image pipeline</span>
          </span>
        </button>

        <TopMenu
          view={view}
          onNav={nav}
          provider={settings.provider}
          onProvider={(p) => patchSettings({ provider: p })}
          settings={settings}
          markedCount={markedCount}
          templateCount={setups.length}
          batchCount={batches.length}
          doneCount={doneCount}
          onRerunMarked={() => {
            const ids = rows
              .filter((r) => r.status === "failed" || ((r.note ?? "").trim() !== "" && (r.status === "done" || r.status === "imported")))
              .map((r) => r.id);
            if (ids.length === 0) {
              pushToast("info", "Nothing marked and nothing failed — the wall is clean.");
              return;
            }
            rerunMarked(ids);
          }}
          onWpImport={() => setWpOpen(true)}
          onZip={zipAll}
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setScribeId(selectedId ?? rows[0]?.id ?? null)}
            title="Summon the Scribe — AI prompt & filename writer"
            className="btn-press flex items-center gap-1.5 rounded-lg border border-line bg-panel/70 px-2.5 py-2 text-parch hover:border-potion/50 hover:text-potion"
          >
            <IQuill size={14} />
            <span className="hidden font-mono text-[10px] tracking-wide uppercase lg:inline">scribe</span>
          </button>
          <button
            onClick={() => (folder.linked ? syncAllToFolder() : linkFolder())}
            title={folder.linked ? `Sync all plates to ${folder.name}` : "Link an output folder"}
            className={`btn-press flex items-center gap-1.5 rounded-lg border px-2.5 py-2 ${
              folder.linked ? "border-moss/50 bg-moss/10 text-moss hover:bg-moss/20" : "border-line bg-panel/70 text-parch hover:border-line2"
            }`}
          >
            <IFolder size={14} />
            <span className="hidden max-w-[110px] truncate font-mono text-[10px] md:inline">
              {folder.linked ? folder.name : folder.pendingName ? `re-link ${folder.pendingName}` : "link folder"}
            </span>
          </button>
          <span className="hidden font-mono text-[10.5px] text-dust xl:block">
            {queueLen > 0 ? `${queueLen} awaiting the hammer` : coolingCount > 0 ? `${coolingCount} cooling` : "queue clear"}
          </span>
          <button
            onClick={() => runQueue()}
            disabled={isRunning || queueLen === 0}
            className={`btn-press flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold ${
              isRunning
                ? "stripes-live text-[#241503]"
                : `bg-ember text-[#241503] hover:bg-[#ffb654] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none ${queueLen > 0 ? "breathe" : ""}`
            }`}
          >
            <IPlay size={13} />
            {isRunning ? "Forging…" : `Run queue · ${queueLen}`}
          </button>
        </div>
      </header>

      {/* body */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {view === "workbench" ? (
          <>
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
              onJumpSpec={() => nav("settings", "filenames")}
            />
            <main className="relative flex min-w-0 flex-1 flex-col">
              {activeBatch && (
                <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-panel/60 px-5 py-2">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-dust uppercase">showing batch</span>
                  <span className="rounded-md border border-ember/40 bg-ember/10 px-2 py-0.5 font-mono text-[11px] text-ember">{activeBatch.name}</span>
                  <span className="font-mono text-[10px] text-dust">{activeBatch.rowIds.length} pictures</span>
                  <button onClick={() => setBatchFilter(null)} className="btn-press ml-auto flex items-center gap-1 font-mono text-[10px] text-dust hover:text-cream">
                    <IX size={10} /> show everything
                  </button>
                </div>
              )}
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
                openScribe={setScribeId}
                startWizard={() => nav("wizard")}
                addRow={addRow}
                updateRow={patchRow}
                deleteRow={deleteRow}
                duplicateRow={duplicateRow}
                generateOne={generateOne}
                forceRetry={forceRetry}
                setToPending={setToPending}
                markSkipped={markSkipped}
                markImported={markImported}
                downloadRow={downloadRow}
                importCsv={importCsv}
                exportCsv={exportCsv}
                log={log}
                isRunning={isRunning}
                styleLock={styleLock}
                appendStyle={appendStyle}
                setAppendStyle={setAppendStyle}
              />
            </main>
          </>
        ) : view === "wizard" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <WizardView
              key={wizardPreset?.id ?? "fresh"}
              preset={wizardPreset}
              setups={setups}
              settings={settings}
              patchSettings={patchSettings}
              folder={folder}
              onLinkFolder={linkFolder}
              onFinish={startBatch}
              onExit={() => nav("workbench")}
              pushToast={pushToast}
            />
          </main>
        ) : view === "factory" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <PromptFactory
              settings={settings}
              styleId={styleLock}
              styleBlock={styleBlock}
              items={factoryItems}
              setItems={setFactoryItems}
              pushToast={pushToast}
            />
            {factoryItems.filter((i) => i.filename.trim() && i.prompt.trim()).length > 0 && (
              <div className="sticky bottom-0 border-t border-line bg-coal/90 px-6 py-3 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-dust">
                    {factoryItems.filter((i) => i.filename.trim() && i.prompt.trim()).length} pictures ready · style “{styleLock}” will be appended
                  </p>
                  <Btn
                    variant="moss"
                    onClick={() => {
                      const ready = factoryItems.map((i) => ({
                        ...i,
                        prompt: styleBlock && appendStyle && !i.prompt.endsWith(styleBlock) ? `${i.prompt}, ${styleBlock}` : i.prompt,
                      }));
                      startBatch(
                        {
                          name: `Factory batch ${new Date().toLocaleDateString("en-GB")}`,
                          kind: "none",
                          styleId: styleLock,
                          model: "",
                          aspect: "per-category",
                          linkFolder: folder.linked,
                          runAfter: false,
                          defaultNegative: "",
                        },
                        ready,
                        null
                      );
                      setFactoryItems([]);
                    }}
                  >
                    <IPlay size={13} /> Arrange on the workbench
                  </Btn>
                </div>
              </div>
            )}
          </main>
        ) : view === "lib-images" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <ImageLibrary rows={rows} batches={batches} updateRow={patchRow} onRedo={rerunMarked} />
          </main>
        ) : view === "lib-styles" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
              <StyleLibrary settings={settings} patchSettings={patchSettings} styleLock={styleLock} setStyleLock={setStyleLock} pushToast={pushToast} />          </main>
        ) : view === "lib-templates" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <TemplateLibrary
              setups={setups}
              onDelete={(id) => setSetups((s) => s.filter((x) => x.id !== id))}
              onUse={(t) => {
                setWizardPreset(t);
                setView("wizard");
              }}
            />
          </main>
        ) : view === "lib-batches" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <BatchLibrary
              batches={batches}
              rows={rows}
              onOpen={(id) => {
                setBatchFilter(id);
                setView("workbench");
              }}
              onRerun={(id) => {
                const b = batches.find((x) => x.id === id);
                if (!b) return;
                const ids = rowsRef.current.filter((r) => b.rowIds.includes(r.id) && (r.status === "pending" || r.status === "failed")).map((r) => r.id);
                if (ids.length === 0) {
                  pushToast("info", "Nothing left to rerun in that batch.");
                  return;
                }
                rerunMarked(ids);
              }}
              onDelete={(id) => setBatches((b) => b.filter((x) => x.id !== id))}
            />
          </main>
        ) : view === "settings" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <SettingsView
              section={settingsSection}
              onSection={setSettingsSection}
              settings={settings}
              patchSettings={patchSettings}
              folder={folder}
              onLinkFolder={linkFolder}
              onUnlinkFolder={unlinkFolder}
              onSyncAll={syncAllToFolder}
              onGoStyles={() => nav("lib-styles")}
              pushToast={pushToast}
            />
          </main>
        ) : view === "docs" ? (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <DocsView
              rows={rows}
              settings={settings}
              folderLinked={folder.linked}
              folderName={folder.name}
              onLinkFolder={linkFolder}
              onZip={zipAll}
              onOpenSettings={() => nav("settings", "engines")}
            />
          </main>
        ) : (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <AgentsView />
          </main>
        )}
      </div>

      {scribeRow && (
        <ScribeDrawer
          row={scribeRow}
          settings={settings}
          styleLock={styleLock}
          onClose={() => setScribeId(null)}
          onPatch={(patch) => patchRow(scribeRow.id, patch)}
          pushToast={pushToast}
        />
      )}

      <WpImportModal
        open={wpOpen}
        onClose={() => setWpOpen(false)}
        settings={settings}
        patchSettings={patchSettings}
        rows={rows}
        batches={batches}
        getBlob={getBlobFor}
        patchRow={patchRow}
        pushToast={pushToast}
      />

      <ToastHost toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
