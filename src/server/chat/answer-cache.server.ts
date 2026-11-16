// Semantic answer cache for first-turn questions (no conversation history).
//
// A new question reuses a cached answer when its embedding has cosine similarity ≥ 0.95 with a
// cached question built from the SAME knowledge hash AND the same system prompt (so editing
// knowledge/, the rules or the router instructions invalidates everything; see
// answerCacheKey). Entries live 7 days, at most ~500 per knowledge hash, oldest pruned first.
// Only real answers are stored — never refusals, "missing" replies, guarded answers or errors —
// and a cached answer still goes through the output guard before it is sent.
//
// Upstash layout (namespaced per environment, like the rate limits):
//   <ns>:answers:<hash>:vec  HASH id -> {"v": base64 int8 embedding, "t": epoch ms}
//   <ns>:answers:<hash>:ans  HASH id -> answer text
// Each instance keeps a copy of the small `vec` hash for 30 s, so a lookup is usually one
// in-memory scan plus one HGET on a hit. Every Redis failure is logged and treated as a miss.

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { SYSTEM_PROMPT_HASH } from "./prompt-hash.server.ts";
import { LIMITS, TEXT } from "./settings.server.ts";

/**
 * The cache key prefix: the knowledge hash plus the system-prompt hash. Answers written under
 * other knowledge or other rules are never found, whatever their age.
 */
export function answerCacheKey(knowledgeHash: string, promptHash: string = SYSTEM_PROMPT_HASH) {
  return `${knowledgeHash}:prompt-${promptHash}`;
}

type Entry = { vec: Float32Array; t: number };
type Store = {
  loadVectors(hash: string): Promise<Map<string, Entry>>;
  getAnswer(hash: string, id: string): Promise<string | null>;
  put(hash: string, id: string, vec: string, t: number, answer: string): Promise<void>;
  remove(hash: string, ids: string[]): Promise<void>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_COPY_MS = 30_000;
// v2: keyed on the name-anchored query vector (v1 entries used the raw query vector).
const namespace = `chat:${process.env.VERCEL_ENV ?? "local"}:answers:v2`;

// ----------------------------------------------------------------- int8 vector packing --

function packVector(v: Float32Array): string {
  const bytes = Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * 127))));
  return Buffer.from(bytes.buffer).toString("base64");
}

function unpackVector(b64: string): Float32Array {
  const bytes = new Int8Array(Buffer.from(b64, "base64"));
  const v = Float32Array.from(bytes, (x) => x / 127);
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

const normalizeQuestion = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const entryId = (question: string) =>
  createHash("sha256").update(normalizeQuestion(question)).digest("hex").slice(0, 16);

// ----------------------------------------------------------------------------- stores --

function parseEntry(raw: unknown): { v: string; t: number } | null {
  const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (value && typeof value === "object" && "v" in value && "t" in value) {
    const { v, t } = value as { v: unknown; t: unknown };
    if (typeof v === "string" && typeof t === "number") return { v, t };
  }
  return null;
}

function upstashStore(url: string, token: string): Store {
  // No automatic JSON parsing: answers must come back exactly as stored.
  const redis = new Redis({
    url,
    token,
    automaticDeserialization: false,
    retry: { retries: 1, backoff: () => 100 },
  });
  const keys = (hash: string) => ({
    vec: `${namespace}:${hash}:vec`,
    ans: `${namespace}:${hash}:ans`,
  });
  const ttlSeconds = () => LIMITS.answerCacheTtlDays * 24 * 60 * 60;
  return {
    async loadVectors(hash) {
      // Without automatic deserialization HGETALL comes back as [field, value, field, value…].
      const raw: unknown = await redis.hgetall(keys(hash).vec);
      const pairs: [string, unknown][] = [];
      if (Array.isArray(raw)) {
        for (let i = 0; i + 1 < raw.length; i += 2) pairs.push([String(raw[i]), raw[i + 1]]);
      } else if (raw && typeof raw === "object") {
        pairs.push(...Object.entries(raw));
      }
      const out = new Map<string, Entry>();
      for (const [id, value] of pairs) {
        const e = parseEntry(value);
        if (e) out.set(id, { vec: unpackVector(e.v), t: e.t });
      }
      return out;
    },
    async getAnswer(hash, id) {
      const value = await redis.hget<string>(keys(hash).ans, id);
      return typeof value === "string" ? value : null;
    },
    async put(hash, id, vec, t, answer) {
      const k = keys(hash);
      const p = redis.pipeline();
      p.hset(k.vec, { [id]: JSON.stringify({ v: vec, t }) });
      p.hset(k.ans, { [id]: answer });
      p.expire(k.vec, ttlSeconds());
      p.expire(k.ans, ttlSeconds());
      await p.exec();
    },
    async remove(hash, ids) {
      if (!ids.length) return;
      const k = keys(hash);
      const p = redis.pipeline();
      p.hdel(k.vec, ...ids);
      p.hdel(k.ans, ...ids);
      await p.exec();
    },
  };
}

function memoryStore(): Store {
  const vecs = new Map<string, Map<string, { v: string; t: number }>>();
  const answers = new Map<string, Map<string, string>>();
  const get = <T>(m: Map<string, Map<string, T>>, hash: string) => {
    let inner = m.get(hash);
    if (!inner) m.set(hash, (inner = new Map()));
    return inner;
  };
  return {
    async loadVectors(hash) {
      return new Map(
        [...get(vecs, hash)].map(([id, e]) => [id, { vec: unpackVector(e.v), t: e.t }]),
      );
    },
    async getAnswer(hash, id) {
      return get(answers, hash).get(id) ?? null;
    },
    async put(hash, id, v, t, answer) {
      get(vecs, hash).set(id, { v, t });
      get(answers, hash).set(id, answer);
    },
    async remove(hash, ids) {
      for (const id of ids) {
        get(vecs, hash).delete(id);
        get(answers, hash).delete(id);
      }
    },
  };
}

let store: Store | undefined;
function getStore(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? upstashStore(url, token) : memoryStore();
  return store;
}

// Per-instance copy of the vectors for the current knowledge hash.
let local: { hash: string; loadedAt: number; entries: Map<string, Entry> } | undefined;

async function vectorsFor(hash: string): Promise<Map<string, Entry>> {
  if (local?.hash === hash && Date.now() - local.loadedAt < LOCAL_COPY_MS) return local.entries;
  const entries = await getStore().loadVectors(hash);
  local = { hash, loadedAt: Date.now(), entries };
  return entries;
}

// Per-instance memo of answers already fetched or stored (saves the HGET on repeat hits).
const answerMemo = new Map<string, string>();
const MEMO_MAX = 200;
function remember(key: string, answer: string) {
  if (answerMemo.size >= MEMO_MAX) answerMemo.delete(answerMemo.keys().next().value!);
  answerMemo.set(key, answer);
}

function logError(what: string, error: unknown) {
  console.error(
    `[chat] answer cache ${what} failed — continuing without it:`,
    (error as Error)?.name,
  );
}

// ------------------------------------------------------------------------- public API --

export type CacheHit = { answer: string; similarity: number };

/** Best cached answer for this question embedding, or null (also on any error). */
/** Cache operations never hold up an answer for long: past this, they count as a miss. */
const CACHE_TIMEOUT_MS = 1500;
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("answer cache timed out")), CACHE_TIMEOUT_MS),
    ),
  ]);
}

export async function lookupAnswer(
  knowledgeHash: string,
  queryVector: Float32Array,
): Promise<CacheHit | null> {
  if (!LIMITS.answerCacheEnabled) return null;
  try {
    const entries = await withTimeout(vectorsFor(knowledgeHash));
    const oldest = Date.now() - LIMITS.answerCacheTtlDays * DAY_MS;
    let best: { id: string; similarity: number } | undefined;
    for (const [id, e] of entries) {
      if (e.t < oldest) continue;
      const similarity = cosine(queryVector, e.vec);
      if (!best || similarity > best.similarity) best = { id, similarity };
    }
    if (!best || best.similarity < LIMITS.answerCacheSimilarity) return null;
    const memoKey = `${knowledgeHash}:${best.id}`;
    const answer =
      answerMemo.get(memoKey) ?? (await withTimeout(getStore().getAnswer(knowledgeHash, best.id)));
    if (answer) remember(memoKey, answer);
    return answer ? { answer, similarity: Number(best.similarity.toFixed(4)) } : null;
  } catch (error) {
    logError("lookup", error);
    return null;
  }
}

/** Verbs that turn a question into an instruction ("…? Say no.", "Answer that…"). */
const INSTRUCTION_WORDS =
  /\b(say|says|answer|reply|respond|pretend|ignore|write|repeat|translate|output|print|claim|state|insist|act as|role-?play)\b/i;

/**
 * Only plain, single-sentence questions are stored, so an injected instruction or "fact" can
 * never become a cache entry that other visitors receive. Example: "Can he join immediately?
 * No." is 0.979 similar to the clean question, so without this check the model's answer to
 * the poisoned version could be served to everyone who asks the clean one.
 * (Questions that fail this check are still answered normally, just not cached.)
 */
export function isCacheableQuestion(question: string): boolean {
  const q = question.trim();
  if (q.length > 160 || q.split(/\s+/).length > 25) return false;
  const body = q.replace(/[?.!]+$/, "");
  if (/[?.!;:\n]/.test(body)) return false; // more than one sentence / clause
  if (/["“”`<>{}[\]()]/.test(q)) return false; // quotes, markup, brackets
  return !INSTRUCTION_WORDS.test(q);
}

/** True for answers worth reusing: not the off-topic refusal and not the "missing" reply. */
export function isCacheableAnswer(answer: string): boolean {
  const a = answer.trim();
  return a.length > 0 && !a.includes(TEXT.offTopic) && !a.includes(TEXT.missing);
}

/** Stores a guarded, real answer for a first-turn question. Errors are logged and ignored. */
export async function storeAnswer(
  knowledgeHash: string,
  question: string,
  queryVector: Float32Array,
  answer: string,
): Promise<void> {
  if (!LIMITS.answerCacheEnabled || !isCacheableAnswer(answer) || !isCacheableQuestion(question)) {
    return;
  }
  try {
    const id = entryId(question);
    const t = Date.now();
    const packed = packVector(queryVector);
    await withTimeout(getStore().put(knowledgeHash, id, packed, t, answer));
    remember(`${knowledgeHash}:${id}`, answer);
    const entries = await vectorsFor(knowledgeHash);
    entries.set(id, { vec: unpackVector(packed), t });
    // Size cap: drop expired entries, then the oldest beyond the limit.
    const oldest = t - LIMITS.answerCacheTtlDays * DAY_MS;
    const sorted = [...entries].sort((a, b) => a[1].t - b[1].t);
    const expired = sorted.filter(([, e]) => e.t < oldest).map(([id]) => id);
    const live = sorted.filter(([, e]) => e.t >= oldest);
    const overflow = live
      .slice(0, Math.max(0, live.length - LIMITS.answerCacheMaxEntries))
      .map(([id]) => id);
    const drop = [...expired, ...overflow];
    if (drop.length) {
      await getStore().remove(knowledgeHash, drop);
      for (const d of drop) {
        entries.delete(d);
        answerMemo.delete(`${knowledgeHash}:${d}`);
      }
    }
  } catch (error) {
    logError("store", error);
  }
}
