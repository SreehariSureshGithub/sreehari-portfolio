// Chat behaviour from docs/chatbot/chatbot-settings.md (the source of truth — keep in sync).
// Visitor-facing texts live in src/lib/chat-copy.ts (shared with the chat UI); numeric limits
// can be overridden with env vars.

import { CHAT_TEXT } from "../../lib/chat-copy.ts";

export const TEXT = CHAT_TEXT;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** A fraction in [0, 1] (e.g. 0.25), or the fallback. */
function fractionFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

export const LIMITS = {
  /** Max characters of the latest user message. */
  maxMessageChars: intFromEnv("CHAT_MAX_MESSAGE_CHARS", 500),
  /** Max characters of any message in the submitted history. */
  maxHistoryMessageChars: 2000,
  /** Max messages accepted in a request. */
  maxMessages: 12,
  /** Max request body size in bytes. */
  maxBodyBytes: 16 * 1024,
  /** Messages forwarded to the model. */
  historyToModel: intFromEnv("CHAT_HISTORY_TO_MODEL", 6),
  /** Per-IP burst limit: every request counts as 1. */
  perIpPerMinute: intFromEnv("CHAT_RATE_PER_IP_MINUTE", 6),
  /** Per-IP message budgets (sliding windows). A gate-refused question costs refusedWeight. */
  perIpPerHour: intFromEnv("CHAT_RATE_PER_IP_HOUR", 40),
  perIpPerDay: intFromEnv("CHAT_RATE_PER_IP_DAY", 30),
  /**
   * Questions that reach the LLM, all visitors together, sized so a full day fits inside
   * Groq's 200,000 tokens/day per model (confirmed by a 429 on 2026-11-12). Measured
   * 2026-11-15 (eval run 10, server logs): an ordinary answer ~1,750 tokens, a hiring answer
   * ~2,200 (results chunk and reminder), a router call ~800. Cached prompt tokens are not
   * subtracted: caching is best-effort (see docs/chatbot/chatbot-settings.md, Limits).
   * Worst day, 120 hiring answers at 2,250: the primary serves the first 88 (198K), the
   * fallback the other 32 (72K) next to 120 router calls (96K) = 168K. Both under 200K.
   * It was 100, sized for 2,500–3,150 tokens per answer.
   */
  globalPerDay: intFromEnv("CHAT_RATE_GLOBAL_DAY", 120),
  /**
   * Query-understanding router (intent + standalone search query), on the fallback model by
   * default. It shares that model's 200,000 tokens/day with fallback answers. A call
   * measured 784–839 tokens on average (2026-11-15), so 120 calls ≈ 96K tokens, which
   * leaves ~104K for fallback answers (32 are needed on the worst day, 72K). Past the cap,
   * the embedding gate decides (no LLM call). CHAT_ROUTER=off disables it entirely. It was 100.
   */
  routerEnabled: process.env.CHAT_ROUTER !== "off",
  routerGlobalPerDay: intFromEnv("CHAT_ROUTER_GLOBAL_DAY", 120),
  routerTimeoutMs: intFromEnv("CHAT_ROUTER_TIMEOUT_MS", 3000),
  /**
   * Fast path: a first message of more than 3 words whose relevance is at least this skips
   * the router (no extra latency or tokens). The highest off-topic score in
   * scripts/test-retrieval.ts is 0.653, so 0.70 leaves a margin.
   */
  routerFastPathRelevance: fractionFromEnv("CHAT_ROUTER_FAST_PATH", 0.7),
  /** Cost of a question refused by the relevance gate (no LLM call), as a fraction of one. */
  refusedWeight: fractionFromEnv("CHAT_REFUSED_WEIGHT", 0.25),
  /** Semantic answer cache for first-turn questions (Upstash). CHAT_ANSWER_CACHE=off disables it. */
  answerCacheEnabled: process.env.CHAT_ANSWER_CACHE !== "off",
  /** Minimum cosine similarity between a new question and a cached one to reuse its answer. */
  answerCacheSimilarity: fractionFromEnv("CHAT_CACHE_SIMILARITY", 0.95),
  answerCacheTtlDays: intFromEnv("CHAT_CACHE_TTL_DAYS", 7),
  answerCacheMaxEntries: intFromEnv("CHAT_CACHE_MAX_ENTRIES", 500),
  /**
   * Answer length cap. The prompt asks for about 60 words (~90 tokens); 240 tokens (~170
   * words) leaves room for a longer answer when the visitor asks for detail. Reasoning
   * models need extra room on top (see providers). It was 350.
   */
  maxAnswerTokens: intFromEnv("CHAT_MAX_ANSWER_TOKENS", 240),
  temperature: 0.2,
  providerTimeoutMs: intFromEnv("CHAT_PROVIDER_TIMEOUT_MS", 15_000),
} as const;
