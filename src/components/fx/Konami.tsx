import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function NeuralCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    const layers = [5, 8, 8, 4];
    const nodes = layers.flatMap((count, li) =>
      Array.from({ length: count }, (_, ni) => ({
        x: ((li + 1) / (layers.length + 1)) * w,
        y: ((ni + 1) / (count + 1)) * h,
        li,
      })),
    );
    let t = 0;
    let raf = 0;
    const draw = () => {
      t += 0.02;
      ctx.clearRect(0, 0, w, h);
      for (const a of nodes) {
        for (const b of nodes) {
          if (b.li !== a.li + 1) continue;
          const pulse = 0.1 + 0.25 * Math.abs(Math.sin(t + a.y * 0.01 + b.y * 0.01));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(247,111,83,${pulse})`;
          ctx.stroke();
        }
      }
      for (const n of nodes) {
        const r = 4 + Math.sin(t * 2 + n.y * 0.05) * 1.6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(209,207,192,0.9)";
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="h-64 w-full" />;
}

export function KonamiEasterEgg() {
  const [open, setOpen] = useState(false);
  const buffer = useRef<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      buffer.current = [...buffer.current, e.key].slice(-CODE.length);
      if (buffer.current.join(",").toLowerCase() === CODE.join(",").toLowerCase()) {
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="AI Mode"
          className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-4 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            className="glass glow-cyan w-full max-w-2xl overflow-hidden p-8 text-center"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close AI Mode"
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="font-mono text-xs tracking-[0.4em] text-primary">AI MODE ACTIVATED</p>
            <h3 className="mt-3 text-3xl font-bold text-foreground">Neural Override Engaged</h3>
            <NeuralCanvas />
            <p className="text-sm text-muted-foreground">
              You found the easter egg. 2,500 images annotated, 4ms inference — and apparently a
              working Konami Code. Let&apos;s build something intelligent together.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
