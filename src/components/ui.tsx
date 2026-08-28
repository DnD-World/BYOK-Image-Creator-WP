import React, { useEffect, useRef, useState } from "react";
import type { Category, Status, Toast } from "../types";
import { CATEGORY_META, STATUS_META } from "../types";

/* ---------------- icons (hand-drawn strokes) ---------------- */

const S = ({
  children,
  size = 16,
  className = "",
  strokeWidth = 2,
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IAnvil = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path
      d="M4 9h24c0 5-4.6 7.5-9.5 7.5H17v5h4.5v4h-11v-4H15v-5h-1.5C8.6 16.5 4 14 4 9Z"
      fill="currentColor"
    />
    <rect x="10" y="27" width="12" height="2.4" rx="1.2" fill="currentColor" opacity="0.55" />
  </svg>
);

export const IStore = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M3.5 9 5 4h14l1.5 5" />
    <path d="M3.5 9c0 1.5 1.2 2.8 2.8 2.8S9 10.5 9 9c0 1.5 1.3 2.8 3 2.8s3-1.3 3-2.8c0 1.5 1.2 2.8 2.7 2.8s2.8-1.3 2.8-2.8" />
    <path d="M5 12v8h14v-8" />
    <path d="M9.5 20v-5h5v5" />
  </S>
);
export const ISword = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M14.5 3.5 20.5 9.5 8 22l-4-4L16.5 5.5Z" transform="rotate(45 12 12) scale(0.92)" opacity="0" />
    <path d="m19 5-9.5 9.5" />
    <path d="M20 4l-1.5 4L7 19.5 4.5 17 16 5.5 20 4Z" />
    <path d="m5.5 14.5 4 4" />
    <path d="m4 20 1.5-1.5" />
  </S>
);
export const IFlag = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M5 21V4" />
    <path d="M5 4c3-1.8 6 1.8 9 0v9c-3 1.8-6-1.8-9 0" />
  </S>
);
export const IHood = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M12 3c-4 0-6.5 3.4-6.5 7.5V14L4 21h16l-1.5-7v-3.5C18.5 6.4 16 3 12 3Z" />
    <path d="M9 12h.01M15 12h.01" strokeWidth={2.6} />
  </S>
);
export const IPlay = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M7 4.8v14.4L19 12 7 4.8Z" fill="currentColor" stroke="none" />
  </S>
);
export const IRetry = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M20 8a8.2 8.2 0 1 0 1.7 6" />
    <path d="M21.5 3.5V8H17" />
  </S>
);
export const ISkip = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M5 5.5v13L14 12 5 5.5Z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </S>
);
export const IDownload = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M12 3v11" />
    <path d="m7.5 10 4.5 4.5L16.5 10" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </S>
);
export const IUpload = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M12 14V3" />
    <path d="M7.5 7 12 2.8 16.5 7" />
    <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </S>
);
export const IPlus = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const ITrash = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M4.5 6.5h15" />
    <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
    <path d="m6.5 6.5.8 12A2 2 0 0 0 9.3 20.5h5.4a2 2 0 0 0 2-1.9l.8-12.1" />
    <path d="M10 10.5v6M14 10.5v6" />
  </S>
);
export const ICopy = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </S>
);
export const ICheck = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </S>
);
export const IX = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </S>
);
export const IAlert = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M12 3.5 2.5 20h19L12 3.5Z" />
    <path d="M12 10v4.5M12 17.5v.01" strokeWidth={2.4} />
  </S>
);
export const ISearch = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </S>
);
export const IHammer = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M13.5 6 18 10.5" />
    <path d="M11 3.5 15 2l6 6-1.5 4L13 8.5 11 3.5Z" fill="currentColor" stroke="none" opacity="0.9" />
    <path d="m12.5 9.5-9 9L6 21l9-9" />
  </S>
);
export const IFlask = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M10 3h4M10.5 3v5L4.8 18a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L13.5 8V3" />
    <path d="M7.5 15h9" />
  </S>
);
export const IChevron = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="m9 5 7 7-7 7" />
  </S>
);
export const IFolder = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V6.5Z" />
  </S>
);
export const IWp = (p: { size?: number; className?: string }) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m5.5 9 3.5 9 2.5-6.5L14 18l3.5-9" />
  </S>
);

export const CAT_ICON: Record<Category, (p: { size?: number; className?: string }) => React.JSX.Element> = {
  shop: IStore,
  item: ISword,
  event: IFlag,
  npc: IHood,
};

/* ---------------- chips & buttons ---------------- */

export function StatusChip({ status, pulse = false }: { status: Status; pulse?: boolean }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${m.chip}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${m.dot} ${pulse && status === "generating" ? "pulse-dot" : ""}`}
      />
      {m.label}
    </span>
  );
}

export function CatChip({ category }: { category: Category }) {
  const m = CATEGORY_META[category];
  const Ic = CAT_ICON[category];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] ${m.chip}`}>
      <Ic size={11} />
      {m.label}
    </span>
  );
}

type BtnVariant = "primary" | "ghost" | "danger" | "subtle" | "moss";

export function Btn({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary:
      "bg-ember text-[#241503] hover:bg-[#ffb654] shadow-[0_2px_0_#8a5a17,0_10px_24px_rgba(242,163,60,0.22)] font-semibold",
    ghost: "border border-line2 bg-panel2/60 text-parch hover:text-cream hover:border-ember/50 hover:bg-raise/70",
    danger: "border border-blood/40 bg-blood/10 text-blood hover:bg-blood/20",
    subtle: "text-dust hover:text-cream hover:bg-raise/60",
    moss: "bg-moss text-[#15230c] hover:bg-[#9cc47f] shadow-[0_2px_0_#4f6b3c] font-semibold",
  };
  return (
    <button
      {...rest}
      className={`btn-press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------- toasts ---------------- */

export function ToastHost({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-[340px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pop-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-sm ${
            t.kind === "ok"
              ? "border-moss/40 bg-[#1f2a18]/95 text-moss"
              : t.kind === "err"
                ? "border-blood/40 bg-[#2c1a15]/95 text-blood"
                : "border-line2 bg-panel2/95 text-parch"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {t.kind === "ok" ? <ICheck size={14} /> : t.kind === "err" ? <IAlert size={14} /> : <IFlask size={14} />}
          </span>
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 transition hover:opacity-100">
            <IX size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-[#0d0906]/80" onClick={onClose} />
      <div className={`plaque pop-in relative w-full ${width} max-h-[88vh] overflow-hidden rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-sm tracking-wide text-cream">{title}</h3>
          <button onClick={onClose} className="text-dust transition hover:text-cream">
            <IX size={16} />
          </button>
        </div>
        <div className="max-h-[76vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- code block + copy ---------------- */

export function CopyBtn({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="btn-press inline-flex items-center gap-1.5 rounded-md border border-line2 bg-raise/60 px-2 py-1 font-mono text-[11px] text-parch hover:border-ember/50 hover:text-cream"
    >
      {copied ? <ICheck size={11} className="text-moss" /> : <ICopy size={11} />}
      {copied ? "copied" : label}
    </button>
  );
}

export function CodeBlock({ code, copyText }: { code: string; copyText?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-[#191310]">
      <div className="flex items-center justify-between border-b border-line/70 px-3.5 py-2">
        <span className="font-mono text-[10px] tracking-widest text-dust uppercase">csv · utf-8</span>
        <CopyBtn text={copyText ?? code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12px] leading-relaxed whitespace-pre text-[#d8c8a8]">
        {code}
      </pre>
    </div>
  );
}

/* ---------------- scroll reveal ---------------- */

export function useRevealObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("on");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return ref;
}
