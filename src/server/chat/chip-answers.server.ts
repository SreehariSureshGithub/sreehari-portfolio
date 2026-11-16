// Pre-generated answers for the suggested question chips (written by `npm run build:index`).
// They are served without an LLM call, but only while they match the current knowledge hash
// AND the current prompt/retrieval setup — otherwise the normal pipeline answers instead.

import { createHash } from "node:crypto";
import { KNOWLEDGE_HASH, RETRIEVAL_CONFIG } from "../rag/retrieve.server.ts";
import chipData from "./chip-answers.server.json" with { type: "json" };
import { SYSTEM_RULES } from "./prompt.server.ts";

export type ChipAnswersFile = {
  knowledgeHash: string;
  /** Fingerprint of the prompt rules and retrieval depth the answers were generated with. */
  promptHash: string;
  generatedAt: string;
  model: string;
  answers: { question: string; answer: string }[];
};

const data = chipData as ChipAnswersFile;

/** Changes whenever the rules or the number of retrieved chunks change. */
export function answerSetupHash(): string {
  return `sha256:${createHash("sha256")
    .update(`${SYSTEM_RULES}\nk=${RETRIEVAL_CONFIG.k}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export const normalizeChipQuestion = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const current = data.knowledgeHash === KNOWLEDGE_HASH && data.promptHash === answerSetupHash();
const byQuestion = new Map(
  current ? data.answers.map((a) => [normalizeChipQuestion(a.question), a.answer]) : [],
);

/** The pre-generated answer for a chip question, or null (unknown question or stale file). */
export function findChipAnswer(question: string): string | null {
  return byQuestion.get(normalizeChipQuestion(question)) ?? null;
}

export const chipAnswersStatus = () => ({ current, count: byQuestion.size });
