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
        className="bglow bglow-live pointer-events-none absolute inset-0 transition-opacity duration-300"
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

/* ---------------- Ember Field (rising sparks) ---------------- */

export function EmberField({ className = "", density = 60, color = "#f2a33c" }: { className?: string; density?: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ density, color });
  propsRef.current = { density, color };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    type P = { x: number; y: number; s: number; v: number; drift: number; phase: number };
    let parts: P[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(propsRef.current.density);
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: 0.8 + Math.random() * 1.8,
        v: 0.15 + Math.random() * 0.5,
        drift: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const { color: c } = propsRef.current;
      for (const p of parts) {
        if (!reduced) {
          p.y -= p.v;
          p.x += Math.sin(t * 0.001 * p.drift + p.phase) * 0.25;
          if (p.y < -8) {
            p.y = h + 8;
            p.x = Math.random() * w;
          }
        }
        const flicker = reduced ? 0.5 : 0.35 + 0.65 * Math.abs(Math.sin(t * 0.003 + p.phase));
        ctx.globalAlpha = flicker * 0.8;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={`pointer-events-none h-full w-full ${className}`} />;
}

/* ---------------- Star Field (twinkle + shooting stars) ---------------- */

export function StarField({ className = "", density = 90 }: { className?: string; density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef(density);
  propsRef.current = density;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    type St = { x: number; y: number; r: number; phase: number; speed: number };
    let stars: St[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: propsRef.current }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      }));
    };
    resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduced ? 0.5 : 0.25 + 0.55 * Math.abs(Math.sin(t * 0.0008 * s.speed + s.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = "#f4e8d4";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) {
        if (!shoot && Math.random() < 0.002) {
          shoot = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, vx: 6 + Math.random() * 4, vy: 2.5 + Math.random() * 2, life: 1 };
        }
        if (shoot) {
          shoot.x += shoot.vx;
          shoot.y += shoot.vy;
          shoot.life -= 0.02;
          ctx.globalAlpha = Math.max(shoot.life, 0) * 0.9;
          ctx.strokeStyle = "#f4e8d4";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - shoot.vx * 6, shoot.y - shoot.vy * 6);
          ctx.stroke();
          if (shoot.life <= 0) shoot = null;
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={`pointer-events-none h-full w-full ${className}`} />;
}

/* ---------------- Cursor FX (lantern glow / sparkle trail) ---------------- */

export function CursorFX({ mode, size = 220, color = "#f2a33c" }: { mode: "none" | "lantern" | "sparks"; size?: number; color?: string }) {
  const glowRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: -999, y: -999 });
  const last = useRef(0);

  useEffect(() => {
    if (mode === "none") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const cur = { x: -999, y: -999 };

    const onMove = (e: PointerEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (mode === "sparks" && fieldRef.current && Date.now() - last.current > 46) {
        last.current = Date.now();
        const sp = document.createElement("span");
        sp.className = "spark";
        const s = 3 + Math.random() * 4;
        sp.style.width = `${s}px`;
        sp.style.height = `${s}px`;
        sp.style.left = `${e.clientX}px`;
        sp.style.top = `${e.clientY}px`;
        sp.style.background = color;
        sp.style.setProperty("--sx", `${(Math.random() - 0.5) * 44}px`);
        sp.style.setProperty("--sy", `${10 + Math.random() * 26}px`);
        fieldRef.current.appendChild(sp);
        setTimeout(() => sp.remove(), 750);
      }
    };

    const loop = () => {
      if (mode === "lantern" && glowRef.current) {
        cur.x += (pos.current.x - cur.x) * 0.14;
        cur.y += (pos.current.y - cur.y) * 0.14;
        glowRef.current.style.transform = `translate(${cur.x - size / 2}px, ${cur.y - size / 2}px)`;
        glowRef.current.style.opacity = pos.current.x < -500 ? "0" : "1";
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove);
    if (mode === "lantern") raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [mode, size, color]);

  if (mode === "none") return null;
  return (
    <>
      {mode === "lantern" && (
        <div
          ref={glowRef}
          className="pointer-events-none fixed left-0 top-0 z-[65] rounded-full opacity-0 transition-opacity duration-300"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle, ${color}26 0%, ${color}10 45%, transparent 70%)`,
            mixBlendMode: "screen",
          }}
        />
      )}
      {mode === "sparks" && <div ref={fieldRef} className="pointer-events-none fixed inset-0 z-[65] overflow-hidden" />}
    </>
  );
}
