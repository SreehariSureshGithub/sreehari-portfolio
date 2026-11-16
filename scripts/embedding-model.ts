// Single source of truth for the embedding model files.
// Used by scripts/build-index.ts (embedding the knowledge) and vite.config.ts (copying the
// model into the Vercel function), so build-time and query-time vectors come from the exact
// same, verified files. The runtime reads id/dtype/pooling/queryPrefix from the index JSON.
//
// Files are pinned to a Hugging Face commit and checked by SHA-256: an upstream change can
// never silently swap the model. To upgrade, change `revision` + hashes and rebuild the index.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const EMBEDDING_MODEL = {
  id: "Xenova/bge-small-en-v1.5",
  revision: "ea104dacec62c0de699686887e3f920caeb4f3e3",
  dtype: "q8",
  pooling: "cls",
  queryPrefix: "Represent this sentence for searching relevant passages: ",
  files: {
    "config.json": "fa73f90bf92c8cace1fbcb709626306f2bdbc9ea3e5b5f94b440df9b6aa56350",
    "tokenizer.json": "d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66",
    "tokenizer_config.json": "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
    "onnx/model_quantized.onnx": "6c9c6101a956d62dfb5e7190c538226c0c5bb9cb27b651234b6df063ee7dbfe4",
  },
} as const;

/** Where model files live in the repo checkout (gitignored). transformers.js `localModelPath`. */
export const modelRoot = (rootDir: string) => join(rootDir, ".cache", "transformers");

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/**
 * Makes sure every model file exists under <rootDir>/.cache/transformers/<id>/ with the
 * pinned hash, downloading missing/corrupt files from the pinned revision. Throws on any
 * mismatch. Returns the model directory.
 */
export async function ensureModelFiles(rootDir: string, log = console.log): Promise<string> {
  const modelDir = join(modelRoot(rootDir), EMBEDDING_MODEL.id);
  for (const [file, expected] of Object.entries(EMBEDDING_MODEL.files)) {
    const target = join(modelDir, file);
    if (existsSync(target) && sha256(readFileSync(target)) === expected) continue;

    const url = `https://huggingface.co/${EMBEDDING_MODEL.id}/resolve/${EMBEDDING_MODEL.revision}/${file}`;
    log(`[embedding-model] downloading ${file} ...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[embedding-model] ${url} -> HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const actual = sha256(buf);
    if (actual !== expected) {
      throw new Error(
        `[embedding-model] hash mismatch for ${file}: expected ${expected}, got ${actual}`,
      );
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buf);
  }
  return modelDir;
}
