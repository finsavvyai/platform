# Technology Stack

**Analysis Date:** 2026-04-22

## Languages

**Primary:**
- TypeScript/JavaScript (Node 18+) - Monorepo orchestration, Cloudflare Workers, web frontends, and service code in `package.json`, `services/admin-ui/package.json`, `services/realtime/package.json`, `services/document-processor/package.json`, `infra/cloudflare/workers/package.json`
- Go (1.24-1.25) - API gateway, LLM gateway, and SDK components in `services/gateway/go.mod`, `services/llm-gateway/go.mod`, `packages/sdk-go/go.mod`
- Python (3.11+ for services, 3.9+ for SDK) - RAG, embedding, DLP services and Python SDK in `services/rag/requirements.txt`, `services/dlp/pyproject.toml`, `services/embedding/requirements.txt`, `packages/sdk-py/pyproject.toml`
- Rust (edition 2021) - Vector service in `services/vector-core/Cargo.toml`

**Secondary:**
- SQL (PostgreSQL, SQLite/D1) - persistence and vector workloads in `services/gateway/internal/infrastructure/config/config.go`, `services/rag/app/database/core/connection.py`, `deployments/cloudflare/wrangler.toml`
- YAML/TOML/JSON - runtime, deployment, and CI config in `.github/workflows/*.yml`, `services/proxy-worker/wrangler.toml`, `deployments/cloudflare/wrangler.toml`, `services/gateway/internal/infrastructure/config/config.go`

## Runtime

**Environment:**
- Node.js `>=18.0.0` baseline in `package.json`, `services/admin-ui/package.json`, `services/gateway-worker/package.json`, `infra/cloudflare/workers/package.json`
- Go modules with `go 1.24/1.25` in `services/llm-gateway/go.mod`, `services/gateway/go.mod`, `packages/sdk-go/go.mod`
- Python `>=3.11` service baseline in `services/dlp/pyproject.toml` and py311 targeting in `services/rag/pyproject.toml`
- Rust toolchain `>=1.75.0` from root engines in `package.json`

**Package Manager:**
- JavaScript package manager: npm workspaces in `package.json`
- Lockfile: present (`package-lock.json` + nested lockfiles such as `services/package-lock.json`, `landing-page/package-lock.json`)
- Go dependency locking: present via `go.sum` (`services/gateway/go.sum`, `services/llm-gateway/go.sum`)
- Python dependency management: mixed `requirements.txt` and `pyproject.toml` (`services/rag/requirements.txt`, `services/dlp/pyproject.toml`)
- Rust dependency locking: Cargo manifests present (`services/vector-core/Cargo.toml`)

## Frameworks

**Core:**
- FastAPI - Python API services in `services/rag/requirements.txt`, `services/dlp/pyproject.toml`, `services/embedding/requirements.txt`
- Go HTTP frameworks (Chi + Gin) - gateway and llm-gateway in `services/gateway/go.mod`, `services/llm-gateway/go.mod`
- Next.js - admin and landing apps in `services/admin-ui/package.json`, `landing-page/package.json`
- Hono + Cloudflare Workers runtime - edge services in `services/gateway-worker/package.json`, `packages/shared-billing/package.json`, `services/proxy-worker/wrangler.toml`
- Fastify/WebSocket stack - realtime service in `services/realtime/package.json`
- Axum/Tokio - Rust vector service in `services/vector-core/Cargo.toml`

**Testing:**
- Vitest/Jest for TS/JS in `package.json`, `services/gateway-worker/package.json`, `landing-page/package.json`, `services/admin-ui/package.json`
- Pytest for Python services in `services/rag/requirements.txt`, `services/dlp/pyproject.toml`, `services/embedding/requirements.txt`
- Go `testing` + `testify` in `services/gateway/go.mod`, `services/llm-gateway/go.mod`, `packages/sdk-go/go.mod`

**Build/Dev:**
- TypeScript compiler and bundling in `tsconfig.json`, `services/admin-ui/package.json`, `packages/sdk-ts/package.json`
- Wrangler for Cloudflare deploy/dev in `services/package.json`, `services/gateway-worker/package.json`, `infra/cloudflare/workers/package.json`
- Docker-based local/prod orchestration via scripts in `package.json`
- Multi-runtime local orchestration scripts in `package.json`

## Key Dependencies

**Critical:**
- `openai`, `anthropic`, `cohere` - LLM provider connectivity in `services/rag/requirements.txt`, `services/embedding/requirements.txt`, `services/llm-gateway/go.mod`
- `pgvector` / `pgvector-go` - vector search on PostgreSQL in `services/rag/requirements.txt`, `services/gateway/go.mod`, `services/vector-core/Cargo.toml`
- `redis` ecosystem (`redis`, `ioredis`, `go-redis`) - cache, sessions, queues, and rate limits in `services/realtime/package.json`, `services/document-processor/package.json`, `services/gateway/go.mod`
- `openfga-sdk` - relationship-based authz in `services/rag/requirements.txt`, `services/rag/app/authz/openfga_client.py`
- `temporalio` - durable workflows for ingestion pipeline in `services/rag/requirements.txt`

**Infrastructure:**
- Cloudflare stack (`wrangler`, Workers bindings, D1/KV/R2/Vectorize/Queues/DO) in `deployments/cloudflare/wrangler.toml`, `infra/cloudflare/workers/package.json`, `services/proxy-worker/wrangler.toml`
- Observability stack (Prometheus + OpenTelemetry + Langfuse/Traceloop + Sentry) in `services/gateway/go.mod`, `services/rag/requirements.txt`, `services/rag/app/observability/tracing.py`, `services/llm-gateway/internal/observability/otel.go`
- Identity/billing integrations (`next-auth`, `@clerk/nextjs`, `@supabase/supabase-js`, `stripe`, LemonSqueezy env contract) in `services/admin-ui/package.json`, `landing-page/package.json`, `packages/shared-auth/package.json`, `packages/shared-billing/package.json`, `packages/shared-dashboard/src/worker/billing-routes.ts`

## Configuration

**Environment:**
- Use environment-variable-driven config as the primary pattern:
  - Go via Viper + env overrides in `services/gateway/internal/infrastructure/config/config.go`
  - Python via `pydantic-settings` and `os.getenv` in `services/dlp/pyproject.toml`, `services/rag/app/database/core/connection.py`, `services/rag/app/config/llm_config.py`
  - Node/Next via `process.env` in `services/admin-ui/src/auth/auth.ts`, `landing-page/pages/api/checkout/webhook.ts`, `services/realtime/src/config/config.ts`
- Cloudflare runtime config uses `wrangler.toml` `[vars]` + `wrangler secret put` pattern in `deployments/cloudflare/wrangler.toml`, `services/proxy-worker/wrangler.toml`
- Do not rely on hardcoded credentials; keep secrets in runtime secret stores and CI secret contexts (`.env` files exist but are not source-of-truth for committed config)

**Build:**
- TypeScript root and package-level configs in `tsconfig.json`, `packages/shared-dashboard/tsconfig.json`, `services/gateway-worker/tsconfig.json`
- Worker deployment config in `deployments/cloudflare/wrangler.toml`, `services/wrangler.toml`, `services/proxy-worker/wrangler.toml`
- Container build artifacts in `services/gateway/Dockerfile`, `services/llm-gateway/Dockerfile`, `services/realtime/Dockerfile`
- CI/CD pipeline config in `.github/workflows/production-deploy.yml`, `.github/workflows/deploy-cloudflare.yml`, `.github/workflows/deploy-landing-page.yml`

## Platform Requirements

**Development:**
- Install Node 18+, npm 9+, Go 1.24+, Python 3.11+, Rust/Cargo (per `package.json` engines + language manifests)
- For local parity, use Docker where service scripts expect infra dependencies (`package.json` docker scripts)
- For Cloudflare flows, require Wrangler and authenticated Cloudflare account (`services/package.json`, `infra/cloudflare/workers/package.json`)

**Production:**
- Multi-target deployment: Cloudflare Workers/Pages + Kubernetes/infra workflows in `.github/workflows/production-deploy.yml`, `.github/workflows/deploy-landing-page.yml`, `.github/workflows/deploy-gateway.yml`
- Core services require PostgreSQL, Redis, and observability endpoints configured before rollout (`services/gateway/internal/infrastructure/config/config.go`, `services/rag/app/database/core/connection.py`, `services/llm-gateway/README.md`)

---

*Stack analysis: 2026-04-22*
