# ClawPipe

[![CI](https://github.com/finsavvyai/clawpipe/actions/workflows/ci.yml/badge.svg)](https://github.com/finsavvyai/clawpipe/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/clawpipe-ai.svg)](https://www.npmjs.com/package/clawpipe-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/clawpipe-ai)](https://bundlephobia.com/package/clawpipe-ai)

**The intelligent AI pipeline. Booster, semantic cache, and self-learning router across 21 providers.**

> Public measured benchmark in progress at [github.com/finsavvyai/clawpipe-booster-benchmark](https://github.com/finsavvyai/clawpipe-booster-benchmark). Methodology v1.0 locked; per-bucket measured numbers pending.

ClawPipe sits between your app and LLM providers. One SDK that combines **246 deterministic Booster rules**, Context Packing, **Sessions**, Semantic Caching, Self-Learning Routing, **Cross-Provider Tool Calling**, Multi-Provider Gateway, Swarm Orchestration, **15-plugin Guard Registry + DLP pack**, Budget Hierarchy, RAG, Voice, Offline Fallback, Pipeline Tracing, and an **M365 intent classifier**.

## Install

```bash
npm install clawpipe-ai
```

## Quick Start

```typescript
import { ClawPipe } from 'clawpipe-ai';

const pipe = new ClawPipe({
  apiKey: 'cp_xxx',
  projectId: 'my-app',
});

const result = await pipe.prompt('Explain this code', {
  system: 'You are a code reviewer',
  maxTokens: 2000,
});

console.log(result.text);
console.log(result.meta);
// { boosted: false, cached: false, contextSavings: '42%',
//   route: 'deepseek', model: 'deepseek-chat', latencyMs: 1200,
//   estimatedCostUsd: 0.003 }
```

## Pipeline Stages

| Stage | What It Does |
|-------|-------------|
| **Booster** | Resolves prompts without AI — math, JSON, dates, conversions, UUIDs |
| **RAG** | Retrieves relevant documents and prepends them as context |
| **Packer** | Compresses context to reduce token count by 20-60% |
| **Semantic Cache** | Hash-based + embedding-based deduplication returns cached results |
| **Router** | Self-learning model selection based on cost, quality, latency |
| **Swarm** | Fan out to N models in parallel with vote/best/first/merge strategies |
| **Gateway** | Multi-provider dispatch — 21 providers: AI21, Anthropic, Azure OpenAI, Bedrock, Cerebras, Cohere, Databricks, DeepSeek, Fireworks, Gemini, Groq, HuggingFace, Mistral, OpenAI, OpenRouter, Perplexity, Replicate, Together, Vertex, Writer, xAI (see gateway/src/providers/) |
| **Learner** | Tracks outcomes and refines routing weights (persisted to D1) |

## New in v3.0

### Swarm Orchestration

```typescript
import { Swarm, Gateway } from 'clawpipe-ai';

const swarm = new Swarm({
  models: [
    { provider: 'openai', model: 'gpt-4o', qualityScore: 0.94 },
    { provider: 'anthropic', model: 'claude-sonnet-4', qualityScore: 0.95 },
    { provider: 'groq', model: 'llama-3.1-70b', qualityScore: 0.80 },
  ],
  strategy: 'vote', // 'first' | 'vote' | 'best' | 'merge'
});

const result = await swarm.run('Is this code safe?', {}, gateway);
// Returns the response most models agree on
```

### Semantic Cache

```typescript
import { SemanticCache } from 'clawpipe-ai';

const cache = new SemanticCache({
  embeddingFn: async (text) => embeddings.create(text),
  similarityThreshold: 0.92,
});

await cache.set('explain recursion', 'Recursion is...');
await cache.get('what is recursion?'); // Cache hit! Same meaning.
```

### RAG Pipeline

```typescript
import { Rag } from 'clawpipe-ai';

const rag = new Rag({
  retrieveFn: async (query, limit) => vectorDb.search(query, limit),
  maxDocuments: 5,
  maxTokens: 4000,
});

const result = await rag.augment('How does auth work?');
// result.augmentedPrompt includes relevant docs as context
```

### Offline Fallback

```typescript
import { LocalProvider } from 'clawpipe-ai';

const local = new LocalProvider();
const models = await local.detect(); // Auto-finds llamafile, Ollama, LM Studio
// [{ provider: 'local-llamafile', model: 'LLaMA_CPP', url: 'http://localhost:8080' }]
```

### Voice Pipeline

```typescript
import { Voice } from 'clawpipe-ai';

const voice = new Voice();
const { text } = await voice.transcribe(audioBuffer);  // STT
const { audio } = await voice.synthesize('Hello!');     // TTS
```

### Pipeline Tracing

```bash
clawpipe prompt "What is 2+2?" --trace
# --- trace:
#   Booster      0.1ms (result=resolved)
#   Total        0.1ms
```

```typescript
const pipe = new ClawPipe({ ...config, enableTrace: true });
const result = await pipe.prompt('Hello');
console.log(result.trace);
// Export as Perfetto JSON: new Tracer(true).toPerfetto()
```

## Full Configuration

```typescript
const pipe = new ClawPipe({
  apiKey: 'cp_xxx',
  projectId: 'my-app',

  // Pipeline stages (all default: true)
  enableBooster: true,
  enablePacker: true,
  enableCache: true,
  cacheTtlMs: 300_000,
  gatewayUrl: 'https://api.clawpipe.ai/v1',

  // Tracing
  enableTrace: false,

  // Offline
  localModelUrl: 'http://localhost:8080',
  enableLocalFallback: false,

  // Budget caps
  budgetCapUsd: 100,
  budgetWarnUsd: 80,

  // Rate limiting
  rateLimitPerDay: 100_000,

  // Model access control
  allowlist: [{ provider: 'openai' }],
  denylist: [{ provider: 'deepseek' }],

  // Audit logging
  enableAudit: true,
  auditTransport: (entry) => sendToSiem(entry),

  // Circuit breaker
  circuitBreakerThreshold: 5,
  circuitBreakerRecoveryMs: 30_000,
});
```

## Observability

```typescript
pipe.stats();        // Telemetry: requests, cost, cache rate, top models
pipe.budgetStatus(); // Budget: spent, cap, remaining, percent used
pipe.rateLimitStatus(); // Rate limits: remaining, reset time
pipe.circuitStatus();   // Provider health: state, failures, availability
pipe.auditLogs();       // Compliance: timestamped action log
```

## Streaming

```typescript
for await (const chunk of pipe.stream('Analyze this', { system: '...' })) {
  process.stdout.write(chunk);
}
```

## CLI

```bash
clawpipe prompt "What is 2+2"                        # Prompt
clawpipe prompt "Explain" --system "..." --trace      # With tracing
clawpipe test                                         # Test pipeline
clawpipe stats                                        # Telemetry
clawpipe export                                       # JSON telemetry
clawpipe config                                       # Configuration
```

## Auth & Dashboard

ClawPipe includes a complete auth system for the gateway:

- Email/password registration and login
- Google OAuth 2.0 and GitHub OAuth social login
- Generic OIDC SSO for enterprise (Okta, Azure AD, Auth0, Keycloak) — see [docs/sso.md](docs/sso.md)
- Project member invitations by email (admin-only)
- JWT sessions with HttpOnly Secure cookies
- Role-based access control (owner/admin/member)
- API key create, rotate, and revoke
- Analytics dashboard at [app.clawpipe.ai](https://app.clawpipe.ai)

## FinOps

Built for finance and ops leaders who need cost control without engineering tickets.
See the dedicated [FinOps landing](https://clawpipe.ai/finops) and [docs/finops.md](docs/finops.md).

- **Monthly budget caps** per project — requests return HTTP 402 when exceeded.
- **Team budget caps** — link projects to teams; enforce aggregate cap across the team.
- **Slack weekly digest** — auto-posted every Monday 09:00 UTC with spend, top models, and wk-over-wk delta.
- **Email weekly digest** — HTML summary to a designated address (via Resend).
- **Threshold alerts** — Slack + email fire automatically at 50 / 80 / 100 % of monthly cap.
- **CSV export** — `GET /v1/projects/:id/export.csv?from=…&to=…` for finance systems.

All configured through the Settings tab at [app.clawpipe.ai](https://app.clawpipe.ai).

## Exports

```typescript
// Core pipeline
import { ClawPipe, Booster, Packer, Cache, Router, Gateway } from 'clawpipe-ai';

// Enterprise features
import { Telemetry, Budget, RateLimiter, CircuitBreaker } from 'clawpipe-ai';
import { Allowlist, AuditLogger } from 'clawpipe-ai';

// New modules
import { Swarm, SemanticCache, Rag, Voice } from 'clawpipe-ai';
import { Tracer, WeightStore, LocalProvider, LocalGateway } from 'clawpipe-ai';
```

## Architecture

```
SDK (npm: clawpipe-ai)     Gateway (Cloudflare Worker)     Dashboard (Cloudflare Pages)
├── Booster                ├── /v1/prompt                   ├── Auth (login/signup/OAuth)
├── Packer                 ├── /v1/stream                   ├── Project picker
├── Cache                  ├── /v1/weights                  └── Analytics charts
├── SemanticCache          ├── /v1/analytics/*
├── Router                 ├── /auth/* (register/login/OAuth)
├── Swarm                  ├── /v1/projects (CRUD)
├── Gateway                └── /v1/projects/:id/keys
├── Rag
├── Voice
├── Tracer
├── LocalProvider
└── WeightStore
```

## Pricing

| Tier | Price | Calls/day |
|------|-------|-----------|
| Free | $0 | 1,000 |
| Dev | $79/mo | 15,000 |
| Growth | $299/mo | 150,000 |
| Scale | $799/mo | 1,500,000 |
| Enterprise | Custom | Unlimited |

Billing is handled by LemonSqueezy (Merchant of Record).

## Links

- Website: [clawpipe.ai](https://clawpipe.ai)
- Dashboard: [app.clawpipe.ai](https://app.clawpipe.ai)
- API Docs: [OpenAPI Spec](gateway/openapi.yaml)

## License

MIT
