// Output guard. checkAnswer() checks a complete text; createStreamGuard() applies the same
// checks incrementally while an LLM answer streams (see below).
// Blocks (a) system-prompt leaks, (b) phone numbers that don't appear in the knowledge files
// (compared digit by digit, so spaces, dashes and brackets don't matter), (c) URLs (including
// wa.me links), domains and email addresses that don't appear in the knowledge files.

import rawIndex from "../rag/knowledge-index.server.json" with { type: "json" };
import { PROMPT_CANARY, SANCTIONED_RULE_PHRASES, SYSTEM_RULES } from "./prompt.server.ts";
import { TEXT } from "./settings.server.ts";

type IndexLike = { chunks: { source: string; text: string }[] };
const knowledge = (rawIndex as unknown as IndexLike).chunks;
// The index text is the knowledge with HTML comments removed — so a number or link that only
// sits in a comment is correctly NOT allowed.
const allKnowledgeText = knowledge.map((c) => c.text).join("\n");

// ---------------------------------------------------------------------------- helpers --

const URL_RE = /\bhttps?:\/\/[^\s<>()[\]{}"'`]+/gi;
const WWW_RE = /\bwww\.[^\s<>()[\]{}"'`]+/gi;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
// Bare domains like "github.com/someone" — common TLDs only, so "Node.js" or "M.Sc" don't match.
const DOMAIN_RE =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|ai|co|in|ae|me|info|xyz|site|link|ly|gg|uk|us)\b(?:\/[^\s<>()[\]{}"'`]*)?/gi;
const PHONE_RE = /\+?\d[\d\s().\-/]{6,}\d/g;

const trimPunct = (s: string) => s.replace(/[.,;:!?*_)\]]+$/, "");
const normUrl = (u: string) =>
  trimPunct(u)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
const digits = (s: string) => s.replace(/\D/g, "");
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const allowedUrls = new Set(
  [...(allKnowledgeText.match(URL_RE) ?? []), ...(allKnowledgeText.match(WWW_RE) ?? [])].map(
    normUrl,
  ),
);
const allowedHosts = new Set([...allowedUrls].map((u) => u.split("/")[0]!));
const allowedEmails = new Set((allKnowledgeText.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()));
/** Phone numbers written in the knowledge, as digit strings (Sreehari's phone/WhatsApp). */
const allowedPhones = new Set(
  (allKnowledgeText.match(PHONE_RE) ?? []).map(digits).filter((d) => d.length >= 9),
);

/** All n-word sequences of a text (lowercase, punctuation ignored). */
function shinglesOf(text: string, n: number): Set<string> {
  const w = words(text);
  const set = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(" "));
  return set;
}

/**
 * n-word sequences of the knowledge (public content). A sequence that occurs there is never
 * evidence of a prompt leak, even if the rules happen to contain it too.
 */
export function knowledgeShingles(n: number): Set<string> {
  return shinglesOf(allKnowledgeText, n);
}

// 8-word sequences of the rules, minus (a) the replies the model is *supposed* to give,
// worded or canned (a model that follows rule 2 echoes "…can ask Sreehari directly at his
// email…" — that tripped the guard on the Preview), and (b) anything that also occurs in the
// knowledge.
const SHINGLE = 8;
const SANCTIONED_PHRASES = [TEXT.offTopic, TEXT.missing, ...SANCTIONED_RULE_PHRASES];
const ruleText = SANCTIONED_PHRASES.reduce((t, p) => t.replace(p, " "), SYSTEM_RULES);
const fromKnowledge = knowledgeShingles(SHINGLE);
const ruleShingles = new Set(
  [...shinglesOf(ruleText, SHINGLE)].filter((s) => !fromKnowledge.has(s)),
);
/** Prompt markers; one that occurs in the knowledge would flag public text, so it's dropped. */
const LEAK_MARKERS = ["<context>", "</context>", "untrusted reference data"].filter(
  (m) => !allKnowledgeText.toLowerCase().includes(m),
);
/** The canary with every separator removed, so "SSAI - CANARY - 7F3K9Q" is caught too. */
const CANARY_COMPACT = PROMPT_CANARY.toLowerCase().replace(/[^a-z0-9]+/g, "");

// ------------------------------------------------------------------------------ guard --

export type GuardResult =
  | { ok: true }
  | {
      ok: false;
      reason: "prompt_leak" | "phone" | "url" | "email";
      /**
       * What matched, safe to log: "canary", "marker", or the 8-word rule sequence (rule
       * text, never visitor data). Unset for phone/url/email, whose values aren't logged.
       */
      detail?: string;
    };

export function checkAnswer(answer: string): GuardResult {
  const lower = answer.toLowerCase();

  // The canary is checked first and is never excluded.
  if (lower.replace(/[^a-z0-9]+/g, "").includes(CANARY_COMPACT)) {
    return { ok: false, reason: "prompt_leak", detail: "canary" };
  }
  if (LEAK_MARKERS.some((m) => lower.includes(m))) {
    return { ok: false, reason: "prompt_leak", detail: "marker" };
  }
  const answerWords = words(answer);
  for (let i = 0; i + SHINGLE <= answerWords.length; i++) {
    const shingle = answerWords.slice(i, i + SHINGLE).join(" ");
    if (ruleShingles.has(shingle)) return { ok: false, reason: "prompt_leak", detail: shingle };
  }

  const emails = answer.match(EMAIL_RE) ?? [];
  if (emails.some((e) => !allowedEmails.has(e.toLowerCase())))
    return { ok: false, reason: "email" };
  const withoutEmails = answer.replace(EMAIL_RE, " ");

  const urls = [...(withoutEmails.match(URL_RE) ?? []), ...(withoutEmails.match(WWW_RE) ?? [])];
  if (urls.some((u) => !allowedUrls.has(normUrl(u)))) return { ok: false, reason: "url" };
  const withoutUrls = withoutEmails.replace(URL_RE, " ").replace(WWW_RE, " ");
  const domains = withoutUrls.match(DOMAIN_RE) ?? [];
  if (domains.some((d) => !allowedUrls.has(normUrl(d)) && !allowedHosts.has(normUrl(d)))) {
    return { ok: false, reason: "url" };
  }

  // 9+ digits = phone-like (keeps "2023-2025", "14 ms to 4 ms", "20–30 leads" etc. legal).
  const phones = (withoutUrls.match(PHONE_RE) ?? []).map(digits).filter((d) => d.length >= 9);
  if (phones.some((d) => !allowedPhones.has(d))) return { ok: false, reason: "phone" };

  return { ok: true };
}

// -------------------------------------------------------------------- streaming guard --

/** Characters held back when no sentence has ended yet. */
const HOLD_CHARS = 60;
/** End of a sentence: . ! ? … followed by whitespace, or a line break. */
const SENTENCE_END = /[.!?…](?=\s)|\n/g;
/** A phone-like digit run at the end of a prefix (it may continue after the cut). */
const TRAILING_DIGITS = /[+(]?\d[\d\s().\-/]*$/;

/**
 * How much of `text` is complete enough to check and show: up to the last finished sentence,
 * or everything except the last ~60 characters. The cut always falls on whitespace (so URLs
 * and emails are never split) and never inside a run of digits (so a phone number can't be
 * shown half before the rest arrives).
 */
export function safePrefixLength(text: string): number {
  let sentence = 0;
  for (const m of text.matchAll(SENTENCE_END)) sentence = (m.index ?? 0) + m[0].length;
  let byLength = text.length - HOLD_CHARS;
  if (byLength > 0) {
    const space = text.lastIndexOf(" ", byLength);
    byLength = space > 0 ? space : 0;
  }
  let cut = Math.max(sentence, byLength, 0);
  const digitRun = text.slice(0, cut).match(TRAILING_DIGITS);
  if (digitRun?.index !== undefined) {
    cut = digitRun.index;
    // Digits that end a longer token (".../971508624546 "): cut before the whole token, so a
    // URL is never shown or checked half-finished.
    if (cut > 0 && !/\s/.test(text[cut - 1]!)) {
      const before = text.slice(0, cut);
      const lastSpace = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\n"));
      cut = lastSpace + 1;
    }
  }
  return cut;
}

// ------------------------------------------------------------- WhatsApp link removal --

/** A wa.me URL, with or without the scheme (its trailing punctuation is kept separately). */
const WA_ME_URL = /(?:https?:\/\/)?(?:www\.)?wa\.me\/[^\s<>()[\]{}"'`]*/gi;

/**
 * Removes wa.me URLs from answer text when the WhatsApp button is shown instead. Token-level
 * only, so it is safe on a streaming prefix: the cut never splits a URL, so removing URLs
 * from a prefix always gives a prefix of the result for the longer text.
 */
export function removeWhatsAppUrls(text: string): string {
  return text.replace(WA_ME_URL, (url) => url.match(/[.,;:!?]+$/)?.[0] ?? "");
}

/**
 * Whole-answer tidy-up after removeWhatsAppUrls(): drops what a removed link leaves behind,
 * i.e. empty brackets, a "WhatsApp chat:" label with nothing after it, and stray spaces.
 */
export function tidyAfterLinkRemoval(text: string): string {
  return text
    .replace(/[ \t]*\([ \t]*(?:[^()\n:]*:)?[ \t]*\)/g, "") // "()" or "(WhatsApp chat: )"
    .replace(/^[ \t]*(?:[-•][ \t]*)?[^\n:]*whats ?app[^\n:]*:[ \t]*[.,;]?[ \t]*(?:\n|$)/gim, "")
    .replace(/[ \t]+([.,;!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n") // Markdown's "two spaces before a line break"
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Same text apart from spacing that the chat bubble doesn't show anyway. */
export const sameVisibleText = (a: string, b: string) => {
  const norm = (s: string) =>
    s
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim();
  return norm(a) === norm(b);
};

/** The full clean-up for a finished answer shown with contact buttons. */
export const withoutWhatsAppLinks = (text: string) =>
  tidyAfterLinkRemoval(removeWhatsAppUrls(text));

export type StreamGuardStep =
  | { ok: true; flush: string }
  | {
      ok: false;
      reason: Extract<GuardResult, { ok: false }>["reason"];
      detail?: string;
    };

/**
 * Incremental output guard for streamed answers. Text is shown only after the accumulated
 * text up to that point has passed checkAnswer() (canary/leak markers, prompt-rule shingles,
 * unknown URLs/emails, phone numbers). The latest incomplete sentence (or ~60 chars) is held
 * back until it passes. A rule fragment shorter than one 8-word shingle can still be shown
 * before the shingle completes and trips the guard — the client then replaces the bubble.
 */
export function createStreamGuard(options: { stripWhatsAppLinks?: boolean } = {}) {
  let text = "";
  /** Raw characters already processed, and the visible text they produced. */
  let checked = 0;
  let visible = "";
  const view = (raw: string) => (options.stripWhatsAppLinks ? removeWhatsAppUrls(raw) : raw);
  const step = (upTo: number): StreamGuardStep => {
    if (upTo <= checked) return { ok: true, flush: "" };
    const next = view(text.slice(0, upTo));
    const verdict = checkAnswer(next);
    if (!verdict.ok) return verdict;
    // view() is prefix-stable (see removeWhatsAppUrls), so `next` extends `visible`.
    const flush = next.startsWith(visible) ? next.slice(visible.length) : "";
    checked = upTo;
    visible = next;
    return { ok: true, flush };
  };
  return {
    /** Adds streamed text; returns the newly checked text that may be shown (may be ""). */
    push(delta: string): StreamGuardStep {
      text += delta;
      return step(safePrefixLength(text));
    },
    /** The stream finished: checks and releases everything that was held back. */
    end(): StreamGuardStep {
      return step(text.length);
    },
    get text() {
      return text;
    },
    /** Everything shown so far (after any link removal). */
    get visible() {
      return visible;
    },
  };
}
