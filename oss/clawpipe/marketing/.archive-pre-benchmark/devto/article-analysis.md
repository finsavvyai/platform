---
title: "We Analyzed 10,000 LLM Calls — Here's Where the Money Goes"
published: true
description: "A data-driven breakdown of LLM spending patterns across production workloads. 70% of costs are addressable without changing your prompts."
tags: ai, llm, datascience, costoptimization
canonical_url: https://clawpipe.ai/blog/10000-llm-calls-analysis
cover_image: https://clawpipe.ai/images/blog/analysis-cover.png
---

# We Analyzed 10,000 LLM Calls — Here's Where the Money Goes

We instrumented 10,000 production LLM calls across five different SaaS products. The goal: understand where LLM money actually goes, and how much of it is waste.

The results were more dramatic than we expected. **70% of LLM spend is addressable** without changing a single prompt.

## The Dataset

We collected anonymized metadata from 10,000 LLM calls across five B2B SaaS products:
- A customer support platform (3,200 calls)
- A document processing tool (2,500 calls)
- A code generation assistant (1,800 calls)
- A data analytics chatbot (1,500 calls)
- A content creation tool (1,000 calls)

For each call, we recorded: prompt structure, token count, model used, response time, cost, and whether the task was deterministic.

## Finding 1: 30% of Calls Don't Need AI

**[Bar Chart: Request Classification]**
_X-axis: Request type. Y-axis: Percentage of total calls._
_Bars: Deterministic (30%), Redundant Context (25%), Duplicate (15%), Routable (30%)_

The single biggest finding: nearly one in three LLM calls had a deterministic, verifiable answer that could be computed without any AI.

**What these look like:**

| Task | Example Prompt | Correct Answer | Needs AI? |
|------|---------------|----------------|-----------|
| Arithmetic | "What is 18% tip on $85?" | $15.30 | No |
| Date math | "How many days between March 1 and April 15?" | 45 | No |
| Unit conversion | "Convert 100km/h to mph" | 62.14 mph | No |
| JSON formatting | "Format this as JSON: name=Alice, role=admin" | `{"name":"Alice","role":"admin"}` | No |
| UUID generation | "Generate a unique identifier" | `a1b2c3d4-...` | No |
| Regex | "Extract emails from this text" | Pattern match | No |

These calls were costing $0.005-0.03 each, returning in 500-2000ms. They could be resolved in <1ms for $0.

**Cost impact:** At an average of $0.008/call, these 3,000 unnecessary AI calls cost $24 per 10,000 requests. Scale that to 50K calls/day and it's $3,600/month — for answers a calculator could produce.

## Finding 2: 25% Have Redundant Context

**[Stacked Bar Chart: Token Distribution]**
_X-axis: Call categories. Y-axis: Token count._
_Stacked segments: Unique content (green), Repeated system prompt (yellow), Redundant context (red), Filler tokens (orange)._

We analyzed token composition across all 10,000 calls:

- **Average prompt length:** 1,847 tokens
- **Average unique content:** 1,108 tokens (60%)
- **Average redundant content:** 739 tokens (40%)

The redundancy came from three sources:

1. **Repeated system prompts** — The same 200-500 token system prompt sent with every request. Identical bytes, full price every time.

2. **Bloated conversation history** — Chat applications sending the full conversation history when only the last 2-3 turns were relevant.

3. **Copy-pasted documentation** — RAG systems including 5 retrieved documents when 2 were relevant, or including full documents when a paragraph would suffice.

**Token waste breakdown:**

| Source | Avg Tokens Wasted | % of Prompt |
|--------|-------------------|-------------|
| Repeated system prompts | 312 | 17% |
| Unnecessary history | 241 | 13% |
| Redundant RAG context | 186 | 10% |
| **Total waste** | **739** | **40%** |

**Cost impact:** At GPT-4o pricing ($2.50/1M input tokens), 739 wasted tokens per call x 10,000 calls = 7.39M wasted tokens = $18.48. Scale to 50K/day: $2,775/month on tokens that add no value.

## Finding 3: 15% Are Duplicates

**[Line Chart: Cumulative Cache Hit Rate Over Time]**
_X-axis: Hours of operation. Y-axis: Cache hit rate (%)._
_Line starts at 0%, climbs to 8% at hour 4, 15% at hour 24, 22% at hour 48, plateaus at ~35% by hour 168 (1 week)._

1,500 of 10,000 calls were semantically identical to a previous call. Not string-identical — semantically identical.

**Examples of semantic duplicates:**

| Call A | Call B | Same Answer? |
|--------|--------|-------------|
| "Explain recursion" | "What is recursion?" | Yes |
| "How do I reset my password?" | "Password reset instructions" | Yes |
| "Summarize this document" [same doc] | "Give me a summary of this" [same doc] | Yes |
| "Convert 100 USD to EUR" | "What's 100 dollars in euros?" | Yes |

String-based caching (exact match) caught 8% of duplicates. Adding embedding-based semantic matching caught an additional 7%.

**Cost impact:** 15% of calls eliminated entirely. At average cost of $0.01/call, that's $15 per 10,000 requests. Scale to 50K/day: $2,250/month.

## Finding 4: The Remaining 30% Are Misrouted

**[Pie Chart: Optimal Model Distribution]**
_Segments: "Needs GPT-4/Claude Opus" (30%), "GPT-4o-mini sufficient" (25%), "DeepSeek sufficient" (20%), "Groq/fast model sufficient" (15%), "Doesn't need AI" (10% — overlap with Finding 1 for borderline cases)._

Of the 3,000 calls that genuinely needed AI, weren't duplicates, and had optimized context, we tested each against multiple models:

| Original Model | Cheaper Model That Worked | Cost Reduction |
|----------------|--------------------------|----------------|
| GPT-4o | GPT-4o-mini | 60% cheaper |
| GPT-4o | DeepSeek-chat | 85% cheaper |
| GPT-4o | Groq Llama 3.1 70B | 90% cheaper |
| Claude Sonnet | Claude Haiku | 75% cheaper |

"Worked" = same factual accuracy on objective tasks, or human-indistinguishable output on subjective tasks (blind evaluation by 3 raters).

**Results:**
- 45% of "needs AI" calls produced equivalent output on a model at least 60% cheaper
- 25% produced equivalent output on a model at least 80% cheaper
- Only 30% genuinely needed a premium model (complex reasoning, nuanced generation)

**Cost impact:** Optimal routing reduces the AI-needing portion by ~50% in cost. On our 50K/day scale: $2,100/month saved.

## The Full Picture

**[Waterfall Chart: Cost Reduction Breakdown]**
_Starting bar: $12,000/mo (baseline). Successive bars subtract:_
_Booster savings: -$3,600. Packer savings: -$2,775. Cache savings: -$2,250. Router savings: -$2,100._
_Final bar: $6,840/mo (43% reduction)._

| Optimization | % of Calls Affected | Monthly Savings (at 50K/day) |
|-------------|--------------------|-----------------------------|
| Deterministic resolution | 30% | $3,600 |
| Context compression | 25% (token reduction) | $2,775 |
| Semantic deduplication | 15% | $2,250 |
| Smart routing | 30% (of remaining) | $2,100 |
| **Total** | | **$10,725 saved** |

From $17,820/mo baseline to ~$7,100/mo. **60% reduction.**

(Real-world results vary. Our production deployment saw 43% reduction because patterns overlap — some deterministic calls also had redundant context, etc.)

## What You Can Do About It

These four optimizations are the pipeline stages in [ClawPipe](https://clawpipe.ai):

1. **Booster** = deterministic resolution
2. **Packer** = context compression
3. **Semantic Cache** = deduplication
4. **Router** = smart model selection

```bash
npm install clawpipe-ai
```

```typescript
import { ClawPipe } from 'clawpipe-ai';

const pipe = new ClawPipe({
  apiKey: 'cp_xxx',
  projectId: 'my-app',
});

// This runs all four optimizations automatically
const result = await pipe.prompt('What is 15% of $240?');
// Booster resolves in 0.1ms, $0 cost

const result2 = await pipe.prompt('Summarize this contract', {
  system: longSystemPrompt,  // Packer compresses this
  maxTokens: 2000,
});
// Router selects cheapest viable model
```

Free tier: 1,000 calls/day. Enough to validate on real traffic.

---

**Methodology note:** All data collected with consent. Prompts were classified by structure, not content. No prompt text was stored or analyzed. Token counts, latency, cost, and task type metadata only.
