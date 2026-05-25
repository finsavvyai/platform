# Reddit — subreddit-specific submissions

Each subreddit has a different culture; copy is bespoke per sub. Don't
cross-post the same body. Post over 4-6 days, not all in one window —
moderators flag it, and engagement gets diluted.

Read each sub's rules before posting. r/programming bans self-promotion
in titles. r/MachineLearning requires the [P] tag for personal projects.
r/LocalLLaMA cares about non-cloud, on-device — the angle there is
different.

---

## 1. r/MachineLearning

**Tag**: `[P]` (personal project)
**Title**: `[P] ClawPipe — open SDK + gateway for routing across 21 LLM providers, with a deterministic pre-LLM stage that resolves 30% of prompts without a model call`

**Body**:

```
Long-time lurker, first-time poster. I shipped a thing.

Premise: a fraction of every app's prompts don't need an LLM at all.
Math, date math, JSON formatting, JWT decoding, ISO country/currency
lookups, regex, format conversions. These are deterministic — a
language model is the wrong tool. So I wrote 246 rules across 24
domain packs (math, regex, ISO, AWS, crypto, format, color, time,
chemistry, music, finance, dev, etc.) that resolve those prompts
locally in the SDK at sub-millisecond latency. Zero tokens, zero API
call. Call it Booster.

What Booster doesn't catch flows through:
- A context compressor (avg 4.36 token savings per prompt)
- A semantic cache (Cloudflare Workers AI BGE-small-en embeddings)
- A self-learning router that updates per-model weights from observed
  latency/cost/quality (closer to a bandit than a config file)
- A multi-provider gateway (21 providers — OpenAI, Anthropic, Bedrock
  with proper SigV4, Vertex with RS256 JWT auto-refresh, Gemini, Groq,
  DeepSeek, Mistral, Together, Fireworks, Perplexity, xAI, Cohere,
  AI21, Cerebras, Replicate, Hugging Face, Writer, Databricks, Azure
  OpenAI, OpenRouter, plus any OpenAI-compatible endpoint like Ollama
  or vLLM)

I ran a 400-prompt synthetic benchmark (200 unique × 2 passes, mixed
difficulties): 57.3% cost reduction vs direct provider calls, 30%
Booster hit rate, 35% cache hit rate after pass 2, 0.022ms pipeline
overhead. Methodology + raw numbers in `benchmarks/results/summary.md`
in the repo. Real arithmetic against published per-token prices —
not measured production traffic. Mileage on your prompt mix will
differ.

SDK: MIT-licensed, TypeScript, 1,655 unit tests passing.
Hosted gateway: free tier (1,000 calls/day, no card).

Honest gaps in case you care:
- Gateway itself is not yet OSS (SDK is). Working on the licensing /
  ops story — running multi-provider proxies has non-trivial KV/D1/
  egress costs.
- No PII guardrails module yet. Portkey/Helicone are ahead. On the
  Q3 roadmap.
- The router weights are exposed and overridable, but the UI for
  inspecting them is plain.

Repo: https://github.com/finsavvyai/clawpipe-sdk
Site: https://clawpipe.ai

Happy to discuss the routing math, the deterministic-rules taxonomy,
or why we don't ship a "mode that uses an LLM as a tool selector"
(it's slow, expensive, and beats the deterministic case more often
than people expect — but only barely, and only on small workloads).
```

---

## 2. r/LocalLLaMA

**Title**: `Anyone want a routing SDK that mixes local models (Ollama, vLLM, llamafile) with cloud providers, including a deterministic stage that skips the model entirely?`

**Body**:

```
Built ClawPipe — open SDK that does Booster -> Pack -> Cache -> Route
-> Call -> Learn. The relevant bits for r/LocalLLaMA:

1. The Router doesn't care if a model is local or cloud. You add an
   OpenAI-compatible endpoint (Ollama, llamafile, LM Studio, vLLM,
   TGI) as a "provider" in your config and the router treats it the
   same as gpt-4o-mini — cost is whatever you set (typically 0 for
   local), latency is observed.

2. The self-learning weights persist locally if you want — no need
   to send any data to our gateway. SDK runs in your process. Cache,
   Booster, router weights — all local.

3. The Booster stage is a gift if you have local hardware that's
   bandwidth-limited. 30% of your prompts resolve in 0.3ms locally
   instead of going to a model at all.

4. The MCP server ships separately and works with Claude Desktop,
   Cursor, Continue.dev — but you can wire it to a local model via
   OpenAI-compat too.

Repo: github.com/finsavvyai/clawpipe-sdk (MIT)
SDK on npm: clawpipe-ai
Local-only example: https://github.com/finsavvyai/clawpipe-sdk/tree/main/examples/local-only

Question for the sub: how are you currently choosing between two
local models for the same task? I'm interested in failure modes for
the bandit-style learner.
```

---

## 3. r/programming

**Title**: `Self-learning router for LLM API calls — the routing weights update from observed cost/latency/quality, not from a fallback config`

(This sub flags marketing. Lead with the engineering idea, not the
product. Don't put "ClawPipe" in the title.)

**Body**:

```
Wrote up the routing logic from my new project. The TL;DR:

Most "AI gateways" handle multi-provider as a fallback chain — try
OpenAI, fall back to Anthropic, fall back to Groq. That works for
liveness, but doesn't lower cost.

I wanted something where the router learns. Per (provider, model)
pair, we keep:
- totalCalls, avgLatencyMs, avgTokensOut, score

`score` is a weighted average of recent outcomes, normalized 0-1.
After every successful call, we recompute score = α·costScore +
β·qualityScore + γ·latencyScore where α, β, γ depend on the
classified task complexity (we tag "simple", "medium", "complex"
based on token count and pattern detection).

For the next request, we rank candidate models by `complexityScore +
0.2·(score - 0.5)`. Effectively a bandit with a normalized prior
from published per-token prices.

There's also a circuit breaker (5 failures in 30s opens for 60s),
provider failover (HTTP 5xx/429 → next-best, retryable matrix),
health penalty on the next request after a failure (linearly decays
over 60s), and an optional "global learning" mode where weights sync
to a shared gateway via weighted-average merge.

Code: https://github.com/finsavvyai/clawpipe-sdk/blob/main/src/router.ts
(189 lines, MIT)

The interesting design tension is staying simple enough to debug
(no Thompson sampling, no UCB, no full bandit machinery) while still
beating "just always pick the cheapest model" — which it does in our
benchmark by ~12 percentage points. If you've shipped something
similar I'd love to compare notes.
```

---

## 4. r/devops

**Title**: `Per-project rate limiting + idempotency keys + RFC 9239 RateLimit headers, on Cloudflare Workers`

(Again — engineering-first title.)

**Body**:

```
Shipped a couple of things on a Worker-based gateway that might be
useful patterns for others rate-limiting on the edge:

1. **Idempotency-Key**: client passes `Idempotency-Key: <token>` on
   POSTs, server stashes the (project_id, key, response) triple in
   KV with 24h TTL. Replays return cached body + `Idempotency-Replay:
   HIT`. Only 2xx responses are stored — non-2xx forces the client
   to retry against fresh state. Validates pattern
   `[A-Za-z0-9_.-]{1,200}`.

2. **RFC 9239 RateLimit headers**: `RateLimit-Limit: <n>, <n>;w=86400`,
   `RateLimit-Remaining: <n>`, `RateLimit-Reset: <secs>`. Computed
   per-project from a tier-based daily ceiling (free 1k, dev 15k,
   growth 150k, scale 1.5M, enterprise unlimited). KV counter resets
   at UTC midnight; Reset header reports delta-seconds.

3. **Webhook DLQ + retry on cron**: outbound webhooks are recorded in
   D1 (`webhook_deliveries` table, status pending|success|dead),
   retried with exponential backoff (1m/5m/30m/2h/12h), parked as
   dead after 5 attempts. A cron trigger (`*/5 * * * *`) drains due
   retries up to 50 per tick. Manual replay via
   `POST /v1/webhooks/dlq/{id}/replay`.

The whole thing is a Cloudflare Worker + D1 + KV. The DLQ pattern
in particular has been clean — I expected to need Queues or
Durable Objects, but the partial index `WHERE status='pending' AND
next_retry_at <= now` keeps drains cheap.

Code: github.com/finsavvyai/clawpipe (gateway/ subfolder, but the
gateway itself isn't OSS yet — happy to share specific files in
comments if you want a pattern).
```

---

## 5. Tone & timing rules

- Don't post the same submission to multiple subs simultaneously —
  Reddit's spam filter shadow-bans cross-posters fast. Space out
  4-6 days.
- Reply to every comment in the first 4 hours, even short ones.
  Top-level engagement is the strongest sub-rank signal.
- Never delete a critical comment. If someone says "I tried it and
  the SDK errored on X" — debug live in the thread, post the fix
  commit, link to the test that catches it next time.
- If a thread starts trending negative (>5 downvotes on the OP, or
  the top comment is critical), don't escalate. Reply substantively
  to the criticism, leave the post alone for 24 hours, come back
  with a follow-up post linking the actual fix.
