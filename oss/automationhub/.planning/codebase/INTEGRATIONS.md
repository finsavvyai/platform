# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**AI/LLM Providers:**
- OpenAI - chat completion and streaming generation used by `backend/app/services/llm_service.py`.
  - SDK/Client: `openai` (`backend/requirements.txt`)
  - Auth: `OPENAI_API_KEY` (`backend/app/core/config.py`)
- Anthropic - configured as supported provider in settings/dependencies (active code path is primarily OpenAI in `backend/app/services/llm_service.py`).
  - SDK/Client: `anthropic` (`backend/requirements.txt`)
  - Auth: `ANTHROPIC_API_KEY` (`backend/app/core/config.py`)

**Cloud/Edge Platform:**
- Cloudflare API - zone/DNS/workers/R2/tunnel operations in `backend/app/services/cloudflare_service.py`.
  - SDK/Client: `httpx` (direct REST) and `cloudflare` package in `mcp-servers/requirements.txt`
  - Auth: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` (`backend/app/core/config.py`)
- Cloudflare Workers runtime - edge API/proxy/analytics queue handlers in `cloudflare-workers/src/index.ts`.
  - SDK/Client: `hono`, Cloudflare bindings from `cloudflare-workers/package.json`
  - Auth: platform bindings and environment vars in `cloudflare-workers/wrangler.toml` and `wrangler.toml`

**Payments/Billing:**
- Stripe - subscription lifecycle, invoices, and webhook signature verification in `backend/app/services/billing_service.py` and `backend/app/api/v1/endpoints/billing.py`.
  - SDK/Client: `stripe` (imported in service and endpoint code)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (read via `backend/app/core/config.py` usage)

**Identity/Social Login:**
- Google OAuth2/OIDC - provider config in `backend/app/services/oauth_service.py`.
  - SDK/Client: `httpx`, `jwt` in OAuth flow
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`backend/app/core/config.py`)
- Microsoft OAuth2/OIDC - provider config in `backend/app/services/oauth_service.py`.
  - SDK/Client: `httpx`, `jwt`
  - Auth: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (`backend/app/core/config.py`)
- GitHub OAuth - provider config in `backend/app/services/oauth_service.py`.
  - SDK/Client: `httpx`
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (`backend/app/core/config.py`)

**Security/Comms Providers:**
- Twilio - SMS MFA delivery in `backend/app/services/mfa_service.py`.
  - SDK/Client: `twilio` (`backend/requirements.txt`)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (`backend/app/core/config.py`)
- HashiCorp Vault - secret backend abstraction in `backend/app/services/vault_service.py`.
  - SDK/Client: `hvac` (`backend/requirements.txt`)
  - Auth: `VAULT_URL`, `VAULT_TOKEN`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID`, `VAULT_NAMESPACE` (`backend/app/core/config.py`)

**Agent/Automation Integrations:**
- OpenClaw (incoming/outgoing integration channel) in `backend/app/api/v1/endpoints/integrations.py` and `backend/app/integrations/openclaw_webhook.py`.
  - SDK/Client: internal webhook handler + Redis idempotency
  - Auth: `OPENCLAW_WEBHOOK_SECRET`, `OPENCLAW_API_KEY`, `OPENCLAW_API_URL` via `backend/app/core/integrations_config.py`
- OpenHands (SDK/cloud mode settings) in `backend/app/core/integrations_config.py`.
  - SDK/Client: optional OpenHands dependencies in `backend/requirements-optional.txt`
  - Auth: `OPENHANDS_API_KEY`, optional `OPENHANDS_API_URL`
- MCP Servers - managed via `backend/app/services/mcp_integration.py` (AutoBoot endpoint + GitHub MCP server metadata).
  - SDK/Client: `mcp`, `websockets`, `httpx` (`backend/requirements.txt`)
  - Auth: server-specific `auth_config` per MCP server

## Data Storage

**Databases:**
- Primary ORM database via SQLAlchemy async engine in `backend/app/core/database.py`.
  - Connection: `DATABASE_URL` (`backend/app/core/config.py`)
  - Client: SQLAlchemy ORM (`backend/requirements.txt`)
- Cloudflare D1 optional database layer in `backend/app/core/cloudflare_d1.py`.
  - Connection: `CLOUDFLARE_D1_DATABASE_URL` or account/database IDs (`backend/app/core/config.py`)
  - Client: `httpx` D1 API + SQLAlchemy fallback engine
- Worker-side D1 bindings for edge data operations in `cloudflare-workers/src/routes/api.ts`.

**File Storage:**
- Local filesystem upload directory configured by `UPLOAD_DIR` in `backend/app/core/config.py`.
- Cloudflare R2 object storage operations supported in `backend/app/services/cloudflare_service.py` and worker binding usage in `cloudflare-workers/src/index.ts` (`UPM_FILES`).

**Caching:**
- Redis for backend cache, idempotency, queues, and service state (`backend/app/core/redis.py`, `backend/app/integrations/openclaw_webhook.py`).
- Cloudflare KV for edge cache/config in `wrangler.toml`, `cloudflare-workers/src/routes/api.ts`, and `cloudflare-workers/src/routes/proxy.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom JWT auth plus optional OAuth providers.
  - Implementation: backend JWT and auth middleware (`backend/app/core/auth.py`, `backend/app/middleware/auth_middleware.py`) with OAuth federation in `backend/app/services/oauth_service.py`.
- Frontend sends bearer tokens and refresh flow via `frontend/src/services/api.ts`.

## Monitoring & Observability

**Error Tracking:**
- Sentry integration is configured in dependencies and settings (`backend/requirements.txt`, `backend/app/core/config.py`), but active initialization path is not centrally visible in the sampled files.

**Logs:**
- Python logging across backend services (`backend/app/main.py`).
- Worker request/event logs and analytics datapoints in `cloudflare-workers/src/index.ts`.
- Optional Prometheus client dependency is present (`backend/requirements.txt`) with port setting `PROMETHEUS_PORT` (`backend/app/core/config.py`).

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers for edge gateway/API proxy and scheduled/queue workloads (`cloudflare-workers/wrangler.toml`, `wrangler.toml`).
- Backend designed as FastAPI/ASGI service (`backend/app/main.py`) with environment-configured dependencies.

**CI Pipeline:**
- Root-level `.github/workflows` pipeline files are not detected in this repository path.
- Deployment automation is script-driven through npm/Wrangler and app scripts (`cloudflare-workers/package.json`, `frontend/package.json`, `desktop-app/package.json`).

## Environment Configuration

**Required env vars:**
- Core app/runtime: `ENVIRONMENT`, `DEBUG`, `API_V1_STR`, `ALLOWED_ORIGINS`, `ALLOWED_HOSTS` (`backend/app/core/config.py`).
- Data layer: `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CHROMA_HOST`, `CHROMA_PORT`.
- AI providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
- Identity/security: `SECRET_KEY`, OAuth client IDs/secrets, MFA/Twilio settings, Vault settings.
- Cloudflare: D1/account/token vars and worker vars/bindings in `wrangler.toml` and `cloudflare-workers/wrangler.toml`.
- Frontend runtime endpoints: `REACT_APP_API_URL`, `REACT_APP_WS_URL` (`frontend/src/services/api.ts`, `frontend/src/services/websocket.ts`).

**Secrets location:**
- Backend and integration secrets are expected through environment variables and `.env` loading in `backend/app/core/config.py`.
- `.env` files are present at `backend/.env`, `mcp-servers/.env`, and `build/extension/.env` (treat as secret-bearing, do not commit values).

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook endpoint: `POST /billing/webhooks/stripe` in `backend/app/api/v1/endpoints/billing.py`.
- OpenClaw incoming webhook endpoint: `POST /integrations/openclaw/incoming` in `backend/app/api/v1/endpoints/integrations.py`.
- OAuth callback handling endpoint path: `POST /oauth/callback` in `backend/app/api/v1/endpoints/auth_enhanced.py` (delegates to `backend/app/services/oauth_service.py`).

**Outgoing:**
- Generic webhook dispatch plus Slack/Discord/Teams channels in `backend/app/services/notification_service.py`.
- Workflow executor webhook node (user-configured URL calls) in `backend/app/services/workflow_executor.py`.
- Vector store completion webhook notifications in `backend/app/services/vector_store.py`.
- Cloudflare API callbacks are outbound REST calls from `backend/app/services/cloudflare_service.py`.

---

*Integration audit: 2026-04-21*
# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**AI/LLM Providers:**
- OpenAI - chat completion and streaming generation used by `backend/app/services/llm_service.py`.
  - SDK/Client: `openai` (`backend/requirements.txt`)
  - Auth: `OPENAI_API_KEY` (`backend/app/core/config.py`)
- Anthropic - configured as supported provider in settings/dependencies (active code path is primarily OpenAI in `backend/app/services/llm_service.py`).
  - SDK/Client: `anthropic` (`backend/requirements.txt`)
  - Auth: `ANTHROPIC_API_KEY` (`backend/app/core/config.py`)

**Cloud/Edge Platform:**
- Cloudflare API - zone/DNS/workers/R2/tunnel operations in `backend/app/services/cloudflare_service.py`.
  - SDK/Client: `httpx` (direct REST) and `cloudflare` package in `mcp-servers/requirements.txt`
  - Auth: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` (`backend/app/core/config.py`)
- Cloudflare Workers runtime - edge API/proxy/analytics queue handlers in `cloudflare-workers/src/index.ts`.
  - SDK/Client: `hono`, Cloudflare bindings from `cloudflare-workers/package.json`
  - Auth: platform bindings and environment vars in `cloudflare-workers/wrangler.toml` and `wrangler.toml`

**Payments/Billing:**
- Stripe - subscription lifecycle, invoices, and webhook signature verification in `backend/app/services/billing_service.py` and `backend/app/api/v1/endpoints/billing.py`.
  - SDK/Client: `stripe` (imported in service and endpoint code)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (read via `backend/app/core/config.py` usage)

**Identity/Social Login:**
- Google OAuth2/OIDC - provider config in `backend/app/services/oauth_service.py`.
  - SDK/Client: `httpx`, `jwt` in OAuth flow
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`backend/app/core/config.py`)
- Microsoft OAuth2/OIDC - provider config in `backend/app/services/oauth_service.py`.
  - SDK/Client: `httpx`, `jwt`
  - Auth: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (`backend/app/core/config.py`)
- GitHub OAuth - provider config in `backend/app/services/oauth_service.py`.
  - SDK/Client: `httpx`
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (`backend/app/core/config.py`)

**Security/Comms Providers:**
- Twilio - SMS MFA delivery in `backend/app/services/mfa_service.py`.
  - SDK/Client: `twilio` (`backend/requirements.txt`)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (`backend/app/core/config.py`)
- HashiCorp Vault - secret backend abstraction in `backend/app/services/vault_service.py`.
  - SDK/Client: `hvac` (`backend/requirements.txt`)
  - Auth: `VAULT_URL`, `VAULT_TOKEN`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID`, `VAULT_NAMESPACE` (`backend/app/core/config.py`)

**Agent/Automation Integrations:**
- OpenClaw (incoming/outgoing integration channel) in `backend/app/api/v1/endpoints/integrations.py` and `backend/app/integrations/openclaw_webhook.py`.
  - SDK/Client: internal webhook handler + Redis idempotency
  - Auth: `OPENCLAW_WEBHOOK_SECRET`, `OPENCLAW_API_KEY`, `OPENCLAW_API_URL` via `backend/app/core/integrations_config.py`
- OpenHands (SDK/cloud mode settings) in `backend/app/core/integrations_config.py`.
  - SDK/Client: optional OpenHands dependencies in `backend/requirements-optional.txt`
  - Auth: `OPENHANDS_API_KEY`, optional `OPENHANDS_API_URL`
- MCP Servers - managed via `backend/app/services/mcp_integration.py` (AutoBoot endpoint + GitHub MCP server metadata).
  - SDK/Client: `mcp`, `websockets`, `httpx` (`backend/requirements.txt`)
  - Auth: server-specific `auth_config` per MCP server

## Data Storage

**Databases:**
- Primary ORM database via SQLAlchemy async engine in `backend/app/core/database.py`.
  - Connection: `DATABASE_URL` (`backend/app/core/config.py`)
  - Client: SQLAlchemy ORM (`backend/requirements.txt`)
- Cloudflare D1 optional database layer in `backend/app/core/cloudflare_d1.py`.
  - Connection: `CLOUDFLARE_D1_DATABASE_URL` or account/database IDs (`backend/app/core/config.py`)
  - Client: `httpx` D1 API + SQLAlchemy fallback engine
- Worker-side D1 bindings for edge data operations in `cloudflare-workers/src/routes/api.ts`.

**File Storage:**
- Local filesystem upload directory configured by `UPLOAD_DIR` in `backend/app/core/config.py`.
- Cloudflare R2 object storage operations supported in `backend/app/services/cloudflare_service.py` and worker binding usage in `cloudflare-workers/src/index.ts` (`UPM_FILES`).

**Caching:**
- Redis for backend cache, idempotency, queues, and service state (`backend/app/core/redis.py`, `backend/app/integrations/openclaw_webhook.py`).
- Cloudflare KV for edge cache/config in `wrangler.toml`, `cloudflare-workers/src/routes/api.ts`, and `cloudflare-workers/src/routes/proxy.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom JWT auth plus optional OAuth providers.
  - Implementation: backend JWT and auth middleware (`backend/app/core/auth.py`, `backend/app/middleware/auth_middleware.py`) with OAuth federation in `backend/app/services/oauth_service.py`.
- Frontend sends bearer tokens and refresh flow via `frontend/src/services/api.ts`.

## Monitoring & Observability

**Error Tracking:**
- Sentry integration is configured in dependencies and settings (`backend/requirements.txt`, `backend/app/core/config.py`), but active initialization path is not centrally visible in the sampled files.

**Logs:**
- Python logging across backend services (`backend/app/main.py`).
- Worker request/event logs and analytics datapoints in `cloudflare-workers/src/index.ts`.
- Optional Prometheus client dependency is present (`backend/requirements.txt`) with port setting `PROMETHEUS_PORT` (`backend/app/core/config.py`).

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers for edge gateway/API proxy and scheduled/queue workloads (`cloudflare-workers/wrangler.toml`, `wrangler.toml`).
- Backend designed as FastAPI/ASGI service (`backend/app/main.py`) with environment-configured dependencies.

**CI Pipeline:**
- Root-level `.github/workflows` pipeline files are not detected in this repository path.
- Deployment automation is script-driven through npm/Wrangler and app scripts (`cloudflare-workers/package.json`, `frontend/package.json`, `desktop-app/package.json`).

## Environment Configuration

**Required env vars:**
- Core app/runtime: `ENVIRONMENT`, `DEBUG`, `API_V1_STR`, `ALLOWED_ORIGINS`, `ALLOWED_HOSTS` (`backend/app/core/config.py`).
- Data layer: `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CHROMA_HOST`, `CHROMA_PORT`.
- AI providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
- Identity/security: `SECRET_KEY`, OAuth client IDs/secrets, MFA/Twilio settings, Vault settings.
- Cloudflare: D1/account/token vars and worker vars/bindings in `wrangler.toml` and `cloudflare-workers/wrangler.toml`.
- Frontend runtime endpoints: `REACT_APP_API_URL`, `REACT_APP_WS_URL` (`frontend/src/services/api.ts`, `frontend/src/services/websocket.ts`).

**Secrets location:**
- Backend and integration secrets are expected through environment variables and `.env` loading in `backend/app/core/config.py`.
- `.env` files are present at `backend/.env`, `mcp-servers/.env`, and `build/extension/.env` (treat as secret-bearing, do not commit values).

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook endpoint: `POST /billing/webhooks/stripe` in `backend/app/api/v1/endpoints/billing.py`.
- OpenClaw incoming webhook endpoint: `POST /integrations/openclaw/incoming` in `backend/app/api/v1/endpoints/integrations.py`.
- OAuth callback handling endpoint path: `POST /oauth/callback` in `backend/app/api/v1/endpoints/auth_enhanced.py` (delegates to `backend/app/services/oauth_service.py`).

**Outgoing:**
- Generic webhook dispatch plus Slack/Discord/Teams channels in `backend/app/services/notification_service.py`.
- Workflow executor webhook node (user-configured URL calls) in `backend/app/services/workflow_executor.py`.
- Vector store completion webhook notifications in `backend/app/services/vector_store.py`.
- Cloudflare API callbacks are outbound REST calls from `backend/app/services/cloudflare_service.py`.

---

*Integration audit: 2026-04-21*
# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**LLM / AI Providers:**
- OpenAI (GPT-4, embeddings) - Conversational AI, code generation, RAG
  - SDK/Client: `openai==1.52.0`
  - Auth: `OPENAI_API_KEY`
  - Used in: `backend/app/services/conversational_ai.py`, `backend/app/services/code_generation.py`, `backend/app/services/ai_selector.py`
- Anthropic (Claude) - Alternative LLM provider
  - SDK/Client: `anthropic==0.7.7`
  - Auth: `ANTHROPIC_API_KEY`
  - Used in: `backend/app/services/ai_selector.py`
- IBM Quantum Network - Quantum circuit execution (optional)
  - SDK/Client: `qiskit==0.45.0`, `qiskit-aer==0.13.0`
  - Auth: `IBM_QUANTUM_TOKEN`
  - Used in: `backend/app/services/quantum.py`

**Communication & Notifications:**
- Twilio - SMS-based MFA and notifications
  - SDK/Client: `twilio==8.10.0`
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - Feature flag: `SMS_ENABLED`
  - Used in: `backend/app/services/auth_service.py`

**Cloudflare Platform:**
- Cloudflare Workers - Edge compute gateway layer
  - Deployment: `wrangler.toml` (root), `cloudflare-workers/wrangler.toml`
  - Auth: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
  - Workers: `upm-plus-gateway` (root worker), `upm-plus-automationhub` (automationhub worker)
- Cloudflare D1 - SQLite-compatible edge database
  - Binding: `UPM_PLUS_DB` (id: `01c45f4f-ba3a-4302-8c13-a48942601f51`)
  - Config DB binding: `UPM_CONFIG_DB`
  - Backend env var: `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_DATABASE_URL`
  - Used in: `backend/app/core/cloudflare_d1.py`, `backend/app/core/d1_migrations.py`
- Cloudflare KV - Global cache / config store
  - Bindings: `UPM_PLUS_CACHE`, `UPM_CONFIG`
- Cloudflare Workers AI - AI inference at edge
  - Binding: `AI` (configured in `wrangler.toml`)
- Cloudflare MCP Server - Custom MCP server for Cloudflare tooling
  - Location: `mcp-servers/cloudflare-mcp-server/`
  - Auth: Cloudflare API token

**OpenHands Development Agent:**
- Mode: Embedded SDK (default) or Cloud API (`OPENHANDS_MODE=sdk|cloud`)
  - SDK: `openhands-sdk ≥1.11.0` from `backend/requirements-optional.txt`
  - Cloud API: `OPENHANDS_API_URL`, `OPENHANDS_API_KEY`
  - Adapter: `backend/app/integrations/openhands_adapter.py`
  - Circuit breaker: 5-failure threshold, 60s cooldown
  - Rate limit: 30 tasks/tenant/hour

**OpenClaw Channel Gateway:**
- Embedded webhook gateway (internal Docker network only)
  - Adapter: `backend/app/integrations/openclaw_webhook.py`
  - Config: `backend/app/core/integrations_config.py` (`OpenClawSettings`)
  - Auth: `OPENCLAW_WEBHOOK_SECRET`
  - Outbound: `OPENCLAW_API_URL`, `OPENCLAW_API_KEY`
  - Rate limit: 60 requests/tenant/minute

## Data Storage

**Databases:**
- PostgreSQL 15 (primary relational database)
  - Connection env var: `DATABASE_URL` (async: `postgresql+asyncpg://...`)
  - Client: SQLAlchemy 2.0 async ORM + asyncpg driver
  - Migrations: Alembic (`backend/alembic/`, `backend/alembic.ini`)
  - Dev connection string: `postgresql+asyncpg://upmplus:upmplus_dev_password@localhost:5433/upmplus`
  - Docker: `postgres:15-alpine` (port 5433 on host → 5432 in container)

- SQLite (fallback / dev / testing)
  - Driver: `aiosqlite` (fallback when `DATABASE_URL` not set)
  - Dev default: `sqlite+aiosqlite:///./test.db`

- Cloudflare D1 (SQLite-compatible edge database)
  - Used via Cloudflare REST API from backend (`backend/app/core/cloudflare_d1.py`)
  - Workers use native D1 binding (`UPM_PLUS_DB`, `UPM_CONFIG_DB`)

**Vector Database:**
- ChromaDB 0.4.18 (vector store for RAG / knowledge management)
  - Dev: In-memory / local DuckDB+Parquet persistence (`./chroma_db`)
  - Production: HTTP client connecting to `CHROMA_HOST:CHROMA_PORT`
  - Docker: `chromadb/chroma:latest` (port 8000)
  - Used in: `backend/app/core/vector_db.py`, `backend/app/services/vector_store.py`

- Pinecone (optional managed vector DB)
  - Auth: `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`
  - Used in: `backend/app/services/vector_store.py` (conditional)

**Caching / Message Broker:**
- Redis 7 - Cache + Celery broker + result backend
  - Connection env var: `REDIS_URL` (cache), `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
  - Client: `redis==5.0.1` + `hiredis==2.2.3`
  - Docker: `redis:7-alpine` (port 6379, 512MB max, LRU eviction, AOF persistence)
  - Used in: `backend/app/core/redis.py`, `backend/app/services/cache_service.py`

**File Storage:**
- Local filesystem uploads directory (`UPLOAD_DIR`, default `uploads/`)
  - Max file size: 100MB (`MAX_FILE_SIZE`)
  - Docker volume: `backend_uploads`
  - No S3/R2 integration detected in requirements (future addition)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based auth (primary)
  - Implementation: `backend/app/core/auth.py`
  - Library: `python-jose[cryptography]` for JWT, `passlib[bcrypt]` + `bcrypt` for password hashing
  - Token: HS256-signed JWT, 30-minute access token, 30-day refresh token
  - Endpoint: `POST /api/v1/auth/login`

- fastapi-users 12.1.2 (extended user management)
  - Features: Registration, password reset, email verification
  - Backend: SQLAlchemy (`fastapi-users-db-sqlalchemy==6.0.1`)

- Multi-Factor Authentication (MFA)
  - TOTP via `pyotp` (QR code via `qrcode[pil]`)
  - SMS via Twilio (when `SMS_ENABLED=true`)
  - Backup codes support (10 codes per user)
  - Implementation: `backend/app/api/v1/endpoints/auth_enhanced.py`

**OAuth Providers (configured, not externally verified):**
- Google OAuth - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Microsoft OAuth - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- GitHub OAuth - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

**Secrets Management:**
- HashiCorp Vault (production secrets)
  - Client: `hvac==2.1.0`
  - Auth: `VAULT_URL`, `VAULT_TOKEN` or AppRole (`VAULT_ROLE_ID`, `VAULT_SECRET_ID`)
  - Namespace: `VAULT_NAMESPACE`
  - Implementation: `backend/app/services/vault_service.py`

## Monitoring & Observability

**Error Tracking:**
- Sentry (FastAPI integration)
  - SDK: `sentry-sdk[fastapi]==1.38.0`
  - Config: `SENTRY_DSN`

**Metrics:**
- Prometheus - Metrics collection and exposition
  - Client: `prometheus-client==0.19.0`
  - Port: `PROMETHEUS_PORT` (default 8002)
  - Docker: `prom/prometheus:latest` (port 9090)
  - Config: `monitoring/prometheus.yml`

- Grafana - Dashboards
  - Docker: `grafana/grafana:latest` (port 3001)
  - Config: `monitoring/grafana/provisioning/`

- Flower - Celery task monitoring
  - Port: 5555 (Docker service `upm-plus-flower`)

**Logging:**
- `structlog==23.2.0` - Structured JSON logging
- Setup: `backend/app/core/logging.py`
- Per-request logging middleware in `backend/app/main.py`

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers (edge layer) - `wrangler deploy`
- fly.io (OpenClaw gateway) - `openclaw/fly.toml`
- Docker Compose (self-hosted backend) - `docker-compose.yml` (dev), `docker-compose.prod.yml` (production)

**Deployment Scripts:**
- `deploy.sh`, `deploy_and_test.sh` - Shell deployment scripts at root

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or similar config found)

## WebSockets & Real-time

**WebSocket Server:**
- FastAPI native WebSocket support (`backend/app/core/websocket.py`)
- Socket.io-client 4.7.4 on frontend - real-time workflow updates
- Collaboration endpoints: `backend/app/api/v1/endpoints/websocket_collaboration.py`, `workflow_websockets.py`

**MCP Protocol (Model Context Protocol):**
- Server: `mcp==1.14.1` + `websockets==12.0`
- Custom MCP server: `mcp-servers/cloudflare-mcp-server/`
- Endpoint management: `backend/app/api/v1/endpoints/mcp.py`
- MCP server config: `mcp-servers/claude-desktop-config.json`

## Webhooks & Callbacks

**Incoming:**
- OpenClaw webhook receiver (internal Docker network): `backend/app/integrations/openclaw_webhook.py`
- Workflow trigger webhooks: `backend/app/api/v1/endpoints/workflows.py`

**Outgoing:**
- HTTP action type in automation engine (`src/automationhub/actions.py` → `HTTPAction`)
- Webhook action type for workflow steps

## Browser Automation

**Playwright:**
- `playwright==1.40.0` - Primary headless browser
- Config: `BROWSER_HEADLESS` (default `true`), `BROWSER_TIMEOUT` (default 30s)
- Services: `backend/app/services/browser_automation.py`, `backend/app/services/advanced_browser_automation.py`

**Selenium:**
- `selenium==4.15.2` - Alternative driver (fallback)
- Service: `backend/app/services/browser_manager.py`

**Browser Use:**
- `browser-use==0.1.0` - AI-native browser control
- Service: `backend/app/services/browser_use_integration.py`

## Infrastructure Management

**Ansible:**
- `ansible==8.7.0` + `ansible-runner==2.3.4` - Playbook-based infra automation
- `paramiko==3.3.1` - SSH for remote execution
- Auth: `ANSIBLE_VAULT_PASSWORD`
- Service: `backend/app/services/ansible_service.py`
- Endpoint: `backend/app/api/v1/endpoints/ansible.py`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SECRET_KEY` - JWT signing secret
- `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` - Celery configuration
- `OPENAI_API_KEY` - For AI features
- `ANTHROPIC_API_KEY` - For Claude AI features

**Optional env vars:**
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID` - D1 integration
- `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT` - Managed vector DB
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `SMS_ENABLED` - SMS/MFA
- `VAULT_URL`, `VAULT_TOKEN`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID` - HashiCorp Vault
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` - Microsoft OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `SENTRY_DSN` - Error tracking
- `IBM_QUANTUM_TOKEN` - Quantum computing
- `OPENHANDS_API_KEY`, `OPENHANDS_API_URL` - OpenHands cloud mode
- `OPENCLAW_API_KEY`, `OPENCLAW_WEBHOOK_SECRET` - OpenClaw gateway

**Secrets location:**
- Development: `backend/.env` file
- Production: HashiCorp Vault (via `vault_service.py`) + Cloudflare Workers secrets

---

*Integration audit: 2026-04-21*
