# ClawPipe vs Calling OpenAI/Anthropic Directly

## Overview

Most teams start by calling OpenAI or Anthropic directly. It's the simplest approach: get an API key, install the SDK, make calls. This comparison examines when direct API calls are sufficient and when ClawPipe's optimization pipeline provides meaningful value.

## Feature Comparison

| Feature | Direct API | ClawPipe |
|---------|-----------|----------|
| **Setup complexity** | Minimal | One additional import |
| **Deterministic resolution** | No (every call hits the API) | Booster resolves 30% at $0 |
| **Context optimization** | Manual prompt engineering | Automatic Packer (20-60% token savings) |
| **Caching** | Build your own or none | Semantic Cache built-in (15-35% hit rate) |
| **Multi-provider** | One provider per SDK | All providers through one interface |
| **Model selection** | Manual, static | Self-learning Router |
| **Provider failover** | Build your own | Circuit breaker built-in |
| **Streaming** | Yes | Yes |
| **Budget controls** | Build your own | Built-in caps and warnings |
| **Rate limiting** | Provider-side only | Client-side + provider-side |
| **Cost tracking** | Build your own | Built-in telemetry |
| **Vendor lock-in** | Locked to one provider | Switch providers without code changes |

## Cost Analysis

### Scenario: SaaS app making 50,000 LLM calls/day

**Direct API (OpenAI GPT-4o):**

| Category | Daily Calls | Avg Cost/Call | Monthly Cost |
|----------|-------------|---------------|-------------|
| All requests | 50,000 | $0.010 | $15,000 |
| **Total** | | | **$15,000/mo** |

**With ClawPipe:**

| Category | Daily Calls | Action | Monthly Cost |
|----------|-------------|--------|-------------|
| Deterministic (30%) | 15,000 | Boosted at $0 | $0 |
| Cached (15%) | 7,500 | Cached at $0 | $0 |
| Packed + routed (55%) | 27,500 | Compressed context, cheaper models | $6,840 |
| ClawPipe Pro subscription | — | — | $49 |
| **Total** | | | **$6,889/mo** |

**Savings: $8,111/mo (54%)**

### Scenario: Side project making 500 LLM calls/day

**Direct API (OpenAI GPT-4o-mini):**

| Category | Daily Calls | Avg Cost/Call | Monthly Cost |
|----------|-------------|---------------|-------------|
| All requests | 500 | $0.002 | $30 |
| **Total** | | | **$30/mo** |

**With ClawPipe (free tier):**

| Category | Daily Calls | Action | Monthly Cost |
|----------|-------------|--------|-------------|
| Deterministic (30%) | 150 | Boosted at $0 | $0 |
| Cached (15%) | 75 | Cached at $0 | $0 |
| Packed + routed (55%) | 275 | Compressed, routed | $12 |
| ClawPipe subscription | — | Free tier (1K/day) | $0 |
| **Total** | | | **$12/mo** |

**Savings: $18/mo (60%)**

Even at low volumes, the Booster and Cache stages provide meaningful savings if your traffic includes deterministic tasks and repeated queries.

## Latency Comparison

| Scenario | Direct API | ClawPipe |
|----------|-----------|----------|
| Normal LLM call | 500-2000ms | 500-2000ms (same — direct provider call) |
| Deterministic task | 500-2000ms | <1ms (Booster) |
| Cached query | 500-2000ms | <5ms (Semantic Cache) |
| Context-heavy request | Proportional to tokens | 20-60% fewer tokens = faster |
| **Weighted p50** | **850ms** | **620ms** |

ClawPipe doesn't add latency to normal LLM calls (it calls providers directly). It reduces latency by eliminating unnecessary calls and reducing token count.

## Multi-Provider Benefits

Direct API locks you to one provider's SDK. Switching from OpenAI to Anthropic means:
- Changing SDK imports
- Adapting to different request/response formats
- Updating model names
- Modifying streaming code
- Rewriting error handling

With ClawPipe, switching providers is a configuration change:

```typescript
// Use OpenAI
const pipe = new ClawPipe({
  allowlist: [{ provider: 'openai' }],
});

// Switch to Anthropic — no code changes
const pipe = new ClawPipe({
  allowlist: [{ provider: 'anthropic' }],
});

// Use all providers — Router picks the best
const pipe = new ClawPipe({
  // No allowlist = all providers available
});
```

## What You'd Need to Build Yourself

To match ClawPipe's optimization with direct API calls, you'd need to build:

1. **Deterministic resolver** — Pattern matching for math, dates, conversions. ~1-2 weeks of engineering.
2. **Context compressor** — Token-level redundancy detection. ~1-2 weeks.
3. **Semantic cache** — Embedding storage, similarity search, TTL management. ~2-3 weeks.
4. **Multi-provider gateway** — Unified interface across OpenAI/Anthropic/etc. ~2-3 weeks.
5. **Self-learning router** — Task classification, weight tracking, model scoring. ~3-4 weeks.
6. **Circuit breaker** — Provider health monitoring, automatic failover. ~1 week.
7. **Budget controls** — Per-project spend tracking and caps. ~1 week.
8. **Telemetry** — Request logging, cost tracking, analytics. ~1-2 weeks.

Total: **12-18 weeks of engineering** to build what ClawPipe provides with `npm install`.

## When to Use Direct API

- Your LLM usage is **very low volume** (<100 calls/day) and cost doesn't matter
- You use **one provider only** and have no plans to change
- You have **no deterministic tasks** in your traffic (all open-ended generation)
- Your prompts are **already optimized** (minimal redundancy, right-sized context)
- You have **no repeated queries** (every call is unique)
- You want **zero dependencies** beyond the provider SDK

## When to Use ClawPipe

- You're making **500+ LLM calls/day** and cost matters
- Your traffic includes **any deterministic tasks** (math, dates, formatting)
- Your prompts have **redundant context** (system prompts, RAG results, history)
- You get **repeated or similar queries** from users
- You want **multi-provider support** without managing multiple SDKs
- You want **automatic optimization** that improves over time
- You want **provider failover** without building circuit breaker logic

## Migration Path

Adding ClawPipe to an existing direct-API setup:

```typescript
// Step 1: Install
// npm install clawpipe-ai

// Step 2: Change import
import { ClawPipe } from 'clawpipe-ai';

// Step 3: Replace client
const client = new ClawPipe({
  apiKey: 'cp_xxx',           // Free at clawpipe.ai
  projectId: 'my-app',
  enableTrace: true,           // See what each stage does
});

// Step 4: Your existing calls work unchanged
const result = await client.prompt('Summarize this document', {
  system: 'You are a document analyst',
  maxTokens: 1000,
});
```

Reverting: change the import back. No other code changes needed.
