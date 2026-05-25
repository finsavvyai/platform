# /r/MachineLearning Post

## Title

[P] ClawPipe: An SDK-local pipeline that cuts LLM inference costs 30-50% via deterministic boosting, context packing, semantic caching, and self-learning routing

## Body

I've been working on an LLM cost optimization SDK and wanted to share the technical approach.

**Problem:** We analyzed 10K production LLM calls and found that ~70% of spend is addressable:

- 30% of calls have deterministic answers (arithmetic, date math, conversions, JSON formatting) — no model inference needed
- 25% have redundant context (repeated system prompts, bloated RAG results, unnecessary conversation history)
- 15% are semantic duplicates of previous calls
- The remaining calls are often routed to an overqualified model

**Approach:** ClawPipe is a TypeScript SDK (npm package) that runs a six-stage pipeline in-process:

1. **Booster** — Pattern-matching resolver for deterministic tasks. If the prompt matches a known computable pattern (arithmetic expressions, date calculations, unit conversions, UUID generation), it returns the computed answer in <1ms without any model call. False positive rate on our test set of 10K labeled prompts: 0.08%.

2. **Packer** — Context compressor. Identifies and removes redundant tokens: repeated system prompt fragments, duplicate context documents in RAG results, and low-information filler phrases. Operates on the token level. Average compression: 20-60% depending on prompt structure.

3. **Semantic Cache** — Two-layer deduplication. Layer 1: SHA-256 hash of normalized prompt (fast exact match). Layer 2: embedding-based similarity with configurable threshold (default 0.92). You provide the embedding function. Typical hit rate: 15-35% after warm-up.

4. **Router** — Self-learning model selector. Maintains a weight matrix `[task_type][provider][model] -> score` where score is a weighted combination of cost (40%), quality (35%), and latency (25%). Task type is inferred from prompt structure. Weights update after each request via the Learner stage. Converges after ~500 requests.

5. **Gateway** — Multi-provider dispatch. Calls OpenAI, Anthropic, DeepSeek, Groq, Mistral, or local models (Ollama, llamafile, LM Studio) directly from your process. Includes circuit breaker for provider failover.

6. **Learner** — Asynchronous weight updater. Records cost, latency, and quality signal per request. Updates Router weights. Persists to disk or D1.

**Key architectural decision — SDK-local vs proxy:**

Most existing tools (LiteLLM, Portkey) are proxies that add a network hop between your app and the provider. We chose SDK-local because:

- Stages 1-3 are fundamentally local operations (pattern matching, compression, cache lookup). Running them on a remote proxy adds latency for no benefit.
- No prompts transit third-party infrastructure for the local stages.
- No single point of failure. If our telemetry server is down, the SDK still works.
- Net latency effect is negative: 45% of requests resolve locally in <5ms instead of 500-2000ms via a model.

**Benchmarks (50K calls/day, production SaaS):**

| Metric | Baseline | With ClawPipe |
|--------|----------|---------------|
| Monthly cost | $12,000 | $6,840 (-43%) |
| p50 latency | 850ms | 620ms (-27%) |
| p99 latency | 3,200ms | 2,100ms (-34%) |
| % calls needing inference | 100% | 55% |

**Limitations:**

- Booster only handles strictly deterministic tasks. It won't help if your traffic is 100% open-ended generation.
- Packer compression depends on how redundant your prompts are. Well-optimized prompts see less benefit.
- Semantic Cache requires an embedding function for fuzzy matching. Without it, only exact-match caching works.
- Router needs ~500 requests to start outperforming static model selection.
- TypeScript/JavaScript only for now. Python SDK is in development.

**Links:**
- npm: `clawpipe-ai`
- Website: [clawpipe.ai](https://clawpipe.ai)
- MIT licensed

Happy to discuss the architecture, methodology, or limitations.
