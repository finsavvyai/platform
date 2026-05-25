# LunaOS Engine

**The core API powering LunaOS** — AI agent management, RAG, authentication, and billing.

Built on **Hono** + **Cloudflare Workers** for edge-first performance.

## Architecture

```
packages/
├── api/          # Hono API worker — routes, middleware, endpoints
├── agents/       # Agent lifecycle, health monitoring, resource management
├── rag/          # RAG engine — document processing, vector search, embeddings
├── database/     # Prisma schema, migrations, seed data
├── gateway/      # API gateway, circuit breaker, rate limiting
├── cache/        # Cache layer (Cloudflare KV)
├── messaging/    # Message queue (Cloudflare Queues)
├── monitoring/   # Health checks, metrics
├── shared/       # Shared utilities
├── types/        # TypeScript type definitions
├── testing/      # Test utilities
└── users/        # User management
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy
```

**Domain**: `api.lunaos.ai`

## License

Proprietary — LunaOS AI
