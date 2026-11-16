// Builds the RAG knowledge index from knowledge/*.md.
// Run: npm run build:index   (Node >= 22.18 / 24 runs .ts directly via type stripping)
//
// Output: src/server/rag/knowledge-index.server.json — server-only (TanStack Start blocks
// `*.server.*` files from the client bundle). Never put it in public/.
//
// Embeddings are computed locally with transformers.js from the pinned, hash-verified model
// files in scripts/embedding-model.ts (downloaded once into .cache/transformers/, gitignored,
// never committed). The same files are copied into the Vercel function for query embedding.

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env, pipeline } from "@huggingface/transformers";
import { tokenize } from "../src/server/rag/tokenize.server.ts";
import { EMBEDDING_MODEL as MODEL, ensureModelFiles, modelRoot } from "./embedding-model.ts";
import { buildChipAnswers } from "./chip-answers.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KNOWLEDGE_DIR = join(ROOT, "knowledge");
const OUT_PATH = join(ROOT, "src", "server", "rag", "knowledge-index.server.json");

const MAX_WORDS = 350;
const VECTOR_DECIMALS = 5;
const BM25 = { k1: 1.2, b: 0.75 };
const INDEX_VERSION = 1;

// Files that must never be indexed, even if someone copies them into knowledge/.
const FORBIDDEN = new Set(["chatbot-settings.md"]);

type Chunk = {
  id: string;
  source: string;
  heading: string;
  text: string;
  words: number;
};

const countWords = (s: string) => (s.match(/\S+/g) ?? []).length;

// "Sreehari Suresh – AI Intern at ISMO Bio-Photonics…" -> "ai-intern-at-ismo-bio-photonics-pvt-ltd"
// (the name is in almost every heading, so it adds nothing to an id; cut at a word boundary).
function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\bsreehari(\s+suresh)?('s)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 48) return slug;
  const cut = slug.slice(0, 49);
  return cut.slice(0, cut.lastIndexOf("-"));
}

function cleanMarkdown(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((line) => !line.includes("[FILL"))
    .join("\n");
}

// Packs paragraphs into parts of at most MAX_WORDS words (a single oversized paragraph
// stays whole rather than being cut mid-sentence).
function splitParagraphs(body: string): string[] {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const parts: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const p of paragraphs) {
    const w = countWords(p);
    if (current.length > 0 && currentWords + w > MAX_WORDS) {
      parts.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
    current.push(p);
    currentWords += w;
  }
  if (current.length > 0) parts.push(current.join("\n\n"));
  return parts;
}

function chunkFile(file: string): Chunk[] {
  const source = `knowledge/${basename(file)}`;
  const stem = basename(file, ".md");
  const sections = cleanMarkdown(readFileSync(file, "utf8")).split(/^## +/m);

  const preamble = sections.shift() ?? "";
  const strayText = preamble.replace(/^# .*$/m, "").trim();
  if (strayText) {
    console.warn(`  ! ${source}: text before the first "##" heading is ignored`);
  }

  const chunks: Chunk[] = [];
  const usedIds = new Set<string>();
  for (const section of sections) {
    const newline = section.indexOf("\n");
    const heading = (newline === -1 ? section : section.slice(0, newline)).trim();
    const body = (newline === -1 ? "" : section.slice(newline + 1))
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!heading || !body) continue;

    const parts = countWords(body) > MAX_WORDS ? splitParagraphs(body) : [body];
    parts.forEach((part, i) => {
      let id = `${stem}-${slugify(heading)}${parts.length > 1 ? `-p${i + 1}` : ""}`;
      for (let n = 2; usedIds.has(id); n++) id = `${id}-${n}`;
      usedIds.add(id);
      const text = `${heading}\n${part}`;
      chunks.push({ id, source, heading, text, words: countWords(text) });
    });
  }
  return chunks;
}

function contentHash(files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    // Normalise line endings so the hash is the same on Windows (autocrlf) and Linux.
    hash.update(`${basename(file)}\0${readFileSync(file, "utf8").replace(/\r\n?/g, "\n")}\0`);
  }
  return `sha256:${hash.digest("hex")}`;
}

// JSON.stringify with indentation, but number arrays and {term: count} maps kept on one
// line so the file stays readable and diffs stay small.
function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g, (_, nums: string) => {
      return `[${nums.replace(/\s+/g, "")}]`;
    })
    .replace(/\{\s+("[^"\n]+": \d+(?:,\s+"[^"\n]+": \d+)*)\s+\}/g, (_, pairs: string) => {
      return `{ ${pairs.replace(/,\s+/g, ", ")} }`;
    });
}

async function main() {
  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith(".md") && !FORBIDDEN.has(f))
    .sort()
    .map((f) => join(KNOWLEDGE_DIR, f));
  if (files.length === 0) throw new Error("No knowledge/*.md files found");

  console.log(`Chunking ${files.length} files from knowledge/ ...`);
  const chunks: Chunk[] = [];
  const perFile: { source: string; chunks: number }[] = [];
  for (const file of files) {
    const fileChunks = chunkFile(file);
    perFile.push({ source: `knowledge/${basename(file)}`, chunks: fileChunks.length });
    chunks.push(...fileChunks);
  }

  await ensureModelFiles(ROOT);
  env.localModelPath = modelRoot(ROOT);
  env.allowLocalModels = true;
  env.allowRemoteModels = false; // only the verified files — never a fresh download
  console.log(`Loading ${MODEL.id}@${MODEL.revision.slice(0, 7)} (${MODEL.dtype}) from .cache/`);
  const extractor = await pipeline("feature-extraction", MODEL.id, { dtype: MODEL.dtype });

  const output = await extractor(
    chunks.map((c) => c.text),
    { pooling: MODEL.pooling, normalize: true },
  );
  const vectors = output.tolist() as number[][];
  const dimension = vectors[0]?.length ?? 0;
  if (vectors.length !== chunks.length || dimension === 0) {
    throw new Error(`Embedding failed: got ${vectors.length} vectors for ${chunks.length} chunks`);
  }

  // BM25 statistics: per-chunk term frequencies + global document frequencies.
  const df: Record<string, number> = {};
  const termData = chunks.map((c) => {
    const tokens = tokenize(c.text);
    const tf: Record<string, number> = {};
    for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
    for (const t of Object.keys(tf)) df[t] = (df[t] ?? 0) + 1;
    return { length: tokens.length, tf };
  });
  const avgLength = termData.reduce((sum, d) => sum + d.length, 0) / chunks.length;

  const round = (v: number) => Number(v.toFixed(VECTOR_DECIMALS));
  const index = {
    version: INDEX_VERSION,
    model: MODEL.id,
    modelRevision: MODEL.revision,
    dtype: MODEL.dtype,
    pooling: MODEL.pooling,
    normalized: true,
    queryPrefix: MODEL.queryPrefix,
    dimension,
    builtAt: new Date().toISOString(),
    contentHash: contentHash(files),
    sources: perFile,
    bm25: {
      ...BM25,
      documents: chunks.length,
      avgLength: Number(avgLength.toFixed(3)),
      df: Object.fromEntries(Object.entries(df).sort(([a], [b]) => a.localeCompare(b))),
    },
    chunks: chunks.map((c, i) => ({
      ...c,
      length: termData[i]!.length,
      tf: termData[i]!.tf,
      vector: vectors[i]!.map(round),
    })),
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${formatJson(index)}\n`);

  console.log("\nChunks per file:");
  for (const { source, chunks: n } of perFile) console.log(`  ${source.padEnd(28)} ${n}`);
  console.log(`  ${"TOTAL".padEnd(28)} ${chunks.length}`);
  const words = chunks.map((c) => c.words);
  console.log(`Words per chunk: min ${Math.min(...words)}, max ${Math.max(...words)}`);
  console.log(`Vector dimension: ${dimension}`);
  console.log(`BM25 vocabulary: ${Object.keys(df).length} terms`);
  console.log(
    `Wrote ${relative(ROOT, OUT_PATH)} (${(statSync(OUT_PATH).size / 1024).toFixed(1)} KB)`,
  );

  // Pre-generated answers for the suggested question chips (regenerated when knowledge or
  // the prompt setup changes; served by /api/chat without an LLM call).
  // SKIP_CHIP_ANSWERS=1 rebuilds only the index (no Groq calls), e.g. to test retrieval; the
  // server then ignores the chip file until a full build:index regenerates it.
  if (process.env.SKIP_CHIP_ANSWERS === "1") {
    console.log("Chip answers: skipped (SKIP_CHIP_ANSWERS=1, no LLM calls)");
  } else {
    await buildChipAnswers(ROOT, index.contentHash);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
