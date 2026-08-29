import type { ReactNode } from "react";
import type { ManifestRow } from "../types";
import { STATUS_META } from "../types";
import { Btn, IChevron, IDownload, IPlay, IRetry, IUpload, IWp, useRevealObserver, ICheck } from "./ui";

export interface PipelineViewProps {
  rows: ManifestRow[];
  onExport: () => void;
  onRunAll: () => void;
  onRetryFailed: () => void;
  onSimulateImport: () => void;
  onReviewFailed: () => void;
  isRunning: boolean;
}

type StepState = "complete" | "active" | "idle";

export default function PipelineView(p: PipelineViewProps) {
  const ref = useRevealObserver<HTMLDivElement>();
  const total = p.rows.length;
  const done = p.rows.filter((r) => r.status === "done").length;
  const imported = p.rows.filter((r) => r.status === "imported").length;
  const failed = p.rows.filter((r) => r.status === "failed").length;
  const pending = p.rows.filter((r) => r.status === "pending").length;
  const struck = done + imported;

  const steps: {
    title: string;
    desc: string;
    state: StepState;
    badge: string;
    badgeColor: string;
    action?: ReactNode;
  }[] = [
    {
      title: "Build item / shop / event data locally",
      desc: "Curate the marketplace content offline. The forge never touches this data — it only consumes the manifest you export from it.",
      state: "complete",
      badge: "source of truth",
      badgeColor: "text-dust",
    },
    {
      title: "Export image prompts to CSV",
      desc: "One marketplace-images.csv with the full schema: filename, prompt, category, ids, style, aspect, seed, status, error, generated_at, attachment id.",
      state: total > 0 ? "complete" : "idle",
      badge: `${total} rows in manifest`,
      badgeColor: total > 0 ? "text-moss" : "text-dust",
      action: (
        <Btn onClick={p.onExport}>
          <IDownload size={13} /> marketplace-images.csv
        </Btn>
      ),
    },
    {
      title: "Run the independent generator",
      desc: "The standalone script reads the CSV, skips status=done and existing files, sends each prompt to the OpenAI-compatible endpoint, saves the PNG, updates status, logs errors. Nothing else.",
      state: struck === total && total > 0 ? "complete" : struck > 0 ? "active" : "idle",
      badge: `${struck}/${total} struck`,
      badgeColor: struck === total && total > 0 ? "text-moss" : "text-ember",
      action: (
        <Btn variant="primary" onClick={p.onRunAll} disabled={p.isRunning || pending + failed === 0}>
          <IPlay size={13} /> {p.isRunning ? "running…" : `run queue · ${pending + failed}`}
        </Btn>
      ),
    },
    {
      title: "Review failed images",
      desc: "Failures stay in the CSV with the endpoint error in the error column — inspect them without losing the rest of the run.",
      state: failed === 0 && struck > 0 ? "complete" : failed > 0 ? "active" : "idle",
      badge: failed === 0 ? "no failures" : `${failed} failed`,
      badgeColor: failed === 0 ? "text-moss" : "text-blood",
      action:
        failed > 0 ? (
          <Btn onClick={p.onReviewFailed}>
            review in manifest <IChevron size={12} />
          </Btn>
        ) : undefined,
    },
    {
      title: "Re-run failed rows",
      desc: "Only rows with status=failed go back under the hammer. Completed files are never regenerated unless you ask.",
      state: failed === 0 && struck > 0 ? "complete" : "idle",
      badge: failed === 0 ? "queue clear" : `${failed} to retry`,
      badgeColor: failed === 0 ? "text-moss" : "text-dust",
      action: (
        <Btn onClick={p.onRetryFailed} disabled={p.isRunning || failed === 0}>
          <IRetry size={13} /> retry failed
        </Btn>
      ),
    },
    {
      title: "Import into WordPress Media Library",
      desc: "A separate importer uploads finished PNGs into the Media Library. This is the only step that speaks WordPress — and it happens after generation, never during.",
      state: imported === total && total > 0 ? "complete" : imported > 0 ? "active" : "idle",
      badge: `${imported} imported`,
      badgeColor: imported > 0 ? "text-lagoon" : "text-dust",
      action: (
        <Btn onClick={p.onSimulateImport} disabled={done === 0}>
          <IWp size={13} /> run WP import · {done}
        </Btn>
      ),
    },
    {
      title: "Let Imagify optimize them",
      desc: "Because the images live in the Media Library, Imagify picks them up automatically. Generated files left in a random folder would never be touched — that's why step 6 exists.",
      state: imported > 0 ? "active" : "idle",
      badge: imported > 0 ? "optimizing via Imagify" : "waits for import",
      badgeColor: imported > 0 ? "text-lagoon" : "text-dust",
    },
    {
      title: "Store attachment IDs in custom SQL",
      desc: "The importer writes each WordPress attachment_id back next to its row — the manifest becomes the bridge between the forge and your tables.",
      state: imported > 0 ? "active" : "idle",
      badge:
        imported > 0
          ? `ids: ${p.rows
              .filter((r) => r.imported_attachment_id)
              .map((r) => "#" + r.imported_attachment_id)
              .slice(0, 4)
              .join(" ")}`
          : "no ids yet",
      badgeColor: imported > 0 ? "text-lagoon" : "text-dust",
    },
    {
      title: "Frontend uses optimized image URLs",
      desc: "The marketplace renders wp-content URLs served and compressed by Imagify. Players never know a goat was ever loose.",
      state: imported > 0 ? "active" : "idle",
      badge: imported > 0 ? "live" : "awaiting pipeline",
      badgeColor: imported > 0 ? "text-moss" : "text-dust",
    },
  ];

  const sample = p.rows.find((r) => r.imported_attachment_id);

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="reveal mb-10">
        <p className="font-mono text-[11px] tracking-[0.28em] text-ember uppercase">the whole road</p>
        <h2 className="mt-2 font-display text-3xl text-cream">Nine steps, one direction</h2>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-parch">
          Generation is fully independent. WordPress, Imagify and SQL only enter the picture{" "}
          <em className="text-cream not-italic font-semibold">after</em> the forge is done — through the manifest, never
          around it.
        </p>
      </header>

      <ol className="relative space-y-3">
        <span className="absolute top-4 bottom-4 left-[21px] w-px border-l border-dashed border-line2" aria-hidden />
        {steps.map((s, i) => (
          <li key={s.title} className="reveal relative flex gap-4" style={{ transitionDelay: `${i * 40}ms` }}>
            <div
              className={`z-10 flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-xl border font-display text-[15px] ${
                s.state === "complete"
                  ? "border-moss/50 bg-moss/12 text-moss"
                  : s.state === "active"
                    ? "border-ember/60 bg-ember/12 text-ember"
                    : "border-line bg-panel text-dust"
              }`}
            >
              {s.state === "complete" ? <ICheck size={17} /> : i + 1}
            </div>
            <div
              className={`plaque flex-1 rounded-xl px-4.5 py-3.5 transition ${
                s.state === "idle" ? "opacity-75" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-display text-[15px] tracking-wide text-cream">{s.title}</h3>
                <span className={`font-mono text-[10.5px] ${s.badgeColor}`}>{s.badge}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-parch">{s.desc}</p>
              {s.action && <div className="mt-3">{s.action}</div>}
            </div>
          </li>
        ))}
      </ol>

      {sample && (
        <div className="reveal plaque mt-8 rounded-xl p-4">
          <p className="font-mono text-[10px] tracking-[0.22em] text-dust uppercase">serving path · step 9</p>
          <p className="mt-2 overflow-x-auto font-mono text-[12px] whitespace-nowrap text-lagoon">
            https://marketplace.example/wp-content/uploads/2026/02/{sample.filename}
            <span className="text-dust"> · att #{sample.imported_attachment_id} · imagify: -63%</span>
          </p>
        </div>
      )}

      <div className="reveal mt-8 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["pending", pending],
            ["failed", failed],
            ["imported", imported],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-panel/50 px-4 py-3 text-center">
            <div className="font-display text-xl" style={{ color: STATUS_META[k].hex }}>
              {v}
            </div>
            <div className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-dust uppercase">{k} right now</div>
          </div>
        ))}
      </div>

      <p className="reveal mt-10 border-t border-line pt-5 text-center font-mono text-[11px] text-dust">
        <IUpload size={11} className="mr-1 inline text-lagoon" />
        the importer is the single door between the forge and WordPress
      </p>
    </div>
  );
}
