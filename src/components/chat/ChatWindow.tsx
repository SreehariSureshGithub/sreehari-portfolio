import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUp,
  FileText,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  RotateCw,
  X,
  type LucideIcon,
} from "lucide-react";

import portrait from "@/assets/portrait.jpg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_TEXT, CHAT_UI } from "@/lib/chat-copy";
import { cn } from "@/lib/utils";
import {
  ACTION_TEXT,
  opensNewTab,
  type ContactAction,
  type ContactActionId,
} from "./contact-actions";
import { linkify, tidyAnswer } from "./linkify";
import { useChat, type ChatMessage } from "./use-chat";

// Loaded lazily by ChatLauncher on first open (or when the browser is idle).

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function Bubble({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry?: (() => void) | undefined;
}) {
  const mine = message.role === "user";
  return (
    <li className={cn("flex flex-col gap-1.5", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[0.94rem] leading-relaxed shadow-sm",
          mine
            ? "rounded-br-md border border-primary/35 bg-primary/15 text-foreground"
            : "rounded-bl-md border border-border bg-[var(--glass-bg)] text-foreground backdrop-blur-md",
          message.kind === "error" && "border-destructive/40",
        )}
      >
        <span className="sr-only">{mine ? "You said:" : "Assistant:"}</span>
        <p className="whitespace-pre-wrap break-words">
          {mine ? message.content : linkify(tidyAnswer(message.content))}
        </p>
        {message.kind === "error" && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 h-7 rounded-full border-primary/40 bg-transparent text-primary hover:bg-primary/10 hover:text-primary"
          >
            <RotateCw aria-hidden="true" />
            Retry
          </Button>
        )}
        <time
          dateTime={new Date(message.at).toISOString()}
          className="mt-1 block text-right text-[0.68rem] text-muted-foreground"
        >
          {timeFormat.format(message.at)}
        </time>
      </div>
      {!mine && message.actions?.length ? <ContactButtons actions={message.actions} /> : null}
    </li>
  );
}

const ACTION_ICONS: Record<ContactActionId, LucideIcon> = {
  whatsapp: MessageCircle,
  email: Mail,
  call: Phone,
  linkedin: Linkedin,
  resume: FileText,
};

/** True on touch-first devices (phones, tablets): the only place a Call button makes sense. */
function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    try {
      const query = window.matchMedia("(pointer: coarse)");
      setTouch(query.matches);
      const onChange = (e: MediaQueryListEvent) => setTouch(e.matches);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    } catch {
      return undefined;
    }
  }, []);
  return touch;
}

/** Contact buttons under an assistant answer. Items were validated in sanitizeActions(). */
function ContactButtons({ actions }: { actions: ContactAction[] }) {
  const touch = useTouchDevice();
  const visible = actions.filter((a) => touch || !a.touchOnly);
  if (!visible.length) return null;
  return (
    <ul aria-label="Contact Sreehari" className="flex max-w-[85%] flex-wrap gap-1.5">
      {visible.map((a) => {
        const Icon = ACTION_ICONS[a.id];
        const newTab = opensNewTab(a.href);
        return (
          <li key={a.id}>
            <a
              href={a.href}
              aria-label={ACTION_TEXT[a.id].aria}
              {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors hover:border-primary/70 hover:bg-primary/15 hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {ACTION_TEXT[a.id].label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function TypingIndicator() {
  return (
    <li className="flex justify-start" aria-label="Assistant is typing">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-[var(--glass-bg)] px-4 py-3 backdrop-blur-md">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-primary/80 motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </li>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export default function ChatWindow({ open, onOpenChange, returnFocusRef }: Props) {
  const { messages, status, busy, send, retry } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  /** When the dialog last opened: a second click of a double-click must not close it. */
  const openedAt = useRef(0);
  useEffect(() => {
    if (open) openedAt.current = performance.now();
  }, [open]);

  const tooLong = draft.length > CHAT_UI.maxMessageChars;
  const canSend = !busy && draft.trim().length > 0 && !tooLong;

  const viewport = () =>
    scrollRef.current?.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");

  // Follow new messages and streamed text, unless the visitor scrolled up to read.
  useLayoutEffect(() => {
    const el = viewport();
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status, open]);

  useEffect(() => {
    if (!open) return;
    const el = viewport();
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  // Auto-growing textarea (up to ~5 lines, then it scrolls).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft, open]);

  const submit = useCallback(
    (text: string) => {
      stickToBottom.current = true;
      if (send(text)) setDraft("");
    },
    [send],
  );

  const lastIsError = messages.at(-1)?.kind === "error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[120] bg-background/60 backdrop-blur-md" />
        <DialogPrimitive.Content
          onPointerDownOutside={(e) => {
            // The second click of a quick double-click on the launcher lands on the backdrop.
            if (performance.now() - openedAt.current < 500) e.preventDefault();
          }}
          onOpenAutoFocus={(e) => {
            // Desktop: straight to the input. Touch: don't pop the keyboard up uninvited.
            if (window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusRef.current?.focus();
          }}
          className={cn(
            "fixed inset-0 z-[120] flex h-[100dvh] w-full flex-col overflow-hidden border-border bg-[color-mix(in_oklab,var(--background)_90%,transparent)] shadow-[var(--shadow-glow)] backdrop-blur-xl focus:outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(680px,calc(100dvh-4rem))] sm:w-[min(440px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 duration-200",
          )}
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="relative shrink-0">
              <img
                src={portrait}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover ring-1 ring-primary/40"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background"
              />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate font-display text-base font-semibold">
                {CHAT_TEXT.assistantName}
              </DialogTitle>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </p>
              <DialogDescription className="sr-only">
                Ask questions about Sreehari's experience, projects and skills.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close chat"
                className="rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                <X className="!size-5" aria-hidden="true" />
              </Button>
            </DialogClose>
          </header>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
            <ol
              role="log"
              aria-live="polite"
              aria-busy={busy}
              aria-label="Conversation"
              className="flex flex-col gap-3 px-4 py-4"
            >
              <li className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-[var(--glass-bg)] px-3.5 py-2 text-[0.94rem] leading-relaxed backdrop-blur-md">
                  {CHAT_TEXT.greeting}
                </div>
              </li>
              {messages.length === 0 && (
                <li>
                  <ul aria-label="Suggested questions" className="flex flex-wrap gap-2 pt-1">
                    {CHAT_UI.suggestedQuestions.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => submit(q)}
                          disabled={busy}
                          className="rounded-full border border-primary/35 bg-primary/5 px-3 py-1.5 text-left text-sm text-primary transition-colors hover:border-primary/70 hover:bg-primary/15 hover:shadow-[var(--shadow-glow)] disabled:opacity-50"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              {messages.map((m) => (
                <Bubble
                  key={m.id}
                  message={m}
                  onRetry={m.kind === "error" && lastIsError ? retry : undefined}
                />
              ))}
              {status === "waiting" && <TypingIndicator />}
            </ol>
          </ScrollArea>

          {/* Input */}
          <form
            className="border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) submit(draft);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">
                Your question
              </label>
              <Textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (canSend) submit(draft);
                  }
                }}
                placeholder="Ask about Sreehari…"
                aria-describedby="chat-counter chat-note"
                aria-invalid={tooLong}
                className="max-h-[140px] min-h-[44px] resize-none rounded-2xl border-border bg-[var(--glass-bg)] px-4 py-2.5 text-base focus-visible:ring-primary/60 md:text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!canSend}
                aria-label={busy ? "Waiting for the reply" : "Send message"}
                className="h-11 w-11 shrink-0 rounded-full shadow-[var(--shadow-glow)]"
              >
                <ArrowUp className="!size-5" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-1.5 flex items-start justify-between gap-3 px-1 text-[0.7rem] text-muted-foreground">
              <p id="chat-note">{CHAT_UI.footerNote}</p>
              <p
                id="chat-counter"
                aria-live={tooLong ? "assertive" : "off"}
                className={cn("shrink-0 tabular-nums", tooLong && "font-medium text-destructive")}
              >
                {draft.length}/{CHAT_UI.maxMessageChars}
                {tooLong && <span className="sr-only"> — too long to send</span>}
              </p>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
