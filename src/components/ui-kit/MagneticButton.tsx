import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

type Ripple = { id: number; x: number; y: number };

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  download?: boolean;
  ariaLabel?: string;
};

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  download,
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (e: MouseEvent) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      setTimeout(() => setRipples((prev) => prev.filter((p) => p.id !== id)), 650);
    }
    onClick?.();
  };

  const base = cn(
    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold transition-[box-shadow,background-color,border-color,color] duration-300",
    variant === "primary"
      ? "text-primary-foreground glow-cyan"
      : "glass text-foreground hover:border-primary/55 hover:text-primary",
    className,
  );

  const inner = (
    <>
      {variant === "primary" && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-primary transition-opacity duration-300 group-hover:opacity-85"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          className="pointer-events-none absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-background/60"
          style={{ left: r.x, top: r.y, transform: "translate(-50%,-50%) scale(14)" }}
        />
      ))}
    </>
  );

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        aria-label={ariaLabel}
        download={download}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        onClick={handleClick}
        className={base}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={base}
    >
      {inner}
    </button>
  );
}
