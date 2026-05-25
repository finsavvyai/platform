# Architecture

**Analysis Date:** 2026-04-22

## Pattern Overview

**Overall:** Polyglot monorepo with service-oriented architecture and mixed runtime boundaries (Go, Python, TypeScript/Node, Cloudflare Workers), plus layered internal architecture in core services.

**Key Characteristics:**
- API-first service boundaries with multiple entry points in `services/*`, `src/*`, and worker runtimes.
- Layered organization inside the Go gateway: domain (`internal/domain`), infrastructure (`internal/infrastructure`), and HTTP interface (`internal/interfaces/http`).
- Cross-cutting edge + backend routing model: Cloudflare Workers in `services/proxy-worker` and `services/gateway-worker` front API paths, while backend services handle deep domain behavior.

## Layers

**Edge/API Entry Layer:**
- Purpose: Receive client traffic, enforce perimeter checks, and route/proxy to downstream systems.
- Location: `services/proxy-worker/src/index.ts`, `services/gateway-worker/src/index.ts`, `packages/shared-dashboard/src/worker/*`.
- Contains: API key validation, per-minute and monthly quota checks, CORS/security headers, lightweight request shaping, and backend proxy calls.
- Depends on: KV/R2/D1 bindings (Workers), helper modules like `services/proxy-worker/src/proxy-backend.ts`, `services/proxy-worker/src/rate-limiter.ts`.
- Used by: Browser clients, SDK clients, and callback/tool runner flows.

**Application Interface Layer (HTTP Routers/Handlers):**
- Purpose: Define route groups, middleware composition, and HTTP contracts per service.
- Location: `services/gateway/cmd/server/router.go`, `services/gateway/internal/interfaces/http/handlers/*.go`, `services/rag/app/api/router.py`, `services/document-processor/app/index.ts`, `src/api/*.ts`.
- Contains: Router composition, endpoint registration, request validation, transport-level response mapping.
- Depends on: Domain services and infrastructure components.
- Used by: Service entry points (`main.go`, `main.py`, `index.ts`, `src/server.ts`).

**Domain Layer:**
- Purpose: Business logic and core domain types.
- Location: `services/gateway/internal/domain/models/*.go`, `services/gateway/internal/domain/services/*.go`, `src/services/*.ts`.
- Contains: Tenant/user/policy/document models, auth/policy/audit services, pipeline/release logic in root TypeScript API.
- Depends on: Domain interfaces and selected infrastructure adapters.
- Used by: Interface handlers and orchestration code.

**Infrastructure Layer:**
- Purpose: External system integration and technical capabilities.
- Location: `services/gateway/internal/infrastructure/*`, `services/rag/app/database/*`, `services/proxy-worker/src/*.ts` helper modules.
- Contains: DB connections, repositories, redis/rate limiting, policy engines, observability, storage providers, event publishing.
- Depends on: External stores/services (Postgres, Redis, KV/R2/D1, telemetry backends).
- Used by: Domain services and service initialization flows.

**Frontend/Admin Layer:**
- Purpose: Admin and product-facing UI with API consumption.
- Location: `services/admin-ui/src/*`, `packages/shared-dashboard/src/*`, `landing-page/*`.
- Contains: App router pages, React state management, UI components, worker-backed API surfaces.
- Depends on: Shared packages (`packages/shared-auth`, `packages/shared-billing`, `packages/shared-analytics`, `packages/shared-config`).
- Used by: Admin operators and product users.

## Data Flow

**Gateway Request Flow (Go service):**

1. Process startup wires dependencies in `services/gateway/cmd/server/main.go` (`config`, DB, policy engine, redis, discovery, health, circuit breakers).
2. Router assembly in `services/gateway/cmd/server/router.go` applies proxy middleware first, then middleware chain, then route groups.
3. Route handlers in `services/gateway/internal/interfaces/http/handlers/*.go` convert HTTP requests into domain/service calls.
4. Infrastructure packages in `services/gateway/internal/infrastructure/*` execute data access, policy checks, event emission, and observability updates.
5. Response serialization returns JSON payloads to clients.

**Edge Proxy + PII Flow (Cloudflare Worker):**

1. Entry at `services/proxy-worker/src/index.ts` assigns request ID and handles preflight/admin/health/callback fast paths.
2. API key extraction and validation execute before protected path routing.
3. Rate and quota checks run via KV-backed modules (`rate-limiter.ts`, `monthly-quota.ts`, `tenant-plan.ts`).
4. Request/response PII detection/redaction is applied around backend proxy calls (`proxyWithPII` in `index.ts`).
5. Usage logging is deferred via `ctx.waitUntil(...)`.

**RAG API Flow (Python FastAPI):**

1. Service boots in `services/rag/app/main.py` and initializes tracing, lifecycle manager, health monitor, and database.
2. API surface is mounted via `services/rag/app/api/router.py` under versioned endpoint groups (`/rag`, `/search`, `/vector-search`, `/context`, `/documents`, `/embeddings`, `/monitoring`).
3. Endpoint handlers process requests and use database/model modules under `services/rag/app/database`.
4. Prometheus metrics and health endpoints are exposed from the same app process.

**State Management:**
- In-process state for request lifecycle and service components (Go/Python/Node services).
- Externalized state in PostgreSQL/pgvector-style models (`services/gateway/internal/infrastructure/database/models/models.go`, `services/rag/app/database/models/base.py`), Redis, and Cloudflare KV/D1/R2 bindings.
- Frontend state split between local UI stores and remote API-backed data (`services/admin-ui/src/store/*`, `packages/shared-dashboard/src/hooks/*`).

## Key Abstractions

**Application Composition Root:**
- Purpose: Central dependency wiring and runtime lifecycle.
- Examples: `services/gateway/cmd/server/main.go`, `services/llm-gateway/cmd/server/main.go`, `services/rag/app/main.py`, `src/server.ts`.
- Pattern: Bootstrapping + dependency injection + graceful shutdown orchestration.

**HTTP Dependency Bundle:**
- Purpose: Transport layer receives a typed bundle of dependencies.
- Examples: `services/gateway/internal/interfaces/http/handlers/handlers.go` (`Dependencies` struct), `services/gateway/internal/interfaces/http/routes/stubs.go`.
- Pattern: Constructor-style dependency passing into handlers/routes.

**Domain Model Sets:**
- Purpose: Shared entity shape for tenant-aware operations.
- Examples: `services/gateway/internal/domain/models/tenant.go`, `services/gateway/internal/infrastructure/database/models/models.go`, `services/rag/app/database/models/base.py`.
- Pattern: Rich model structs/classes with tenant-scoped relationships and helper methods.

**Worker Orchestration Modules:**
- Purpose: Keep edge entrypoint thin by splitting capability modules.
- Examples: `services/proxy-worker/src/index.ts`, `services/proxy-worker/src/agent-routes.ts`, `services/proxy-worker/src/proxy-backend.ts`, `services/proxy-worker/src/pii-handling.ts`.
- Pattern: Route orchestrator + specialized module per concern.

## Entry Points

**Root TypeScript API Service:**
- Location: `src/server.ts`
- Triggers: `npm run dev:root`, `npm run start`.
- Responsibilities: Express app startup, signal handling, process-level error handling, and graceful stop.

**Go Gateway Service:**
- Location: `services/gateway/cmd/server/main.go`
- Triggers: `npm run dev:gateway`, direct `go run ./cmd/server`.
- Responsibilities: Compose infra dependencies, build middleware chain/router, run HTTP server, monitor health/discovery loops.

**RAG Service:**
- Location: `services/rag/app/main.py`
- Triggers: `npm run dev:rag`, `uvicorn app.main:app`.
- Responsibilities: FastAPI lifecycle, middleware stack, API router mounting, metrics/health endpoints.

**LLM Gateway Service:**
- Location: `services/llm-gateway/cmd/server/main.go`
- Triggers: Go server execution.
- Responsibilities: Provider gateway creation, validator/cost tracker setup, HTTP routing, monitoring server startup.

**Document Processor Service:**
- Location: `services/document-processor/app/index.ts`
- Triggers: Node runtime for document processor service.
- Responsibilities: Initialize queue/storage/metrics services, apply middleware, expose `/api/v1` processing endpoints.

**Cloudflare Worker Gateways:**
- Location: `services/proxy-worker/src/index.ts`, `services/gateway-worker/src/index.ts`
- Triggers: `wrangler dev`/`wrangler deploy` scripts in corresponding `package.json`.
- Responsibilities: Edge auth/rate policy, proxy behavior, D1/R2/KV integration, worker API routing.

## Error Handling

**Strategy:** Service-local centralized handlers with transport-safe responses and structured logging.

**Patterns:**
- Go: explicit error returns and graceful shutdown branches in `services/gateway/cmd/server/main.go`.
- Python: startup/shutdown try/finally lifecycle and FastAPI exception handling in `services/rag/app/main.py`.
- Node/TS: middleware-level fallback handlers and status-mapped API responses in `src/app.ts` and `services/document-processor/app/index.ts`.
- Worker: top-level try/catch around request orchestration with normalized error response generation in `services/proxy-worker/src/index.ts`.

## Cross-Cutting Concerns

**Logging:** Structured request/service logging in `src/app.ts`, `services/gateway/internal/infrastructure/observability/*`, `services/rag/app/main.py`, and worker console/error helpers.

**Validation:** Request shape checks in route handlers (`src/api/*.ts`, gateway handler layer) plus schema/model constraints in database model modules (`services/gateway/internal/infrastructure/database/models/models.go`, `services/rag/app/database/models/base.py`).

**Authentication:** JWT/API key flows across gateway and worker boundaries (`services/gateway/cmd/server/router.go`, `services/gateway-worker/src/index.ts`, `services/proxy-worker/src/index.ts`) with plan/quota enforcement at edge in proxy worker modules.

---

*Architecture analysis: 2026-04-22*
