import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Splash screen. While it covers the page it blocks clicks, so a blind click can't land on
 * hidden content; it lets clicks through as soon as it starts fading out. The chat button
 * and the chat window sit above it (z-[110] / z-[120]), so they work even during the splash.
 */
export function Loader() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const fade = setTimeout(() => setPhase("fade"), 1200);
    const gone = setTimeout(() => setPhase("gone"), 1800);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center bg-background transition-opacity duration-[600ms] ease-in-out",
        phase === "fade" && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative grid h-20 w-20 place-items-center">
          <span
            className="absolute inset-0 rounded-full border border-primary/40"
            style={{ animation: "pulse-ring 1.6s ease-out infinite" }}
          />
          <span
            className="absolute inset-0 rounded-full border border-accent/40"
            style={{ animation: "pulse-ring 1.6s ease-out 0.5s infinite" }}
          />
          <span className="h-8 w-8 rounded-full" style={{ background: "var(--gradient-brand)" }} />
        </div>
        <p className="font-mono text-xs tracking-[0.4em] text-muted-foreground">INITIALIZING</p>
      </div>
    </div>
  );
}
