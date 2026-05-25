---
title: "Self-learning router for LLM API calls — the math, in 189 lines of TypeScript"
published: false
description: "How ClawPipe's router updates per-model weights from observed cost/latency/quality outcomes, why we didn't ship full bandit machinery, and the small bag of tricks that beats 'always pick the cheapest model' by 12 percentage points."
tags: ai, llm, typescript, machinelearning
cover_image: https://clawpipe.ai/blog/covers/router-math.png
canonical_url: https://clawpipe.ai/blog/router-math
---

## TL;DR

`router.ts` is 189 lines. It picks one of ~21 LLM models for an
incoming prompt. It learns from the outcomes of past calls. On a
400-prompt synthetic benchmark, it spends 12 percentage points less
than the strategy "always pick the cheapest model" — without writing
a bandit, without writing a fallback chain, and without any
hyperparameters more exotic than `0.5`.

This post walks through the entire scoring function, what we
considered and rejected, and what fails.

## The setup

The Router is one stage of the ClawPipe pipeline:

```
Booster -> Pack -> Cache -> [Route] -> Call -> Learn
```

By the time we get to Route, the prompt has survived deterministic
resolution (Booster), context compression (Pack), and semantic
caching (Cache). Whatever's left is genuinely a model query. Our job
is to pick the cheapest model that will answer it well.

The candidate set is a config:

```ts
const DEFAULT_MODELS = [
  { provider: 'groq',      model: 'llama-3.1-8b-instant',  costPer1kTokens: 0,    avgLatencyMs: 200,  qualityScore: 0.78, maxTokens: 128_000 },
  { provider: 'gemini',    model: 'gemini-2.5-flash',       costPer1kTokens: 0,    avgLatencyMs: 600,  qualityScore: 0.88, maxTokens: 1_000_000 },
  { provider: 'deepseek',  model: 'deepseek-chat',          costPer1kTokens: 0.14, avgLatencyMs: 800,  qualityScore: 0.82, maxTokens: 64_000 },
  { provider: 'openai',    model: 'gpt-4o-mini',            costPer1kTokens: 0.15, avgLatencyMs: 600,  qualityScore: 0.85, maxTokens: 128_000 },
  { provider: 'anthropic', model: 'claude-haiku-4-5',       costPer1kTokens: 0.25, avgLatencyMs: 500,  qualityScore: 0.88, maxTokens: 200_000 },
  // ... 10 more
];
```

These are *priors*. We seed them from published per-token prices
(cost), advertised model cards (quality), and our own latency
measurements during onboarding. After the router has been live for a
few days, the priors stop mattering — observed weights take over.

## Step 1: classify the task

Before we score models, we classify the prompt:

```ts
function classifyComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
  const tokens = Math.ceil(prompt.length / 4);
  const hasCode = /```[\s\S]+```/.test(prompt) || /function\s|class\s|const\s/.test(prompt);
  const hasMultiStep = /\b(then|after that|next|finally|step \d)\b/i.test(prompt);
  if (tokens > 2000 || (hasCode && hasMultiStep)) return 'complex';
  if (tokens > 500 || hasCode || hasMultiStep) return 'medium';
  return 'simple';
}
```

This is a regex, not an LLM-as-classifier. We tried the LLM-classifier
approach in an early prototype. It cost more in classification calls
than the routing wins, and it routinely mis-tagged short prompts as
complex because it was trained to be deferential. The regex is wrong
sometimes (it misses code-without-fences) but it's wrong fast.

## Step 2: rank candidates

For each candidate model, we compute three normalized sub-scores:

```ts
const costScore    = 1 - Math.min(m.costPer1kTokens / 15, 1);
const qualityScore = m.qualityScore;        // already 0-1 from priors
const speedScore   = 1 - Math.min(m.avgLatencyMs / 3000, 1);
```

The 15 in `costScore` is a normalization constant (Claude Opus is
$15/1k tokens; everything cheaper gets a positive score). The 3000ms
in `speedScore` is the same idea — anything faster than 3 seconds
gets credit, slower gets penalized.

Then we weight the three sub-scores by complexity:

| Complexity | costWeight | qualityWeight | speedWeight |
|------------|-----------|---------------|-------------|
| simple     | 0.6       | 0.2           | 0.2         |
| medium     | 0.3       | 0.5           | 0.2         |
| complex    | 0.1       | 0.7           | 0.2         |

For a simple prompt, cost dominates. For complex, quality dominates.
Speed always counts but never overwhelms. The numbers came from a
weekend of grid searching against the benchmark dataset; they're not
sacred. You can override them with config.

## Step 3: apply learned weights

This is where it gets interesting. After every successful call we
record:

```ts
interface LearnedWeight {
  totalCalls: number;
  avgLatencyMs: number;
  avgTokensOut: number;
  score: number;       // 0-1, weighted by recent observations
}
```

`score` is computed from `avgLatencyMs` and `avgTokensOut` — the two
things we actually measure (we don't *observe* cost; we know the
per-token price, and we observe `tokensOut`, so cost is derived).
After enough calls, the learned `score` tells us "this model has
been doing well lately on similar prompts." We add a bonus to the
ranking:

```ts
const learnedBonus = learned ? (learned.score - 0.5) * 0.2 : 0;
```

The 0.5 is the neutral mid-point. The 0.2 is the cap on how much the
learned signal can shift the ranking — at most 0.1 in either
direction (since `learned.score` is in [0, 1]). We chose 0.2 because
larger values let a single model that got lucky on three calls
dominate. Smaller values mean the router never adapts.

This is, in machine-learning terms, a *very* simple thing. A
weighted average. Nothing exotic. We tried Thompson sampling — it
didn't move the benchmark. We tried UCB — it routed to the
highest-uncertainty model on every call until calibrated, which
hurt the cold-start experience. We tried a contextual bandit
(features = prompt embedding, arms = models) — it cost more in
training infra than it saved in routing.

The lesson: simple beats fancy at this scale. The number of
candidate models is small (~21). The number of feedback events per
day is tractable. Online weighted-average converges fast. The fancy
algorithms only pay off when you have hundreds of arms or millions
of events per day. Most apps don't.

## Step 4: provider health penalty

After scoring, we apply one more adjustment: a per-provider health
penalty:

```ts
function healthPenalty(map: HealthMap, provider: string, now = Date.now()): number {
  const h = map.get(provider);
  if (!h) return 0;
  const age = now - h.lastFailure;
  if (age >= HEALTH_DECAY_MS) return 0;
  const ageFactor = 1 - age / HEALTH_DECAY_MS;
  return Math.min(1, h.failures * FAILURE_PENALTY * ageFactor);
}
```

`HEALTH_DECAY_MS` is 60 seconds. `FAILURE_PENALTY` is 0.15. So one
failure on `openai` 30 seconds ago drops the provider's score by
0.075 for the next request. After 60 seconds the penalty is 0. After
five failures in a minute, the penalty is at the cap of 1 — `openai`
is effectively banned.

This is *not* a circuit breaker. We have a separate circuit breaker
that opens after 5 failures in 30s and stays open for 60s. The
health penalty is softer — it nudges the router away from a
flickering provider without taking it offline.

We also apply automatic failover: if the chosen route fails with a
retryable status (HTTP 408, 425, 429, 5xx, timeout, network), the
SDK transparently tries the next-best fallback. The router exposes
`fallbacks(primary, prompt, count)` for this:

```ts
fallbacks(primary: RouteDecision, prompt: string, count = 3): RouteDecision[] {
  const ranked = this.rankWithComplexity(prompt);
  const out: RouteDecision[] = [];
  for (const r of ranked) {
    if (r.provider === primary.provider && r.model === primary.model) continue;
    out.push({ provider: r.provider, model: r.model, score: r.score, reason: r.reason });
    if (out.length >= count) break;
  }
  return out;
}
```

The same complexity-aware ranking that picks the primary picks the
fallbacks. No separate config.

## What we learned

1. **Priors matter for the first hour, then they don't.** Set them
   from published prices. Don't fuss.
2. **The classifier doesn't need to be smart.** A regex on
   length-and-keyword catches enough of the signal that the
   downstream weighting handles the rest.
3. **Bandit machinery isn't worth it.** A normalized moving average
   converged faster on our workload and was easier to debug.
4. **Health penalty separate from circuit breaker.** The breaker is
   binary; the penalty is gradual. Both have their place.

## Read the code

189 lines, MIT-licensed: [`sdk/src/router.ts`](https://github.com/finsavvyai/clawpipe-sdk/blob/main/src/router.ts)

The `Router` class has 5 public methods: `route`, `fallbacks`,
`learn`, `pushQualityScore`, `getWeights`. Everything else is
private. If you want to fork the routing math for your own gateway,
this file is a good starting point. The classification regex is the
part most worth changing for your domain.

## Try it

`npm install clawpipe-ai` — the SDK runs in your process, the router
weights are local by default, and you can override the model list
with `new Router({ models: [...] })`. The hosted gateway is optional.

If you ship something similar, I'd love to compare notes. The
weighted-average-vs-bandit conclusion was surprising to me; I expected
the bandit to win.
