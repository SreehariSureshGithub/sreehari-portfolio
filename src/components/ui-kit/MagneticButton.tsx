import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        download={download}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        onClick={onClick}
        className={base}
      >
        {inner}
      </a>
    );
  }

  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={base}>
      {inner}
    </button>
  );
}
