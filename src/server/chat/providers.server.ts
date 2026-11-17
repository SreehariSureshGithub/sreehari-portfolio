// LLM providers over plain fetch (OpenAI-compatible chat completions; no SDKs).
// A primary and a short chain of fallbacks, each tried once in order — never retried in a loop.

import { LIMITS } from "./settings.server.ts";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = {
  name: "groq" | "groq-fallback" | `groq-fallback-${number}` | "gemini" | "groq-router";
  url: string;
  key: string;
  model: string;
  /** Provider-specific body fields. */
  extra: Record<string, unknown>;
};

export type Attempt = {
  provider: string;
  model: string;
  status: number | "timeout" | "network";
  ms: number;
  reason?: string;
  /** The provider's finish_reason ("stop" = complete; "length" = cut off at max tokens). */
  finish?: string;
  /** Streaming only: milliseconds until the first answer token arrived. */
  firstTokenMs?: number;
  /** Token usage reported by the provider (`usage` field). */
  usage?: {
    prompt: number;
    /** Prompt tokens served from Groq's prompt cache (they don't count toward rate limits). */
    cached?: number;
    completion: number;
    reasoning?: number;
    total: number;
  };
  /** Provider quota left after this call (Groq headers: tokens = per minute, requests = per day). */
  quota?: { tokensLeftMinute?: number; tokensLimitMinute?: number; requestsLeftDay?: number };
  /** Router calls only: what the provider's error body said (see readProviderError). */
  error?: ProviderError;
};

/**
 * The parts of a provider error body that are safe to log: its code, type and message
 * (shortened, with anything key-like removed). Groq's JSON-mode failure also returns the text
 * the model generated ("failed_generation"), which can repeat the visitor's words, and message
 * text is never logged. So only its length and its shape are kept (every letter becomes "a",
 * every digit "0"): enough to tell truncated JSON from prose or a code fence.
 */
export type ProviderError = {
  code?: string;
  type?: string;
  message?: string;
  generationChars?: number;
  generationShape?: string;
};

const redact = (s: string) =>
  s.replace(/gsk_[A-Za-z0-9_-]+/g, "[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");

export function readProviderError(body: string): ProviderError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body.trim() ? { message: redact(body.trim().slice(0, 300)) } : {};
  }
  const e = (parsed as { error?: Record<string, unknown> } | null)?.error;
  if (!e || typeof e !== "object") return {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const generation = str(e["failed_generation"]);
  const code = str(e["code"]);
  const type = str(e["type"]);
  const message = str(e["message"]);
  return {
    ...(code ? { code: code.slice(0, 60) } : {}),
    ...(type ? { type: type.slice(0, 60) } : {}),
    ...(message ? { message: redact(message.slice(0, 300)) } : {}),
    ...(generation
      ? {
          generationChars: generation.length,
          generationShape: generation.slice(0, 200).replace(/\p{L}/gu, "a").replace(/\p{N}/gu, "0"),
        }
      : {}),
  };
}

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
  prompt_tokens_details?: { cached_tokens?: number };
};

function readUsage(u: Usage | undefined): Attempt["usage"] {
  if (!u || typeof u.total_tokens !== "number") return undefined;
  const reasoning = u.completion_tokens_details?.reasoning_tokens;
  const cached = u.prompt_tokens_details?.cached_tokens;
  return {
    prompt: u.prompt_tokens ?? 0,
    ...(typeof cached === "number" ? { cached } : {}),
    completion: u.completion_tokens ?? 0,
    ...(typeof reasoning === "number" ? { reasoning } : {}),
    total: u.total_tokens,
  };
}

function readQuota(headers: Headers): Attempt["quota"] {
  const num = (name: string) => {
    const n = Number.parseInt(headers.get(name) ?? "", 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const tokensLeftMinute = num("x-ratelimit-remaining-tokens");
  const requestsLeftDay = num("x-ratelimit-remaining-requests");
  const tokensLimitMinute = num("x-ratelimit-limit-tokens");
  if (tokensLeftMinute === undefined && requestsLeftDay === undefined) return undefined;
  return {
    ...(tokensLeftMinute !== undefined ? { tokensLeftMinute } : {}),
    ...(requestsLeftDay !== undefined ? { requestsLeftDay } : {}),
    ...(tokensLimitMinute !== undefined ? { tokensLimitMinute } : {}),
  };
}

export type Generation =
  | { ok: true; text: string; provider: string; usedFallback: boolean; attempts: Attempt[] }
  | { ok: false; attempts: Attempt[] };

// gpt-oss (Groq) and Gemini 3.x are reasoning models: the token cap covers hidden reasoning
// too, so allow headroom on top of the answer budget. "low" is the lowest reasoning effort
// Groq accepts for gpt-oss ("none" is not supported for these models; Groq docs, checked
// 2026-11-15), so the effort can't be reduced further. A bare answer cap risks empty answers.
// Groq reserves the whole cap against the 8k tokens/minute limit when it accepts a request,
// so keep it tight: 240 + 110 (was 350 + 150).
const REASONING_HEADROOM = 110;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/**
 * Request fields per Groq model family. gpt-oss reasons at "low" with the reasoning hidden.
 * Qwen3 can switch reasoning off ("none") and hide it, so it needs no headroom and never sends
 * <think> text (checked 2026-11-17: no reasoning tokens, no <think> tag). Anything else gets
 * only the answer cap: an unknown reasoning field would make every call fail with HTTP 400.
 */
export function groqExtra(model: string): Record<string, unknown> {
  if (/^openai\/gpt-oss/i.test(model)) {
    return {
      max_completion_tokens: LIMITS.maxAnswerTokens + REASONING_HEADROOM,
      reasoning_effort: "low",
      include_reasoning: false,
    };
  }
  if (/^qwen\/qwen3/i.test(model)) {
    return {
      max_completion_tokens: LIMITS.maxAnswerTokens,
      reasoning_effort: "none",
      reasoning_format: "hidden",
    };
  }
  return { max_completion_tokens: LIMITS.maxAnswerTokens };
}

function groq(name: Provider["name"], model: string): Provider {
  return {
    name,
    url: GROQ_URL,
    key: process.env.GROQ_API_KEY ?? "",
    model,
    extra: groqExtra(model),
  };
}

/**
 * Groq models tried after GROQ_FALLBACK_MODEL, in order, on the same key. Each Groq model has
 * its own free daily quota (1,000 requests and 200,000 tokens a day; headers checked
 * 2026-11-17), so every model added here adds a day's worth of answers at $0. Only models that
 * passed scripts/test-fallback-models.ts belong here. GROQ_EXTRA_FALLBACK_MODELS (comma-separated)
 * replaces this list; "none" turns it off.
 */
export const DEFAULT_EXTRA_FALLBACK_MODELS: readonly string[] = ["qwen/qwen3.8-27b"];

export function extraFallbackModels(): string[] {
  const raw = process.env.GROQ_EXTRA_FALLBACK_MODELS?.trim();
  if (raw?.toLowerCase() === "none") return [];
  const list = raw ? raw.split(",") : DEFAULT_EXTRA_FALLBACK_MODELS;
  return list.map((m) => m.trim()).filter(Boolean);
}

/** Optional fallback providers, picked with CHAT_FALLBACK_PROVIDER. Add new ones here. */
const FALLBACKS: Record<string, () => Provider | undefined> = {
  // Default: a second Groq model — it has its own quota (doesn't help if Groq itself is down).
  groq: () =>
    process.env.GROQ_API_KEY && process.env.GROQ_FALLBACK_MODEL
      ? groq("groq-fallback", process.env.GROQ_FALLBACK_MODEL)
      : undefined,
  // Not in use: this project's Google account has no Gemini free tier (2026-11-11).
  gemini: () =>
    process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL
      ? {
          name: "gemini",
          url: GEMINI_URL,
          key: process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL,
          extra: {
            max_tokens: LIMITS.maxAnswerTokens + REASONING_HEADROOM,
            reasoning_effort: "low",
          },
        }
      : undefined,
};

/**
 * Primary: Groq (GROQ_MODEL). Then CHAT_FALLBACK_PROVIDER (default "groq": GROQ_FALLBACK_MODEL),
 * then the extra Groq models (extraFallbackModels). A model already in the chain is skipped.
 */
export function getProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.GROQ_API_KEY && process.env.GROQ_MODEL) {
    providers.push(groq("groq", process.env.GROQ_MODEL));
  }
  const fallback = FALLBACKS[process.env.CHAT_FALLBACK_PROVIDER?.trim() || "groq"]?.();
  if (fallback) providers.push(fallback);
  if (process.env.GROQ_API_KEY) {
    let n = 2;
    for (const model of extraFallbackModels()) {
      if (providers.some((p) => p.model === model)) continue;
      providers.push(groq(`groq-fallback-${n++}`, model));
    }
  }
  return providers;
}

/** One non-streaming answer from one Groq model (scripts/test-fallback-models.ts). */
export async function answerWithGroqModel(
  model: string,
  messages: LlmMessage[],
): Promise<{ text?: string; attempt: Attempt }> {
  return callProvider(groq("groq-fallback-2", model), messages);
}

async function callProvider(
  p: Provider,
  messages: LlmMessage[],
  options: { temperature?: number; timeoutMs?: number; captureError?: boolean } = {},
): Promise<{ text?: string; attempt: Attempt }> {
  const started = performance.now();
  const ms = () => Math.round(performance.now() - started);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? LIMITS.providerTimeoutMs);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: options.temperature ?? LIMITS.temperature,
        ...p.extra,
      }),
      signal: controller.signal,
    });
    const quota = readQuota(res.headers);
    const base = {
      provider: p.name,
      model: p.model,
      status: res.status,
      ...(quota ? { quota } : {}),
    };
    if (!res.ok) {
      // Error bodies are read only for the router (captureError), and only the safe parts.
      if (options.captureError) {
        const error = readProviderError(await res.text().catch(() => ""));
        return { attempt: { ...base, ms: ms(), reason: "http_error", error } };
      }
      await res.body?.cancel();
      return { attempt: { ...base, ms: ms(), reason: "http_error" } };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
      usage?: Usage;
    };
    const usage = readUsage(data.usage);
    const finish = data.choices?.[0]?.finish_reason ?? undefined;
    const withUsage = { ...base, ...(finish ? { finish } : {}), ...(usage ? { usage } : {}) };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { attempt: { ...withUsage, ms: ms(), reason: "empty_answer" } };
    return { text, attempt: { ...withUsage, ms: ms() } };
  } catch (error) {
    const timedOut = (error as Error).name === "AbortError";
    return {
      attempt: {
        provider: p.name,
        model: p.model,
        status: timedOut ? "timeout" : "network",
        ms: ms(),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries the primary, then each fallback once, in order. Falls back on 429, 5xx, timeout and network
 * errors as specified — and also on other failures (bad key, removed model, empty answer),
 * since a working fallback is better than the busy message. Provider error bodies are never
 * read or returned here (only for a failed router call, see callRouterModel).
 */
export async function generateAnswer(messages: LlmMessage[]): Promise<Generation> {
  const attempts: Attempt[] = [];
  for (const [i, provider] of getProviders().entries()) {
    const { text, attempt } = await callProvider(provider, messages);
    attempts.push(attempt);
    if (text) return { ok: true, text, provider: provider.name, usedFallback: i > 0, attempts };
  }
  return { ok: false, attempts };
}

// ------------------------------------------------------------------------- streaming --

export type StreamResult =
  | { ok: true; text: string; provider: string; usedFallback: boolean; attempts: Attempt[] }
  | {
      ok: false;
      /** True once any token was passed to onToken (then no other model is tried). */
      started: boolean;
      /** True when onToken asked to stop (the output guard tripped). */
      stopped: boolean;
      provider?: string;
      attempts: Attempt[];
    };

type StreamChunk = {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: Usage;
  x_groq?: { usage?: Usage };
};

/**
 * Streams one provider's answer. onToken returns false to stop (the stream is aborted).
 * The first-token timeout is the provider timeout; the whole answer gets twice that.
 */
async function streamProvider(
  p: Provider,
  messages: LlmMessage[],
  onToken: (delta: string) => boolean,
): Promise<{ text: string; started: boolean; stopped: boolean; attempt: Attempt }> {
  const started = performance.now();
  const ms = () => Math.round(performance.now() - started);
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), LIMITS.providerTimeoutMs);
  let text = "";
  let firstTokenMs: number | undefined;
  let stopped = false;
  let usage: Attempt["usage"];
  let quota: Attempt["quota"];
  let finish: string | undefined;
  const attemptOf = (status: Attempt["status"], reason?: string): Attempt => ({
    provider: p.name,
    model: p.model,
    status,
    ms: ms(),
    ...(reason ? { reason } : {}),
    ...(finish ? { finish } : {}),
    ...(firstTokenMs !== undefined ? { firstTokenMs } : {}),
    ...(usage ? { usage } : {}),
    ...(quota ? { quota } : {}),
  });
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: LIMITS.temperature,
        stream: true,
        ...p.extra,
      }),
      signal: controller.signal,
    });
    quota = readQuota(res.headers);
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return { text, started: false, stopped, attempt: attemptOf(res.status, "http_error") };
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    read: for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") break read;
        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(data) as StreamChunk;
        } catch {
          continue;
        }
        usage = readUsage(chunk.x_groq?.usage ?? chunk.usage) ?? usage;
        finish = chunk.choices?.[0]?.finish_reason ?? finish;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (!delta) continue;
        if (firstTokenMs === undefined) {
          firstTokenMs = ms();
          clearTimeout(timer);
          timer = setTimeout(() => controller.abort(), LIMITS.providerTimeoutMs * 2);
        }
        text += delta;
        if (!onToken(delta)) {
          stopped = true;
          controller.abort();
          break read;
        }
      }
    }
    if (stopped)
      return { text, started: true, stopped, attempt: attemptOf(200, "stopped_by_guard") };
    if (!text.trim())
      return { text, started: false, stopped, attempt: attemptOf(200, "empty_answer") };
    return { text: text.trim(), started: true, stopped, attempt: attemptOf(200) };
  } catch (error) {
    const timedOut = (error as Error).name === "AbortError";
    return {
      text,
      started: firstTokenMs !== undefined,
      stopped,
      attempt: attemptOf(timedOut ? "timeout" : "network"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streams the answer token by token. Falls back to the next provider only while nothing has
 * been passed to onToken yet (http error, timeout, network error or an empty answer before
 * the first token). Once tokens have gone out, a failure ends the attempt — no model switch.
 */
export async function streamAnswer(
  messages: LlmMessage[],
  onToken: (delta: string) => boolean,
): Promise<StreamResult> {
  const attempts: Attempt[] = [];
  for (const [i, provider] of getProviders().entries()) {
    const r = await streamProvider(provider, messages, onToken);
    attempts.push(r.attempt);
    if (r.started && !r.stopped && r.attempt.status === 200 && !r.attempt.reason) {
      return { ok: true, text: r.text, provider: provider.name, usedFallback: i > 0, attempts };
    }
    if (r.started) {
      return { ok: false, started: true, stopped: r.stopped, provider: provider.name, attempts };
    }
  }
  return { ok: false, started: false, stopped: false, attempts };
}

// ---------------------------------------------------------------------------- router --

/** Model for the query-understanding router: CHAT_ROUTER_MODEL, else the fallback model. */
export function routerModel(): string | undefined {
  return (
    process.env.CHAT_ROUTER_MODEL?.trim() || process.env.GROQ_FALLBACK_MODEL?.trim() || undefined
  );
}

/** Groq rejected the model's output in JSON mode (HTTP 400, code json_validate_failed). */
export function isJsonRejection(attempt: Attempt | undefined): boolean {
  return attempt?.status === 400 && attempt.error?.code === "json_validate_failed";
}

/**
 * One router call: JSON mode, temperature 0, low reasoning effort, small token cap, short
 * timeout. Returns the raw JSON text (validated by router.server.ts) and the attempt for
 * the log; a failed call's status and error body (safe parts only) are in the attempt.
 * `plain` turns JSON mode off: routeMessage() uses it for its one retry after Groq rejected
 * the model's JSON, since the parser also accepts JSON inside a fence or with text around
 * it. Never falls back to another model.
 */
export async function callRouterModel(
  messages: LlmMessage[],
  options: { plain?: boolean } = {},
): Promise<{ text?: string; attempt?: Attempt; jsonRejected?: boolean }> {
  const model = routerModel();
  if (!process.env.GROQ_API_KEY || !model) return {};
  const provider: Provider = {
    name: "groq-router",
    url: GROQ_URL,
    key: process.env.GROQ_API_KEY,
    model,
    extra: {
      max_completion_tokens: 250,
      reasoning_effort: "low",
      include_reasoning: false,
      ...(options.plain ? {} : { response_format: { type: "json_object" } }),
    },
  };
  const res = await callProvider(provider, messages, {
    temperature: 0,
    timeoutMs: LIMITS.routerTimeoutMs,
    captureError: true,
  });
  return isJsonRejection(res.attempt) ? { ...res, jsonRejected: true } : res;
}
