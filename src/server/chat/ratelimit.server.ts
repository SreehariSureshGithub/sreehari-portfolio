// Rate limits for /api/chat (values: LIMITS in settings.server.ts / chatbot-settings.md).
//
//   burst   per IP, sliding 1 min  — every request counts 1
//   hour    per IP, sliding 1 h    — message budget, counted in units (1 message = 100 units)
//   day     per IP, sliding 1 d    — same units
//   global  all IPs, fixed 1 d     — only questions that reach the main LLM count
//   router  all IPs, fixed 1 d     — query-understanding calls (see router.server.ts)
//
// Flow (one Upstash round trip for answers without an LLM call, two with one):
//   admitRequest()  burst +1, hour +0.25, day +0.25 — three checks in parallel. That 0.25 is
//                   the whole cost of a gate refusal, a chip answer or a cached answer.
//   admitLlmCall()  only before an LLM call: hour +0.75, day +0.75, global +1, in parallel.
//                   If any of them fails, the others are refunded and the request gets a 429.
// A question is accepted while the hour/day budgets aren't used up; an LLM answer also needs
// the remaining 0.75 to fit (the sliding window counts a charge that overshoots as a failure).
//
// Upstash Redis when configured; otherwise an in-memory fallback (local dev only — it is
// per-instance, so it doesn't protect a multi-instance deployment).

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { LIMITS } from "./settings.server.ts";

export type LimitScope = "burst" | "ip" | "global";
export type RateLimitResult = { ok: true } | { ok: false; scope: LimitScope; resetAt: number };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Units per message, so fractional weights (0.25) work with integer counters. */
const UNIT = 100;
/** Units charged up front: the full cost of an answer that needs no LLM call. */
const baseUnits = () => Math.round(LIMITS.refusedWeight * UNIT);
/** Units added only when the question goes to the LLM. */
const llmUnits = () => UNIT - baseUnits();

type WindowResult = { success: boolean; reset: number };
/** `units` < 0 refunds. */
type Window = (key: string, units: number) => Promise<WindowResult>;
type Windows = {
  burst: Window;
  hour: Window;
  day: Window;
  global: Window;
  router: Window;
  warm: Window;
};

/** Keys are separated per environment so local/preview testing never eats production quota. */
const namespace = `chat:${process.env.VERCEL_ENV ?? "local"}`;

function upstashWindows(url: string, token: string): Windows {
  // Few retries: a dead Redis should fall back to the in-memory limiter quickly.
  const redis = new Redis({ url, token, retry: { retries: 1, backoff: () => 100 } });
  const make = (name: string, limiter: ConstructorParameters<typeof Ratelimit>[0]["limiter"]) => {
    const rl = new Ratelimit({ redis, prefix: `${namespace}:${name}`, limiter, timeout: 2000 });
    return async (key: string, units: number) => {
      const result = await rl.limit(key, { rate: units });
      // @upstash/ratelimit resolves as "allowed" when Redis doesn't answer within `timeout`.
      // Treat that as an error so withFallback() applies the in-memory limits instead.
      if (result.reason === "timeout") throw new Error("Upstash rate limit timed out");
      return result;
    };
  };
  return {
    burst: make("burst", Ratelimit.slidingWindow(LIMITS.perIpPerMinute, "1 m")),
    hour: make("ip-hour", Ratelimit.slidingWindow(LIMITS.perIpPerHour * UNIT, "1 h")),
    day: make("ip-day", Ratelimit.slidingWindow(LIMITS.perIpPerDay * UNIT, "1 d")),
    global: make("global", Ratelimit.fixedWindow(LIMITS.globalPerDay, "1 d")),
    router: make("router", Ratelimit.fixedWindow(LIMITS.routerGlobalPerDay, "1 d")),
    warm: make("warm", Ratelimit.slidingWindow(LIMITS.perIpPerMinute, "1 m")),
  };
}

/** Weighted sliding log per key; a refund reduces the key's latest entry. */
function memoryWindow(limit: number, windowMs: number): Window {
  const log = new Map<string, { t: number; units: number }[]>();
  return async (key, units) => {
    const now = Date.now();
    const entries = (log.get(key) ?? []).filter((e) => now - e.t < windowMs);
    log.set(key, entries);
    const last = entries.at(-1);
    if (units < 0) {
      if (last) last.units = Math.max(0, last.units + units);
      return { success: true, reset: now };
    }
    const used = entries.reduce((sum, e) => sum + e.units, 0);
    const reset = (entries[0]?.t ?? now) + windowMs;
    if (used + units > limit) return { success: false, reset };
    entries.push({ t: now, units });
    return { success: true, reset };
  };
}

function memoryWindows(): Windows {
  return {
    burst: memoryWindow(LIMITS.perIpPerMinute, MINUTE),
    hour: memoryWindow(LIMITS.perIpPerHour * UNIT, HOUR),
    day: memoryWindow(LIMITS.perIpPerDay * UNIT, DAY),
    global: memoryWindow(LIMITS.globalPerDay, DAY),
    router: memoryWindow(LIMITS.routerGlobalPerDay, DAY),
    warm: memoryWindow(LIMITS.perIpPerMinute, MINUTE),
  };
}

let windows: Windows | undefined;

function getWindows(): Windows {
  if (windows) return windows;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    windows = upstashWindows(url, token);
  } else {
    console.warn(
      "[chat] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — using an in-memory rate limiter (local dev only).",
    );
    windows = memoryWindows();
  }
  return windows;
}

let fallbackWindows: Windows | undefined;

/**
 * Fails safe, not open: if Redis fails (network, outage), the same limits are applied with a
 * per-instance in-memory limiter for that request — never "unlimited". The failure is logged
 * (error type only).
 */
async function withFallback<T>(what: string, fn: (w: Windows) => Promise<T>): Promise<T> {
  try {
    return await fn(getWindows());
  } catch (error) {
    console.error(
      `[chat] rate limiter error (${what}) — using the in-memory limiter:`,
      (error as Error).name,
    );
    fallbackWindows ??= memoryWindows();
    return fn(fallbackWindows);
  }
}

/** Refunds the windows that accepted a charge for a request we're turning away. */
async function undo(charges: [Window, string, number, WindowResult][]): Promise<void> {
  await Promise.all(
    charges
      .filter(([, , units, r]) => r.success && units > 0)
      .map(([w, key, units]) => w(key, -units)),
  );
}

const skipped: WindowResult = { success: true, reset: 0 };

/**
 * Burst +1 and the 0.25 base charge on the hour and day budgets, all in parallel (one round
 * trip). Answers that need no LLM call make no further rate-limit calls.
 */
export function admitRequest(ipKey: string): Promise<RateLimitResult> {
  return withFallback<RateLimitResult>("admit", async (w) => {
    const base = baseUnits();
    const [burst, hour, day] = await Promise.all([
      w.burst(ipKey, 1),
      base > 0 ? w.hour(ipKey, base) : skipped,
      base > 0 ? w.day(ipKey, base) : skipped,
    ]);
    if (burst.success && hour.success && day.success) return { ok: true };
    // Rejected: give back the hour/day charges (only on this rare path). The burst charge
    // stays — every request counts toward the per-minute burst limit, rejected or not.
    await undo([
      [w.hour, ipKey, base, hour],
      [w.day, ipKey, base, day],
    ]);
    return burst.success
      ? { ok: false, scope: "ip", resetAt: Math.max(hour.reset, day.reset) }
      : { ok: false, scope: "burst", resetAt: burst.reset };
  });
}

/** Before an LLM call: the remaining 0.75 on hour/day plus the global daily cap, in parallel. */
export function admitLlmCall(ipKey: string): Promise<RateLimitResult> {
  return withFallback<RateLimitResult>("llm", async (w) => {
    const extra = llmUnits();
    const [hour, day, all] = await Promise.all([
      extra > 0 ? w.hour(ipKey, extra) : skipped,
      extra > 0 ? w.day(ipKey, extra) : skipped,
      w.global("all", 1),
    ]);
    if (hour.success && day.success && all.success) return { ok: true };
    await undo([
      [w.hour, ipKey, extra, hour],
      [w.day, ipKey, extra, day],
      [w.global, "all", 1, all],
    ]);
    return hour.success && day.success
      ? { ok: false, scope: "global", resetAt: all.reset }
      : { ok: false, scope: "ip", resetAt: Math.max(hour.reset, day.reset) };
  });
}

/**
 * Before a router call: the router's own global daily cap (it spends the fallback model's
 * daily tokens). Per visitor, routing costs nothing extra: a routed smalltalk/off-topic
 * reply costs the 0.25 already charged by admitRequest(), an answer the usual 1.0.
 * False = cap reached; the caller falls back to the embedding gate (no LLM call).
 */
export function admitRouterCall(): Promise<boolean> {
  return withFallback<boolean>("router", async (w) => (await w.router("all", 1)).success);
}

/** Burst limit for the warm-up endpoint (its own window, so warm-ups never block questions). */
export function admitWarmUp(ipKey: string): Promise<RateLimitResult> {
  return withFallback<RateLimitResult>("warm", async (w) => {
    const r = await w.warm(ipKey, 1);
    return r.success ? { ok: true } : { ok: false, scope: "burst", resetAt: r.reset };
  });
}
