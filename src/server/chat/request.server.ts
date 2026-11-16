// Request checks for /api/chat: origin, client IP, size-limited body, validation, hygiene.

import { createHmac } from "node:crypto";
import { z } from "zod";
import { LIMITS } from "./settings.server.ts";

/** Random id of this server instance, logged so warm-ups and questions can be matched up. */
export const INSTANCE_ID = crypto.randomUUID().slice(0, 6);

// ------------------------------------------------------------------------------ origin --

const normalizeOrigin = (o: string) => o.trim().replace(/\/+$/, "").toLowerCase();

/**
 * Allowed origins: CHAT_ALLOWED_ORIGINS, plus this exact Vercel deployment's own URLs
 * (VERCEL_URL = this deployment, VERCEL_BRANCH_URL = its branch alias,
 * VERCEL_PROJECT_PRODUCTION_URL). That is stricter than a "*-project-*.vercel.app" pattern:
 * a preview page can call only its own deployment's API.
 */
export function allowedOrigins(): Set<string> {
  const fromEnv = (process.env.CHAT_ALLOWED_ORIGINS ?? "").split(",").filter((o) => o.trim());
  const vercel = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .filter((h): h is string => !!h)
    .map((host) => `https://${host}`);
  return new Set([...fromEnv, ...vercel].map(normalizeOrigin));
}

/** Browsers send Origin on every POST fetch; requests without one (or a foreign one) fail. */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !!origin && allowedOrigins().has(normalizeOrigin(origin));
}

/**
 * For same-origin GET requests: browsers don't send Origin on those, so fall back to the
 * Referer's origin (sent by default for same-origin requests).
 */
export function isAllowedOriginOrReferer(request: Request): boolean {
  if (request.headers.get("origin")) return isAllowedOrigin(request);
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return allowedOrigins().has(normalizeOrigin(new URL(referer).origin));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------- IP --

/**
 * Client IP as Vercel provides it. Vercel overwrites X-Forwarded-For "to prevent IP spoofing"
 * (docs: Request headers); x-vercel-forwarded-for is the same value and, unlike
 * x-forwarded-for, can't be overwritten by a proxy in front of Vercel, so it goes first.
 * Locally (no Vercel), whatever the client sends is used — only matters for dev.
 */
export function clientIp(request: Request): string {
  const first = (name: string) => request.headers.get(name)?.split(",")[0]?.trim();
  return (
    first("x-vercel-forwarded-for") ||
    first("x-forwarded-for") ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Rate-limit key for an IP: HMAC so raw IPs are never stored (an unsalted hash of an IPv4
 * address is trivially reversible). Keyed with a server-only secret that already exists.
 */
export function ipKey(ip: string): string {
  const secret = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.GROQ_API_KEY || "local-dev";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

// -------------------------------------------------------------------------------- body --

export class BodyTooLargeError extends Error {}

/** Reads the body as text, refusing more than LIMITS.maxBodyBytes (even without Content-Length). */
export async function readBodyLimited(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > LIMITS.maxBodyBytes) throw new BodyTooLargeError();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > LIMITS.maxBodyBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// ---------------------------------------------------------------------- validation --

const messageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(LIMITS.maxHistoryMessageChars),
  })
  .strict();

export const chatBodySchema = z
  .object({ messages: z.array(messageSchema).min(1).max(LIMITS.maxMessages) })
  .strict();

export type ChatMessage = z.infer<typeof messageSchema>;

// ------------------------------------------------------------------------- hygiene --

// Unicode classes instead of literal code points: Cf = format characters (zero-width
// spaces/joiners, bidi controls, soft hyphen, BOM...), Cc = C0/C1 control characters.
const FORMAT_CHARS = /\p{Cf}/gu;
const CONTROL_CHARS = /\p{Cc}/gu;

/** Trim, strip control/zero-width characters, collapse all whitespace to single spaces. */
export function cleanText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(FORMAT_CHARS, "") // first: JS \s counts the BOM as whitespace
    .replace(/\s+/g, " ") // then newlines/tabs -> spaces, so removing controls can't glue words
    .replace(CONTROL_CHARS, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

export type ParsedChat =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; reason: "json" | "schema" | "last_not_user" | "too_long" | "empty" };

/** Parses + validates the body, applies hygiene, and enforces the latest-message limit. */
export function parseChatBody(raw: string): ParsedChat {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "json" };
  }
  const parsed = chatBodySchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "schema" };

  const messages = parsed.data.messages
    .map((m) => ({ role: m.role, content: cleanText(m.content) }))
    .filter((m) => m.content.length > 0);
  const last = messages.at(-1);
  if (!last) return { ok: false, reason: "empty" };
  if (last.role !== "user") return { ok: false, reason: "last_not_user" };
  if (last.content.length > LIMITS.maxMessageChars) return { ok: false, reason: "too_long" };
  return { ok: true, messages };
}
