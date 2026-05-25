# ClawPipe vs LiteLLM

## Overview

**LiteLLM** is an open-source proxy server that provides a unified API across 100+ LLM providers. It focuses on provider abstraction, routing, and observability.

**ClawPipe** is an SDK-local pipeline that optimizes LLM calls through deterministic boosting, context packing, semantic caching, and self-learning routing — all running in your application process.

They solve overlapping but different problems. LiteLLM focuses on provider unification. ClawPipe focuses on cost reduction.

## Feature Comparison

| Feature | ClawPipe | LiteLLM |
|---------|----------|---------|
| **Architecture** | SDK (in-process) | Proxy (separate service) |
| **Provider support** | OpenAI, Anthropic, DeepSeek, Groq, Mistral, local | 100+ providers |
| **Deterministic Booster** | Yes (resolves 30% of calls at $0) | No |
| **Context Packing** | Yes (20-60% token reduction) | No |
| **Semantic Cache** | Yes (embedding-based dedup) | Basic caching (exact match) |
| **Self-learning Router** | Yes (learns from traffic) | Static routing rules |
| **Unified API** | Yes | Yes |
| **Streaming** | Yes | Yes |
| **Budget controls** | Yes (per-project caps) | Yes (per-key limits) |
| **Rate limiting** | Yes | Yes |
| **Circuit breaker** | Yes | Yes (failover) |
| **Swarm orchestration** | Yes | No |
| **RAG pipeline** | Yes | No |
| **Voice pipeline** | Yes | No |
| **Local model fallback** | Yes (auto-detects Ollama, llamafile) | Yes (via provider config) |
| **Pipeline tracing** | Yes (Perfetto-compatible) | Yes (logging/callbacks) |
| **Team management** | Dashboard (app.clawpipe.ai) | Admin UI |
| **Language support** | TypeScript, Python | Python (primary), proxy works with any language |
| **Open source** | SDK is MIT | MIT |

## Architecture Difference

```
LiteLLM:
  Your App  -->  LiteLLM Proxy  -->  LLM Provider
                 (+50-200ms)

ClawPipe:
  Your App + ClawPipe SDK  -->  LLM Provider
  (Booster/Packer/Cache run locally, 0ms overhead)
```

**LiteLLM** runs as a separate service. Every request routes through the proxy, adding a network hop. This is the tradeoff for language-agnostic support — any HTTP client can use the proxy.

**ClawPipe** runs inside your application process. The Booster, Packer, Cache, and Router stages execute locally. Only the Gateway stage makes a network call — directly to the LLM provider, same as calling the provider yourself.

## Latency Impact

| Scenario | LiteLLM | ClawPipe |
|----------|---------|----------|
| Normal LLM call | +50-200ms (proxy hop) | +0ms |
| Deterministic task (math, dates) | Still calls LLM (~850ms) | Booster resolves in <1ms |
| Cached request | Proxy lookup + return (~100ms) | Local lookup (<5ms) |
| Context-heavy request | Full tokens sent via proxy | Packer compresses first |

## Security

| Concern | LiteLLM | ClawPipe |
|---------|---------|----------|
| Prompt visibility | All prompts transit proxy | Local stages: prompts stay in-process |
| Data residency | Depends on proxy location | Local stages: your server only |
| API key storage | Proxy stores provider keys | Your app stores provider keys |
| Self-hosted option | Yes | N/A (runs in your process) |

## Pricing

| | LiteLLM | ClawPipe |
|--|---------|----------|
| Self-hosted | Free (OSS) + infra cost (~$50-200/mo) | N/A |
| Managed | Per-token pricing | Free: 1K/day, Pro: $49/mo (100K/day) |

## When to Use LiteLLM

- You need **100+ provider support** (ClawPipe supports 6 providers + local)
- Your services are in **multiple languages** and you want a single API gateway
- You need a **centralized proxy** for organizational control across many teams
- You already have **proxy infrastructure** and want to add LLM routing to it
- You want a **mature, battle-tested** open-source project with a large community

## When to Use ClawPipe

- You want **maximum cost reduction** (Booster + Packer + Cache save before any LLM call)
- **Latency matters** and you can't afford a proxy hop
- **Security** requires prompts to stay in your process for local optimization stages
- You want **self-learning routing** that improves without manual configuration
- You want **operational simplicity** — one npm/pip install, no service to deploy
- You need **swarm orchestration, RAG, or voice** as part of the pipeline

## Can You Use Both?

Yes. You can run ClawPipe's local stages (Booster, Packer, Cache) in your app and point the Gateway stage at a LiteLLM proxy for provider routing. This gives you ClawPipe's cost optimization plus LiteLLM's wide provider support. However, you'd still add the proxy latency for non-boosted/non-cached requests.
