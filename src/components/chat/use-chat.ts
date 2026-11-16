import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_TEXT, CHAT_UI } from "@/lib/chat-copy";
import { sanitizeActions, type ContactAction } from "./contact-actions";

// Client side of POST /api/chat. History lives in React state, mirrored to sessionStorage
// (cleared when the tab closes). Nothing goes to localStorage or cookies.

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  /** "notice" = local busy/invalid text, "error" = network failure with retry. Never sent. */
  kind?: "notice" | "error";
  /** Contact buttons the server attached (validated against the allowlist). Never sent. */
  actions?: ContactAction[];
};

const STORAGE_KEY = "sreehari-ai-chat:v1";
const REQUEST_TIMEOUT_MS = 30_000;

const KNOWN_TEXTS = new Set<unknown>([CHAT_TEXT.busy, CHAT_TEXT.slowDown, CHAT_TEXT.limitReached]);

const newId = () => Math.random().toString(36).slice(2, 10);

function loadHistory(): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is ChatMessage =>
          !!m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          typeof m.at === "number" &&
          typeof m.id === "string",
      )
      .slice(-50)
      .map((m) => {
        // Stored data is untrusted too: re-validate any buttons before they are rendered.
        const { actions, ...rest } = m;
        const valid = sanitizeActions(actions, window.location.origin);
        return valid.length ? { ...rest, actions: valid } : rest;
      });
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  } catch {
    // Storage blocked or full: the chat still works for this page view.
  }
}

/** The conversation as the server expects it: real turns only, within its size limits. */
function toRequestMessages(messages: ChatMessage[]) {
  const turns = messages
    .filter((m) => !m.kind && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-CHAT_UI.maxMessagesSent);
  while (turns.length > 1 && JSON.stringify({ messages: turns }).length > CHAT_UI.maxBodyChars) {
    turns.shift();
  }
  return turns;
}

type Status = "idle" | "waiting" | "streaming";

/** Typing effect for assistant text: characters revealed per animation frame (~60 fps). */
const CHARS_PER_FRAME = 35;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Reveals text progressively towards a growing target (streamed tokens or a complete chip /
 * cached answer). Instant with reduced motion or when the tab is hidden (animation frames
 * don't run there); jumps to the end if the tab is hidden mid-animation.
 */
function createReveal(render: (text: string) => void) {
  let target = "";
  let shown = 0;
  let frame = 0;
  let waiters: (() => void)[] = [];
  const instant = () => document.hidden || prefersReducedMotion();
  const settle = () => {
    if (shown < target.length) return;
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };
  const finishNow = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    shown = target.length;
    if (target) render(target);
    settle();
  };
  const tick = () => {
    frame = 0;
    shown = Math.min(target.length, shown + CHARS_PER_FRAME);
    render(target.slice(0, shown));
    if (shown < target.length) frame = requestAnimationFrame(tick);
    else settle();
  };
  const onVisibility = () => {
    if (document.hidden) finishNow();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return {
    /** New full text to reveal; `replace` swaps it in at once (guard / error replacement). */
    set(text: string, replace = false) {
      target = text;
      if (replace || instant()) return finishNow();
      shown = Math.min(shown, target.length);
      if (!frame) frame = requestAnimationFrame(tick);
    },
    get hasText() {
      return target.length > 0;
    },
    /** Resolves once everything received so far is on screen. */
    drained(): Promise<void> {
      if (shown >= target.length) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
    dispose() {
      finishNow();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status === "idle") saveHistory(messages.filter((m) => m.kind !== "error"));
  }, [messages, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (history: ChatMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const replyId = newId();
    let received = "";
    let actions: ContactAction[] = [];
    const reveal = createReveal((content) =>
      setMessages((prev) =>
        prev.some((m) => m.id === replyId)
          ? prev.map((m) => (m.id === replyId ? { ...m, content } : m))
          : [...prev, { id: replyId, role: "assistant", content, at: Date.now() }],
      ),
    );

    const push = (msg: Omit<ChatMessage, "id" | "at">) =>
      setMessages((prev) => [...prev, { ...msg, id: newId(), at: Date.now() }]);

    setStatus("waiting");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toRequestMessages(history) }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        if (res.status >= 500 && res.status !== 503) {
          push({ role: "assistant", content: CHAT_UI.networkError, kind: "error" });
          return;
        }
        let text: string =
          res.status === 429 || res.status === 503 ? CHAT_TEXT.busy : CHAT_TEXT.invalid;
        if (res.status === 403) text = CHAT_UI.networkError;
        let buttons: ContactAction[] = [];
        if (res.status === 429 || res.status === 503) {
          // Which limit was hit (burst / per visitor / global) — shown only if it's one of ours.
          // The busy message comes with the contact buttons (validated like any others).
          const body = (await res.json().catch(() => null)) as {
            error?: unknown;
            actions?: unknown;
          } | null;
          if (KNOWN_TEXTS.has(body?.error)) text = body?.error as string;
          if (text === CHAT_TEXT.busy) {
            buttons = sanitizeActions(body?.actions, window.location.origin);
          }
        }
        push({
          role: "assistant",
          content: text,
          kind: res.status === 403 ? "error" : "notice",
          ...(buttons.length ? { actions: buttons } : {}),
        });
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += chunk.value;
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let data: { type?: string; text?: unknown };
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (data.type === "delta" && typeof data.text === "string") {
            received += data.text;
            setStatus("streaming");
            reveal.set(received);
          } else if (data.type === "replace" && typeof data.text === "string") {
            // The server withdrew what was streamed (output guard or a broken stream).
            received = data.text;
            actions = [];
            setStatus("streaming");
            reveal.set(received, true);
          } else if (data.type === "actions") {
            actions = sanitizeActions((data as { items?: unknown }).items, window.location.origin);
          } else if (data.type === "done") {
            done = true;
          }
        }
      }
      if (!received) push({ role: "assistant", content: CHAT_UI.networkError, kind: "error" });
      await reveal.drained();
      // Buttons appear once the answer text is fully on screen.
      if (received && actions.length) {
        const items = actions;
        setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, actions: items } : m)));
      }
    } catch {
      if (abortRef.current !== controller) return; // superseded or unmounted
      if (!received) push({ role: "assistant", content: CHAT_UI.networkError, kind: "error" });
    } finally {
      clearTimeout(timer);
      reveal.dispose();
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStatus("idle");
      }
    }
  }, []);

  const busy = status !== "idle";

  const send = useCallback(
    (raw: string) => {
      const content = raw.trim();
      if (busy || !content || content.length > CHAT_UI.maxMessageChars) return false;
      const userMsg: ChatMessage = { id: newId(), role: "user", content, at: Date.now() };
      // Drop a pending error bubble: the new question replaces the failed attempt.
      const history = [...messages.filter((m) => m.kind !== "error"), userMsg];
      setMessages(history);
      void run(history);
      return true;
    },
    [busy, messages, run],
  );

  const retry = useCallback(() => {
    if (busy) return;
    const history = messages.filter((m) => m.kind !== "error");
    if (history.at(-1)?.role !== "user") return;
    setMessages(history);
    void run(history);
  }, [busy, messages, run]);

  return { messages, status, busy, send, retry };
}
