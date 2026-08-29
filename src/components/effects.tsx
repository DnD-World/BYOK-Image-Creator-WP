import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

/* ---------------- Dot Field (reactbits.dev/backgrounds/dot-field) ---------------- */

interface DotFieldProps {
  className?: string;
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
}

export function DotField({
  className = "",
  dotRadius = 1.25,
  dotSpacing = 26,
  cursorRadius = 300,
  bulgeStrength = 34,
  glowRadius = 230,
  sparkle = true,
  waveAmplitude = 2.2,
  gradientFrom = "rgba(205,188,159,0.20)",
  gradientTo = "rgba(242,163,60,0.15)",
  glowColor = "rgba(242,163,60,0.08)",
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ dotRadius, dotSpacing, cursorRadius, bulgeStrength, glowRadius, sparkle, waveAmplitude, gradientFrom, gradientTo, glowColor });
  propsRef.current = { dotRadius, dotSpacing, cursorRadius, bulgeStrength, glowRadius, sparkle, waveAmplitude, gradientFrom, gradientTo, glowColor };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const mouse = { x: -9999, y: -9999 };
    const sparks = new Map<number, number>();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (t: number) => {
      const p = propsRef.current;
      ctx.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / p.dotSpacing) + 1;
      const rows = Math.ceil(h / p.dotSpacing) + 1;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p.gradientFrom);
      grad.addColorStop(1, p.gradientTo);
      ctx.fillStyle = grad;

      const R2 = p.cursorRadius * p.cursorRadius;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          let x = gx * p.dotSpacing;
          let y = gy * p.dotSpacing;
          if (p.waveAmplitude > 0 && !reduced) {
            y += Math.sin(t * 0.0007 + gx * 0.55) * p.waveAmplitude;
            x += Math.cos(t * 0.0006 + gy * 0.45) * p.waveAmplitude * 0.6;
          }
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const d2 = dx * dx + dy * dy;
          let r = p.dotRadius;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / p.cursorRadius) * p.bulgeStrength;
            x += (dx / d) * f;
            y += (dy / d) * f;
            r += (1 - d / p.cursorRadius) * 1.4;
          }
          if (p.sparkle) {
            const key = gy * 1000 + gx;
            if (!sparks.has(key) && Math.random() < 0.0004) sparks.set(key, t + 400 + Math.random() * 500);
            const until = sparks.get(key);
            if (until !== undefined) {
              if (t < until) r += 1.6 * Math.sin(((until - t) / 900) * Math.PI);
              else sparks.delete(key);
            }
          }
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.2, r), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (mouse.x > -999 && !reduced) {
        const rg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, p.glowRadius);
        rg.addColorStop(0, p.glowColor);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(mouse.x - p.glowRadius, mouse.y - p.glowRadius, p.glowRadius * 2, p.glowRadius * 2);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={`pointer-events-none h-full w-full ${className}`} />;
}

/* ---------------- Border Glow (reactbits.dev/components/border-glow) ---------------- */

interface BorderGlowProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  radius?: number;
  glow?: string;
  idle?: string;
  style?: CSSProperties;
}

export function BorderGlow({
  children,
  className = "",
  innerClassName = "",
  radius = 14,
  glow = "rgba(242,163,60,0.55)",
  idle = "rgba(242,163,60,0.16)",
  style,
}: BorderGlowProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: -500, y: -500 });
  const [active, setActive] = useState(false);

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const radiusStyle: CSSProperties = { borderRadius: radius };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={`relative overflow-hidden ${className}`}
      style={{ ...radiusStyle, ...style }}
    >
      {/* base hairline border */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ ...radiusStyle, border: `1px solid ${idle}`, opacity: active ? 0 : 1 }}
      />
      {/* mouse-tracked glow border */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          ...radiusStyle,
          opacity: active ? 1 : 0,
          background: `radial-gradient(180px circle at ${pos.x}px ${pos.y}px, ${glow}, transparent 70%)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: 1.5,
        }}
      />
      {/* soft outer bloom */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          ...radiusStyle,
          opacity: active ? 1 : 0,
          boxShadow: `0 0 42px -6px ${glow}`,
        }}
      />
      <div className={`relative h-full ${innerClassName}`} style={radiusStyle}>
        {children}
      </div>
    </div>
  );
}
