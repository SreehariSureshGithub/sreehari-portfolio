import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { CHAT_UI } from "@/lib/chat-copy";
import { useLoaderCovering } from "@/lib/loader-signal";

// The always-present floating button. It stays tiny: the chat window (Radix Dialog, hook,
// avatar) is a separate chunk, fetched on hover/focus, when the browser is idle, or on click.
//
// It is rendered only after hydration, so it is never visible while it can't react: a click
// on a server-rendered button before React attaches its handler would be lost silently. It also
// waits for the page loader (splash) to start fading, then fades in with the page; a safety
// timeout shows it anyway if the splash never ends. While the window chunk downloads the
// button shows a spinner, so a click always gets visible feedback.

/** Show the button this long after hydration even if the splash is still reported as covering. */
const LOADER_SAFETY_MS = 4000;

const loadChatWindow = () => import("./ChatWindow");
const ChatWindow = lazy(loadChatWindow);

// Warms the server (loads the embedding model) so the first answer is faster. Fires at most
// once per page load, only when the visitor shows interest (hover, focus or open).
let serverWarmed = false;
function warmServer() {
  if (serverWarmed) return;
  serverWarmed = true;
  void fetch("/api/warm", { method: "GET", credentials: "same-origin" }).catch(() => {});
}

const prepareChat = () => {
  void loadChatWindow();
  warmServer();
};

export function ChatLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** True once React has hydrated this component: only then is the button rendered. */
  const [interactive, setInteractive] = useState(false);
  /** True once the chat window chunk has loaded (until then an open click shows a spinner). */
  const [windowReady, setWindowReady] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loaderCovering = useLoaderCovering();
  const [loaderTimedOut, setLoaderTimedOut] = useState(false);

  useEffect(() => setInteractive(true), []);

  useEffect(() => {
    const timer = setTimeout(() => setLoaderTimedOut(true), LOADER_SAFETY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Prefetch once the page has loaded and the main thread is idle.
  useEffect(() => {
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(() => void loadChatWindow(), { timeout: 5000 });
        } else {
          void loadChatWindow();
        }
      }, 3000);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (timer) clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
    };
  }, []);

  if (!interactive) return null;
  const showButton = !loaderCovering || loaderTimedOut;
  const opening = open && !windowReady;
  return (
    <>
      {showButton && (
        <div className="group fixed bottom-6 right-6 z-[110] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[600ms] motion-safe:ease-in-out">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border border-primary/50 motion-safe:animate-[pulse-ring_2.8s_ease-out_infinite]"
          />
          <button
            ref={buttonRef}
            type="button"
            aria-label={CHAT_UI.tooltip}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-busy={opening}
            onPointerEnter={prepareChat}
            onFocus={prepareChat}
            onClick={() => {
              prepareChat();
              void loadChatWindow().then(() => setWindowReady(true));
              setMounted(true);
              setOpen(true);
            }}
            className="glass glow-cyan relative grid h-14 w-14 place-items-center rounded-full text-primary transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {opening ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-0 shadow-[var(--shadow-glow)] transition-opacity duration-200 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 sm:block"
          >
            {CHAT_UI.tooltip}
          </span>
        </div>
      )}
      {mounted && (
        <Suspense fallback={null}>
          <ChatWindow open={open} onOpenChange={setOpen} returnFocusRef={buttonRef} />
        </Suspense>
      )}
    </>
  );
}
