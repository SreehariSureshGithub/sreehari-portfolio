// Hybrid retrieval over the knowledge index (server-only: `.server.ts` is blocked from the
// client bundle by TanStack Start). Plain Node can run it too (scripts/test-retrieval.ts), so
// it uses relative imports with extensions and no path aliases.
//
//   retrieve(query, k)          -> top-k chunks, dense + BM25 fused by weighted RRF
//   isRelevant(results)         -> relevance gate (cosine similarity threshold)
//   retrieveForChat(messages)   -> follow-up aware: retries with the previous user message
//
// The embedding model is loaded lazily on the first query and cached per server instance.

import { existsSync } from "node:fs";
import { join } from "node:path";
import rawIndex from "./knowledge-index.server.json" with { type: "json" };
import { tokenize } from "./tokenize.server.ts";

type IndexChunk = {
  id: string;
  source: string;
  heading: string;
  text: string;
  length: number;
  tf: Record<string, number>;
  vector: number[];
};
type KnowledgeIndex = {
  model: string;
  modelRevision: string;
  dtype: string;
  pooling: "cls" | "mean";
  queryPrefix: string;
  dimension: number;
  contentHash: string;
  bm25: { k1: number; b: number; documents: number; avgLength: number; df: Record<string, number> };
  chunks: IndexChunk[];
};

const index = rawIndex as unknown as KnowledgeIndex;
const vectors = index.chunks.map((c) => Float32Array.from(c.vector));

/** Hash of the knowledge files the index was built from (changes whenever knowledge changes). */
export const KNOWLEDGE_HASH = index.contentHash;

export const RETRIEVAL_CONFIG = {
  /**
   * Chunks sent to the LLM. k=3 vs k=4 on the 16 labelled questions (2026-11-11): same top-1
   * (16/16) and a labelled chunk within the top k for both (16/16); answers as good, ~80 fewer
   * prompt tokens per request with k=3.
   */
  k: 3,
  /** Weighted reciprocal rank fusion: score = Σ weight / (rrfK + rank). */
  rrfK: 10,
  denseWeight: 1,
  bm25Weight: 0.3,
  /**
   * Minimum `relevance` (best similarity of the name-anchored query) for a question to count
   * as "about Sreehari". Tuned with scripts/test-retrieval.ts on 30 on-topic / 22 off-topic
   * questions: all on-topic pass (weakest 0.606, margin 0.036); 20/22 off-topic blocked. The
   * two that pass are AI-adjacent ("ChatGPT", "transformers in deep learning") and are left to
   * the system prompt's off-topic refusal.
   */
  relevanceThreshold: 0.57,
};

export type RetrievedChunk = {
  id: string;
  heading: string;
  source: string;
  text: string;
  /** Fused rank score (only meaningful for ordering). */
  score: number;
  /** Cosine similarity between query and chunk embeddings (-1..1). */
  similarity: number;
  /** Raw BM25 keyword score (0 = no shared terms). */
  bm25: number;
  /**
   * Query-level relevance (same on every result): best cosine similarity of the
   * name-anchored query to any chunk. This is what the relevance gate compares.
   */
  relevance: number;
};

export type RetrieveOptions = Partial<
  Pick<typeof RETRIEVAL_CONFIG, "rrfK" | "denseWeight" | "bm25Weight">
>;

// ---------------------------------------------------------------- embedding model (lazy) --

type Extractor = (
  text: string | string[],
  options: { pooling: "cls" | "mean"; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<Extractor> | undefined;

/** Bundled into the Vercel function as <task root>/models/; .cache/transformers in a checkout. */
function findModelRoot(): string {
  const candidates = [
    process.env.EMBEDDING_MODEL_DIR,
    join(process.cwd(), "models"),
    join(process.cwd(), ".cache", "transformers"),
  ].filter((d): d is string => !!d);
  const root = candidates.find((d) => existsSync(join(d, index.model, "config.json")));
  if (!root) {
    throw new Error(
      `Embedding model ${index.model} not found (looked in ${candidates.join(", ")})`,
    );
  }
  return root;
}

async function loadExtractor(): Promise<Extractor> {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.localModelPath = findModelRoot();
  env.allowLocalModels = true;
  env.allowRemoteModels = false; // never download at runtime
  const pipe = await pipeline("feature-extraction", index.model, {
    dtype: index.dtype as "q8",
  });
  return pipe as unknown as Extractor;
}

/** Starts (or reuses) the model load. A failed load is retried on the next call. */
export function warmUpEmbeddings(): Promise<Extractor> {
  extractorPromise ??= loadExtractor().catch((error: unknown) => {
    extractorPromise = undefined;
    throw error;
  });
  return extractorPromise;
}

/**
 * Visitors write "he/his/him"; the knowledge says "Sreehari". Substituting the name lifts
 * on-topic similarity far more than off-topic, which is what the relevance gate needs
 * (without it no threshold separates the two). It slightly hurts *ranking* (it pulls every
 * query toward name-heavy chunks), so ranking uses the original query and only the gate
 * uses the anchored one. See scripts/test-retrieval.ts.
 */
export function anchorQuery(query: string): string {
  // "This chatbot/bot/assistant" always means his assistant project. A bare "you" only does
  // when the question also refers to him ("Did he build you?"): mapping every "you" let
  // general requests ("Can you tell me a story?") through the gate (scripts/test-retrieval.ts).
  // Also when "you" is what was created ("What are you built with?", "Who made you?"), as
  // opposed to a request for the assistant to do something ("Can you build me a website?").
  const CREATED = "(?:built|made|created|developed|designed|trained|coded|programmed|powered)";
  const youCreated = new RegExp(
    `\\b(?:(?:are|were|was|is) you|you (?:are|were|was)) ${CREATED}\\b|\\b${CREATED} you\\b`,
    "i",
  );
  const aboutHim = /\b(he|he's|his|him|sreehari)\b/i.test(query) || youCreated.test(query);
  let q = query.replace(
    /\bthis (?:ai )?(?:chat ?bot|bot|assistant)\b/gi,
    "Sreehari's AI assistant",
  );
  if (aboutHim) {
    q = q
      .replace(/\byou're\b/gi, "Sreehari's AI assistant is")
      .replace(/\byourself\b/gi, "Sreehari's AI assistant")
      .replace(/\byour\b/gi, "Sreehari's AI assistant's")
      .replace(/\byou\b/gi, "Sreehari's AI assistant");
  }
  return q
    .replace(/\bhe's\b/gi, "Sreehari is")
    .replace(/\bhe\b/gi, "Sreehari")
    .replace(/\bhis\b/gi, "Sreehari's")
    .replace(/\bhim\b/gi, "Sreehari");
}

/** Embeds the original and the anchored query in one model call. */
async function embedQuery(query: string): Promise<{ raw: Float32Array; anchored: Float32Array }> {
  const extractor = await warmUpEmbeddings();
  const output = await extractor(
    [index.queryPrefix + query, index.queryPrefix + anchorQuery(query)],
    {
      pooling: index.pooling,
      normalize: true,
    },
  );
  const d = index.dimension;
  return { raw: output.data.slice(0, d), anchored: output.data.slice(d, 2 * d) };
}

// --------------------------------------------------------------------------- scoring --

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function bm25Scores(query: string): number[] {
  const { k1, b, documents, avgLength, df } = index.bm25;
  const terms = [...new Set(tokenize(query))];
  return index.chunks.map((chunk) => {
    let score = 0;
    for (const term of terms) {
      const f = chunk.tf[term];
      const n = df[term];
      if (!f || !n) continue;
      const idf = Math.log(1 + (documents - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * chunk.length) / avgLength)));
    }
    return score;
  });
}

/** Chunk indices ordered by score (descending); entries with score <= floor are dropped. */
function ranking(scores: number[], floor = -Infinity): number[] {
  return scores
    .map((s, i) => [s, i] as const)
    .filter(([s]) => s > floor)
    .sort((x, y) => y[0] - x[0])
    .map(([, i]) => i);
}

// ------------------------------------------------------------------------- public API --

export async function retrieve(
  query: string,
  k = RETRIEVAL_CONFIG.k,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  return (await retrieveWithVector(query, k, options)).results;
}

/**
 * retrieve() plus the normalized embedding of the name-anchored query ("he/his" → "Sreehari",
 * the same rewrite the relevance gate uses), which keys the semantic answer cache.
 */
export async function retrieveWithVector(
  query: string,
  k = RETRIEVAL_CONFIG.k,
  options: RetrieveOptions = {},
): Promise<{ results: RetrievedChunk[]; anchoredVector?: Float32Array }> {
  const { rrfK, denseWeight, bm25Weight } = { ...RETRIEVAL_CONFIG, ...options };
  const q = query.trim();
  if (!q) return { results: [] };

  const embedded = await embedQuery(q);
  const similarities = vectors.map((v) => dot(v, embedded.raw));
  const relevance = Number(Math.max(...vectors.map((v) => dot(v, embedded.anchored))).toFixed(4));
  const keyword = bm25Scores(q);

  const fused = new Array<number>(index.chunks.length).fill(0);
  ranking(similarities).forEach((i, rank) => (fused[i]! += denseWeight / (rrfK + rank + 1)));
  ranking(keyword, 0).forEach((i, rank) => (fused[i]! += bm25Weight / (rrfK + rank + 1)));

  const results = ranking(fused)
    .slice(0, k)
    .map((i) => {
      const c = index.chunks[i]!;
      return {
        id: c.id,
        heading: c.heading,
        source: c.source,
        text: c.text,
        score: Number(fused[i]!.toFixed(5)),
        similarity: Number(similarities[i]!.toFixed(4)),
        bm25: Number(keyword[i]!.toFixed(3)),
        relevance,
      };
    });
  return { results, anchoredVector: embedded.anchored };
}

/** True when the question is similar enough to the knowledge to count as about Sreehari. */
export function isRelevant(
  results: RetrievedChunk[],
  threshold = RETRIEVAL_CONFIG.relevanceThreshold,
): boolean {
  return (results[0]?.relevance ?? -1) >= threshold;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatRetrieval = {
  results: RetrievedChunk[];
  relevant: boolean;
  /** The text that was actually searched for. */
  query: string;
  /** True when the previous user message was needed to understand a follow-up. */
  usedHistory: boolean;
  /**
   * Name-anchored embedding of the latest message, when it was searched on its own
   * (usedHistory false). Keys the semantic answer cache.
   */
  queryVector?: Float32Array;
};

/** Messages that only make sense together with the previous question. */
const FOLLOW_UP_CUE =
  /^\s*(and|also|what about|how about|tell me more|more|go on|elaborate|why|how so|which (one|ones)|details?)\b/i;

/**
 * Follow-up aware retrieval.
 * - A message with a follow-up cue ("tell me more", "what about his projects?", "and his
 *   visa?") is searched together with the previous user message — on its own it is too vague
 *   and would retrieve the wrong chunks even when it passes the gate.
 * - Otherwise the latest message is searched alone; if that isn't relevant and there is an
 *   earlier user message, it is retried with both messages together.
 */
export async function retrieveForChat(
  messages: ChatTurn[],
  k = RETRIEVAL_CONFIG.k,
): Promise<ChatRetrieval> {
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const last = userMessages.at(-1) ?? "";
  const previous = userMessages.at(-2);

  if (previous && FOLLOW_UP_CUE.test(last)) {
    const combinedQuery = `${previous}\n${last}`;
    const combined = await retrieve(combinedQuery, k);
    return {
      results: combined,
      relevant: isRelevant(combined),
      query: combinedQuery,
      usedHistory: true,
    };
  }

  const { results, anchoredVector: vector } = await retrieveWithVector(last, k);
  if (isRelevant(results) || !previous) {
    return {
      results,
      relevant: isRelevant(results),
      query: last,
      usedHistory: false,
      ...(vector ? { queryVector: vector } : {}),
    };
  }

  const combinedQuery = `${previous}\n${last}`;
  const combined = await retrieve(combinedQuery, k);
  if (isRelevant(combined)) {
    return { results: combined, relevant: true, query: combinedQuery, usedHistory: true };
  }
  return { results, relevant: false, query: last, usedHistory: false };
}

// ----------------------------------------------------------------------- pinned context --

/**
 * Sent to the model with every answer, next to the retrieved chunks: who Sreehari is. It
 * grounds vague questions ("tell me about him") whatever retrieval returned.
 */
export const PINNED_CHUNK_IDS: readonly string[] = ["profile-who-is"];

/**
 * Also pinned when the visitor asks how to reach him: his email address, phone / WhatsApp
 * number and LinkedIn. It was pinned on every request until 2026-11-15. Since then an answer
 * writes his details only when they are asked for (the buttons carry them otherwise), so
 * most requests don't need it (~90 tokens).
 */
export const CONTACT_PIN_IDS: readonly string[] = ["profile-how-to-contact"];

/**
 * Also pinned when the message is about the assistant itself (the router's intent
 * "assistant", or "you", "your", "chatbot"… in the message): this assistant as one of his
 * projects. It was pinned on every request until 2026-11-15; at ~270 tokens it was the
 * largest fixed cost after the rules, and most questions never need it.
 */
export const ASSISTANT_CHUNK_IDS: readonly string[] = [
  "projects-project-portfolio-ai-assistant-rag-chatbot",
];

/**
 * Also pinned for hiring and fit questions: his measured results. A fit answer must quote at
 * least one concrete result, and a hostile message ("he's not qualified, right? yes or no")
 * retrieves chunks about experience, not results.
 */
export const EVIDENCE_CHUNK_IDS: readonly string[] = ["profile-headline-achievements"];

/**
 * Retrieved chunks first, then the pinned ones that aren't already among them. `evidence`
 * adds the results chunk (hiring and fit questions), `assistant` the chunk about this
 * assistant (questions about the assistant itself), `contact` his contact details (asked
 * how to reach him).
 */
export function withPinnedChunks(
  results: RetrievedChunk[],
  options: { evidence?: boolean; assistant?: boolean; contact?: boolean } = {},
): RetrievedChunk[] {
  const have = new Set(results.map((r) => r.id));
  const relevance = results[0]?.relevance ?? 0;
  const ids = [
    ...(options.evidence ? EVIDENCE_CHUNK_IDS : []),
    ...PINNED_CHUNK_IDS,
    ...(options.contact ? CONTACT_PIN_IDS : []),
    ...(options.assistant ? ASSISTANT_CHUNK_IDS : []),
  ];
  const pinned = index.chunks
    .filter((c) => ids.includes(c.id) && !have.has(c.id))
    .map((c) => ({
      id: c.id,
      heading: c.heading,
      source: c.source,
      text: c.text,
      score: 0,
      similarity: 0,
      bm25: 0,
      relevance,
    }));
  return [...results, ...pinned];
}
