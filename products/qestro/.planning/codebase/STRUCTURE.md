# Directory Structure

**Analysis Date:** 2026-04-22

## Top-Level Layout

```
qestro/
├── frontend/            # Vite + React web app (legacy/main dashboard surface)
├── backend/             # Hono/Express APIs + services + DB schema and routes
├── src/                 # Worker-first API/runtime (Durable Objects, ws, middleware)
├── apps/api/            # Additional Worker API package
├── mobile/              # Expo React Native app
├── cli/                 # CLI entrypoint and command handlers
├── mcp-server/          # MCP server implementation
├── orchestrator/        # Python orchestration service
├── tests/               # Cross-cutting integration/E2E/performance/security tests
├── drizzle/             # Root-level migrations and schema config
├── packages/            # Shared/internal packages
└── docs/                # Product, ops, and project-management documentation
```

## Application Boundaries

**Frontend surfaces:**
- `frontend/` - main React SPA, component system, API client wrappers, auth stores.
- `questro-app/` and `questro-io/` - additional web app surfaces with shared domain intent.
- `mobile/` - mobile-specific navigation and API adapters under Expo Router.

**Backend/API surfaces:**
- `backend/` - broad route and service implementation with mixed Worker/Node compatibility.
- `src/` - Worker-first runtime including Durable Objects and collaboration channels.
- `apps/api/` - package-scoped API app with focused route modules.

**Tooling/runtime services:**
- `cli/` - scripting and developer/operator workflow commands.
- `mcp-server/` and `mcp/` - MCP connectivity and tool server bindings.
- `orchestrator/` - Python agents/workflow execution support.

## Key Source Locations

**Entry points:**
- `backend/src/index.ts`
- `src/index.ts`
- `apps/api/src/index.ts`
- `frontend/src/main.tsx`
- `mobile/app/_layout.tsx`
- `cli/src/index.ts`
- `mcp-server/src/index.ts`

**Routes and transport:**
- `backend/src/routes/`
- `apps/api/src/routes/`
- `src/routes/`

**Business services:**
- `backend/src/services/`
- `src/services/`
- `apps/api/src/services/`

**Persistence/schema:**
- `backend/src/db/`
- `backend/src/database/`
- `drizzle/`
- `src/db/`

**Tests:**
- `tests/` (cross-project)
- `backend/tests/` and `backend/src/**/__tests__`
- `frontend/src/**/__tests__`
- `mobile/src/__tests__`

## Naming and File Organization Patterns

**Common patterns in this repo:**
- React components frequently use `PascalCase.tsx` in UI folders (for example in `frontend/src/components/` and `mobile/src/components/`).
- Route and middleware files commonly use `*.route.ts` or `camelCase.ts` patterns in `backend/src/routes/` and `backend/src/middleware/`.
- Worker/runtime modules in `src/` include mixed kebab-case and camelCase filenames.
- Many domains expose `index.ts` barrels for import ergonomics.

**Folder conventions by concern:**
- `components/`, `pages/`, `stores/`, `lib/` in web/mobile clients.
- `routes/`, `services/`, `middleware/`, `controllers/`, `utils/` in backend packages.
- `durable-objects/` in Worker runtime for stateful coordination.

## Configuration and Infrastructure Locations

- Root runtime config: `wrangler.toml`, `docker-compose.yml`, `docker-compose.production.yml`.
- Backend runtime config: `backend/wrangler.toml`, `backend/src/config/`.
- Tooling config: `.eslintrc.js`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`.
- Package-specific config files under each app/package root (`frontend/`, `backend/`, `mobile/`, `apps/api/`).

## Monorepo Organization Notes

**Strengths:**
- Clear subsystem directories make ownership discoverable.
- Multiple deployment targets are explicit and separated by root folders.

**Complexity points:**
- Similar responsibilities exist in both `backend/` and `src/` API surfaces.
- Multiple frontend surfaces increase duplication risk for shared UI/data logic.
- Mixed conventions across old/new modules require local style awareness when editing.

---

*Structure analysis: 2026-04-22*
# Codebase Structure

**Analysis Date:** 2026-04-22

## Directory Layout

```text
qestro/
├── frontend/              # Primary React SPA (Vite)
├── backend/               # Main Hono/Node API and service layer
├── src/                   # Root Cloudflare Worker + Durable Objects
├── apps/api/              # Secondary package-scoped API worker
├── mobile/                # Expo React Native app (file-based routing)
├── questro-app/           # Product-focused web app variant
├── questro-io/            # Marketing/brand web app variant
├── cli/                   # Command-line interface
├── mcp-server/            # MCP stdio server for AI tooling
├── packages/              # Reusable internal libraries
├── shared/                # Shared cross-runtime utility/types modules
├── tests/                 # Cross-surface test suites (backend/frontend/e2e/etc.)
├── drizzle/               # D1 migration files
├── scripts/               # Operational and deployment scripts
├── docs/                  # Product and engineering documentation
└── wrangler.toml          # Root Worker deployment/runtime bindings
```

## Directory Purposes

**`frontend/`:**
- Purpose: Main customer web app.
- Contains: Route pages, component hierarchy, Zustand stores, API client modules.
- Key files: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/api/index.ts`

**`backend/`:**
- Purpose: Main API composition and backend domain services.
- Contains: Route modules, middleware, business services, DB schema, seeds, workers.
- Key files: `backend/src/index.ts`, `backend/src/routes`, `backend/src/services`, `backend/src/db/schema.ts`

**`src/`:**
- Purpose: Root Cloudflare Worker runtime and Durable Object implementations.
- Contains: Worker entrypoint, middleware, durable objects, worker-specific services.
- Key files: `src/index.ts`, `src/durable-objects/test-execution-do.ts`, `src/middleware/auth.ts`

**`apps/api/`:**
- Purpose: Modular API package with focused auth/tests/billing routes.
- Contains: Hono entrypoint, route modules, local service helpers.
- Key files: `apps/api/src/index.ts`, `apps/api/src/routes/tests.ts`, `apps/api/src/services/testGenerator.ts`

**`mobile/`:**
- Purpose: Expo mobile application.
- Contains: File-based app routes (`app/`), reusable components/hooks/stores (`src/`), mobile tests.
- Key files: `mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/src/stores/authStore.ts`

**`questro-app/` and `questro-io/`:**
- Purpose: Additional React web applications with separate product/marketing surfaces.
- Contains: SPA route trees, stores, and shared page/component structures.
- Key files: `questro-app/src/App.tsx`, `questro-io/src/App.tsx`, `questro-app/src/stores/authStore.ts`

**`cli/`:**
- Purpose: Terminal interface for platform automation.
- Contains: Command modules, CLI orchestration, utilities/config.
- Key files: `cli/src/index.ts`, `cli/src/commands`, `cli/src/utils`

**`mcp-server/`:**
- Purpose: MCP tool exposure for AI agent integrations.
- Contains: MCP server bootstrap and tool handlers.
- Key files: `mcp-server/src/index.ts`, `mcp-server/src/tools`

**`packages/`:**
- Purpose: Internal reusable libraries and feature modules.
- Contains: Namespaced packages (`finsavvyai-*`, `self-healing`) with independent builds.
- Key files: `packages/self-healing/src/index.ts`, `packages/finsavvyai-auth/src/index.ts`

**`tests/`:**
- Purpose: Repository-level integration, e2e, performance, security, and unit suites.
- Contains: Multi-domain test folders and Playwright/Jest/Vitest assets.
- Key files: `tests/e2e`, `tests/backend`, `tests/frontend`, `tests/playwright`

## Key File Locations

**Entry Points:**
- `backend/src/index.ts`: Main backend API Worker.
- `src/index.ts`: Root Cloudflare Worker app.
- `apps/api/src/index.ts`: Secondary API worker.
- `frontend/src/main.tsx`: Frontend SPA bootstrap.
- `mobile/app/_layout.tsx`: Mobile root navigation entry.
- `cli/src/index.ts`: CLI command runtime.
- `mcp-server/src/index.ts`: MCP stdio server entrypoint.

**Configuration:**
- `package.json`: Root workspace scripts and runtime orchestration.
- `wrangler.toml`: Worker bindings for D1/KV/R2/Durable Objects.
- `drizzle.config.ts`: Migration/schema tooling setup.
- `frontend/vite.config.ts`: Frontend build/dev server config.
- `tsconfig.json`: Root TypeScript defaults for worker/tests.

**Core Logic:**
- `backend/src/routes`: API endpoint modules by feature.
- `backend/src/services`: Business and provider integration services.
- `src/durable-objects`: Stateful execution/collaboration runtime logic.
- `frontend/src/lib/api`: Frontend API abstraction and domain modules.
- `mobile/src`: Mobile shared UI/business modules.

**Testing:**
- `tests/`: Cross-package/integration/e2e suites.
- `backend/src/__tests__`: Backend unit/integration tests colocated with source.
- `frontend/src/test` and `frontend/src/**/__tests__`: Frontend unit/integration tests.
- `mobile/src/__tests__`: Mobile unit/component tests.

## Naming Conventions

**Files:**
- Route modules use both singular and plural suffixes: `*.route.ts` and `*.routes.ts` (for example `backend/src/routes/projects.route.ts`, `backend/src/routes/security.routes.ts`).
- Service classes/modules use `*Service.ts` or feature-subfolder naming (for example `backend/src/services/PlaywrightExecutorService.ts`, `backend/src/services/vibe-test-pilot/VibeTestPilot.ts`).
- React components use PascalCase filenames (for example `frontend/src/components/ChatWidget.tsx`).
- Mobile routes use Expo Router path names, including dynamic segments (for example `mobile/app/plans/[id].tsx`).

**Directories:**
- Domain folders are feature-oriented in API surfaces (`backend/src/routes`, `backend/src/services`).
- UI code is split by role (`components`, `pages`, `stores`, `contexts`) in each web app.
- Shared runtime building blocks live in `shared/` and `packages/`.

## Where to Add New Code

**New Feature:**
- Primary code: Add backend endpoints under `backend/src/routes` and orchestration logic under `backend/src/services`.
- Tests: Add route/service tests in `tests/backend` or `backend/src/__tests__`; add UI coverage in `tests/frontend` or app-local `__tests__`.

**New Component/Module:**
- Implementation: Add web UI components to `frontend/src/components` (or app-specific `questro-app/src/components` / `questro-io/src/components`), and screens/pages to each app’s `pages` or route tree.

**Utilities:**
- Shared helpers: Put cross-runtime helpers in `shared/utils` or package-scoped modules in `packages/*/src`.
- Worker-specific helpers: Keep in `src/utils` for root worker code and `backend/src/utils` for backend API concerns.

## Special Directories

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes.
- Committed: No.

**`dist/`:**
- Purpose: Build artifacts from worker/backend/package compilation.
- Generated: Yes.
- Committed: Mixed (present in repo root; treat as generated output).

**`playwright-report/` and `test-results/`:**
- Purpose: E2E test output artifacts and snapshots.
- Generated: Yes.
- Committed: Mixed (tracked artifacts are present; avoid new manual edits).

**`drizzle/`:**
- Purpose: Database migration source for D1/Drizzle.
- Generated: Partially (tool-generated migrations).
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: Architecture/quality/stack mapping artifacts for GSD planning.
- Generated: Yes (agent-generated).
- Committed: Yes.

---

*Structure analysis: 2026-04-22*
