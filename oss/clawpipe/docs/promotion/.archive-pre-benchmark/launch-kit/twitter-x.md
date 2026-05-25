# Twitter / X — launch posts

All copy cross-checked against `benchmarks/results/summary.json` and shipped
gateway code. Numbers without a citation here are removed from the post.

---

## 1. Standalone announcement (≤ 280 chars)

```
ClawPipe is live.

The only AI gateway that skips LLM calls entirely.

246 deterministic rules resolve math, dates, JSON, JWT, ISO lookups
in <1ms — your token count never moves. The rest goes through a
self-learning router across 21 providers.

57.3% cost cut. Free tier, 1k calls/day.

🔗 clawpipe.ai
```

Char count: 277.

---

## 2. Hero thread (8 tweets)

Format: post the first tweet on its own — don't pre-thread it. Wait 30
seconds, reply to your own post with #2, #3, etc. Spacing of ~30s gives
the algo a chance to see engagement on each before the next lands.

### 1/8 — hook
```
Most "AI gateways" are HTTP proxies with retry logic.

I built one with a different idea: what if a chunk of your prompts
never need an LLM at all?

ClawPipe → 246 deterministic rules. Math, regex, JWT, ISO, dates,
JSON. Sub-millisecond. Zero tokens. Zero provider call.
```

### 2/8 — the wedge
```
Call it Booster.

`pipe.prompt("what is 17 * 23?")` → 391, in 0.3ms, off your phone.
`pipe.prompt("decode this JWT")` → claims object, no API call.
`pipe.prompt("ISO code for Norway")` → NO, instantly.

If Booster doesn't catch it, it falls through to the LLM stages.
```

### 3/8 — the rest of the pipeline
```
Booster → Pack → Cache → Route → Call → Learn.

Pack: token compression (avg 4.36 saved/prompt).
Cache: Cloudflare BGE-small semantic dedup.
Route: cost/quality/latency-aware, self-learning weights.
Call: 21 providers, circuit breaker, idempotency keys.
Learn: outcome tracking refines route_weights.
```

### 4/8 — the benchmark
```
400-prompt benchmark (200 unique × 2 passes, mixed difficulties):

• 57.3% cost reduction vs direct provider calls
• 30% Booster hit rate (resolved with no LLM)
• 35% semantic cache hit rate
• 0.022ms pipeline overhead end-to-end

Numbers are real arithmetic against published per-token prices.
Not measured prod traffic. Mileage varies on your prompts.
```

### 5/8 — the SDK
```
Pure SDK on npm: `npm install clawpipe-ai`

Drop-in OpenAI compat:
```js
const pipe = new ClawPipe({ apiKey });
const { text } = await pipe.prompt(prompt, { provider, model });
```

Or proxy your existing OpenAI client:
```js
new OpenAI({ baseURL: 'https://api.clawpipe.ai/v1' })
```

MIT-licensed. 1655 tests passing.
```

### 6/8 — what it doesn't do
```
Honest gaps. The gateway isn't open-source yet (SDK is). No PII
guardrails module — Portkey/Helicone parity is on the roadmap.
Dashboard is minimal vs Helicone's. Bedrock + Vertex are signed
correctly but the routing UX is plain.

If those matter to you, use the right tool.
```

### 7/8 — pricing
```
Free: 1,000 calls/day. All pipeline stages. No card.
Dev: $79/mo, 15k calls/day, unlimited projects.
Growth: $299/mo, 150k calls/day, global weight sync.
Scale: $799/mo, 1.5M calls/day, SLA.
Enterprise: SSO, audit logs, dedicated infra.

Quotas verified in `gateway/src/billing/types.ts`.
```

### 8/8 — call to action
```
Try it: clawpipe.ai
SDK: github.com/finsavvyai/clawpipe-sdk
MCP server (Claude Desktop, Cursor): clawpipe-mcp-server on npm

Show HN tomorrow morning ET. Will be in the thread.

If you want a tour, my DMs are open.
```

---

## 3. Single quote-tweet for retweets

When someone shares the post, quote-RT with one of these:

- `Booster is the only stage other gateways don't have. Everything else is table stakes.`
- `30% of prompts in our benchmark never reached an LLM. That's the whole pitch in one sentence.`
- `If your gateway is just retries + fallbacks, you're not lowering cost — you're insuring against failures. ClawPipe does both, but only one of them moves the cost line.`

---

## 4. Reply templates

For when ML/AI/devtool accounts ask "vs $competitor?":

> Three honest splits — Booster (deterministic pre-LLM stage, nobody else
> has it), self-learning router (we update weights from observed outcomes,
> they're config-driven), and SDK-local execution (some savings never leave
> your machine — pure proxies can't do that). Where they win: Portkey has
> 1,600+ models, LiteLLM is fully OSS, Helicone's dashboard is nicer. Use
> the right tool.

For "open-source the gateway?":

> SDK is MIT today: github.com/finsavvyai/clawpipe-sdk. Gateway is not yet —
> running a multi-provider proxy at scale has non-trivial KV/D1/egress
> bills and we want a sustainable model first. If gateway-OSS is a hard
> requirement: LiteLLM is genuinely good, ship that.

For "is the benchmark realistic?":

> Synthetic dataset, mixed difficulty, deliberately included a "boostable"
> category since that's the wedge. Cost arithmetic is real (against
> published per-token prices), the dataset is not your prod traffic.
> Methodology + raw numbers in `benchmarks/results/summary.md`. The 57%
> figure on your stack will be different.

---

## 5. Posting time

US-launch oriented:

- **Tuesday or Wednesday, 9:30am ET.** Best engagement window for devtool
  accounts. Avoid Mondays (post-weekend backlog) and Fridays (pre-weekend
  drift).
- Aim ~30 minutes BEFORE the Show HN post so the X audience sees the
  announcement first, then HN later that morning, then Product Hunt the
  next day.

Don't pre-schedule. Algo-watch the first 10 minutes — if engagement is
weak, hold the thread reply chain and re-engage from a second account.
