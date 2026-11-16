import { createFileRoute } from "@tanstack/react-router";

// Deployment smoke test: tells us which JS runtime the server code actually runs on.
// Exposes no secrets — only runtime name/version and the (non-sensitive) Vercel env/region.

type Runtime = "workerd" | "edge" | "bun" | "deno" | "node" | "unknown";

function detectRuntime(): Runtime {
  const g = globalThis as Record<string, unknown>;
  // Check workerd first: with nodejs_compat it also exposes process.versions.node.
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return "workerd";
  }
  if (typeof g.EdgeRuntime === "string") return "edge";
  if (typeof g.Bun !== "undefined") return "bun";
  if (typeof g.Deno !== "undefined") return "deno";
  if (typeof process !== "undefined" && process.versions?.node) return "node";
  return "unknown";
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        const runtime = detectRuntime();
        const env = typeof process !== "undefined" ? process.env : {};
        return Response.json(
          {
            ok: true,
            runtime,
            nodeVersion: runtime === "node" ? process.versions.node : null,
            vercelEnv: env.VERCEL_ENV ?? null,
            region: env.VERCEL_REGION ?? null,
          },
          { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
        );
      },
    },
  },
});
