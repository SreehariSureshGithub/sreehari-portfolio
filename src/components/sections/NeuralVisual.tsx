import { useEffect, useRef } from "react";

/** Animated neural-network / AI node visualization for the hero. */
export function NeuralVisual() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let t = 0;
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

    type Node = { x: number; y: number; li: number; phase: number };
    let nodes: Node[] = [];

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const layers = [4, 7, 7, 5, 3];
      nodes = layers.flatMap((count, li) =>
        Array.from({ length: count }, (_, ni) => ({
          x: ((li + 1) / (layers.length + 1)) * w,
          y: ((ni + 1) / (count + 1)) * h,
          li,
          phase: Math.random() * Math.PI * 2,
        })),
      );
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      parallax.tx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 18;
      parallax.ty = ((e.clientY - (r.top + r.height / 2)) / r.height) * 18;
    };

    const draw = () => {
      t += 0.012;
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(parallax.x, parallax.y);

      for (const a of nodes) {
        for (const b of nodes) {
          if (b.li !== a.li + 1) continue;
          const flow = 0.5 + 0.5 * Math.sin(t * 2 + a.phase + b.phase);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0,229,255,${0.05 + flow * 0.16})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          const px = a.x + (b.x - a.x) * ((t * 0.6 + a.phase) % 1);
          const py = a.y + (b.y - a.y) * ((t * 0.6 + a.phase) % 1);
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(124,58,237,0.75)";
          ctx.fill();
        }
      }

      for (const n of nodes) {
        const pulse = 5 + Math.sin(t * 2.4 + n.phase) * 1.8;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, pulse * 4);
        g.addColorStop(0, "rgba(0,229,255,0.55)");
        g.addColorStop(1, "rgba(0,229,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulse * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulse * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(230,245,255,0.95)";
        ctx.fill();
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-lg">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-3xl"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="glass glow-border animate-float absolute inset-0 overflow-hidden rounded-3xl">
        <canvas ref={ref} aria-hidden="true" className="h-full w-full" />
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        </div>
        <p className="absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
          YOLOv8 · TENSORRT · 4ms
        </p>
      </div>
    </div>
  );
}
