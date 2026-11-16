import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { CHAT_UI } from "@/lib/chat-copy";
import { cn } from "@/lib/utils";

// The always-present floating button. It stays tiny: the chat window (Radix Dialog, hook,
// avatar) is a separate chunk, fetched on hover/focus, when the browser is idle, or on click.
//
// It is rendered only after hydration, so it is never visible while it can't react: a click
// on a server-rendered button before React attaches its handler would be lost silently. It
// appears shortly after mount and fades in. While the window chunk downloads the button shows
// a spinner, so a click always gets visible feedback.

/** Delay after mount before the button fades in. */
const SHOW_DELAY_MS = 600;
/** The "Ask my AI assistant" label shows by itself once per page load: this long after the button appears… */
const INVITE_DELAY_MS = 3000;
/** …for this long, then fades out over INVITE_FADE_MS. */
const INVITE_SHOW_MS = 5000;
const INVITE_FADE_MS = 500;

/**
 * idle: not shown yet · on: label forced visible · fading: invite over, fading out ·
 * cut: hidden instantly because the chat was opened · done: invite finished for this page load.
 */
type InviteState = "idle" | "on" | "fading" | "cut" | "done";

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

  const [showButton, setShowButton] = useState(false);
  const [invite, setInvite] = useState<InviteState>("idle");
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => setInteractive(true), []);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // One-time invite: show the label a few seconds after the button appears, unless the chat
  // was already opened. Hover and focus-visible still show it independently (CSS).
  useEffect(() => {
    if (!showButton) return;
    const timers = [
      setTimeout(
        () => setInvite((s) => (s === "idle" && !openRef.current ? "on" : s)),
        INVITE_DELAY_MS,
      ),
      setTimeout(
        () => setInvite((s) => (s === "on" ? "fading" : s)),
        INVITE_DELAY_MS + INVITE_SHOW_MS,
      ),
      setTimeout(
        () => setInvite((s) => (s === "fading" ? "done" : s)),
        INVITE_DELAY_MS + INVITE_SHOW_MS + INVITE_FADE_MS,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [showButton]);

  // After an instant hide, restore the normal hover transition on the next tick.
  useEffect(() => {
    if (invite !== "cut") return;
    const timer = setTimeout(() => setInvite("done"), 50);
    return () => clearTimeout(timer);
  }, [invite]);

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
  const opening = open && !windowReady;
  return (
    <>
      {showButton && (
        <div className="group fixed bottom-4 right-4 z-[110] md:bottom-6 md:right-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[600ms] motion-safe:ease-in-out">
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
              setInvite((s) => (s === "on" || s === "fading" ? "cut" : "done"));
            }}
            className="glass relative grid h-12 w-12 place-items-center rounded-full text-primary transition-transform duration-200 active:scale-95"
          >
            {opening ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute right-full top-1/2 mr-3 block -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity motion-reduce:transition-none",
              invite === "on"
                ? "opacity-100"
                : // Hover/focus only from sm up: touch screens have no hover, so only the invite shows it there.
                  "opacity-0 sm:group-hover:opacity-100 sm:group-has-[:focus-visible]:opacity-100",
              invite === "on" || invite === "fading"
                ? "duration-500"
                : invite === "cut"
                  ? "duration-0"
                  : "duration-200",
            )}
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
