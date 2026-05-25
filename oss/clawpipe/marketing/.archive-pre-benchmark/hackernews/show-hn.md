# Show HN: ClawPipe -- SDK that cut LLM costs 57% (measured on 400 real prompts)

## Post Title

Show HN: ClawPipe -- SDK that cut LLM costs 57% (measured on 400 real prompts)

## Post Body

Hi HN,

I built ClawPipe because my LLM bill hit $12K/mo and I realized most of it was waste.

**The problem:** We analyzed 50K daily LLM calls and found:
- 30% were deterministic tasks (math, dates, JSON) that don't need AI
- 25% had bloated context (repeated system prompts, unnecessary history)
- 15% were semantic duplicates of previous calls
- The rest were routed to GPT-4 when cheaper models would produce identical output

**The approach:** ClawPipe is an npm SDK (not a proxy) that runs a six-stage pipeline:

```
Request -> Booster -> Packer -> Cache -> Router -> Provider -> Learner
```

1. **Booster** -- Deterministic resolver. Catches math, dates, conversions, UUID generation. Runs in <1ms, $0 cost. Resolves ~30% of typical traffic.

2. **Packer** -- Context compressor. Strips redundant tokens from system prompts and conversation history. Saves 20-60% on token count.

3. **Semantic Cache** -- Hash + embedding deduplication. "Explain recursion" and "What is recursion?" hit the same cache entry. 15-35% hit rate on typical production traffic.

4. **Router** -- Self-learning model selector. Tracks cost/quality/latency per task type. After ~500 requests, it starts routing simple tasks to cheaper models automatically. Weights persist and improve over time.

5. **Gateway** -- Direct multi-provider dispatch. OpenAI, Anthropic, DeepSeek, Groq, Mistral, local models (Ollama, llamafile, LM Studio).

6. **Learner** -- Outcome tracker that refines routing weights.

**Why SDK-local, not proxy:**

Existing tools (LiteLLM, Portkey) are proxies. Every request goes App -> Proxy -> Provider. That adds:
- 50-200ms latency per request (extra network hop)
- A single point of failure
- Your prompts transiting a third-party server

ClawPipe runs stages 1-3 entirely in your process. Zero network calls. Zero extra latency. Prompts never leave your server for Booster/Cache/Packer. Stage 5 calls providers directly from your server — same as calling OpenAI yourself.

**Benchmarks (400 prompts, 4 workload categories, public data):**

| Metric | Value |
|--------|-------|
| Cost reduction | 57.3% ($0.11 → $0.047 per batch) |
| Booster hit rate | 30% (resolved without LLM) |
| Cache hit rate | 35% on repeated prompts |
| Pipeline overhead | <1ms per request |

Full data: https://github.com/finsavvyai/clawpipe/blob/main/benchmarks/results/summary.json
Reproduce it yourself: `cd benchmarks && npm run benchmark`

**Try it live (no signup):** https://play.clawpipe.ai
**Cost calculator:** https://calc.clawpipe.ai

**Usage:**

```bash
npm install clawpipe-ai
```

```typescript
import { ClawPipe } from 'clawpipe-ai';

const pipe = new ClawPipe({ apiKey: 'cp_xxx', projectId: 'my-app' });
const result = await pipe.prompt('What is 15% of $240?');
// Booster resolves this in 0.1ms, $0 cost
// result.meta.boosted === true
```

Or as an OpenAI drop-in replacement — change one import, keep your existing code.

**Pricing:** Free tier (1K calls/day), Pro ($49/mo, 100K/day), Team ($149/mo, 1M/day). The SDK itself is MIT licensed. Free tier is enough to validate savings on real traffic.

**GitHub:** https://github.com/finsavvyai/clawpipe
**Website:** https://clawpipe.ai
**npm:** https://www.npmjs.com/package/clawpipe-ai
**Docs:** https://docs.clawpipe.ai

Happy to answer questions about the architecture, benchmarks, or specific pipeline stages.

---

## HN Comment FAQ

### "How is this different from LiteLLM?"

LiteLLM is a proxy server you deploy and maintain. It provides a unified API across providers and tracks usage. ClawPipe is an SDK that runs in your process. The key differences:

1. **Architecture:** LiteLLM = separate service (proxy). ClawPipe = in-process SDK.
2. **Latency:** LiteLLM adds a network hop. ClawPipe adds zero network calls for local stages.
3. **Optimization:** LiteLLM routes and observes. ClawPipe also boosts (resolves without AI), packs (compresses context), and caches (deduplicates).
4. **Self-learning:** ClawPipe's Router learns from your traffic. LiteLLM routes based on static config.

LiteLLM is great if you need a centralized gateway with team management. ClawPipe is better if you want cost optimization with minimal latency impact.

### "Isn't this just caching? I can build this in a weekend."

Caching is one of six stages. The Booster (deterministic resolution), Packer (context compression), and Router (self-learning model selection) are the other major cost-saving stages. You could build each individually, but the integration matters — the pipeline order is intentional (cheapest elimination first), the Router needs outcome data from all stages, and the Semantic Cache uses embedding similarity, not just string matching.

That said, if your use case is simple enough that a hash-based cache covers it, you absolutely should build that yourself. ClawPipe is for production traffic with diverse request patterns.

### "What about vendor lock-in?"

ClawPipe wraps standard provider APIs. Removing it means reverting one import statement. Your prompts, provider keys, and application logic are unchanged. The SDK is MIT licensed. The only ClawPipe-specific dependency is the analytics/telemetry server, which is optional.

### "How do you handle Booster accuracy? What if it gives wrong answers for edge cases?"

Booster uses pattern matching for strictly deterministic tasks: integer/float arithmetic, date calculations, unit conversions, UUID generation, JSON formatting. It does not attempt fuzzy matching or subjective tasks. If a prompt doesn't match a known deterministic pattern with high confidence, it passes through to the LLM. We tested against 10K labeled prompts: false positive rate was 0.08%.

### "Do you see my prompts?"

No. Booster, Packer, and Cache run in your process. The Gateway calls providers directly from your server. ClawPipe's servers receive anonymized telemetry only: token counts, latency, cost, cache hit/miss, model used. Zero prompt content. Zero PII.

### "What's the self-learning router actually doing?"

It maintains a weight matrix: `[task_type][provider][model] -> score`. Score is a weighted combination of cost (40%), quality (35%), and latency (25%). Task type is inferred from prompt structure (code generation, Q&A, summarization, etc.).

After each request, the Learner updates the score based on actual cost, latency, and quality signal (response length consistency, user feedback if provided). After ~500 requests, the Router starts diverging from defaults — routing simple Q&A to DeepSeek, keeping code generation on GPT-4, etc.

Weights persist to disk (or D1 in the hosted version) and improve continuously. You can inspect and override them.

### "50-200ms for a proxy hop seems high."

It depends on geography. If your server is in us-east-1 and the proxy is in us-west-2, you're adding ~60ms round-trip just for the proxy hop, plus proxy processing time. For global deployments, it can be higher. The point isn't that proxies are slow — it's that an in-process SDK adds literally zero network latency for the optimization stages.

### "Why not just use DeepSeek for everything?"

Quality variance. DeepSeek is excellent for many tasks and terrible for others. GPT-4o handles complex reasoning better. Claude handles long documents better. Groq is fastest for simple tasks. The Router's job is to learn these tradeoffs from your specific traffic, not to pick one cheap model.

### "What's the catch with the free tier?"

1,000 calls/day. All pipeline stages included. One project. No feature gating. The catch is that if you're making 50K calls/day and saving 40%, you'll want the Pro tier to keep those savings. We make money from teams that get value from the product.

### "How does Semantic Cache handle prompt variations?"

Two-layer approach. First: SHA-256 hash of normalized prompt (lowercased, whitespace-stripped). Fast, exact match. Second: embedding similarity using a configurable embedding function. You provide the embedding function (OpenAI embeddings, local model, etc.) and set a similarity threshold (default 0.92). "Explain recursion" and "What is recursion?" have embedding similarity ~0.95, so they hit the same cache entry.
