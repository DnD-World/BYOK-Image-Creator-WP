import type { Category, ManifestRow, Status } from "../types";
import { CATEGORIES, CATEGORY_META, STATUSES, STATUS_META } from "../types";
import { BorderGlow } from "./effects";
import { Btn, CAT_ICON, IAlert, ICheck, IHammer, IPlay, IX } from "./ui";
import { CountUp, type MotionLevel } from "./motion";

export interface SidebarProps {
  rows: ManifestRow[];
  statusFilter: Status | "all";
  setStatusFilter: (s: Status | "all") => void;
  catFilter: Category | "all";
  setCatFilter: (c: Category | "all") => void;
  styleLock: string;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  drift: number;
  violations: number;
  onJumpSpec: () => void;
  motion: MotionLevel;
}

export default function Sidebar(p: SidebarProps) {
  const total = p.rows.length || 1;
  const counts = STATUSES.map((s) => ({ s, n: p.rows.filter((r) => r.status === s).length }));
  const pending = p.rows.filter((r) => r.status === "pending").length;
  const failed = p.rows.filter((r) => r.status === "failed").length;
  const generating = p.rows.filter((r) => r.status === "generating").length;
  const finished = p.rows.filter((r) => r.status === "done" || r.status === "imported").length;
  const queueLen = pending + failed;

  return (
    <aside className="flex h-full w-[256px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-coal/70 p-4">
      <section>
        <h3 className="mb-2.5 font-mono text-[10px] tracking-[0.22em] text-dust uppercase">Manifest pulse</h3>
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-line bg-[#191310]">
          {counts
            .filter((c) => c.n > 0)
            .map((c) => (
              <div
                key={c.s}
                title={`${c.s}: ${c.n}`}
                className="h-full transition-all duration-700 ease-out"
                style={{ width: `${(c.n / total) * 100}%`, background: STATUS_META[c.s].hex }}
              />
            ))}
        </div>
        <ul className="mt-3 space-y-0.5">
          {counts.map(({ s, n }) => (
            <li key={s}>
              <button
                onClick={() => p.setStatusFilter(p.statusFilter === s ? "all" : s)}
                className={`btn-press flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition ${
                  p.statusFilter === s ? "bg-raise text-cream" : "text-parch hover:bg-raise/50 hover:text-cream"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot} ${s === "generating" && n > 0 ? "pulse-dot" : ""}`} />
                <span className="flex-1 font-mono text-[12px]">{s}</span>
                <span className={`font-mono text-[12px] tabular-nums ${n > 0 ? "text-cream" : "text-dust/60"}`}>
                  <CountUp value={n} level={p.motion} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2.5 font-mono text-[10px] tracking-[0.22em] text-dust uppercase">Categories</h3>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => {
            const n = p.rows.filter((r) => r.category === c).length;
            const Ic = CAT_ICON[c];
            const active = p.catFilter === c;
            return (
              <button
                key={c}
                onClick={() => p.setCatFilter(active ? "all" : c)}
                className={`btn-press flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] transition ${
                  active ? "border-ember/60 bg-ember/10 text-cream" : "border-line bg-panel2/50 text-parch hover:border-line2 hover:text-cream"
                }`}
              >
                <span style={{ color: CATEGORY_META[c].hex }}>
                  <Ic size={14} />
                </span>
                <span className="flex-1 text-left font-mono">{c}</span>
                <span className="font-mono tabular-nums text-dust">{n}</span>
              </button>
            );
          })}
        </div>
      </section>

      <BorderGlow radius={12} glow={p.isRunning ? "rgba(242,163,60,0.6)" : "rgba(242,163,60,0.4)"} idle="#3e2f21" innerClassName="bg-[#241b14]">
        <div className="p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">Generation queue</h3>
            <IHammer size={15} className={`text-ember ${p.isRunning ? "hammer-swing" : ""}`} />
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "queued", v: pending, cls: "text-parch" },
              { label: "failed", v: failed, cls: failed > 0 ? "text-blood" : "text-dust" },
              { label: "struck", v: `${finished}/${p.rows.length}`, cls: "text-moss" },
            ].map((x) => (
              <div key={x.label} className="rounded-lg bg-[#191310] px-1 py-2">
                <div className={`font-display text-base leading-none ${x.cls}`}>{x.v}</div>
                <div className="mt-1 font-mono text-[9px] tracking-widest text-dust uppercase">{x.label}</div>
              </div>
            ))}
          </div>
          {p.isRunning ? (
            <div>
              <div className="stripes-live mb-2 h-2.5 rounded-full" />
              <button
                onClick={p.onStop}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-lg border border-blood/40 bg-blood/10 py-2 text-[13px] font-semibold text-blood hover:bg-blood/20"
              >
                <IX size={13} /> Halt the forge
              </button>
              <p className="mt-2 text-center font-mono text-[10px] text-dust">
                {generating > 0 ? "hammering the current row…" : "winding up…"}
              </p>
            </div>
          ) : (
            <div>
              <button
                onClick={p.onRun}
                disabled={queueLen === 0}
                className={`btn-press flex w-full items-center justify-center gap-2 rounded-lg bg-ember py-2 text-[13px] font-semibold text-[#241503] shadow-[0_2px_0_#8a5a17,0_10px_24px_rgba(242,163,60,0.2)] hover:bg-[#ffb654] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none ${
                  queueLen > 0 ? "breathe" : ""
                }`}
              >
                <IPlay size={13} /> Run queue · {queueLen}
              </button>
              <p className="mt-2 text-center font-mono text-[10px] text-dust">pending + failed rows</p>
            </div>
          )}
        </div>
      </BorderGlow>

      <section className="rounded-xl border border-line bg-panel/60 p-3.5">
        <h3 className="mb-2.5 font-mono text-[10px] tracking-[0.22em] text-dust uppercase">Consistency</h3>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            {p.drift === 0 ? <ICheck size={14} className="mt-0.5 shrink-0 text-moss" /> : <IAlert size={14} className="mt-0.5 shrink-0 text-ember" />}
            <p className="flex-1 text-[12px] leading-snug text-parch">
              {p.drift === 0 ? (
                <>One visual language: <span className="font-mono text-moss">{p.styleLock}</span></>
              ) : (
                <><span className="font-semibold text-ember">{p.drift} row{p.drift > 1 ? "s" : ""}</span> drift from “{p.styleLock}”</>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            {p.violations === 0 ? <ICheck size={14} className="mt-0.5 shrink-0 text-moss" /> : <IAlert size={14} className="mt-0.5 shrink-0 text-blood" />}
            <p className="flex-1 text-[12px] leading-snug text-parch">
              {p.violations === 0 ? "All filenames pass the seven rules" : <><span className="font-semibold text-blood">{p.violations} filename{p.violations > 1 ? "s" : ""}</span> break the rules</>}
            </p>
          </div>
          {(p.drift > 0 || p.violations > 0) && (
            <Btn variant="subtle" className="w-full justify-center" onClick={p.onJumpSpec}>
              open rules &amp; fixes →
            </Btn>
          )}
        </div>
      </section>

      <p className="mt-auto px-1 font-mono text-[10px] leading-relaxed text-dust/70">
        standalone by design —<br />no WordPress, no SQL needed
      </p>
    </aside>
  );
}
