// Keyword tokenizer for BM25. Shared by scripts/build-index.ts (build time) and the
// /api/chat retriever (runtime) — both MUST use this exact function, or BM25 scores drift.
// Server-only: the `.server.ts` suffix makes TanStack Start refuse client imports.
// Kept free of path aliases and TS-only syntax so Node can run it with type stripping.

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have he her his " +
    "how i if in into is it its me my of on or our she so than that the their them then there " +
    "these they this to too us was we were what when where which who whom why will with would " +
    "you your about also any just more most not now only other some such very own same s"
  ).split(" "),
);

// Very light stemming: enough to match "projects" with "project" without mangling
// technical terms. Words ending in -ss/-us/-is (e.g. "analysis", "status") are left alone.
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

export function tokenize(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .match(/[a-z0-9]+/g) ?? [];
  const tokens: string[] = [];
  for (const word of words) {
    if (word.length < 2 || STOPWORDS.has(word)) continue;
    tokens.push(stem(word));
  }
  return tokens;
}
