# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Modular layered architecture across three runtimes (backend API, frontend SPA, edge worker), plus a standalone Python domain package.

**Key Characteristics:**
- API-first orchestration in `backend/app/main.py` with a broad endpoint surface in `backend/app/api/v1/endpoints/`.
- Service-oriented domain logic in `backend/app/services/`, with API handlers delegating work instead of embedding business rules.
- Infrastructure and cross-cutting concerns extracted into `backend/app/core/`, `backend/app/middleware/`, and `backend/app/gateway/`.
- Independent lightweight automation domain package in `src/automationhub/` for in-memory workflow, trigger, action, and schedule orchestration.

## Layers

**Frontend Application Layer:**
- Purpose: Browser UI for dashboards, workflow operations, and auth flows.
- Location: `frontend/src/`.
- Contains: bootstrap (`frontend/src/index.tsx`), provider/router shell (`frontend/src/App.tsx`), feature pages (`frontend/src/pages/`), UI modules (`frontend/src/components/`), API clients (`frontend/src/services/`), state slices (`frontend/src/store/slices/`).
- Depends on: backend REST API (`/api/v1`), WebSocket endpoints, Redux Toolkit, React Query.
- Used by: end users and operators.

**Edge Routing Layer:**
- Purpose: Request proxying, edge routing, analytics fanout, and collaboration Durable Object support.
- Location: `cloudflare-workers/src/`.
- Contains: worker entry (`cloudflare-workers/src/index.ts`), route handlers (`cloudflare-workers/src/routes/*.ts`), durable object (`cloudflare-workers/src/durable-objects/collaboration.ts`).
- Depends on: Cloudflare runtime and backend HTTP endpoints.
- Used by: browser and external HTTP traffic before backend.

**Backend Entry/API Layer:**
- Purpose: Application startup, middleware stack, router registration, health and root endpoints.
- Location: `backend/app/main.py`, `backend/app/api/v1/api.py`, `backend/app/api/v1/endpoints/*.py`.
- Contains: FastAPI lifespan initialization, route mounting, endpoint contracts, auth dependency injection.
- Depends on: services, schemas, gateway, middleware, core infrastructure.
- Used by: frontend clients, edge workers, and direct API consumers.

**Gateway and Middleware Layer:**
- Purpose: cross-cutting policies (auth, rate limiting, transforms, analytics, tenant/security controls).
- Location: `backend/app/gateway/*.py` and `backend/app/middleware/*.py`.
- Contains: gateway runtime (`backend/app/gateway/core.py`), middleware pipeline (`backend/app/gateway/middleware.py`), auth/rate-limiting/tenant/rbac middleware modules.
- Depends on: `backend/app/core/config.py`, persistence/cache infrastructure.
- Used by: every backend request path.

**Service Layer:**
- Purpose: domain workflows, task execution, integrations, and feature orchestration.
- Location: `backend/app/services/*.py`.
- Contains: workflow execution services (`backend/app/services/workflow_engine.py`, `backend/app/services/workflow_executor.py`), agent orchestration (`backend/app/services/task_executor.py`), integration services (cloudflare, rag, llm, browser, etc.).
- Depends on: model/core layers and external systems.
- Used by: API endpoint modules and agent implementations.

**Domain Model and Schema Layer:**
- Purpose: persistence models and I/O contracts.
- Location: `backend/app/models/*.py`, `backend/app/schemas/*.py`.
- Contains: SQLAlchemy entities (`backend/app/models/workflow.py`, `backend/app/models/task.py`, `backend/app/models/agent.py`), Pydantic request/response schemas (`backend/app/schemas/workflow.py`, `backend/app/schemas/auth.py`).
- Depends on: `backend/app/core/database.py`, Pydantic, SQLAlchemy.
- Used by: services and API handlers.

**Standalone Automation Domain Package:**
- Purpose: pure-Python automation primitives for local/embedded use outside FastAPI runtime.
- Location: `src/automationhub/`.
- Contains: workflow state machine (`src/automationhub/workflows.py`), trigger factory/registry (`src/automationhub/triggers.py`), schedule manager (`src/automationhub/scheduler.py`), action executor (`src/automationhub/actions.py`), facade API (`src/automationhub/api.py`).
- Depends on: Python standard library only.
- Used by: unit tests in `tests/` and package consumers.

## Data Flow

**Web Request Flow (UI to backend):**
1. UI starts at `frontend/src/index.tsx` and routes in `frontend/src/App.tsx`.
2. Request is issued through frontend service modules in `frontend/src/services/`.
3. Optional edge hop through `cloudflare-workers/src/index.ts` route handlers.
4. FastAPI receives request in `backend/app/main.py` and dispatches through `backend/app/gateway/middleware.py` and `backend/app/middleware/*.py`.
5. Router in `backend/app/api/v1/api.py` delegates to endpoint module in `backend/app/api/v1/endpoints/*.py`.
6. Endpoint calls service logic in `backend/app/services/*.py`.
7. Service reads/writes models in `backend/app/models/*.py` via core database/caches in `backend/app/core/`.
8. Response returns to API layer, then frontend service client and UI state.

**Agent/Task Execution Flow:**
1. API request hits agent/task endpoints in `backend/app/api/v1/endpoints/agents.py` or `backend/app/api/v1/endpoints/task_queue.py`.
2. `backend/app/services/task_executor.py` orchestrates task execution and agent dispatch.
3. Agent registry and agent implementations under `backend/app/agents/` select capability-specific executors.
4. Task and execution state persists through models in `backend/app/models/task.py` and `backend/app/models/workflow.py`.

**Standalone Package Flow:**
1. Consumer calls `AutomationAPI` in `src/automationhub/api.py`.
2. API composes `WorkflowEngine`, `ActionExecutor`, and `TriggerManager`.
3. Workflow execution runs through in-memory step iteration in `src/automationhub/workflows.py`.
4. Execution metadata is stored in in-memory history collections.

**State Management:**
- Persistent state: backend SQLAlchemy models in `backend/app/models/*.py`.
- Runtime/distributed state: Redis/vector services initialized from `backend/app/main.py` via `backend/app/core/`.
- Client state: Redux slices in `frontend/src/store/slices/*.ts` plus React Query cache in `frontend/src/App.tsx`.
- In-memory package state: dictionaries/lists in `src/automationhub/*.py`.

## Key Abstractions

**AutomationAPI Facade:**
- Purpose: single entry for workflow, action, and trigger operations.
- Examples: `src/automationhub/api.py`.
- Pattern: Facade over three registries/executors.

**Workflow Engine Pair:**
- Purpose: define workflow lifecycle and workflow registries.
- Examples: `src/automationhub/workflows.py`, `backend/app/services/workflow_engine.py`, `backend/app/models/workflow.py`.
- Pattern: state-machine semantics (`draft/active/paused/...`) with service orchestration.

**Gateway Middleware Pipeline:**
- Purpose: enforce request-level policies consistently.
- Examples: `backend/app/gateway/middleware.py`, `backend/app/middleware/rate_limiting.py`, `backend/app/middleware/auth_middleware.py`.
- Pattern: middleware chain / policy pipeline.

**Task Executor + Agent Registry:**
- Purpose: assign work to specialized agents and track execution.
- Examples: `backend/app/services/task_executor.py`, `backend/app/agents/registry.py`, `backend/app/agents/*.py`.
- Pattern: registry + strategy-style dispatch.

## Entry Points

**Backend API Runtime:**
- Location: `backend/app/main.py`.
- Triggers: `uvicorn app.main:app`, container runtime.
- Responsibilities: initialize infrastructure, attach middleware, include `api_router`, expose health/root endpoints.

**API Route Registry:**
- Location: `backend/app/api/v1/api.py`.
- Triggers: imported by backend startup.
- Responsibilities: compose endpoint modules and URL prefixes.

**Frontend Runtime:**
- Location: `frontend/src/index.tsx`.
- Triggers: browser bundle load.
- Responsibilities: render React root and initialize app shell in `frontend/src/App.tsx`.

**Cloudflare Worker Runtime:**
- Location: `cloudflare-workers/src/index.ts`.
- Triggers: Cloudflare request events.
- Responsibilities: route edge traffic and execute specialized route handlers.

**Standalone Python Package Runtime:**
- Location: `src/automationhub/api.py`.
- Triggers: direct Python import/use.
- Responsibilities: local orchestration without backend dependencies.

## Error Handling

**Strategy:** Handle errors at layer boundaries and return typed/structured API responses.

**Patterns:**
- Endpoint wrappers catch exceptions and raise `HTTPException` in `backend/app/api/v1/endpoints/*.py`.
- Global fallback handler in `backend/app/main.py` converts uncaught exceptions to `500` JSON.
- Startup lifecycle in `backend/app/main.py` tolerates optional subsystem failures with logging.
- Standalone package raises `ValueError` for invalid workflow/action/trigger/schedule configuration in `src/automationhub/*.py`.

## Cross-Cutting Concerns

**Logging:** centralized setup in `backend/app/core/logging.py`; request-level logs in `backend/app/main.py` middleware.

**Validation:** Pydantic request models in endpoint modules and schema modules (`backend/app/schemas/*.py`); settings validation in `backend/app/core/config.py`.

**Authentication and Authorization:** auth dependency usage in endpoint modules (for example `backend/app/api/v1/endpoints/workflows.py`), gateway auth in `backend/app/gateway/auth.py`, and policy middleware in `backend/app/middleware/auth_middleware.py`/`backend/app/middleware/rbac.py`.

**Tenant and Security Boundaries:** tenant middleware and security middleware in `backend/app/middleware/tenant.py` and `backend/app/middleware/security_middleware.py`.

---

*Architecture analysis: 2026-04-21*
