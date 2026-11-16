import { useEffect, useRef, useState } from "react";

export function CursorGlow() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let gx = x;
    let gy = y;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const interactive = (e.target as HTMLElement)?.closest("a,button,[data-cursor]");
      ring.current?.classList.toggle("scale-[1.9]", !!interactive);
    };

    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      gx += (x - gx) * 0.07;
      gy += (y - gy) * 0.07;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      if (glow.current) glow.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70]">
      <div
        ref={glow}
        className="absolute -ml-[300px] -mt-[300px] h-[600px] w-[600px] rounded-full opacity-60 blur-[10px]"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div
        ref={ring}
        className="absolute -ml-4 -mt-4 h-8 w-8 rounded-full border border-primary/60 transition-transform duration-200"
      />
      <div ref={dot} className="absolute -ml-1 -mt-1 h-2 w-2 rounded-full bg-primary" />
    </div>
  );
}
