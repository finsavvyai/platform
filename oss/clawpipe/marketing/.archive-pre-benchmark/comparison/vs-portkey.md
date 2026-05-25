# ClawPipe vs Portkey

## Overview

**Portkey** is a managed AI gateway that provides routing, caching, observability, and guardrails for LLM applications. It operates as a proxy between your app and LLM providers.

**ClawPipe** is an SDK-local pipeline that runs cost optimization stages (boosting, packing, caching, routing) inside your application process.

Portkey is stronger on enterprise observability and governance. ClawPipe is stronger on cost reduction through local optimization.

## Feature Comparison

| Feature | ClawPipe | Portkey |
|---------|----------|---------|
| **Architecture** | SDK (in-process) | Managed proxy (cloud) |
| **Deterministic Booster** | Yes (resolves 30% of calls at $0) | No |
| **Context Packing** | Yes (20-60% token reduction) | No |
| **Semantic Cache** | Yes (embedding-based) | Yes (semantic caching) |
| **Self-learning Router** | Yes (learns from traffic) | Conditional routing (rule-based) |
| **Provider support** | 6 providers + local | 200+ providers |
| **Guardrails** | Input validation (Zod) | Comprehensive guardrails |
| **Observability** | Built-in telemetry + tracing | Advanced analytics dashboard |
| **A/B testing** | Via Swarm (vote/best strategy) | Native A/B testing |
| **Fallback/retry** | Circuit breaker | Advanced fallback chains |
| **Budget controls** | Per-project caps | Cost tracking |
| **Streaming** | Yes | Yes |
| **Prompt management** | No | Yes (prompt templates/versioning) |
| **Swarm orchestration** | Yes | No |
| **RAG pipeline** | Yes | No |
| **Voice pipeline** | Yes | No |
| **Local model support** | Auto-detects Ollama, llamafile | Limited |
| **Pipeline tracing** | Yes (Perfetto export) | Yes (detailed traces) |
| **Team management** | Dashboard | Advanced team features |
| **Self-hosted option** | N/A (runs in your process) | Enterprise only |
| **Open source** | SDK is MIT | Partially open source |

## Architecture Difference

```
Portkey:
  Your App  -->  Portkey Cloud  -->  LLM Provider
                 (managed proxy)

ClawPipe:
  Your App + ClawPipe SDK  -->  LLM Provider
  (optimization runs locally)
```

**Portkey** is a fully managed cloud proxy. Strong enterprise features (prompt management, guardrails, team analytics) but every request transits Portkey's infrastructure.

**ClawPipe** runs in your process. Booster, Packer, Cache, and Router execute locally. The Gateway calls providers directly from your server.

## Cost Optimization Approach

| Optimization | Portkey | ClawPipe |
|-------------|---------|----------|
| Avoid unnecessary LLM calls | No | Booster resolves 30% at $0 |
| Reduce token count | No | Packer saves 20-60% |
| Cache duplicates | Semantic caching | Semantic caching (local, faster) |
| Smart routing | Rule-based routing | Self-learning routing |
| **Total typical savings** | **10-20%** (caching + routing rules) | **30-50%** (all four stages combined) |

## Latency

| Scenario | Portkey | ClawPipe |
|----------|---------|----------|
| Normal request | +30-100ms (managed proxy) | +0ms |
| Cached request | Fast (cloud cache) | <5ms (local cache) |
| Boosted request | N/A (still calls LLM) | <1ms |

## Security

| Concern | Portkey | ClawPipe |
|---------|---------|----------|
| Prompt transit | All prompts go through Portkey cloud | Local stages: prompts stay in-process |
| Data residency | US/EU options | Your server for local stages |
| SOC 2 | Yes | Prompts don't leave your server |
| Self-hosted | Enterprise tier | N/A (in-process) |

## Pricing

| Tier | Portkey | ClawPipe |
|------|---------|----------|
| Free | Limited requests | 1,000 calls/day |
| Paid | Per-request pricing ($0.0001+) | Pro: $49/mo (100K/day) |
| Enterprise | Custom | Custom |

At 100K calls/day, Portkey's per-request pricing can exceed ClawPipe's flat $49/mo. Additionally, ClawPipe's cost optimization (Booster, Packer, Cache, Router) reduces your LLM provider bill on top of its own pricing.

## When to Use Portkey

- You need **enterprise governance** features: prompt versioning, guardrails, compliance
- You need **200+ provider support** with sophisticated fallback chains
- You want **managed infrastructure** with SOC 2 compliance out of the box
- You need **A/B testing** for prompt and model experiments
- Your team needs **advanced observability** dashboards
- You are comfortable with a **proxy architecture** and the latency tradeoff

## When to Use ClawPipe

- **Cost reduction** is the primary goal (not just observability)
- You want optimization stages that **eliminate calls entirely** (Booster, Cache)
- **Latency** is critical and you can't afford a proxy hop
- **Data security** requires prompts to stay in your process
- You want **self-learning routing** that improves without manual rules
- You need **swarm, RAG, or voice** pipelines
- You prefer **operational simplicity** — npm install, no proxy service

## Can You Use Both?

Yes, but there's limited benefit. If you're using ClawPipe, the local optimization stages handle caching and routing before requests reach any provider. You could route ClawPipe's Gateway output through Portkey for additional observability, but you'd be adding Portkey's latency and cost on top. For most teams, pick one based on whether your priority is cost optimization (ClawPipe) or enterprise governance (Portkey).
