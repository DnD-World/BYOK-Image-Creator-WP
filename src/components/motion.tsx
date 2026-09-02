/**
 * Motion that means something.
 *
 * These are small, dependency-free versions of the ReactBits ideas, written to
 * fit this app rather than dropped in. Three rules they all follow:
 *
 *   1. **Every one of them respects reduced motion.** Not by being switched off
 *      — by arriving instantly at the finished state. A count-up shows the
 *      number, a reveal shows the text. Nothing is ever hidden from someone who
 *      turned motion off, which is the usual bug in this kind of component.
 *
 *   2. **No WebGL, no canvas, no new dependencies.** Transforms and opacity
 *      only, so it stays smooth on an old laptop and over remote desktop.
 *
 *   3. **Motion carries information.** A number counting up says it changed. A
 *      stagger says these arrived together. Decoration for its own sake is in
 *      effects.tsx, where it can be switched off separately.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** What the user asked for, honouring the OS setting as the floor. */
export type MotionLevel = "full" | "reduced" | "off";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * True when we should skip animating and show the end state at once. The OS
 * setting wins over the app setting: someone who set it system-wide should not
 * have to find it again in here.
 */
export function shouldSkipMotion(level: MotionLevel): boolean {
  return level === "off" || prefersReducedMotion();
}

/* ---------------- count up ---------------- */

/**
 * A number that rolls to its new value.
 *
 * Used on the manifest counters, where the point is that you notice something
 * changed without watching for it.
 */
export function CountUp({
  value,
  level = "full",
  duration = 650,
  className = "",
}: {
  value: number;
  level?: MotionLevel;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (shouldSkipMotion(level)) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    // ease-out: fast at first, settling at the end — reads as "landing on" a
    // number rather than creeping up to it.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(from + (value - from) * ease(t)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, level]);

  return <span className={className}>{shown}</span>;
}

/* ---------------- staggered arrival ---------------- */

/**
 * Children that arrive one after another instead of all at once.
 *
 * The delay is capped: with fifty findings you want the list, not a
 * performance. Past the cap everything lands together.
 */
export function Stagger({
  children,
  level = "full",
  step = 45,
  max = 8,
  className = "",
}: {
  children: ReactNode[];
  level?: MotionLevel;
  step?: number;
  max?: number;
  className?: string;
}) {
  const skip = shouldSkipMotion(level);
  return (
    <div className={className}>
      {children.map((child, i) => (
        <div
          key={i}
          className={skip ? "" : "stagger-in"}
          style={skip ? undefined : { animationDelay: `${Math.min(i, max) * step}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/* ---------------- text reveal ---------------- */

/**
 * A heading that resolves into place, word by word.
 *
 * Words rather than letters on purpose: letter-by-letter looks clever and
 * reads badly, and it wrecks copy-paste and screen readers. The whole string
 * stays in the DOM as text either way.
 */
export function RevealText({
  text,
  level = "full",
  step = 55,
  className = "",
}: {
  text: string;
  level?: MotionLevel;
  step?: number;
  className?: string;
}) {
  if (shouldSkipMotion(level) || level === "reduced") return <span className={className}>{text}</span>;
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="reveal-word" style={{ animationDelay: `${i * step}ms` }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/* ---------------- spotlight card ---------------- */

/**
 * A panel that lights up under the cursor.
 *
 * Pure CSS custom properties driven by pointer position — no re-render per
 * mouse move, which is what makes the naive version of this stutter.
 */
export function Spotlight({
  children,
  level = "full",
  className = "",
}: {
  children: ReactNode;
  level?: MotionLevel;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const on = level === "full" && !prefersReducedMotion();

  return (
    <div
      ref={ref}
      className={`${on ? "spotlight" : ""} ${className}`}
      onPointerMove={
        on
          ? (e) => {
              const el = ref.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              el.style.setProperty("--mx", `${e.clientX - r.left}px`);
              el.style.setProperty("--my", `${e.clientY - r.top}px`);
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/* ---------------- magnetic button ---------------- */

/**
 * A control that leans towards the cursor as it approaches.
 *
 * Deliberately small (6px): enough to feel responsive, not enough to make the
 * thing harder to click, which is what happens when this effect is overdone.
 */
export function Magnetic({
  children,
  level = "full",
  strength = 6,
  className = "",
}: {
  children: ReactNode;
  level?: MotionLevel;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const on = level === "full" && !prefersReducedMotion();

  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      className={`${on ? "magnetic" : ""} ${className}`}
      onPointerMove={on ? move : undefined}
      onPointerLeave={on ? reset : undefined}
    >
      {children}
    </div>
  );
}
