# ClawPipe vs Helicone

## Overview

**Helicone** is an open-source LLM observability platform. It logs, monitors, and analyzes your LLM usage through a proxy or SDK integration. It shows you where money goes but doesn't change how it's spent.

**ClawPipe** is an SDK-local optimization pipeline that actively reduces LLM costs through deterministic boosting, context packing, semantic caching, and self-learning routing.

Helicone is an observability tool. ClawPipe is an optimization tool. They solve different problems and can complement each other.

## Feature Comparison

| Feature | ClawPipe | Helicone |
|---------|----------|---------|
| **Primary function** | Cost optimization | Observability |
| **Architecture** | SDK (in-process) | Proxy or SDK (logging) |
| **Deterministic Booster** | Yes (resolves 30% of calls at $0) | No |
| **Context Packing** | Yes (20-60% token reduction) | No |
| **Semantic Cache** | Yes | Yes (cache proxy) |
| **Self-learning Router** | Yes | No (shows data, doesn't act) |
| **Cost analytics** | Yes | Yes (primary strength) |
| **Request logging** | Anonymized telemetry only | Full request/response logging |
| **User tracking** | Per-project | Per-user, per-session |
| **Custom properties** | Limited | Extensive (tags, metadata) |
| **Prompt templates** | No | Yes (versioning, experiments) |
| **Rate limiting** | Yes | Yes |
| **Alerting** | Budget warnings | Customizable alerts |
| **Dashboard** | Built-in analytics | Advanced analytics dashboard |
| **Playground** | No | Yes (prompt testing) |
| **Provider support** | 6 providers + local | Most major providers |
| **Swarm orchestration** | Yes | No |
| **RAG pipeline** | Yes | No |
| **Open source** | SDK is MIT | MIT |

## The Fundamental Difference

**Helicone tells you where money goes.** It shows: "You spent $4,200 on GPT-4 for customer support last month. 18% of those calls were cache-eligible."

**ClawPipe prevents the spend.** It actively resolves deterministic calls without AI, compresses context, caches duplicates, and routes to cheaper models. The savings happen automatically.

Think of it this way:
- Helicone = fitness tracker (shows your data)
- ClawPipe = personal trainer (changes your behavior)

## Typical Workflow Comparison

### With Helicone

1. Integrate Helicone proxy/SDK
2. Run production traffic for 2-4 weeks
3. Analyze dashboard: find cost hotspots
4. Manually implement optimizations:
   - Write caching logic for duplicate prompts
   - Add conditional routing for simple tasks
   - Optimize prompt templates to reduce tokens
   - Switch models for specific task types
5. Repeat analysis, iterate

**Time to savings:** 2-6 weeks of analysis + engineering effort to implement optimizations.

### With ClawPipe

1. `npm install clawpipe-ai`
2. Change one import statement
3. Savings begin immediately (Booster + Cache are instant)
4. Router improves over ~500 requests
5. Check `pipe.stats()` to see breakdown

**Time to savings:** ~15 minutes to integrate. Booster savings start on the first request. Full pipeline optimization within a week.

## Cost Impact

| | Helicone | ClawPipe |
|---|---------|----------|
| **Direct savings** | 0% (observability only) | 30-50% (active optimization) |
| **Indirect savings** | Yes (insights enable manual optimization) | Yes (plus automatic optimization) |
| **Time to first savings** | Weeks (analysis + implementation) | Minutes (Booster is immediate) |
| **Engineering effort** | High (you implement optimizations) | Low (pipeline optimizes automatically) |

## Observability Comparison

Helicone is significantly stronger on observability:

| Capability | ClawPipe | Helicone |
|-----------|----------|---------|
| Request/response logging | No (privacy: prompts not stored) | Yes (full logging) |
| Per-user analytics | No | Yes |
| Custom tags/metadata | Limited | Extensive |
| Prompt versioning | No | Yes |
| A/B experiments | No | Yes |
| Playground | No | Yes |
| Alerting | Budget alerts only | Customizable |

If you need to inspect individual requests, debug prompt quality, or run experiments, Helicone is the better tool.

## Pricing

| Tier | Helicone | ClawPipe |
|------|----------|----------|
| Free | 100K requests/mo | 1,000 calls/day (~30K/mo) |
| Paid | $20-500/mo (by volume) | $49/mo (100K/day) |
| Enterprise | Custom | Custom |

Note: ClawPipe's cost is offset by LLM savings. If ClawPipe saves you $5,000/mo on LLM bills, the $49/mo subscription is a 100x ROI.

## When to Use Helicone

- Your primary need is **observability and analytics** — understanding LLM usage patterns
- You need **full request/response logging** for debugging and compliance
- You want to run **prompt experiments and A/B tests**
- You prefer to **implement optimizations yourself** based on data insights
- You need **per-user tracking** and custom metadata

## When to Use ClawPipe

- Your primary need is **reducing LLM costs now**, not analyzing them later
- You want **automatic optimization** without manual engineering effort
- You want **deterministic resolution** of simple tasks (Booster)
- You want **self-learning routing** that improves without configuration
- **Latency** and **data privacy** favor an in-process SDK

## Can You Use Both?

Yes, and this is a strong combination. Use ClawPipe for cost optimization (Booster, Packer, Cache, Router) and Helicone for observability (logging, analytics, experiments). Route ClawPipe's Gateway output through Helicone's proxy to get full request logging and analytics on the optimized traffic. This gives you both automatic savings and deep visibility.
