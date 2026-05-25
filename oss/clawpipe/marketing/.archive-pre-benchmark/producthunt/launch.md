# ClawPipe — Product Hunt Launch

## Tagline (60 chars)

Cut LLM costs 57% — measured on 400 real prompts

## Short Description (240 chars)

ClawPipe is an SDK that sits between your app and LLM providers. It skips, caches, compresses, and routes every AI request — measured 57.3% cost reduction on 400 real prompts. One npm install, no code rewrite. Works with OpenAI, Anthropic, Groq, Gemini, DeepSeek.

## Detailed Description (Maker's Story)

### Why we built ClawPipe

We were running a SaaS product making ~50K LLM calls per day. Our monthly OpenAI bill hit $12,000 and was climbing. When we analyzed the traffic, the findings were shocking:

- **30% of requests** were simple tasks (math, dates, JSON parsing) that never needed an LLM
- **25% of requests** had bloated context — copy-pasted docs, repeated system prompts, unnecessary history
- **15% of requests** were near-duplicates of previous calls
- The remaining **30%** were being routed to GPT-4 when cheaper models would have produced identical results

We looked at existing solutions. Proxy-based tools like LiteLLM and Portkey add a network hop (50-200ms extra latency) and require routing all prompts through a third-party server. Observability tools like Helicone show you the problem but don't fix it.

We wanted something different: **an SDK that optimizes locally, before the request ever leaves your server.**

### How it works

ClawPipe runs a six-stage pipeline on every request:

1. **Booster** — Deterministic resolution. Math, dates, conversions, UUIDs — resolved in <1ms with zero API cost.
2. **Packer** — Context compression. Strips redundant tokens, compresses context by 20-60%.
3. **Semantic Cache** — Deduplication via hashing and embeddings. "Explain recursion" and "What is recursion?" return the same cached response.
4. **Router** — Self-learning model selection. Starts with sensible defaults, learns from your traffic which model gives the best cost/quality tradeoff per task type.
5. **Gateway** — Multi-provider dispatch to OpenAI, Anthropic, DeepSeek, Groq, Mistral, or local models.
6. **Learner** — Tracks outcomes and refines routing weights continuously.

The first three stages run entirely in your process. No network calls. No latency. No data leaving your server.

### Results

Measured on 400 real prompts across 4 workload categories ([full data](https://github.com/finsavvyai/clawpipe/blob/main/benchmarks/results/summary.json)):
- **57.3% average cost reduction** ($0.11 → $0.047 per batch)
- **30% of requests** resolved by Booster at $0 cost
- **35% cache hit rate** on repeated prompts
- **<1ms pipeline overhead** — sub-millisecond processing per request
- **Zero latency increase** — Booster actually reduces p99 latency

Try it yourself: [live playground](https://play.clawpipe.ai) | [cost calculator](https://calc.clawpipe.ai)

### The one-line change

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI();

// After
import { ClawPipe } from 'clawpipe-ai';
const client = new ClawPipe({ apiKey: 'cp_xxx' });
```

That's it. Same `.chat.completions.create()` interface. Same response shape. 30-50% less cost.

## Gallery Image Descriptions

1. **Hero Screenshot** — Terminal split-screen: left shows `npm install clawpipe-ai` and the two-line code change, right shows the benchmark result (57.3% cost reduction). Dark theme, clean typography. Screenshot the hero at [clawpipe.ai](https://clawpipe.ai).

2. **Live Playground** — Screenshot of [play.clawpipe.ai](https://play.clawpipe.ai) running a real request through all pipeline stages with timing data visible. Shows Booster → Packer → Cache → Router → Gateway stages running live.

3. **Cost Calculator** — Screenshot of [calc.clawpipe.ai](https://calc.clawpipe.ai) with $10K monthly spend selected, showing the per-stage bar chart (Booster/Packer/Cache/Router savings) and the ROI section.

4. **Dashboard** — Screenshot of [app.clawpipe.ai](https://app.clawpipe.ai) logged into a project with the analytics tab showing overview metrics (total requests, total cost, avg latency, cache hit rate) and provider breakdown.

5. **Before/After Code** — Screenshot of the Solution section at [clawpipe.ai](https://clawpipe.ai) showing the side-by-side code compare (OpenAI before → ClawPipe after) with the four benefit tiles below.

6. **Benchmark Proof** — Screenshot of the Proof section at [clawpipe.ai](https://clawpipe.ai) showing 57.3% / 30% / 35% / <1ms cards with the source citation linking to the public JSON.

## Live Links (for PH listing)

- **Website:** https://clawpipe.ai
- **Live Playground:** https://play.clawpipe.ai (no signup, 5 free calls/hour)
- **Cost Calculator:** https://calc.clawpipe.ai
- **Dashboard:** https://app.clawpipe.ai
- **Docs:** https://docs.clawpipe.ai
- **GitHub:** https://github.com/finsavvyai/clawpipe
- **npm:** https://www.npmjs.com/package/clawpipe-ai
- **Benchmark data:** https://github.com/finsavvyai/clawpipe/blob/main/benchmarks/results/summary.json

## Maker's First Comment

Hey Product Hunt! I'm the maker of ClawPipe.

We built this because we were spending $12K/mo on LLM calls and realized most of that spend was waste. Not because OpenAI is expensive — because we were using it for things that didn't need AI.

The key insight: **the cheapest LLM call is the one you never make.**

We ran a benchmark on 400 real prompts across four workload categories and measured a **57.3% average cost reduction**. The data is public — [here's the raw JSON](https://github.com/finsavvyai/clawpipe/blob/main/benchmarks/results/summary.json).

Where the savings come from:
- **30% of requests** resolved by Booster at $0 cost. Math, dates, JSON — no LLM needed.
- **35% cache hit rate** — "explain recursion" and "what is recursion?" return the same cached answer.
- **Context packing** cuts 20–60% of tokens by stripping redundancy.
- **Smart routing** sends simple tasks to cheap/free models (Groq, Gemini free tier) instead of GPT-4.

The whole thing is an npm package. No proxy server, no extra latency (<1ms overhead), no sending prompts through a third party.

**Try it right now:**
- [Live playground](https://play.clawpipe.ai) — no signup, sends real requests
- [Cost calculator](https://calc.clawpipe.ai) — paste your monthly spend
- [Dashboard](https://app.clawpipe.ai) — sign up free, 1,000 calls/day

Happy to answer anything about the architecture, benchmarks, or how specific pipeline stages work.

## FAQ (10 Prepared Responses)

### 1. "How is this different from LiteLLM?"

LiteLLM is a proxy — it sits between your app and providers as a separate service. Every request adds a network hop (50-200ms). ClawPipe is an SDK that runs in your process. The Booster, Packer, and Cache stages execute locally with zero network latency. For the Gateway stage, ClawPipe calls providers directly — same as you would without it. The fundamental difference is proxy vs. SDK-local architecture.

### 2. "Does this add latency to my requests?"

For requests resolved by Booster: latency drops to <1ms (from typical 500-2000ms LLM calls). For cached requests: sub-millisecond. For requests that go to a provider: the Packer adds <5ms of local processing, and you save latency from sending fewer tokens. Net effect is typically faster, not slower.

### 3. "What happens if ClawPipe's servers go down?"

The Booster, Packer, and Cache stages run entirely in your process — no server dependency. The Router and Gateway stages call LLM providers directly. The only ClawPipe server dependency is for analytics/telemetry and weight syncing, which are non-blocking. If our servers are down, your LLM calls still work — you just lose optimization analytics temporarily.

### 4. "Is my data safe? Do you see my prompts?"

Booster, Packer, and Cache run locally in your process. Your prompts never leave your server for these stages. The Gateway calls providers directly from your server. ClawPipe's servers only receive anonymized telemetry (token counts, latency, cost, cache hit/miss) — never prompt content. We log zero PII.

### 5. "How accurate is the Booster? What if it gives wrong answers?"

Booster only handles deterministic tasks with verifiable answers: arithmetic (2+2=4), date math (days between dates), unit conversions, UUID generation, JSON formatting. It does not attempt fuzzy or subjective tasks. If a prompt doesn't match a deterministic pattern, it passes through to the next stage. False positive rate in our testing: <0.1%.

### 6. "What's the pricing model? Is there vendor lock-in?"

Free tier: 1,000 calls/day, forever. Pro: $49/mo for 100K calls/day. Team: $149/mo for 1M calls/day. Enterprise: custom. There's no vendor lock-in — ClawPipe wraps standard provider APIs. Removing ClawPipe means reverting a single import statement. Your prompts, data, and provider relationships are yours.

### 7. "Does the self-learning router actually work? How?"

The Router tracks three signals per request: cost, latency, and quality (measured via response length consistency and user-provided feedback). It maintains per-task-type weights across providers/models. After ~500 requests, it starts routing simple tasks to cheaper models (e.g., DeepSeek instead of GPT-4) while keeping complex tasks on premium models. Weights are persisted and improve continuously.

### 8. "Can I use this with my existing OpenAI/Anthropic code?"

Yes. ClawPipe provides a drop-in replacement interface. Change your import and constructor — the rest of your code stays identical. We match the OpenAI SDK's request/response shape. Alternatively, use the `pipe.prompt()` interface for ClawPipe-native features like tracing and swarm orchestration.

### 9. "What about streaming? Does caching work with streams?"

Yes. `pipe.stream()` returns an async iterator. Cached responses are replayed as a stream (chunk-by-chunk with realistic timing) so your UI code doesn't need to handle two different response shapes. Boosted responses also stream correctly.

### 10. "Why not just use a cheaper model for everything?"

Because quality matters for some tasks. "Summarize this legal contract" needs GPT-4 or Claude. "What's 15% of $240?" doesn't need any LLM at all. The point isn't to use the cheapest model everywhere — it's to use the right model for each task. ClawPipe's Router learns which tasks need premium models and which don't, so you get the quality you need at the lowest possible cost.

---

## Launch Day Checklist

### Pre-launch (24h before)

- [ ] Verify all live URLs return 200: clawpipe.ai, app, docs, play, calc, api/health
- [ ] Run PushCI full pipeline (install → build → test → lint → smoke)
- [ ] Verify playground demo works (5 free calls/hour, no signup)
- [ ] Verify calculator with $10K spend produces sensible output
- [ ] Verify dashboard signup flow works end-to-end (register → project → API key → first call)
- [ ] Verify legal pages resolve: /about, /privacy, /terms, /security
- [ ] Schedule PH listing for 12:01 AM PT (best launch window)
- [ ] Take 6 screenshots per gallery descriptions above
- [ ] Upload launch.md tagline, short description, and detailed description to PH
- [ ] Draft tweets for launch-day cross-posting (see marketing/social/)

### Launch day (0h)

- [ ] Post the Maker's First Comment immediately after launch goes live
- [ ] Cross-post to HackerNews (see marketing/hackernews/)
- [ ] Cross-post to relevant subreddits (see marketing/reddit/)
- [ ] Cross-post to Dev.to (see marketing/devto/)
- [ ] Monitor PH comments — respond to every comment within 1 hour
- [ ] Monitor api.clawpipe.ai/health and demo endpoint for load spikes
- [ ] Watch daily demo cap (2000/day global) — raise if traffic surges

### Post-launch (24–72h)

- [ ] Respond to all GitHub issues/stars from PH traffic
- [ ] Publish a "Launch Day Learnings" blog post
- [ ] Follow up with anyone who tried the playground/calculator
- [ ] Review analytics for conversion funnel (visit → signup → first call)
- [ ] Collect and publish any user testimonials
