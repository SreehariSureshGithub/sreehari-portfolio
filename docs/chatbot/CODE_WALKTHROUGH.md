# Code walkthrough: the portfolio AI assistant

This follows one question through the code, in the order the request meets each file. For
each file: what it does, why it's built that way, and what I traded off. The measurements
behind these decisions are in [ENGINEERING_LOG.md](ENGINEERING_LOG.md). The behaviour rules
are in [chatbot-settings.md](chatbot-settings.md).

```
Browser                                   Vercel function (Node.js 24, fra1)
───────                                   ──────────────────────────────────
ChatLauncher ──hover/focus──► GET /api/warm      (loads the embedding model)
ChatWindow + use-chat ──POST──► /api/chat
                                 request.server      origin, IP, body size, zod, hygiene
                                 ratelimit.server    burst + hour + day   (1 Upstash round trip)
                                 chip-answers.server pre-generated answer?        → SSE
                                 retrieve.server     hybrid search on the visitor's words
                                 answer-cache.server repeat question?             → SSE
                                 router.server       intent + standalone query (unless fast path)
                                                     smalltalk / off-topic → its reply → SSE
                                                     router failed → embedding gate (fallback)
                                 retrieve.server     search again with the rewritten query
                                 ratelimit.server    LLM share + global cap
                                 prompt.server       system prompt + history
                                 providers.server    Groq stream (primary → fallback)
                                 guard.server        incremental output guard
                                 contact-actions     fixed contact buttons
                              ◄── SSE: delta… [replace] [actions] done
```

---

## 1. Browser

### `src/components/chat/ChatLauncher.tsx`
The floating button. It's the only chat code in the main bundle; everything else is a
lazy chunk.
- **Why:** the chat must not slow down the portfolio's first load. The window (Radix
  Dialog, hook, avatar) is fetched on hover, focus, idle time or click.
- **Warm-up:** on the first sign of interest it fires one `GET /api/warm`, so the embedding
  model is already loaded on the server when the first question arrives. A cold model load
  is ~1.2 s.
- **Trade-off:** a warm-up can be wasted if the visitor never asks anything. It needs no
  LLM call and has its own rate limit, so the cost is small.

### `src/components/fx/Loader.tsx`
The page's "INITIALIZING" splash. It's `pointer-events-none`. Before that fix it was a
full-screen layer above the chat button. In a headless-Chrome test, every click on the
button during the loader and its fade went to the loader instead (see the Stage 7 log).

### `src/components/chat/ChatWindow.tsx`
The modal: header, message list, suggested-question chips, input and contact buttons.
- **Accessibility:**
  - Radix Dialog gives the focus trap, Escape to close and focus return to the launcher.
  - The message list is `role="log"` with `aria-live="polite"`, so screen readers hear new
    answers.
  - On a desktop the input gets focus on open; on touch devices it doesn't, so the keyboard
    doesn't pop up uninvited.
- **Scrolling:** it follows new text unless the visitor has scrolled up to read.
- **Contact buttons:** pills under the assistant bubble. Call shows only on
  `(pointer: coarse)` devices, and external links open with `noopener noreferrer`.

### `src/components/chat/use-chat.ts`
Client side of the protocol.
- **State:** history lives in React state, mirrored to `sessionStorage`; nothing goes to
  localStorage or cookies. It's capped at 50 messages, and only role and content are sent
  (at most 12 messages, under the 16 KB body limit).
- **SSE parsing:**
  - `delta` appends text;
  - `replace` swaps the bubble (guard trip, busy message, or the tidy-up after link
    removal);
  - `actions` attaches contact buttons;
  - `done` ends the answer.
- **Typing effect:** 35 characters per animation frame toward the streamed text. It's
  instant with `prefers-reduced-motion` or in a background tab.
- **429:** the friendly text is shown only if it's one of the known texts, so server
  output is never trusted blindly.

### `src/components/chat/linkify.tsx` and `contact-actions.ts`
- **`linkify`:** answers are plain React text nodes, never HTML or Markdown. Only http(s)
  URLs, emails and the short forms `linkedin.com/…` and `github.com/…` become links.
- **`contact-actions.ts`:** validates every button the server sends. Only known ids, and
  only links on an allowlist (wa.me, `mailto:`, `tel:`, linkedin.com, same origin). Labels
  and aria-labels are the client's own.
- **Why both:** defence in depth. The server is the authority, but the client still
  refuses to render a `javascript:` link or a lookalike host.

### `src/lib/chat-copy.ts`
Every visitor-facing text (greeting, refusal, busy and limit messages, chips), shared by the
server and the UI so they can't drift apart. Everything here ships to the browser, so no
prompt text or guardrail details go in it.

---

## 2. Server: request handling

### `src/routes/api/chat.ts`
The orchestrator. It's one TanStack Start server route, and the order of checks is the
design: each step is cheaper than the next, and everything before the LLM is free or
nearly free.
1. **Request checks:** method → content type → origin → env sanity.
2. **Rate limits:** the per-IP check (`admitRequest`) is started as a promise and overlaps
   with body parsing and retrieval. Its result is awaited before *anything* is answered.
   That hides the Upstash round trip behind CPU work.
3. **Chip answer?** It's sent as SSE without an LLM call.
4. **Retrieval** on the visitor's own words. It's local and takes ~10 ms, and gives the
   fast-path signal, the fallback gate and the cache key.
5. **Answer cache:** first-turn questions only. It's checked before the router, so a
   repeated question costs no router call either.
6. **Query understanding** (`router.server.ts`), unless the fast path applies:
   - smalltalk or off-topic → the router's guarded reply, outcome `redirected`;
   - about Sreehari or the assistant → retrieve again with the rewritten query;
   - router failed → the embedding gate decides, and a refusal costs no LLM call.
7. **LLM charge:** `admitLlmCall` takes the remaining 0.75 of a message and the global
   daily cap, in one round trip.
8. **Stream:** retrieved chunks plus the pinned context (who he is; the assistant, his
   contact details or his results only when the message calls for them) → Groq tokens → incremental guard
   → `delta` events. Then an optional tidy `replace`, the contact `actions`, and `done`.
9. **Log:** one JSON line per request, with ids, outcome, router decision (intent,
   `fast_path` or `fallback:<reason>`, tokens, ms), timings, provider, tokens and finish
   reason. Never message text, IPs or keys.

All server modules are imported lazily, so the homepage's SSR never loads the embedding
model or the Redis client.

### `src/server/chat/request.server.ts`
- **Origin:** exact match against `CHAT_ALLOWED_ORIGINS` plus this deployment's own Vercel
  URLs. That's stricter than a `*.vercel.app` wildcard: a Preview can call only its own
  API.
- **Client IP:** `x-vercel-forwarded-for` first. Vercel overwrites the forwarding headers;
  I verified on the Preview that 8 spoofed `X-Forwarded-For` values still hit one burst
  limit.
- **IP keys:** IPs are HMAC-hashed, because a plain hash of an IPv4 address is trivially
  reversible.
- **Body:** read with a hard 16 KB cap *before* parsing, even without a Content-Length.
- **Validation:** zod `.strict()` schema. Roles are only `user`/`assistant`, so a forged
  `system` role is rejected. At most 12 messages and a 500-character question.
- **Hygiene:** NFKC, then strip Unicode format characters (zero-width, bidi) and control
  characters. The order matters: whitespace is collapsed *before* controls are removed, so
  removing them can't glue words together.

### `src/server/chat/ratelimit.server.ts`
- **Windows:**
  - burst: 6/min, sliding, every request counts 1;
  - hour and day: 40 and 30 messages, sliding, in units of 100 so a refusal can cost 0.25;
  - global: 120 main-model answers/day, fixed window;
  - router: 120 calls/day, fixed window. Past it, routing falls back to the embedding gate,
    not to an error.
- **Two-phase charge:** every request pays 0.25 up front. Only an LLM answer pays the
  other 0.75, and if any window rejects it, the others are refunded.
- **Fail-safe:** when Redis errors or times out, the same limits run in memory. That needed
  care because `@upstash/ratelimit` *reports success* on a timeout (`reason: "timeout"`).
  My wrapper treats that as an error. Found in the Stage 5 red team.
- **Trade-off:** in-memory limits are per instance, so they're weaker than Redis. But
  "weaker" beats "unlimited" during an outage.

### `src/server/chat/settings.server.ts` and `env.server.ts`
- **`settings.server.ts`:** every limit is overridable by an env var.
- **`env.server.ts`:** checks the required variables once, logs *names* only, and warns if
  any secret was given a `VITE_` prefix (Vite exposes `VITE_*` variables to the client bundle).

---

## 3. Server: answering without the LLM

### `src/server/chat/chip-answers.server.ts` (+ `scripts/chip-answers.ts`)
- **Generation:** the four suggested questions are answered at build time by the real
  pipeline (retrieval → prompt → Groq → guard). They're stored with the knowledge hash and
  a hash of the prompt setup.
- **Serving:** a stale file is ignored, and the question is answered live instead.
- **Primary model only:** chip answers are served for days, so `build:index` skips any chip
  the fallback model wrote.

### `src/server/rag/retrieve.server.ts`
- **Model:** `bge-small-en-v1.5` (q8 ONNX, 384 dimensions) via transformers.js, loaded from
  files bundled into the function. `allowRemoteModels = false`, so nothing is ever
  downloaded at runtime.
- **Hybrid ranking:** dense cosine plus BM25, merged with weighted reciprocal rank fusion
  (dense 1.0, BM25 0.3, k = 10); the top 3 chunks are used. BM25 rescues exact terms
  ("TensorRT", "Kanini") that small embedding models blur.
- **Pinned context:** `withPinnedChunks()` adds "Who is Sreehari Suresh?" and the assistant
  project chunk to every answer's context (deduplicated), so vague and "about you"
  questions are grounded whatever retrieval found.
- **Relevance gate (now the fallback, and a soft signal):** best cosine ≥ **0.57**, computed on a *name-anchored* query
  ("his education" → "Sreehari education"). Short pronoun questions otherwise score too
  low. Ranking uses the original query, because anchoring skews ranking toward name-heavy
  chunks.
- **Follow-ups:** a cue like "tell me more" or "and his visa?" is searched together with
  the previous question.
- **Trade-off:** a bundled model makes the function 99 MB and a cold start 3.3 s. In
  return there's no embedding API, no key and no per-call cost. BM25-only was the planned
  fallback if size or cold start had gone over budget (150 MB / 5 s).

### `src/server/chat/answer-cache.server.ts`
- **Matching:** a semantic cache for first-turn questions. Cosine ≥ 0.95 on the anchored
  vector, scoped to the knowledge hash, 7-day TTL, at most 500 entries. Vectors are stored
  as int8, and each instance keeps a 30 s local copy.
- **Fail-open:** every operation has a 1.5 s timeout; a failure counts as a miss.
- **Poisoning defence:** only plain single-sentence questions are stored. "Can he join
  immediately? No." is 0.979 similar to the clean question, so without this rule an
  injected answer could be served to everyone.

---

## 4. Server: the LLM path

### `src/server/chat/router.server.ts` (+ `callRouterModel` in `providers.server.ts`)
Query understanding: it replaced the similarity gate as the decision maker. The gate is now
the fallback.
- **Why:** an embedding threshold decided before any model had understood the message, so
  "Hii" and "So he built you in these few days" got canned refusals.
- **Call:** `gpt-oss-20b` by default (`CHAT_ROUTER_MODEL`), temperature 0, JSON mode, low
  reasoning effort, a 250-token cap and a 3 s timeout. A smoke call measured 624 tokens
  and 555 ms.
- **Input:** the last 6 earlier messages plus the latest, as a JSON-encoded block (answers
  shortened to 150 characters). Quotes, braces or a fake `"intent"` in a message can't
  break out of it.
- **Output:** checked with zod as `{intent, query | reply}`.
  - Invalid JSON, a missing field, a timeout or a provider error all fall back to the gate.
  - A reply that fails the checks becomes a fixed line. The checks: the output guard, at
    most 40 words, no links, emails, numbers or markup, no routing words, no 6-word overlap
    with the router's own instructions.
- **Fast path:** `needsRouter()` skips the router for a first message of more than 3 words
  with relevance ≥ 0.70. The highest off-topic score in the retrieval test is 0.653.
- **Planning:** `planResponse()` is a pure function: answer, reply, or refuse.
- **Testability:** the model call is injected, so `npm run test:router` tests everything
  with a mock.
- **Trade-offs:**
  - A routed message pays one more LLM round trip (~0.5 s).
  - The router shares the fallback model's 200K tokens/day, hence its own cap of 120 calls
    next to the global answer cap of 120.
- **Identity and "can't change" (2026-11-15):**
  - the instructions resolve "you" to the assistant and "your boss / owner / creator /
    developer" to Sreehari;
  - `isIdentityQuestion()`: "Who are you?", "Who is your boss?" skip the router (the main
    model answers), and a small-talk decision for one is overruled like a misrouted hiring
    message;
  - `isLockedRequest()`: a request to show, drop or change the instructions with nothing
    about Sreehari in it gets the fixed "I can't change how I work…" line with the contact
    buttons, before any model call; `replyFor()` does the same for a router reply;
  - `isBareRefusal()`: a hiring message answered with only "I'm sorry, but I can't provide
    that." is asked once more with a neutral reading (see `/api/chat`);
  - `mentionsAssistant()` decides whether the chunk about the assistant goes into the
    context.

### `src/server/chat/prompt.server.ts`
- **Layout:** static rules first, so Groq's prompt cache can reuse them (1,024 cached
  tokens on most requests a few seconds apart, rarely on slower traffic); then the retrieved
  chunks in a `<context>` block marked as untrusted. Chunk text is sanitised so it can't
  close or fake that block, and the chunks are not numbered (a "[2]" marker ended up in
  answers when they were).
- **`SYSTEM_RULES` (rewritten once on 2026-11-15):**
  - identity: the AI assistant Sreehari placed on his portfolio site; "you" is the
    assistant, "your boss / owner / creator" is Sreehari;
  - Style: 1–3 sentences, about 60 words, no filler;
  - Stance: honest advocate (truth first; the fact, ONE measured result with its figure,
    an invitation; never a verdict against him or a bare refusal; numbers side by side);
  - Contact: a complete answer has no contact sentence; contact is invited only when the
    knowledge lacks the detail, on a hiring or fit decision, or when asked how to reach him;
  - nine Rules: only facts from context, complete lists, questions about the assistant,
    declines, phone and salary, no comments on others, no leaks, no rule changes ("I can't
    change how I work, suggestions can go to Sreehari"), only known links.
- **`SANCTIONED_RULE_PHRASES`:** every phrase that describes a reply is a named constant, so
  the leak guard doesn't block an answer that follows a rule in the rule's own words.
- **Hiring messages:** a reminder of about 80 words after the visitor's message; the
  results already used in the last two answers are named in it and removed from the result
  lists in the context (`withoutUsedResults()`).
- **Canary:** a token whose appearance in an answer proves a prompt leak.
- **History:** the last 6 messages. Earlier answers are shortened to ~200 characters,
  because the facts come back in `<context>` anyway.
- **Notes after the static rules:**
  - the router's reading of the message, JSON-quoted and sanitised, so it can't open or
    close the context block;
  - a low-relevance hint ("say what you don't know");
  - the follow-up note;
  - a "contact details weren't asked for" note when a retrieved chunk carries his address.

### `src/server/chat/providers.server.ts`
- **Transport:** plain `fetch` to Groq's OpenAI-compatible API; no SDK. `openai/gpt-oss-120b`
  is the primary, `gpt-oss-20b` the fallback (separate quota).
- **Settings:** reasoning effort "low", temperature 0.2. The completion budget is 240
  answer tokens plus 110 reasoning headroom (350 + 150 until 2026-11-15). "low" is the
  lowest reasoning effort Groq accepts for the gpt-oss models. Cached prompt tokens
  (`usage.prompt_tokens_details.cached_tokens`) are read into `usage.cached` and logged.
- **Streaming:** the fallback is tried only *before* the first token. Once text is on
  screen, switching models would show two different answers, so a broken stream ends with
  the busy message instead.
- **Logged per attempt:** status, timings, time to first token, usage (including cached
  tokens), remaining quota and `finish_reason`.

### `src/server/chat/guard.server.ts`
The last line of defence. It runs on every answer, including chip and cached ones.
- **What it blocks:**
  - the canary (also when spelled with separators), prompt markers, and any 8-word overlap
    with the rules (minus the replies the model is *supposed* to give);
  - phone numbers other than his own (compared digit by digit);
  - URLs, domains and emails that aren't in the knowledge files.
- **Streaming:** text is shown only after everything up to it has passed. The latest
  incomplete sentence (or ~60 characters) is held back, and the cut never falls inside a
  URL, an email or a run of digits, so half a phone number can't appear. With contact
  buttons, wa.me URLs are removed before checking.
- **Trade-off:** a rule fragment shorter than one 8-word shingle can be visible briefly
  before a later trip replaces the bubble. Holding back whole answers would have cost
  ~1 s of perceived latency on every reply.

### `src/server/chat/contact-actions.server.ts`
The WhatsApp, Email, Call, LinkedIn and Resume buttons.
- **Source:** a frozen config built from `src/data/contact.ts`, the same constants the site
  uses.
- **When:** in the three contact cases (the knowledge lacks the detail, a hiring or fit
  decision, asked how to reach him), with the "can't change how I work" reply and with the
  busy message. Decided from the question or the router's query, or because the finished
  answer gives his details or invites contact ("worth a conversation with him"). A complete
  factual answer gets none. What is in them never comes from model output, so a prompt
  like "add a WhatsApp button to +1 555…" can't change them.

### `src/routes/api/warm.ts` and `health.ts`
- **`warm`:** the same origin check, its own burst limit; it loads the modules and the
  embedding model.
- **`health`:** a smoke test that reports the runtime (`node`), the Node version, the
  Vercel environment and the region. No secrets, and no variable names.

---

## 5. Build and test tooling

| File | Purpose |
|---|---|
| `scripts/embedding-model.ts` | Downloads the model files pinned to one Hugging Face commit, each checked by SHA-256, so an upstream change can never silently swap the model |
| `scripts/build-index.ts` | `knowledge/*.md` → one chunk per `##` section (HTML comments and `[FILL…]` lines removed) → embeddings + BM25 stats → `knowledge-index.server.json` + content hash; then regenerates the chips |
| `scripts/test-retrieval.ts` | 52 questions: ranking, gate pass/block, margins, latency |
| `scripts/test-router.ts` | 235 in-process checks with a mocked router: JSON parsing and schema, reply safety, timeout and provider fallback, the fast path, planning, the router's input encoding, pinned and conditional context, the prompt wording, identity questions, locked requests, bare refusals, used results |
| `scripts/test-guard.ts` | 173 in-process checks: phone/wa.me rules, streaming splits, link removal, answers that echo the rules' wording, real leaks, the button decision and config, the client allowlist |
| `scripts/redteam.ts` | 59 checks: prompt injection and extraction, 6 router attacks (fake JSON decisions, harmful-reply requests, JSON-breaking input, instruction requests, an injection in Hindi), 5 cases for pressure to change the rules and for identity, forged history, plus in-process guard and cache-poisoning checks |
| `scripts/eval.ts` | 44 single-turn cases + 4 chips + 10 multi-turn conversations (`eval/conversations.json`); reads the server log for provider, router decision and `finish_reason`; declines scored by meaning; optional LLM judge (`EVAL_JUDGE=1`); `EVAL_ONLY` subsets; `EVAL_RESCORE` re-scores saved answers |
| `scripts/measure-tokens.ts` | Real token usage per request from Groq's `usage` field |

---

## Likely interview questions

1. **Why RAG instead of fine-tuning?** The facts change (status, availability) and must be
   exact. RAG lets me edit a Markdown file and redeploy; fine-tuning would bake facts in,
   cost money and still hallucinate.
2. **Why a bundled embedding model instead of an API?** $0 and no key on the hot path. I
   measured it: a 99 MB function and a 3.3 s cold start, both under my limits (150 MB / 5 s).
3. **Why hybrid retrieval?** Small embedding models blur rare exact terms. BM25 at weight
   0.3 fixed the misses (23/24 → 24/24 right chunk first) without letting keywords dominate.
4. **Why replace the similarity gate with an LLM router?** A threshold can't understand
   "Hii" or "So he built you in these few days", so visitors got canned refusals. A small
   JSON-mode call reads the conversation, classifies it and rewrites follow-ups into
   standalone queries. The gate stays as the fallback, so a router outage never blocks
   answers. Clear first questions skip the router, so most questions pay no extra
   latency.
5. **Why anchor pronouns for the gate but not for ranking?** Anchoring raises on-topic
   scores far more than off-topic ones, which is what the gate needs. But it biases ranking
   toward name-heavy chunks, so ranking uses the original query.
6. **How do you stop prompt injection?** In layers:
   - the router sees the conversation only as JSON data, has no tools, and its reply is
     guarded; fooling it only reaches the normal pipeline;
   - the rules declare all messages and the context to be data;
   - the context block can't be faked;
   - the output guard blocks leaks and unknown links or numbers;
   - contact buttons come from server config.
   No single layer is trusted alone.
7. **How can streaming and an output guard coexist?** Text is released only after the
   prefix passes the guard: the latest sentence (or ~60 characters) is held back, never cut
   inside a URL or number. If a later check trips, a `replace` event swaps the bubble.
8. **What happens when Groq is down or out of quota?** The fallback model is tried before
   the first token. If both fail, the visitor gets a friendly busy message with my email.
   Nothing is billed.
9. **What's the real capacity?** Groq's free plan allows 200,000 tokens/day per model. An
   answer costs about 1,750 tokens (2,200 for a hiring answer), so the primary gives 88–114
   answers a day. The router (~800 tokens per call, 120 calls/day) shares the fallback's
   budget, which leaves it about 45 answers, so the global answer cap is 120. Chips and cached answers don't use
   Groq.
10. **How do the rate limits work without a database per request?** One Upstash round trip
    checks burst, hour and day in parallel, and it overlaps with CPU work. Only an LLM
    answer needs a second trip.
11. **What if Redis is down?** The same limits are enforced in memory (fail-safe, never
    unlimited). I found the library reported timeouts as *allowed* and wrapped that.
12. **How is the cache protected from poisoning?** Only plain single-sentence questions are
    stored, entries are scoped to the knowledge hash, and served entries pass the guard
    again.
13. **Why fra1?** The database is in Frankfurt. With the function in Washington, each Redis
    call crossed the Atlantic. In fra1, first text on the Preview went from 1.25 s to
    1.01 s, and refusals to 0.34 s.
14. **How do you know answers are good?** `npm run eval`: 38 keyword and refusal cases plus
    the chips. It went from 32/36 to 36/36, and was 36/36 again on a repeat run. I also read
    the answers, because keyword checks can't catch overstatement.
15. **How do you prevent hallucinated numbers?** "Use only context", fixed missing-detail
    replies, the guard blocking unknown phone numbers and links, and eval cases for
    overstatement ("handles", not "generates", 20–30 leads).
16. **How do you keep secrets out of the client?** Server-only env vars, never `VITE_`. Every
    model, embedding and Redis call is server-side. After builds I scan the client bundle
    for key prefixes and prompt text.
17. **How is privacy handled?** No message text is stored or logged. IPs are HMAC-hashed for
    rate-limit keys. History stays in the visitor's tab.
18. **What was the hardest bug?** Two are close. The rate limiter silently failing open on
    Redis timeouts. And a local Windows build that crashed the chat dialog because a
    lowercase drive letter made the bundler load Radix twice; Linux builds were fine.
19. **What would you change with a budget?** A paid LLM tier (higher daily limits), a
    managed vector store once the knowledge grows past a few hundred chunks, and
    authenticated analytics on unanswered questions.
20. **How did you build it?** I designed the system and made the decisions: the
    architecture, the free-tier constraint, the gate, the guardrails and the limits.
    Implemented stage by stage; each stage verified on Vercel Previews.
