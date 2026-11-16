// Fingerprint of the system prompt: the main model's rules plus the router's instructions.
// Part of the answer-cache key (answer-cache.server.ts), so any prompt change starts a fresh
// cache instead of serving answers written under the old rules (the live site kept serving
// "He did not use Codex or Claude" after the rule that caused it was fixed, 2026-11-16).

import { createHash } from "node:crypto";
import { SYSTEM_RULES } from "./prompt.server.ts";
import { ROUTER_INSTRUCTIONS } from "./router.server.ts";

export function systemPromptHash(
  rules: string = SYSTEM_RULES,
  routerInstructions: string = ROUTER_INSTRUCTIONS,
): string {
  return createHash("sha256").update(`${rules}\0${routerInstructions}`).digest("hex").slice(0, 16);
}

export const SYSTEM_PROMPT_HASH = systemPromptHash();
