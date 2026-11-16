// Token usage per chat request, from the providers' `usage` field. Run: npm run measure:tokens
// Uses the real pipeline (retrieval → system prompt → Groq) with keys from .env.local, so it
// spends real free-tier quota (~2 × questions calls). Calls are spaced out to stay under the
// 8k tokens/minute limit. Prints numbers only — never keys, prompts or answers.

import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import {
  retrieveForChat,
  warmUpEmbeddings,
  withPinnedChunks,
} from "../src/server/rag/retrieve.server.ts";
import { buildModelMessages } from "../src/server/chat/prompt.server.ts";
import { generateAnswer, type Attempt } from "../src/server/chat/providers.server.ts";
import { asksForContactDetails } from "../src/server/chat/contact-actions.server.ts";
import { isHiringMessage, mentionsAssistant } from "../src/server/chat/router.server.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const QUESTIONS: string[][] = [
  ["What is Sreehari doing now?"],
  ["What's his work experience?"],
  ["What computer vision projects has he built?"],
  ["Has he used TensorRT?"],
  ["Tell me about Deckup Nutrition", "How many leads per day?"],
  ["What's his education?"],
  ["Does he know RAG?"],
  ["How can I contact him?"],
  ["What are his skills?", "Which of those has he used in production?"],
  ["Can he join immediately?"],
  // A hiring question: as in /api/chat it gets the results chunk and the reminder.
  ["We have an AI engineer role that needs 3 years of experience. Is Sreehari a fit?"],
];

const GAP_MS = Number(process.env.MEASURE_GAP_MS ?? 13_000);
const primary = process.env.GROQ_MODEL;
const fallback = process.env.GROQ_FALLBACK_MODEL;
if (!process.env.GROQ_API_KEY || !primary) {
  console.error("GROQ_API_KEY / GROQ_MODEL missing in .env.local");
  process.exit(1);
}
const models = [primary, ...(fallback && fallback !== primary ? [fallback] : [])];

type Row = {
  model: string;
  turn: number;
  usage: NonNullable<Attempt["usage"]>;
  ms: number;
  /** Tokens/minute counter drop for this call (limit − remaining; calls are spaced so the bucket is full before each). */
  reserved?: number;
  limit?: number;
  /** A hiring question (results chunk + reminder), reported separately. */
  hiring: boolean;
};
const rows: Row[] = [];
const pad = (s: string | number, n: number) => String(s).padStart(n);

await warmUpEmbeddings();
// Only the model under test: no fallback, so every number belongs to that model.
process.env.CHAT_FALLBACK_PROVIDER = "none";

console.log(`model                  turn  prompt cached  compl  reason  total  reserved     ms`);
for (const conversation of QUESTIONS) {
  for (const model of models) {
    process.env.GROQ_MODEL = model;
    const history: { role: "user" | "assistant"; content: string }[] = [];
    for (const [i, question] of conversation.entries()) {
      history.push({ role: "user", content: question });
      const retrieval = await retrieveForChat(history);
      if (!retrieval.relevant) {
        console.log(`${model.padEnd(22)} ${i + 1}  (refused by the gate — no LLM call)`);
        history.push({ role: "assistant", content: "refused" });
        continue;
      }
      const hiring = isHiringMessage(question);
      const gen = await generateAnswer(
        buildModelMessages(
          history,
          withPinnedChunks(retrieval.results, {
            evidence: hiring,
            assistant: mentionsAssistant(question),
            contact: asksForContactDetails(question),
          }),
          {
            usedHistory: retrieval.usedHistory,
            hiring,
          },
        ),
      );
      const attempt = gen.attempts.at(-1);
      if (!gen.ok || !attempt?.usage) {
        console.log(
          `${model.padEnd(22)} ${i + 1}  failed: ${attempt?.status} ${attempt?.reason ?? ""}`,
        );
        history.push({ role: "assistant", content: "error" });
      } else {
        const u = attempt.usage;
        const q = attempt.quota;
        const limit = q?.tokensLimitMinute;
        const reserved =
          limit !== undefined && q?.tokensLeftMinute !== undefined
            ? limit - q.tokensLeftMinute
            : undefined;
        rows.push({ model, turn: i + 1, usage: u, ms: attempt.ms, reserved, limit, hiring });
        const words = gen.text.split(/\s+/).filter(Boolean).length;
        console.log(
          `${model.padEnd(22)} ${pad(i + 1, 4)} ${pad(u.prompt, 7)} ${pad(u.cached ?? "-", 6)} ${pad(u.completion, 6)} ${pad(u.reasoning ?? "-", 7)} ${pad(u.total, 6)} ${pad(reserved ?? "-", 9)} ${pad(attempt.ms, 6)}  ${attempt.finish ?? "?"}, ${words} words${hiring ? ", hiring" : ""}`,
        );
        history.push({ role: "assistant", content: gen.text });
      }
      await sleep(GAP_MS);
    }
  }
}

console.log("\nHiring answers (results chunk + reminder)");
for (const model of models) {
  for (const x of rows.filter((x) => x.model === model && x.hiring)) {
    console.log(
      `${model.padEnd(22)} prompt ${x.usage.prompt} (cached ${x.usage.cached ?? 0})  completion ${x.usage.completion}  reasoning ${x.usage.reasoning ?? 0}  total ${x.usage.total}`,
    );
  }
}

console.log("\nAverages per LLM call, ordinary answers");
for (const model of models) {
  const r = rows.filter((x) => x.model === model && !x.hiring);
  if (!r.length) continue;
  const cachedShare = r.filter((x) => (x.usage.cached ?? 0) > 0);
  console.log(
    `${model.padEnd(22)} calls with cached prompt tokens: ${cachedShare.length}/${r.length}` +
      (cachedShare.length
        ? `, cached share of the prompt on those: ${Math.round((100 * cachedShare.reduce((s, x) => s + x.usage.cached! / x.usage.prompt, 0)) / cachedShare.length)}%`
        : ""),
  );
  const avg = (f: (x: Row) => number) => Math.round(r.reduce((s, x) => s + f(x), 0) / r.length);
  const max = Math.max(...r.map((x) => x.usage.total));
  const total = avg((x) => x.usage.total);
  const withReserved = r.filter((x) => x.reserved !== undefined);
  const reserved = withReserved.length
    ? Math.round(withReserved.reduce((s, x) => s + x.reserved!, 0) / withReserved.length)
    : undefined;
  const limit = r.find((x) => x.limit)?.limit;
  console.log(
    `${model.padEnd(22)} n=${r.length}  prompt ${avg((x) => x.usage.prompt)} (cached ${avg((x) => x.usage.cached ?? 0)})  completion ${avg((x) => x.usage.completion)}  reasoning ${avg((x) => x.usage.reasoning ?? 0)}  total ${total} (max ${max})  latency ${avg((x) => x.ms)} ms`,
  );
  if (reserved && limit) {
    console.log(
      `${"".padEnd(22)} reserved per call ${reserved} of ${limit} tokens/min → ${(limit / reserved).toFixed(1)} answers/min`,
    );
  }
  const followUps = r.filter((x) => x.turn > 1);
  if (followUps.length) {
    console.log(
      `${"".padEnd(22)} follow-ups only: total ${Math.round(followUps.reduce((s, x) => s + x.usage.total, 0) / followUps.length)}`,
    );
  }
}
