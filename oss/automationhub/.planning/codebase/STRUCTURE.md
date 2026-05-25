# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```text
automationhub/
├── backend/                 # FastAPI backend application and backend tests
├── frontend/                # React TypeScript web client
├── cloudflare-workers/      # Edge worker runtime (TypeScript)
├── src/                     # Standalone Python package and worker JS scripts
├── tests/                   # Standalone package test suite (pytest)
├── mcp-servers/             # MCP server implementations and setup scripts
├── terraform/               # Infrastructure-as-code for cloud resources
├── docs/                    # Product and developer documentation
├── deployment/              # Deployment-specific operational docs
└── .planning/codebase/      # Generated mapping docs used by GSD workflows
```

## Directory Purposes

**`backend/`:**
- Purpose: production API runtime and business logic.
- Contains: backend app code in `backend/app/`, tests in `backend/tests/`, dependency manifests (`backend/requirements.txt`).
- Key files: `backend/app/main.py`, `backend/app/api/v1/api.py`, `backend/tests/conftest.py`.

**`backend/app/api/v1/endpoints/`:**
- Purpose: HTTP endpoint handlers grouped by feature domain.
- Contains: endpoint modules such as `backend/app/api/v1/endpoints/workflows.py`, `backend/app/api/v1/endpoints/auth.py`, `backend/app/api/v1/endpoints/cloudflare.py`.
- Key files: `backend/app/api/v1/api.py` (router composition), `backend/app/api/v1/endpoints/health.py`.

**`backend/app/services/`:**
- Purpose: feature orchestration and business logic.
- Contains: service modules named by capability (for example `workflow_engine.py`, `task_executor.py`, `rag_service.py`, `cloudflare_service.py`).
- Key files: `backend/app/services/workflow_engine.py`, `backend/app/services/task_executor.py`.

**`backend/app/models/`:**
- Purpose: SQLAlchemy entities and persistence definitions.
- Contains: domain entities (`workflow.py`, `task.py`, `agent.py`, `user.py`, `organization.py`).
- Key files: `backend/app/models/workflow.py`, `backend/app/models/task.py`.

**`backend/app/schemas/`:**
- Purpose: request/response validation contracts.
- Contains: Pydantic schemas corresponding to endpoint/model domains.
- Key files: `backend/app/schemas/workflow.py`, `backend/app/schemas/auth.py`.

**`backend/app/core/`:**
- Purpose: shared infrastructure configuration and integrations.
- Contains: runtime settings, DB and Redis setup, vector DB integration, security/logging.
- Key files: `backend/app/core/config.py`, `backend/app/core/database.py`, `backend/app/core/redis.py`.

**`backend/app/gateway/`:**
- Purpose: API gateway policy engine and middleware.
- Contains: gateway runtime (`core.py`), auth/rate/versioning/analytics modules, management endpoints.
- Key files: `backend/app/gateway/middleware.py`, `backend/app/gateway/core.py`.

**`backend/app/middleware/`:**
- Purpose: request middleware for auth, RBAC, tenant, rate limits, and security.
- Contains: independent middleware modules.
- Key files: `backend/app/middleware/auth_middleware.py`, `backend/app/middleware/rbac.py`, `backend/app/middleware/tenant.py`.

**`frontend/`:**
- Purpose: user-facing SPA.
- Contains: source app in `frontend/src/`, package manifest and scripts in `frontend/package.json`.
- Key files: `frontend/src/index.tsx`, `frontend/src/App.tsx`, `frontend/src/services/api.ts`.

**`frontend/src/pages/`:**
- Purpose: route-level screens.
- Contains: feature directories/files for dashboard, workflows, agents, docs, admin, analytics, auth.
- Key files: `frontend/src/pages/Dashboard/Dashboard.tsx`, `frontend/src/pages/Workflows/Workflows.tsx`.

**`frontend/src/components/`:**
- Purpose: reusable UI building blocks.
- Contains: feature component groups (`workflow/`, `Layout/`, `Monitoring/`, `Branding/`).
- Key files: `frontend/src/components/Layout/Layout.tsx`, `frontend/src/components/workflow/VisualWorkflowDesigner.tsx`.

**`frontend/src/services/`:**
- Purpose: frontend API client and transport code.
- Contains: typed API wrappers by domain.
- Key files: `frontend/src/services/api.ts`, `frontend/src/services/workflowApi.ts`, `frontend/src/services/websocket.ts`.

**`cloudflare-workers/`:**
- Purpose: edge runtime for routing and edge concerns.
- Contains: worker entrypoint and route handlers.
- Key files: `cloudflare-workers/src/index.ts`, `cloudflare-workers/src/routes/proxy.ts`.

**`src/automationhub/`:**
- Purpose: standalone Python automation domain package.
- Contains: minimal orchestrator primitives (`workflows.py`, `actions.py`, `triggers.py`, `scheduler.py`, `api.py`).
- Key files: `src/automationhub/api.py`, `src/automationhub/workflows.py`.

**`tests/`:**
- Purpose: package-level pytest suite for `src/automationhub`.
- Contains: unit tests per module (`test_workflows.py`, `test_actions.py`, `test_triggers.py`, `test_scheduler.py`, `test_api.py`).
- Key files: `tests/conftest.py`, `tests/test_api.py`.

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: backend process entry and app factory.
- `backend/app/api/v1/api.py`: API v1 route registry.
- `frontend/src/index.tsx`: frontend root renderer.
- `cloudflare-workers/src/index.ts`: worker request entry.
- `src/automationhub/api.py`: standalone package facade entry.

**Configuration:**
- `pyproject.toml`: Python package metadata, pytest defaults for root tests.
- `frontend/package.json`: frontend dependencies and scripts.
- `wrangler.toml`: Cloudflare worker configuration.
- `backend/requirements.txt`: backend Python dependency list.

**Core Logic:**
- `backend/app/services/*.py`: backend orchestration logic.
- `backend/app/models/*.py`: persistence model definitions.
- `src/automationhub/*.py`: in-memory automation library logic.

**Testing:**
- `tests/*.py`: standalone package tests.
- `backend/tests/*.py`: backend-focused integration and service tests.

## Naming Conventions

**Files:**
- Python modules use snake_case (for example `workflow_engine.py`, `task_executor.py`, `auth_middleware.py`).
- React components/pages use PascalCase filenames in many folders (for example `Dashboard.tsx`, `WorkflowBuilder.tsx`).
- Frontend service/store utility files use camelCase or lower camel variants with `Api`/`Slice` suffixes (for example `workflowApi.ts`, `authSlice.ts`).

**Directories:**
- Backend feature directories are lowercase (`backend/app/services/`, `backend/app/models/`, `backend/app/schemas/`).
- Frontend route directories are mixed but mostly feature-name based (for example `frontend/src/pages/Workflows/`, `frontend/src/pages/Auth/`).

## Where to Add New Code

**New backend feature endpoint:**
- Primary code: add endpoint module in `backend/app/api/v1/endpoints/`.
- Business logic: add/update service in `backend/app/services/`.
- Contracts: add/update schema in `backend/app/schemas/`.
- Persistence: add/update model in `backend/app/models/` when storage changes.
- Router registration: include router in `backend/app/api/v1/api.py`.
- Tests: add tests in `backend/tests/`.

**New frontend feature screen:**
- Route page: add under `frontend/src/pages/`.
- Shared UI: add reusable components under `frontend/src/components/`.
- API calls: add client module/method in `frontend/src/services/`.
- State: add slice in `frontend/src/store/slices/` when persistent client state is needed.

**New standalone automation primitive:**
- Implementation: add module in `src/automationhub/`.
- Facade exposure: wire to `src/automationhub/api.py` if it should be user-facing.
- Tests: add matching tests in `tests/`.

**Utilities and shared infrastructure:**
- Backend infra concerns: `backend/app/core/` or `backend/app/middleware/` depending on scope.
- Edge runtime concerns: `cloudflare-workers/src/routes/` or `cloudflare-workers/src/durable-objects/`.
- Infra provisioning changes: `terraform/`.

## Special Directories

**`.planning/codebase/`:**
- Purpose: generated architecture/quality/stack mapping docs.
- Generated: Yes.
- Committed: Yes.

**`venv/`:**
- Purpose: local Python virtual environment dependencies.
- Generated: Yes.
- Committed: No.

**`vendor/` and `openclaw/`:**
- Purpose: bundled external or adjacent projects present in same workspace.
- Generated: No.
- Committed: Yes (repository content).

---

*Structure analysis: 2026-04-21*
