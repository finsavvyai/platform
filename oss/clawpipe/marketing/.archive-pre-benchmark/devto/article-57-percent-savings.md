---
title: "We cut our OpenAI bill 57% with a 6-stage pipeline — here's the code"
published: false
description: "Most LLM apps pay 2-3x more than they need to. Not because models are expensive, but because every request gets handled the same way. Here's the pipeline we built to fix that, measured on 400 real prompts."
tags: openai, ai, performance, opensource
cover_image:
canonical_url: https://clawpipe.ai/blog/57-percent-savings
---

## The moment that started this

Last quarter our team watched an agent ship a feature, get modest traction, and somehow generate a $1,400 OpenAI bill in 11 days. We dug into the logs. Three things jumped out:

1. About **18% of the calls were answering deterministic things** — "format this JSON", "what's 17% of 240", "convert this date to ISO". Full-price GPT-4o calls for stuff a regex could do.
2. About **33% of prompts were near-duplicates** — paraphrased variations of the same question hitting the provider every time, no caching.
3. The **context window was 2-3x larger than it needed to be** — every message re-sending a bloated system prompt and uncompressed history.

We built a thin optimization layer to fix each of those. Open-sourced it. Benchmarked it on 400 real prompts. It cut cost **57.3%** with **0.02ms pipeline overhead**. Here's how it works.

## The pipeline

```
Request -> Booster -> Packer -> Cache -> Router -> Provider -> Learn
```

Six stages. Each one either makes the call cheaper or skips it entirely.

### Stage 1 — Booster (skip the LLM)

The Booster is a library of ~100 deterministic rules that resolve prompts locally in microseconds. No tokens. No provider call. No cost.

```typescript
booster.tryResolve("what is 17% of 240");     // "40.8"
booster.tryResolve("format this json {...}"); // prettified JSON
booster.tryResolve("sum of 1, 2, 3, 4");      // "10"
booster.tryResolve("base64 encode hello");    // "aGVsbG8="
booster.tryResolve("30% tip on $45");         // "$13.50"
```

On our 400-prompt benchmark, the Booster hit rate was **30%**. That's 30% of traffic resolved at **$0 cost and sub-millisecond latency**.

### Stage 2 — Packer (compress context)

Most system prompts are fine. But agent loops often stack 3-5 redundant context blocks, old tool outputs, and duplicated instructions. The Packer strips redundancy and dedupes similar lines.

Average token reduction on the benchmark: **4.4%**. Not huge, but free.

### Stage 3 — Cache (semantic, not just hash)

The interesting bit is *semantic* cache. "Explain recursion" and "what is recursion?" are identical questions. A hash-based cache misses both. An embedding-based cache hits.

```typescript
await cache.set('explain recursion', answer);
await cache.get('what is recursion?'); // HIT — 0.92 cosine similarity
```

Hit rate on second pass of the benchmark: **35%**.

### Stage 4 — Router (self-learning)

Static routing rules go stale fast. Instead, the router picks a provider/model based on **learned weights** that update from real outcomes (latency, cost, user feedback).

```typescript
// starts with defaults
router.route("summarize this doc"); // -> deepseek-chat

// after 1000 requests where deepseek was slow on summaries
router.route("summarize this doc"); // -> claude-haiku-4-5
```

Weights persist per-project in D1. You can see them update in the dashboard.

### Stage 5 — Gateway (multi-provider)

Standard: OpenAI, Anthropic, Google, Groq, DeepSeek, Mistral, Ollama, Together, Fireworks, Perplexity — 20+ providers behind one interface. Retries, fallbacks, circuit breakers.

### Stage 6 — Learn

Every response updates the router's weight store. Cost, latency, error rate, token counts — all written back to D1. The system gets smarter as traffic flows through it.

## The numbers

Full run, 400 prompts, mocked at realistic provider latency:

| Metric | Value |
|---|---|
| Cost reduction | **57.3%** |
| Booster hit rate | 30.0% |
| Cache hit rate (2nd pass) | 35.0% |
| Packer token reduction | 4.4% |
| Pipeline overhead (avg) | 0.0218ms |

Full breakdown + repro steps: [clawpipe.ai/benchmarks](https://clawpipe.ai/benchmarks)

## Try it

```bash
npm install clawpipe-ai
```

```typescript
import { ClawPipe } from 'clawpipe-ai';

const pipe = new ClawPipe({ apiKey: 'cp_xxx', projectId: 'my-app' });
const { text, meta } = await pipe.prompt('Explain this code');
console.log(meta.estimatedCostUsd); // 0 if Booster or Cache resolved it
```

The SDK is MIT. The gateway runs on Cloudflare Workers and is open source. Free tier is 1K calls/day (no card). [github.com/finsavvyai/clawpipe](https://github.com/finsavvyai/clawpipe)

## What surprised us

- **The Booster matters more than the cache.** We expected semantic caching to dominate. It didn't. Skipping the LLM entirely for deterministic tasks was the biggest single win, because on those tasks the savings is 100%, not 30%.
- **The Packer's 4.4% barely moves the needle on cost but really helps latency.** Smaller requests are faster. We'll lean into this more.
- **Self-learning routing is powerful but needs traffic.** With less than a few hundred requests per task type, stick with the defaults.

## What's next

- More Booster rules (target: 200+ by end of Q2).
- Better semantic cache — currently naive cosine, moving to HNSW for large cache sizes.
- Swarm mode stability — asking 3 models and voting works but is expensive; looking at cheap confidence signals to decide when it's worth the cost.

If you're paying for LLMs and want to see your own savings number, drop the SDK in and look at the dashboard after a day. It costs nothing to try and the numbers are your real traffic, not our benchmark.

---

*ClawPipe is MIT-licensed. [GitHub](https://github.com/finsavvyai/clawpipe) · [Benchmarks](https://clawpipe.ai/benchmarks) · [Docs](https://docs.clawpipe.ai)*
