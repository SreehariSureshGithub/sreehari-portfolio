// Plain TanStack Start + Vite + Nitro setup. Plugins, in this order: Tailwind, tsconfig paths,
// TanStack Start, Nitro (build only), React. Each is registered once, here.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { EMBEDDING_MODEL, ensureModelFiles } from "./scripts/embedding-model.ts";

// onnxruntime-node ships native binaries for every OS/CPU (~288 MB). Keep only the build
// machine's own folder (on Vercel: linux/x64) and copy that whole folder — the tracer sees
// onnxruntime_binding.node but not the libonnxruntime.so it loads natively.
// (The tracer reports paths with forward slashes on every OS.)
type TracedPackages = Record<
  string,
  { versions: Record<string, { path: string; files: string[] }> }
>;
function keepOnlyBuildPlatformOnnxBinaries(packages: TracedPackages) {
  const onnx = packages["onnxruntime-node"];
  if (!onnx) return;
  for (const version of Object.values(onnx.versions)) {
    const binRoot = posix.join(version.path.replaceAll("\\", "/"), "bin", "napi-v6");
    const ownDir = posix.join(binRoot, process.platform, process.arch);
    const ownFiles = readdirSync(ownDir).map((f) => posix.join(ownDir, f));
    const isBinary = (f: string) => f.replaceAll("\\", "/").startsWith(`${binRoot}/`);
    version.files = [...version.files.filter((f) => !isBinary(f)), ...ownFiles];
  }
}

// Vercel builds only: put the pinned, hash-verified embedding model next to the function code
// (<function>/models/<id>/...), so query embedding needs no download at runtime. The model is
// fetched into .cache/ first if this checkout doesn't have it (e.g. a fresh Vercel build).
// Other presets (the default cloudflare-module build) are left untouched.
//
// Registered from a Nitro *module* with nitro.hooks.hook(), NOT via `nitro.hooks: { compiled }`:
// config hooks are merged with the preset's by key, so a `compiled` there replaces the Vercel
// preset's own `compiled` hook — the one that writes .vercel/output/config.json and
// .vc-config.json — and Vercel then can't find the build output.
type NitroLike = {
  options: { preset: string; rootDir: string; output: { serverDir: string } };
  hooks: { hook: (name: "compiled", fn: (nitro: NitroLike) => Promise<void>) => unknown };
};
async function bundleEmbeddingModel(nitro: NitroLike) {
  if (!nitro.options.preset.startsWith("vercel")) return;
  const modelDir = await ensureModelFiles(nitro.options.rootDir);
  const target = join(nitro.options.output.serverDir, "models", EMBEDDING_MODEL.id);
  for (const file of Object.keys(EMBEDDING_MODEL.files)) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    copyFileSync(join(modelDir, file), join(target, file));
  }
  console.log(`[embedding-model] bundled ${EMBEDDING_MODEL.id} into the function`);
}

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Server-only code can never be imported into the client bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
  ];
  if (command === "build") {
    plugins.push(
      nitro({
        // Vercel builds pick the `vercel` preset from the VERCEL env var; this is the fallback.
        defaultPreset: "cloudflare-module",
        // transformers.js loads onnxruntime-node via createRequire, which the bundler can't
        // see, so the package is kept external and traced instead.
        traceDeps: ["@huggingface/transformers"],
        traceOpts: { hooks: { tracedPackages: keepOnlyBuildPlatformOnnxBinaries } },
        modules: [(nitro: NitroLike) => void nitro.hooks.hook("compiled", bundleEmbeddingModel)],
      } as Parameters<typeof nitro>[0]),
    );
  }
  plugins.push(viteReact());

  // VITE_* variables are the only env values exposed to code, as import.meta.env.*.
  const envDefine = Object.fromEntries(
    Object.entries(loadEnv(mode, process.cwd(), "VITE_")).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );
  const isDevBuild = command === "build" && mode === "development";

  return {
    plugins,
    define: envDefine,
    ...(isDevBuild
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
    },
  };
});
