// Generates src/server/chat/chip-answers.server.json — called at the end of build-index.ts.
// Uses the real pipeline (retrieval → system prompt → Groq → output guard) so a chip answer is
// exactly what /api/chat would have produced. Skips regeneration when the knowledge hash,
// prompt setup and questions are unchanged. Needs GROQ_API_KEY/GROQ_MODEL (.env.local);
// without them the existing file is kept and the server ignores it if it's stale.
// An answer is ~1,800 tokens and the primary allows 8,000 tokens per minute, so four in a row
// may not fit in one minute: the script waits for the per-minute budget between answers,
// retries once after a rate limit, and keeps answers already generated for the same setup
// (a rerun only fills in what is missing).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { CHAT_UI } from "../src/lib/chat-copy.ts";

/** Per-minute tokens one answer needs free on the primary (prompt + the reserved cap). */
const NEED_TOKENS = 2400;
/**
 * The prompt asks for about 60 words. A chip answer is served for days, so one that runs
 * past this is generated once more (with a one-line reminder) and skipped if it is still too
 * long. The same goes for a contact sentence on an answer that is complete.
 */
const MAX_WORDS = 70;
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

type ChipFile = {
  knowledgeHash: string;
  promptHash: string;
  generatedAt: string;
  model: string;
  answers: { question: string; answer: string }[];
};

export async function buildChipAnswers(root: string, knowledgeHash: string): Promise<void> {
  const outPath = join(root, "src", "server", "chat", "chip-answers.server.json");
  const envPath = join(root, ".env.local");
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  // Imported only now, after the new index has been written.
  const { answerSetupHash } = await import("../src/server/chat/chip-answers.server.ts");
  const { retrieveForChat, withPinnedChunks } =
    await import("../src/server/rag/retrieve.server.ts");
  const { buildModelMessages } = await import("../src/server/chat/prompt.server.ts");
  const { mentionsAssistant } = await import("../src/server/chat/router.server.ts");
  const { generateAnswer } = await import("../src/server/chat/providers.server.ts");
  const { checkAnswer } = await import("../src/server/chat/guard.server.ts");
  const { asksForContactDetails, contactActionsForAnswer, isContactQuestion } =
    await import("../src/server/chat/contact-actions.server.ts");
  /** What is wrong with a chip answer (too long, an unasked contact sentence, a bare contact list), or null. */
  const problemWith = (question: string, answer: string) =>
    wordCount(answer) > MAX_WORDS
      ? {
          what: `has ${wordCount(answer)} words (limit ${MAX_WORDS})`,
          reminder: "Reminder for this reply: 60 words at most.",
        }
      : !isContactQuestion(question) && contactActionsForAnswer(answer)
        ? {
            what: "is a complete answer with a contact sentence",
            reminder: "Reminder for this reply: the answer is complete, so no contact sentence.",
          }
        : /^\s*email:/i.test(answer) || /https?:\/\/(?:www\.)?linkedin/i.test(answer)
          ? {
              what: "gives the contact lines without an intro or with a full LinkedIn URL",
              reminder:
                "Reminder for this reply: one short intro sentence first, and the LinkedIn line without https://www.",
            }
          : null;
  const { isCacheableAnswer } = await import("../src/server/chat/answer-cache.server.ts");

  const promptHash = answerSetupHash();
  const questions = [...CHAT_UI.suggestedQuestions];
  const existing = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, "utf8")) as ChipFile)
    : undefined;
  if (
    existing &&
    existing.knowledgeHash === knowledgeHash &&
    existing.promptHash === promptHash &&
    // Written by the primary model (older files from the fallback get regenerated).
    (!process.env.GROQ_MODEL || existing.model === process.env.GROQ_MODEL) &&
    questions.every((q) => existing.answers.some((a) => a.question === q)) &&
    existing.answers.every((a) => !problemWith(a.question, a.answer))
  ) {
    console.log(`Chip answers: up to date (${existing.answers.length} answers)`);
    return;
  }
  if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
    console.warn(
      "Chip answers: GROQ_API_KEY / GROQ_MODEL not set — kept the old file; the server ignores it until it is regenerated.",
    );
    return;
  }

  // Answers from an earlier run with the same knowledge, prompt setup and primary model.
  const kept = new Map(
    existing &&
      existing.knowledgeHash === knowledgeHash &&
      existing.promptHash === promptHash &&
      existing.model === process.env.GROQ_MODEL
      ? existing.answers.map((a) => [a.question, a.answer])
      : [],
  );
  const answers: ChipFile["answers"] = [];
  let model = process.env.GROQ_MODEL;
  let generated = 0;
  /** Tokens left this minute on the primary after the last call (from Groq's headers). */
  let left: number | undefined;
  let limit: number | undefined;
  for (const question of questions) {
    const earlier = kept.get(question);
    if (earlier && !problemWith(question, earlier)) {
      answers.push({ question, answer: earlier });
      continue;
    }
    const history = [{ role: "user" as const, content: question }];
    const retrieval = await retrieveForChat(history);
    if (!retrieval.relevant) {
      console.warn(`Chip answers: "${question}" is blocked by the relevance gate — skipped`);
      continue;
    }
    const messages = buildModelMessages(
      history,
      withPinnedChunks(retrieval.results, {
        assistant: mentionsAssistant(question),
        contact: asksForContactDetails(question),
      }),
      {
        usedHistory: retrieval.usedHistory,
      },
    );
    if (left !== undefined && limit && left < NEED_TOKENS) {
      const waitMs = Math.ceil(((NEED_TOKENS - left) / limit) * 60_000) + 1000;
      console.log(`Chip answers: waiting ${Math.round(waitMs / 1000)} s for the per-minute budget`);
      await sleep(waitMs);
    }
    let gen = await generateAnswer(messages);
    // Rate-limited on the primary (the fallback answered instead): wait a minute, try once more.
    if (gen.ok && gen.usedFallback && gen.attempts[0]?.status === 429) {
      console.log("Chip answers: primary rate-limited — waiting 60 s, then one more try");
      await sleep(60_000);
      gen = await generateAnswer(messages);
    }
    // Too long, or a contact sentence on a complete answer: one more try, with a one-line
    // reminder after the question (the same answer came back twice without it, 2026-11-15).
    const issue = gen.ok && !gen.usedFallback ? problemWith(question, gen.text) : null;
    if (issue) {
      console.log(`Chip answers: "${question}" ${issue.what} — waiting 20 s, then one more try`);
      await sleep(20_000);
      gen = await generateAnswer([...messages, { role: "system", content: issue.reminder }]);
    }
    const quota = gen.attempts[0]?.quota;
    left = quota?.tokensLeftMinute;
    limit = quota?.tokensLimitMinute;
    if (!gen.ok) {
      console.warn(`Chip answers: no answer for "${question}" (provider failed) — skipped`);
      continue;
    }
    // Chip answers are served for days, so only the primary model writes them. (A skipped
    // chip is answered live until the next build:index.)
    if (gen.usedFallback) {
      console.warn(
        `Chip answers: "${question}" came from the fallback model (primary unavailable, e.g. its daily token limit) — skipped; rerun npm run build:index later`,
      );
      continue;
    }
    if (!checkAnswer(gen.text).ok || !isCacheableAnswer(gen.text)) {
      console.warn(`Chip answers: answer for "${question}" was refused or guarded — skipped`);
      continue;
    }
    const still = problemWith(question, gen.text);
    if (still) {
      console.warn(`Chip answers: answer for "${question}" ${still.what} — skipped`);
      continue;
    }
    model = gen.attempts.at(-1)?.model ?? model;
    answers.push({ question, answer: gen.text });
    generated++;
  }

  const file: ChipFile = {
    knowledgeHash,
    promptHash,
    generatedAt: new Date().toISOString(),
    model,
    answers,
  };
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`);
  const reused = answers.length - generated;
  console.log(
    `Chip answers: generated ${answers.length}/${questions.length} with ${model}` +
      (reused ? ` (${generated} new, ${reused} kept from the last run)` : ""),
  );
}
