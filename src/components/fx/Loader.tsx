import { useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { setLoaderCovering } from "@/lib/loader-signal";

/**
 * Splash screen. While it covers the page it blocks clicks, so a blind click can't land on
 * hidden content; it lets clicks through as soon as it starts fading out. It publishes the
 * "covering" signal (src/lib/loader-signal.ts) so the chat button waits until the fade starts.
 */
export function Loader() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  // Layout effect: registered before any passive effect (e.g. the chat button's hydration
  // check) runs, so the button never gets a frame on top of the splash.
  useLayoutEffect(() => {
    setLoaderCovering(phase === "show");
  }, [phase]);
  useLayoutEffect(() => () => setLoaderCovering(false), []);

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
