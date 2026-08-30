import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Category, Status, Toast } from "../types";
import { CATEGORY_META, STATUS_META } from "../types";

/* ---------------- icons ---------------- */

type IconProps = { size?: number; className?: string };
const S = ({ size = 16, className = "", children }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

export const IAnvil = (p: IconProps) => (
  <S {...p}>
    <path d="M5 6h14c0 3-2.5 5-6 5v3" />
    <path d="M8 20h8M10 17h4l1 3H9l1-3Z" />
    <path d="M5 6c0 2.5 1.5 4 4 4.5" />
  </S>
);
export const IPlay = (p: IconProps) => (
  <S {...p}>
    <path d="M7 5.5v13l11-6.5L7 5.5Z" />
  </S>
);
export const IX = (p: IconProps) => (
  <S {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </S>
);
export const ICheck = (p: IconProps) => (
  <S {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </S>
);
export const IAlert = (p: IconProps) => (
  <S {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.5M12 17.4v.1" />
  </S>
);
export const IHammer = (p: IconProps) => (
  <S {...p}>
    <path d="M14 4h4l3 3-3 3h-4l-3-3 3-3Z" />
    <path d="m11 7-8 8 2 2 8-8" />
  </S>
);
export const IPlus = (p: IconProps) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IDownload = (p: IconProps) => (
  <S {...p}>
    <path d="M12 4v10M8 10.5 12 14.5l4-4" />
    <path d="M5 18.5h14" />
  </S>
);
export const IUpload = (p: IconProps) => (
  <S {...p}>
    <path d="M12 14V4M8 7.5 12 3.5l4 4" />
    <path d="M5 18.5h14" />
  </S>
);
export const ISearch = (p: IconProps) => (
  <S {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15.5 15.5 4.5 4.5" />
  </S>
);
export const IRetry = (p: IconProps) => (
  <S {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" />
    <path d="M4.5 17.5V12h5.5" />
  </S>
);
export const IFlask = (p: IconProps) => (
  <S {...p}>
    <path d="M10 3h4M11 3v6L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L13 9V3" />
    <path d="M8 15h8" />
  </S>
);
export const IZip = (p: IconProps) => (
  <S {...p}>
    <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
    <path d="M12 5v14" strokeDasharray="2 2.4" />
  </S>
);
export const IGear = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.6v2.7M12 18.7v2.7M2.6 12h2.7M18.7 12h2.7M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9" />
  </S>
);
export const IQuill = (p: IconProps) => (
  <S {...p}>
    <path d="M20 4c-6.5.5-11 3-13.5 8.5L5 19l1.5-.5C13 16 17.5 12 20 4Z" />
    <path d="M5 19 15 9" />
  </S>
);
export const IThumbUp = (p: IconProps) => (
  <S {...p}>
    <path d="M7 10.5V20M7 20H4.5A1.5 1.5 0 0 1 3 18.5v-6.4A1.5 1.5 0 0 1 4.5 10.5H7l4.2-6.6A1.8 1.8 0 0 1 13.2 6v3.5h5.1a2 2 0 0 1 2 2.4l-1.4 6.1a2 2 0 0 1-2 1.5H7" />
  </S>
);
export const IThumbDown = (p: IconProps) => (
  <S {...p}>
    <path d="M17 13.5V4M17 4h2.5A1.5 1.5 0 0 1 21 5.5v6.4a1.5 1.5 0 0 1-1.5 1.6H17l-4.2 6.6A1.8 1.8 0 0 1 10.8 18v-3.5H5.7a2 2 0 0 1-2-2.4l1.4-6.1a2 2 0 0 1 2-1.5H17" />
  </S>
);
export const IWp = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M4.5 9.5h15M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </S>
);
export const IFolder = (p: IconProps) => (
  <S {...p}>
    <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z" />
  </S>
);
export const ITrash = (p: IconProps) => (
  <S {...p}>
    <path d="M5 7h14M9.5 7V5h5v2M7 7l1 13h8l1-13" />
  </S>
);
export const IChevron = (p: IconProps) => (
  <S {...p}>
    <path d="m8.5 10 3.5 3.5L15.5 10" />
  </S>
);
export const ISparkle = (p: IconProps) => (
  <S {...p}>
    <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z" />
    <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
  </S>
);
export const IWand = (p: IconProps) => (
  <S {...p}>
    <path d="M6 18 17 7M14.5 4.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z" />
    <path d="M19 12l.5 1.4 1.4.5-1.4.5L19 16l-.5-1.6-1.4-.5 1.4-.5L19 12Z" />
  </S>
);
export const IBook = (p: IconProps) => (
  <S {...p}>
    <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17.5H7.5A2.5 2.5 0 0 0 5 22V4.5Z" />
    <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19" />
  </S>
);
export const IImage = (p: IconProps) => (
  <S {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17.5 4.5-4 3.5 3 3-2.5 4 3.5" />
  </S>
);
export const CAT_ICON: Record<Category, (p: IconProps) => ReactNode> = {
  shop: IImage,
  item: IFlask,
  event: ISparkle,
  npc: IBook,
};

/* ---------------- chips ---------------- */

export const StatusChip = ({ status, pulse }: { status: Status; pulse?: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] ${STATUS_META[status].chip}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot} ${pulse ? "pulse-dot" : ""}`} />
    {STATUS_META[status].label}
  </span>
);

export const CatChip = ({ category }: { category: Category }) => (
  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10.5px] ${CATEGORY_META[category].chip}`}>
    {category}
  </span>
);

/* ---------------- button ---------------- */

type BtnVariant = "primary" | "ghost" | "danger" | "subtle" | "moss";

export function Btn({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-ember text-[#241503] hover:bg-[#ffb654] shadow-[0_2px_0_#8a5a17,0_10px_24px_rgba(242,163,60,0.22)] font-semibold",
    ghost: "border border-line2 bg-panel2/60 text-parch hover:text-cream hover:border-ember/50 hover:bg-raise/70",
    danger: "border border-blood/40 bg-blood/10 text-blood hover:bg-blood/20",
    subtle: "text-dust hover:text-cream hover:bg-raise/60",
    moss: "bg-moss text-[#15230c] hover:bg-[#9cc47f] shadow-[0_2px_0_#4f6b3c] font-semibold",
  };
  return (
    <button
      {...rest}
      className={`btn-press inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] transition disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none ${styles[variant]} ${className}`}
    >
      {children}
    </button>
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
  title: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" onClick={onClose} />
      <div className={`pop-in relative w-full ${width} max-h-[88vh] overflow-y-auto rounded-2xl border border-line2 bg-panel shadow-[0_30px_80px_rgba(0,0,0,0.55)]`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-3.5 backdrop-blur">
          <h3 className="font-display text-[15px] tracking-wide text-cream">{title}</h3>
          <button onClick={onClose} className="btn-press rounded-lg p-1.5 text-dust hover:bg-raise hover:text-cream">
            <IX size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- code block + copy ---------------- */

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-line bg-[#191310] p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre text-parch">
      {code}
    </pre>
  );
}

export function CopyBtn({ text, label = "copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
      className="btn-press flex items-center gap-1.5 rounded-md border border-line bg-panel2/60 px-2 py-1 font-mono text-[10px] tracking-wider text-dust uppercase hover:border-ember/50 hover:text-ember"
    >
      {ok ? <ICheck size={10} className="text-moss" /> : null}
      {ok ? "copied" : label}
    </button>
  );
}

/* ---------------- toasts ---------------- */

export function ToastHost({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const tone = { ok: "border-moss/50 text-moss", err: "border-blood/50 text-blood", info: "border-ember/50 text-ember" };
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[340px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => dismiss(t.id)}
          className={`slide-in-right pointer-events-auto cursor-pointer rounded-xl border bg-panel/95 px-4 py-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur ${tone[t.kind]}`}
        >
          <span className="text-[12.5px] leading-snug text-cream">{t.msg}</span>
          {t.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                t.action?.run();
                dismiss(t.id);
              }}
              className="btn-press mt-2 block rounded-md border border-ember/50 bg-ember/12 px-2.5 py-1 font-mono text-[10.5px] tracking-wide text-ember uppercase hover:bg-ember/25"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- scroll reveal ---------------- */

export function useRevealObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("on")),
      { threshold: 0.08 }
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);
  return ref;
}
