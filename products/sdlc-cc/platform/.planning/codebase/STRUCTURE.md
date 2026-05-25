# Codebase Structure

**Analysis Date:** 2026-04-22

## Directory Layout

```
sdlc-platform/
├── .config/                 # Shared runtime/deployment config templates (docker, wrangler examples)
├── apps/                    # Standalone app modules (Go app entrypoints)
├── services/                # Primary deployable services (Go, Python, Node, Workers, Next.js)
├── packages/                # Reusable libraries, SDKs, and shared product modules
├── src/                     # Root TypeScript API service and domain modules
├── tests/                   # Cross-project integration/e2e/onboarding test suites
├── database/                # SQL migrations and database docs
├── deployments/             # Environment-specific deployment assets and scripts
├── docs/                    # Architecture, guides, runbooks, and API docs
├── infra/                   # Infrastructure and monitoring assets
└── .planning/codebase/      # Generated codebase mapping docs for GSD planning/execution
```

## Directory Purposes

**`services/`:**
- Purpose: Deployable product services and edge workers.
- Contains: Go services (`services/gateway`, `services/llm-gateway`), Python services (`services/rag`, `services/dlp`), Node/TS services (`services/document-processor`, `services/realtime`), and worker apps (`services/proxy-worker`, `services/gateway-worker`).
- Key files: `services/gateway/cmd/server/main.go`, `services/rag/app/main.py`, `services/proxy-worker/src/index.ts`, `services/document-processor/app/index.ts`.

**`packages/`:**
- Purpose: Shared libraries and SDKs consumed by services/apps.
- Contains: SDKs (`packages/sdk-ts`, `packages/sdk-go`, `packages/sdk-py`), shared product modules (`packages/shared-auth`, `packages/shared-billing`, `packages/shared-dashboard`, `packages/shared-config`, `packages/shared-analytics`), integration helpers.
- Key files: `packages/sdk-ts/src/index.ts`, `packages/shared-dashboard/src/worker/index.ts`, `packages/shared-auth/src/index.ts`.

**`src/`:**
- Purpose: Root Express-based API service and local domain modules.
- Contains: API routers (`src/api`), service modules (`src/services`), app/server boot code (`src/app.ts`, `src/server.ts`), type declarations.
- Key files: `src/server.ts`, `src/app.ts`, `src/config.ts`, `src/api/pipelines.ts`, `src/api/releases.ts`.

**`tests/`:**
- Purpose: Centralized end-to-end/integration/acceptance and subsystem tests.
- Contains: E2E flows, onboarding suites, DLP tests, infrastructure connectivity checks.
- Key files: `tests/e2e/admin-dashboard.spec.ts`, `tests/onboarding/tests/sign-up.spec.ts`, `tests/dlp/dlp-service-core.test.ts`.

**`database/`:**
- Purpose: Shared relational schema evolution and data-layer documentation.
- Contains: SQL migrations and references.
- Key files: `database/migrations/001_initial_schema.sql`, `database/docs/SCHEMA_REFERENCE.md`.

**`deployments/` and `infra/`:**
- Purpose: Deployment orchestration and platform/monitoring definitions.
- Contains: Cloudflare deployment assets, production orchestrators, Docker configs, monitoring dashboards/rules.
- Key files: `deployments/cloudflare/README.md`, `deployments/production/README.md`, `infra/monitoring/README.md`.

## Key File Locations

**Entry Points:**
- `src/server.ts`: Root TypeScript API service process entry.
- `services/gateway/cmd/server/main.go`: Gateway service composition root.
- `services/llm-gateway/cmd/server/main.go`: LLM gateway process entry.
- `services/rag/app/main.py`: FastAPI application entry.
- `services/document-processor/app/index.ts`: Document processor service entry.
- `services/proxy-worker/src/index.ts`: Cloudflare proxy worker fetch entry.
- `services/gateway-worker/src/index.ts`: Cloudflare gateway worker app entry.

**Configuration:**
- `package.json`: Monorepo scripts, workspace declarations, runtime engines.
- `tsconfig.json`: Root TypeScript compiler options and path aliases (`@/*`, `@sdlc/*`).
- `.config/docker/docker-compose.dev.yml`: Local dev stack compose file.
- `.config/wrangler.example.toml`: Worker config template.
- `services/*/package.json`: Service-local scripts and runtime metadata.

**Core Logic:**
- `services/gateway/internal/domain/*`: Domain models/services for gateway.
- `services/gateway/internal/infrastructure/*`: Gateway infra integrations (db, middleware, observability, policy, storage).
- `services/rag/app/api/*`: Versioned RAG endpoint composition.
- `services/rag/app/database/models/*`: RAG tenant-aware ORM models.
- `services/proxy-worker/src/*`: API key auth, quota, PII, proxy orchestration modules.
- `src/services/*`: Root API business services.

**Testing:**
- `tests/**/*`: Repository-level tests.
- `packages/*/tests/**/*`: Package-level tests (SDK/dashboard/config/integrations).
- `services/admin-ui/src/__tests__/*`: Service-local unit tests.
- `packages/insights-core/ts/tests/*`: Package-specific golden tests.

## Naming Conventions

**Files:**
- Go files use snake_case names by concern in gateway internals (for example `services/gateway/internal/infrastructure/database/models/models.go`, `services/gateway/internal/domain/services/authentication_service.go`).
- TypeScript/JavaScript files are mixed: kebab-case in many worker/shared modules (for example `services/proxy-worker/src/monthly-quota.ts`, `packages/shared-dashboard/src/worker/pricing-page.ts`) and concise noun/plural names in API routers (`src/api/pipelines.ts`, `src/api/releases.ts`).
- Python modules use snake_case and package-style hierarchy (`services/rag/app/api/router.py`, `services/rag/app/database/models/base.py`).

**Directories:**
- Service and package roots are kebab-case (`services/document-processor`, `services/proxy-worker`, `packages/shared-dashboard`).
- Internal layering directories are semantic (`internal/domain`, `internal/infrastructure`, `internal/interfaces/http`).
- API and model groupings are feature-oriented (`app/api/endpoints`, `app/database/models`, `src/services/dlp`).

## Where to Add New Code

**New Feature:**
- Primary code:
  - Root API feature: `src/api` + `src/services`.
  - Gateway feature: `services/gateway/internal/domain` + `services/gateway/internal/interfaces/http` + `services/gateway/internal/infrastructure` as needed.
  - Edge feature: `services/proxy-worker/src` or `services/gateway-worker/src`.
  - RAG feature: `services/rag/app/api/endpoints` + `services/rag/app/core`/`services/rag/app/database`.
- Tests:
  - Root/global behavior: `tests/`.
  - Service-local behavior: service test folders (for example `services/admin-ui/src/__tests__`).
  - Package behavior: `packages/<name>/tests`.

**New Component/Module:**
- Implementation:
  - Admin UI component: `services/admin-ui/src/components`.
  - Shared dashboard component/worker route: `packages/shared-dashboard/src`.
  - SDK module: `packages/sdk-ts/src/<domain>`.
  - Gateway handler: `services/gateway/internal/interfaces/http/handlers`.

**Utilities:**
- Shared helpers:
  - Root API utility: `src/utils`.
  - Package-wide utilities: `packages/<name>/src`.
  - Service-specific utilities: service-local utility dirs (for example `services/document-processor/app/utils`).

## Special Directories

**`.planning/codebase`:**
- Purpose: GSD-generated architecture/quality/tech/concern reference docs.
- Generated: Yes.
- Committed: Yes (intended to be checked in for planning continuity).

**`.luna/`:**
- Purpose: Planning and execution artifacts for long-running workflow tracks.
- Generated: Yes.
- Committed: Yes (project keeps roadmap/workflow artifacts in repo).

**`packages/sdk-py/sdlc_sdk.egg-info`:**
- Purpose: Python packaging metadata output.
- Generated: Yes.
- Committed: Yes (currently present in repository changes; treat as generated metadata).

---

*Structure analysis: 2026-04-22*
