import { createFileRoute } from "@tanstack/react-router";

// GET /api/warm — loads the embedding model (and the chat modules) on this server instance so
// the visitor's first question doesn't pay for it. Called by the chat button on hover/focus or
// when the chat opens (at most once per page load). No LLM call, no knowledge in the response.
// Same origin check as /api/chat; its own per-IP burst limit.

const empty = (status: number, extra: HeadersInit = {}) =>
  new Response(null, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
  });

export const Route = createFileRoute("/api/warm")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        try {
          if (request.method !== "GET") return empty(405, { allow: "GET" });
          const req = await import("@/server/chat/request.server");
          if (!req.isAllowedOriginOrReferer(request)) return empty(403);

          const rl = await import("@/server/chat/ratelimit.server");
          const admitted = await rl.admitWarmUp(req.ipKey(req.clientIp(request)));
          if (!admitted.ok) return empty(429);

          const started = performance.now();
          const [rag] = await Promise.all([
            import("@/server/rag/retrieve.server"),
            import("@/server/chat/prompt.server"),
            import("@/server/chat/providers.server"),
            import("@/server/chat/guard.server"),
            import("@/server/chat/chip-answers.server"),
            import("@/server/chat/answer-cache.server"),
            import("@/server/chat/router.server"),
          ]);
          await rag.warmUpEmbeddings();
          console.log(
            JSON.stringify({
              evt: "warm",
              instance: req.INSTANCE_ID,
              ms: Math.round(performance.now() - started),
            }),
          );
          return empty(204);
        } catch (error) {
          console.error(JSON.stringify({ evt: "warm", error: (error as Error)?.name }));
          return empty(500);
        }
      },
    },
  },
});
