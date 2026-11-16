// Server-side env validation for /api/chat. Logs variable NAMES only — never values.

const REQUIRED = ["GROQ_API_KEY", "GROQ_MODEL", "CHAT_ALLOWED_ORIGINS"] as const;
const SECRET_NAMES = [
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

export type EnvStatus = { ok: boolean; missing: string[] };

let status: EnvStatus | undefined;

/** Validated once per server instance (on the first import of the chat route). */
export function chatEnvStatus(): EnvStatus {
  if (status) return status;
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  for (const name of missing) {
    console.error(`[chat] missing required environment variable: ${name}`);
  }

  // The fallback is optional: without it, a failed primary call returns the busy message.
  const fallback = process.env.CHAT_FALLBACK_PROVIDER?.trim() || "groq";
  const fallbackVars: Record<string, string[]> = {
    groq: ["GROQ_FALLBACK_MODEL"],
    gemini: ["GEMINI_API_KEY", "GEMINI_MODEL"],
  };
  const needed = fallbackVars[fallback];
  if (!needed) {
    console.warn(`[chat] unknown CHAT_FALLBACK_PROVIDER "${fallback}" — no fallback LLM`);
  } else {
    for (const name of needed.filter((n) => !process.env[n]?.trim())) {
      console.warn(`[chat] fallback LLM "${fallback}" disabled: ${name} is not set`);
    }
  }

  // VITE_* variables are exposed to the browser bundle by Vite.
  for (const name of SECRET_NAMES) {
    if (process.env[`VITE_${name}`]) {
      console.error(
        `[chat] VITE_${name} is set — secrets must never use the VITE_ prefix (it is bundled into the client)`,
      );
    }
  }

  status = { ok: missing.length === 0, missing };
  return status;
}
