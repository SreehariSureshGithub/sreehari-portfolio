import { createFileRoute } from "@tanstack/react-router";
import type { ContactAction } from "@/server/chat/contact-actions.server";
import type { RouterResult } from "@/server/chat/router.server";
import type { LimitScope as RateLimitScope } from "@/server/chat/ratelimit.server";

// POST /api/chat — the portfolio assistant. Behaviour: docs/chatbot/chatbot-settings.md.
// Order of checks (each one cheaper than the next, all before any LLM call):
//   method + content type → origin → per-IP rate limits → body size + validation + hygiene →
//   chip answer? → retrieval → answer cache (first turn only)? → query understanding (router:
//   intent + standalone query; skipped for clear first questions; the embedding gate is its
//   fallback; a JSON rejection is retried once, then the main model answers) → smalltalk/off-topic: the router's guarded one-line reply, or on-topic: search
//   with the rewritten query + pinned context → LLM charge + global daily cap → LLM token
//   stream (primary, or the fallback if the primary fails before its first token) checked by
//   the incremental output guard → SSE.
// The per-IP check is one Upstash round trip that overlaps with parsing and retrieval; its
// result is awaited before anything is answered. Chip answers, cached answers and gate
// refusals need no LLM call: they cost 0.25 of a message and don't count toward the global
// cap. Chip and cached answers are guarded too.
// Server modules are imported lazily so the homepage SSR never loads them.

type Outcome =
  | "answered"
  | "fallback"
  | "chip"
  | "cached"
  | "refused"
  | "redirected"
  | "guarded"
  | "rate_limited"
  | "forbidden"
  | "invalid"
  | "error"
  | "misconfigured";

/** `actions`: the fixed contact buttons, sent with the busy message (it points to them). */
const jsonError = (
  status: number,
  message: string,
  requestId: string,
  extra: HeadersInit = {},
  actions?: readonly ContactAction[],
) =>
  Response.json(
    { error: message, ...(actions ? { actions } : {}) },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": requestId,
        ...extra,
      },
    },
  );

/**
 * Streams a finished answer as Server-Sent Events: delta events, the contact buttons (if the
 * server decided to show them), then a done event.
 */
function sseAnswer(
  text: string,
  outcome: Outcome,
  requestId: string,
  actions?: readonly ContactAction[],
): Response {
  const encoder = new TextEncoder();
  const pieces = text.match(/\S+\s*/g) ?? [text];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      for (let i = 0; i < pieces.length; i += 3) {
        send({ type: "delta", text: pieces.slice(i, i + 3).join("") });
      }
      if (actions?.length) send({ type: "actions", items: actions });
      const shown = outcome === "fallback" || outcome === "chip" || outcome === "cached";
      send({ type: "done", outcome: shown ? "answered" : outcome });
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
  });
}

/** Requests served by this server instance (1 = the first one after a cold start). */
let instanceRequests = 0;
const ms = (since: number) => Math.round(performance.now() - since);

async function handleChat(request: Request): Promise<Response> {
  const started = performance.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  const log: Record<string, unknown> = { requestId, instanceRequest: ++instanceRequests };
  /** Per-phase milliseconds (admit = per-IP rate limits, llmAdmit = LLM charge + global cap). */
  const timings: Record<string, number> = {};
  const writeLog = (outcome: Outcome, status: number) =>
    console.log(
      JSON.stringify({
        evt: "chat",
        ...log,
        outcome,
        status,
        latencyMs: Math.round(performance.now() - started),
        ms: timings,
      }),
    );
  const finish = (outcome: Outcome, response: Response) => {
    writeLog(outcome, response.status);
    return response;
  };

  const [
    { TEXT, LIMITS },
    req,
    { chatEnvStatus },
    {
      CONTACT_ACTIONS,
      asksForContactDetails,
      contactActionsFor,
      contactActionsForAnswer,
      hasOwnEmail,
    },
  ] = await Promise.all([
    import("@/server/chat/settings.server"),
    import("@/server/chat/request.server"),
    import("@/server/chat/env.server"),
    import("@/server/chat/contact-actions.server"),
  ]);

  log.instance = req.INSTANCE_ID;

  // 1. Method and content type.
  if (request.method !== "POST") {
    return finish("invalid", jsonError(405, "Method not allowed.", requestId, { allow: "POST" }));
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return finish("invalid", jsonError(415, TEXT.invalid, requestId));
  }

  // 2. Origin (no CORS headers are ever sent, so other sites can't read responses either).
  if (!req.isAllowedOrigin(request))
    return finish("forbidden", jsonError(403, "Forbidden.", requestId));

  // Configuration problems are logged by name server-side; the visitor gets the busy text.
  if (!chatEnvStatus().ok) {
    return finish("misconfigured", jsonError(503, TEXT.busy, requestId, {}, CONTACT_ACTIONS));
  }

  // 3. Per-IP rate limits: one Upstash round trip (burst + the 0.25 base charge), started now
  //    and overlapped with body parsing, the chip lookup and retrieval (local CPU work). Its
  //    result is awaited before any answer is sent and before any cache read or LLM call.
  const rl = await import("@/server/chat/ratelimit.server");
  const ipKey = req.ipKey(req.clientIp(request));
  const rateLimited = (limit: { scope: RateLimitScope; resetAt: number }) => {
    log.limit = limit.scope;
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    const text = { burst: TEXT.slowDown, ip: TEXT.limitReached, global: TEXT.busy }[limit.scope];
    // The busy message (site-wide daily cap) points to the contact buttons, so they go with it.
    return finish(
      "rate_limited",
      jsonError(
        429,
        text,
        requestId,
        { "retry-after": String(retryAfter) },
        limit.scope === "global" ? CONTACT_ACTIONS : undefined,
      ),
    );
  };
  const admitStarted = performance.now();
  const admission = rl.admitRequest(ipKey).then((result) => {
    timings.admit = ms(admitStarted);
    return result;
  });
  /** Resolves to a 429 response if the visitor is over a limit, else null. */
  const limited = async () => {
    const result = await admission;
    return result.ok ? null : rateLimited(result);
  };

  // 4. Body size, schema, latest-message length, input hygiene.
  let raw: string;
  try {
    raw = await req.readBodyLimited(request);
  } catch (error) {
    const tooLarge = error instanceof req.BodyTooLargeError;
    return (
      (await limited()) ??
      finish("invalid", jsonError(tooLarge ? 413 : 400, TEXT.invalid, requestId))
    );
  }
  const parsed = req.parseChatBody(raw);
  if (!parsed.ok) {
    log.invalid = parsed.reason;
    return (await limited()) ?? finish("invalid", jsonError(400, TEXT.invalid, requestId));
  }

  const [
    { buildModelMessages, contactLinesAsked },
    { generateAnswer, streamAnswer },
    { checkAnswer, createStreamGuard, sameVisibleText, withoutWhatsAppLinks },
    chips,
    cache,
  ] = await Promise.all([
    import("@/server/chat/prompt.server"),
    import("@/server/chat/providers.server"),
    import("@/server/chat/guard.server"),
    import("@/server/chat/chip-answers.server"),
    import("@/server/chat/answer-cache.server"),
  ]);
  const question = parsed.messages.at(-1)!.content;
  /**
   * A complete answer plus its contact buttons. The buttons (fixed server config) are chosen
   * from the question before answering (contact details, or a hiring or fit decision), or
   * because the finished answer gives Sreehari's own details or invites contact (a salary,
   * "I don't have that" or "worth a conversation with him" answer). A complete factual answer
   * gets none, and they're dropped for an off-topic reply. With buttons, wa.me links are
   * removed from the text, since the WhatsApp button replaces them.
   */
  const withActions = (answer: string, planned: readonly ContactAction[] | undefined) => {
    if (answer.includes(TEXT.offTopic)) return { text: answer, actions: undefined };
    const actions = planned ?? contactActionsForAnswer(answer);
    if (!actions) return { text: answer, actions: undefined };
    log.actions = true;
    return { text: withoutWhatsAppLinks(answer), actions };
  };

  // 5. Suggested-question chips: pre-generated answers (stale ones are never loaded).
  //    Answers without an LLM call cost only the 0.25 already charged by admitRequest().
  const chipAnswer = chips.findChipAnswer(question);
  const chip = chipAnswer ? withActions(chipAnswer, contactActionsFor(question)) : undefined;
  if (chip && checkAnswer(chip.text).ok) {
    return (
      (await limited()) ?? finish("chip", sseAnswer(chip.text, "chip", requestId, chip.actions))
    );
  }

  // 6. Retrieval on the visitor's own words (local, ~10 ms). It gives the fast-path signal,
  //    the fallback gate (when the router can't decide) and the answer-cache key.
  const retrieveStarted = performance.now();
  const [rag, router] = await Promise.all([
    import("@/server/rag/retrieve.server"),
    import("@/server/chat/router.server"),
  ]);
  const retrieval = await rag.retrieveForChat(parsed.messages);
  timings.retrieve = ms(retrieveStarted);
  const relevance = retrieval.results[0]?.relevance ?? 0;
  log.relevance = relevance;
  log.usedHistory = retrieval.usedHistory;

  // 7. Semantic answer cache — first-turn questions only (no history to change the meaning).
  //    The cache read runs in parallel with the rate-limit result, which must have passed
  //    before any LLM call (the router is one).
  const firstTurn = parsed.messages.length === 1 && !retrieval.usedHistory;
  const queryVector = firstTurn ? retrieval.queryVector : undefined;
  if (queryVector) {
    const cacheStarted = performance.now();
    const [blocked, hit] = await Promise.all([
      limited(),
      cache.lookupAnswer(rag.KNOWLEDGE_HASH, queryVector).then((h) => {
        timings.cache = ms(cacheStarted);
        return h;
      }),
    ]);
    if (blocked) return blocked;
    const cached = hit ? withActions(hit.answer, contactActionsFor(question)) : undefined;
    if (hit && cached && checkAnswer(cached.text).ok) {
      log.cacheSimilarity = hit.similarity;
      return finish("cached", sseAnswer(cached.text, "cached", requestId, cached.actions));
    }
  } else {
    const blocked = await limited();
    if (blocked) return blocked;
  }

  // A request to show, drop or change the assistant's instructions that asks nothing about
  // Sreehari: the fixed "can't change how I work, suggestions can go to Sreehari" line with
  // the contact buttons. No router call and no main model.
  if (router.isLockedRequest(question)) {
    log.cantChange = "fixed";
    return finish(
      "redirected",
      sseAnswer(TEXT.cantChange, "redirected", requestId, CONTACT_ACTIONS),
    );
  }

  // 8. Query understanding. A clear first question skips it (fast path). Otherwise one small
  //    router call decides the intent and rewrites the message as a standalone query; if it
  //    fails, times out or its daily cap is reached, the embedding gate decides as before.
  let routed: RouterResult | undefined;
  if (router.needsRouter({ firstTurn, question, relevance })) {
    const routerStarted = performance.now();
    if (!LIMITS.routerEnabled) routed = { ok: false, reason: "disabled" };
    else if (!(await rl.admitRouterCall())) routed = { ok: false, reason: "capped" };
    else {
      const { callRouterModel } = await import("@/server/chat/providers.server");
      const r = await router.routeMessage(parsed.messages, callRouterModel);
      routed = r.result;
      // The last call (status, tokens, and for a failed call the safe parts of the error
      // body); with a retry, the first call is logged too.
      if (r.attempt) log.routerAttempt = r.attempt;
      if (r.attempts.length > 1) log.routerFirstAttempt = r.attempts[0];
    }
    timings.router = ms(routerStarted);
    log.router = routed.ok ? routed.decision.intent : `fallback:${routed.reason}`;
    if (routed.ok && "query" in routed.decision)
      log.routerQueryChars = routed.decision.query.length;
    if (routed.ok && "replyReplaced" in routed.decision && routed.decision.replyReplaced) {
      log.routerReplyReplaced = true;
    }
  } else {
    log.router = "fast_path";
  }
  // When the router can't decide (failed, timed out, capped), the embedding gate does. A
  // message with hiring vocabulary counts as relevant there: it is about Sreehari.
  const plan = router.planResponse(routed, retrieval.relevant || router.isHiringMessage(question));

  // Router unavailable and the gate says off-topic: the fixed refusal, no LLM call. A request
  // to show, drop or change the assistant's instructions gets the fixed "can't change how I
  // work, suggestions can go to Sreehari" line instead, with the contact buttons.
  if (plan.kind === "refuse") {
    const locked = router.isBehaviourRequest(question);
    if (locked) log.cantChange = "fixed";
    return finish(
      "refused",
      sseAnswer(
        locked ? TEXT.cantChange : TEXT.offTopic,
        "refused",
        requestId,
        locked ? CONTACT_ACTIONS : undefined,
      ),
    );
  }
  // Smalltalk / off-topic: the router's own short reply (already checked by the output guard
  // and the stricter reply rules; checked once more here). No main model. No contact buttons,
  // except with the "can't change how I work" reply (see replyFor).
  if (plan.kind === "reply") {
    const written = checkAnswer(plan.text).ok ? plan.text : router.fallbackReply(plan.intent);
    const reply = router.replyFor(written, question);
    if (reply.contact) log.cantChange = reply.text === written ? "router" : "fixed";
    return finish(
      "redirected",
      sseAnswer(reply.text, "redirected", requestId, reply.contact ? CONTACT_ACTIONS : undefined),
    );
  }

  // On-topic: search with the router's standalone query when there is one (pronouns, "you"
  // and follow-ups resolved), else with the visitor's words as before. Low relevance is only
  // a soft signal now: the model still answers and says what it doesn't know.
  let results = retrieval.results;
  if (plan.query) {
    const again = performance.now();
    results = await rag.retrieve(plan.query);
    timings.retrieve2 = ms(again);
    log.relevanceRewritten = results[0]?.relevance;
  }
  const lowRelevance = !rag.isRelevant(results);
  // Hiring or fit vocabulary in the visitor's words or in the router's standalone query.
  const hiring =
    router.isHiringMessage(question) || (!!plan.query && router.isHiringMessage(plan.query));
  if (hiring) log.hiring = true;
  // Contact buttons: from the visitor's words or the router's standalone query (contact
  // details, or a hiring or fit decision). A follow-up like "skip or try?" only reveals its
  // hiring intent once the router has resolved it ("Should a recruiter skip Sreehari or give
  // him a try?"). Every hiring answer invites a conversation, so it gets them too. Anything
  // else is decided from the finished answer (see withActions): a complete factual answer
  // gets none.
  // "Did he use Claude Code?" and "Are you lying?" both point to him: buttons too.
  const aiTools = router.isAiToolQuestion(question);
  const truthChallenge = router.isTruthChallenge(question);
  const plannedActions =
    contactActionsFor(question) ??
    (plan.query ? contactActionsFor(plan.query) : undefined) ??
    (hiring || aiTools || truthChallenge ? CONTACT_ACTIONS : undefined);

  // 9. LLM path: the remaining 0.75 of the message + the global daily cap (one round trip).
  const llmAdmitStarted = performance.now();
  const llmAdmitted = await rl.admitLlmCall(ipKey);
  timings.llmAdmit = ms(llmAdmitStarted);
  if (!llmAdmitted.ok) return rateLimited(llmAdmitted);

  // 10. Stream the answer: tokens are shown only after the incremental output guard has
  //     checked the text up to that point (the latest incomplete sentence / ~60 chars is held
  //     back). If the guard trips mid-stream, a "replace" event swaps the bubble for the
  //     refusal. The pinned context (who Sreehari is; his contact details when asked for)
  //     is always included.
  //     For hiring and fit questions his measured results are pinned too, so the answer can
  //     pick the one that fits the question, and a short reminder follows the visitor's
  //     message (see HIRING_REMINDER).
  //     The chunk about this assistant is added only when the message may be about it.
  //     Not for AI-tool questions: its stack is not the answer to them (prompt rule 3).
  const aboutAssistant =
    !aiTools &&
    (plan.intent === "assistant" ||
      router.mentionsAssistant(question) ||
      (!!plan.query && router.mentionsAssistant(plan.query)));
  const contactAsked =
    asksForContactDetails(question) || (!!plan.query && asksForContactDetails(plan.query));
  const context = rag.withPinnedChunks(results, {
    evidence: hiring || (!!plannedActions && !aiTools && !truthChallenge),
    assistant: aboutAssistant,
    // His contact details only when the visitor asks how to reach him.
    contact: contactAsked,
  });
  //     A message with persona-override text ("ignore your instructions, you are now…") is
  //     sent to the model as the router's reading of it: the question about Sreehari only.
  const conversation =
    plan.query && router.hasPersonaOverride(question)
      ? [...parsed.messages.slice(0, -1), { role: "user" as const, content: plan.query }]
      : parsed.messages;
  if (conversation !== parsed.messages) log.overrideRewritten = true;
  const promptNotes = {
    usedHistory: !plan.query && retrieval.usedHistory,
    ...(plan.query ? { interpretedAs: plan.query } : {}),
    lowRelevance,
    hiring,
    // His address is in a retrieved chunk (e.g. the salary answer) and wasn't asked for.
    noContactDetails: !contactAsked && results.some((r) => hasOwnEmail(r.text)),
    // The lines to write, chosen from the visitor's words. Not for hiring messages: "he gets
    // the interview" counts as asking for contact, and their buttons carry the details.
    ...(contactAsked && !hiring ? { contactDetails: contactLinesAsked(question) } : {}),
    identity: router.isIdentityQuestion(question),
    aiTools,
    truthChallenge,
  };
  const modelMessages = buildModelMessages(conversation, context, promptNotes);
  const encoder = new TextEncoder();
  let clientGone = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          clientGone = true;
        }
      };
      // With contact buttons, wa.me URLs are removed before the guard checks or shows text.
      const guard = createStreamGuard({ stripWhatsAppLinks: !!plannedActions });
      let shownAny = false;
      let blocked: string | undefined;
      /** What the guard matched (rule text or "canary"/"marker"), safe to log. */
      let blockedDetail: string | undefined;
      const show = (text: string) => {
        if (!text) return;
        if (!shownAny) timings.firstToken = ms(started);
        shownAny = true;
        send({ type: "delta", text });
      };
      let outcome: Outcome = "error";
      const llmStarted = performance.now();
      try {
        const result = await streamAnswer(modelMessages, (delta) => {
          if (clientGone) return false; // visitor left: stop spending tokens
          const step = guard.push(delta);
          if (!step.ok) {
            blocked = step.reason;
            blockedDetail = step.detail;
            return false;
          }
          show(step.flush);
          return true;
        });
        timings.llm = ms(llmStarted);
        log.attempts = result.attempts;
        // Prompt caching (Groq, automatic): how much of the prompt was served from the cache.
        // Numbers only. Undefined when the provider didn't report it.
        const usage = result.attempts.at(-1)?.usage;
        if (usage) {
          log.promptTokens = usage.prompt;
          if (usage.cached !== undefined) log.cachedTokens = usage.cached;
        }
        if (result.ok) {
          log.provider = result.provider;
          const last = guard.end();
          if (last.ok) show(last.flush);
          else {
            blocked = last.reason;
            blockedDetail = last.detail;
          }
        }
        if (blocked) {
          // This question was judged on-topic (router sreehari/assistant, fast path or the
          // gate), so a trip is either a real leak or a guard false positive: the visitor gets
          // a neutral line, never the off-topic refusal. Logged loudly to spot false positives.
          log.guard = blocked;
          if (blockedDetail) log.guardDetail = blockedDetail;
          log.guardOnTopic = true;
          outcome = "guarded";
          console.warn(
            JSON.stringify({
              evt: "chat_guard_on_topic",
              requestId,
              reason: blocked,
              detail: blockedDetail ?? null,
              router: log.router ?? null,
            }),
          );
          send({ type: "replace", text: TEXT.answerFailed });
        } else if (!result.ok) {
          // Both providers failed before the first token, or the stream broke after tokens
          // were shown (no model switch then): finish with the busy message.
          log.streamBroken = result.started;
          send({ type: "replace", text: TEXT.busy });
          send({ type: "actions", items: CONTACT_ACTIONS });
        } else {
          outcome = result.usedFallback ? "fallback" : "answered";
          // A hiring message answered with a bare refusal ("I'm sorry, but I can't provide
          // that."): one more attempt with a neutral reading of the message (the router's
          // query, or a fixed question), not streamed. If it is a real answer and passes the
          // guard, it replaces the refusal.
          let answer = result.text;
          let visible = guard.visible;
          if (hiring && router.isBareRefusal(answer)) {
            log.bareRefusal = "kept";
            const retry = await generateAnswer(
              buildModelMessages(
                [
                  ...parsed.messages.slice(0, -1),
                  { role: "user" as const, content: plan.query ?? router.NEUTRAL_HIRING_QUESTION },
                ],
                context,
                promptNotes,
              ),
            );
            log.retryAttempts = retry.attempts;
            if (retry.ok && !router.isBareRefusal(retry.text) && checkAnswer(retry.text).ok) {
              log.bareRefusal = "replaced";
              answer = retry.text;
              visible = retry.text;
              send({ type: "replace", text: answer });
            }
          }
          // Only after the whole answer passed the guard; the items are fixed server config.
          const final = withActions(answer, plannedActions);
          if (final.actions) {
            // Removing a link can leave a dangling label or brackets: if the tidy text differs
            // from what streamed, swap it in (it passes the guard like everything else).
            if (!sameVisibleText(final.text, visible) && checkAnswer(final.text).ok) {
              log.tidied = true;
              send({ type: "replace", text: final.text });
            }
            send({ type: "actions", items: final.actions });
          }
          if (queryVector) {
            const storeStarted = performance.now();
            await cache.storeAnswer(rag.KNOWLEDGE_HASH, question, queryVector, final.text);
            timings.store = ms(storeStarted);
          }
        }
      } catch (error) {
        log.error = (error as Error)?.name;
        send({ type: "replace", text: TEXT.busy });
        send({ type: "actions", items: CONTACT_ACTIONS });
      }
      send({ type: "done", outcome: outcome === "fallback" ? "answered" : outcome });
      if (!clientGone) controller.close();
      writeLog(outcome, 200);
    },
    cancel() {
      clientGone = true;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-accel-buffering": "no",
      "x-request-id": requestId,
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        try {
          return await handleChat(request);
        } catch (error) {
          // Never leak details to the client. Server log: error type + short message only
          // (our own code's message — provider bodies and env values are never read into it).
          const e = error as Error;
          console.error(
            JSON.stringify({
              evt: "chat",
              outcome: "error",
              error: e?.name,
              message: String(e?.message).slice(0, 200),
            }),
          );
          return Response.json(
            { error: "Something went wrong. Please try again later." },
            {
              status: 500,
              headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
            },
          );
        }
      },
    },
  },
});
