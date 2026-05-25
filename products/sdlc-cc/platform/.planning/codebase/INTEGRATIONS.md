# External Integrations

**Analysis Date:** 2026-04-22

## APIs & External Services

**LLM Providers:**
- OpenAI - generation/embedding provider for RAG, DLP structured extraction, and worker workloads
  - SDK/Client: `openai` (`services/rag/requirements.txt`, `services/embedding/requirements.txt`), `github.com/sashabaranov/go-openai` (`services/llm-gateway/go.mod`)
  - Auth: `OPENAI_API_KEY`
- Anthropic - alternate LLM provider in RAG/DLP and llm-gateway routing
  - SDK/Client: `anthropic` (`services/rag/requirements.txt`, `services/dlp/pyproject.toml`), `github.com/anthropics/anthropic-sdk-go` (`services/llm-gateway/go.mod`)
  - Auth: `ANTHROPIC_API_KEY`
- Cohere - embedding/provider support
  - SDK/Client: `cohere` (`services/embedding/requirements.txt`, `services/rag/requirements.txt`)
  - Auth: `COHERE_API_KEY`
- LiteLLM Proxy - provider aggregation/fallback endpoint
  - SDK/Client: HTTP client in `services/llm-gateway/internal/providers/litellm/client.go`
  - Auth: `LITELLM_MASTER_KEY`

**Cloud Platform:**
- Cloudflare (Workers, Pages, D1, KV, R2, Vectorize, Queues, Durable Objects)
  - SDK/Client: `wrangler`, Workers bindings in `deployments/cloudflare/wrangler.toml`, `infra/cloudflare/workers/package.json`, `services/proxy-worker/wrangler.toml`
  - Auth: Cloudflare account/token and Wrangler secrets (for example `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`)

**Identity and OAuth:**
- Google OAuth and GitHub OAuth for admin/dashboard login
  - SDK/Client: `next-auth` provider configs in `services/admin-ui/src/auth/auth.ts`, custom Hono OAuth flow in `packages/shared-dashboard/src/worker/auth-routes-split/oauth-google.ts`
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- Clerk for landing/auth flows
  - SDK/Client: `@clerk/nextjs` in `landing-page/package.json`
  - Auth: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

**Billing & Payments:**
- LemonSqueezy subscriptions + webhooks
  - SDK/Client: worker billing integrations in `packages/shared-dashboard/src/worker/billing-routes.ts`, `landing-page/pages/api/checkout/webhook.ts`, `packages/shared-config/src/products.ts`
  - Auth: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_SIGNING_SECRET`, `LEMONSQUEEZY_WEBHOOK_SECRET`
- Stripe dependencies exist in shared billing/token config
  - SDK/Client: `stripe` in `packages/shared-billing/package.json`, token config env usage in `services/rag/app/config/token_config.py`
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`

**Authorization Policy Engines:**
- OpenFGA (relationship-based authz)
  - SDK/Client: `openfga-sdk` in `services/rag/requirements.txt`, client in `services/rag/app/authz/openfga_client.py`
  - Auth: `OPENFGA_API_URL`, `OPENFGA_STORE_ID`, `OPENFGA_AUTHORIZATION_MODEL_ID`
- OPA (policy decision engine)
  - SDK/Client: OPA config/client integration in `services/gateway/internal/infrastructure/config/config.go`, `services/gateway/internal/infrastructure/opa/opa_client.go`
  - Auth: policy endpoint + signing configuration (`OPA_URL`/server URL patterns)

## Data Storage

**Databases:**
- PostgreSQL (primary OLTP and service persistence)
  - Connection: `DATABASE_URL` or granular DB envs in `services/rag/app/database/core/connection.py`, `services/gateway/internal/infrastructure/config/config.go`
  - Client: SQLAlchemy/asyncpg (`services/rag/app/database/core/connection.py`), pgx/gorm (`services/gateway/go.mod`), sqlx (`services/vector-core/Cargo.toml`)
- Cloudflare D1 (edge/worker databases)
  - Connection: `D1_DATABASE`, `D1_ACCOUNT_ID`, `D1_API_TOKEN` in `services/rag/app/database/core/connection.py`
  - Client: Wrangler D1 bindings in `deployments/cloudflare/wrangler.toml`, `services/proxy-worker/wrangler.toml`
- Qdrant (read-optimized vector store, tiered with pgvector)
  - Connection: `QDRANT_API_KEY` in `services/rag/app/vector_stores/qdrant_store.py`
  - Client: `qdrant-client` in `services/rag/requirements.txt`
- Supabase (auth/billing data access from shared packages)
  - Connection: Supabase URL/key envs in `packages/shared-auth/src/types.ts`, `packages/shared-billing/package.json`
  - Client: `@supabase/supabase-js`

**File Storage:**
- Cloudflare R2 bucket bindings for documents/temp/backup in `deployments/cloudflare/wrangler.toml`
- S3-compatible object storage support in document processor via `aws-sdk`/`minio` and storage envs in `services/document-processor/package.json`, `services/document-processor/app/core/storage-manager.ts`

**Caching:**
- Redis for queues, rate limiting, sessions, and service caching in `services/realtime/src/config/config.ts`, `services/document-processor/app/core/queue-manager.ts`, `services/rag/app/database/core/connection.py`, `services/gateway/go.mod`
- Cloudflare KV namespaces for edge cache/session/rate-limit layers in `deployments/cloudflare/wrangler.toml`, `services/proxy-worker/wrangler.toml`

## Authentication & Identity

**Auth Provider:**
- Hybrid model: custom JWT + OAuth + provider-specific auth clients
  - Implementation: JWT validation and issuance in gateway/admin/realtime (`services/gateway/internal/infrastructure/config/config.go`, `services/admin-ui/src/auth/auth.ts`, `services/realtime/src/config/config.ts`)
- OAuth providers: Google and GitHub callback/authorization endpoints in `packages/shared-dashboard/src/worker/auth-routes-split/oauth-google.ts`, `services/admin-ui/src/auth/auth.ts`
- SDK auth modes include JWT and OAuth in `packages/sdk-py/sdlc_sdk/auth/oauth.py`, `packages/sdk-ts/src/auth/index.ts`, `packages/sdk-go/pkg/auth/oauth_service_test.go`

## Monitoring & Observability

**Error Tracking:**
- Sentry integration in RAG/worker stack (`services/rag/requirements.txt`, `services/rag/app/config/llm_config.py`, `infra/cloudflare/workers/package.json`)

**Logs:**
- Structured logging with Logrus/Pino/Structlog/Tracing in `services/gateway/go.mod`, `package.json`, `services/rag/requirements.txt`, `services/vector-core/Cargo.toml`
- Metrics/tracing stack:
  - Prometheus in `services/gateway/internal/infrastructure/metrics/prometheus_collector.go`, `services/vector-core/src/monitoring.rs`
  - OpenTelemetry and OTLP exporters in `services/gateway/go.mod`, `services/llm-gateway/internal/observability/otel.go`, `services/rag/app/observability/tracing.py`
  - Langfuse/Traceloop hooks in `services/llm-gateway/internal/observability/langfuse.go`, `services/rag/app/observability/langfuse_client.py`

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers/Pages for edge/web deployments in `.github/workflows/deploy-cloudflare.yml`, `.github/workflows/deploy-landing-page.yml`, `deployments/cloudflare/wrangler.toml`
- Kubernetes + additional infra orchestration for service deployment in `.github/workflows/production-deploy.yml`, `.github/workflows/deploy-gateway.yml`

**CI Pipeline:**
- GitHub Actions is the active CI/CD system in `.github/workflows/*.yml`
- Pipeline includes build, security, infra validation, deployment, post-deploy checks, and rollback paths (`.github/workflows/production-deploy.yml`)

## Environment Configuration

**Required env vars:**
- AI providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`
- Core data/auth: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`/`JWT_SECRET_KEY`
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- Billing/webhooks: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_SIGNING_SECRET`, `LEMONSQUEEZY_WEBHOOK_SECRET`
- Cloudflare/edge: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, D1/R2/Worker secrets via Wrangler secret management
- Optional observability: `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `TRACELOOP_API_KEY`, `SENTRY_DSN`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`
- Optional policy/authz: `OPENFGA_STORE_ID`, `OPENFGA_API_URL`, OPA endpoint vars

**Secrets location:**
- Cloudflare secrets are expected via Wrangler secret store (`wrangler secret put`) per `deployments/cloudflare/wrangler.toml` and `services/proxy-worker/wrangler.toml`
- CI secrets are injected through GitHub Actions `secrets.*` in `.github/workflows/production-deploy.yml`, `.github/workflows/deploy-gateway.yml`
- `.env` files exist in the repository for local environment configuration, but secret values must remain outside committed source

## Webhooks & Callbacks

**Incoming:**
- LemonSqueezy billing webhooks:
  - `POST /api/v1/webhooks/lemonsqueezy` in `packages/shared-dashboard/src/worker/billing-routes.ts`
  - `landing-page` edge webhook handler in `landing-page/pages/api/checkout/webhook.ts`
- Beta feedback webhook endpoint in `services/beta-testing/src/index.ts`
- Internal runner callback endpoint in `services/proxy-worker/src/agent-callback.ts`

**Outgoing:**
- Landing webhook forwards plan events to admin proxy endpoint (`/admin/plans`) in `landing-page/pages/api/checkout/webhook.ts`
- DLP and RAG alerting sends outbound webhook notifications in `services/dlp/app/services/violation_reporter.py`, `services/rag/app/services/alerts/alert_manager.py`
- OAuth callback exchanges against Google endpoints in `packages/shared-dashboard/src/worker/auth-routes-split/oauth-google.ts`

---

*Integration audit: 2026-04-22*
