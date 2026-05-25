# Architecture

**Analysis Date:** 2026-04-22

## Pattern Overview

**Overall:** Polyrepo-style monorepo with multiple deployable runtimes (Cloudflare Workers APIs, React web apps, Expo mobile app, CLI, and MCP server) sharing TypeScript-first domain logic.

**Key Characteristics:**
- Route-first API composition with `Hono` app instances mounted by domain in `backend/src/index.ts`, `src/index.ts`, and `apps/api/src/index.ts`.
- Service-oriented business logic in `backend/src/services/` and `src/services/`, with route handlers delegating orchestration and provider calls.
- Multi-surface clients (`frontend`, `questro-app`, `questro-io`, and `mobile`) using client-side routing and auth-guarded view composition.

## Layers

**Client UI Layer:**
- Purpose: Render product interfaces, manage local session state, and call API surfaces.
- Location: `frontend/src`, `questro-app/src`, `questro-io/src`, `mobile/app`, `mobile/src`
- Contains: React route trees, Expo Router screens, Zustand stores, component libraries, API client wrappers.
- Depends on: API/BFF endpoints, browser/mobile platform APIs, auth/session storage.
- Used by: End users on web and mobile.

**Edge/API Composition Layer:**
- Purpose: Expose HTTP endpoints, apply middleware, and mount domain routers.
- Location: `backend/src/index.ts`, `src/index.ts`, `apps/api/src/index.ts`, `backend/src/routes`, `apps/api/src/routes`, `src/routes`
- Contains: `Hono` app setup, CORS/auth/rate-limiting middleware, route modules, health/version endpoints.
- Depends on: Service layer, persistence bindings, auth utilities.
- Used by: Frontend clients, automation jobs, CLI/MCP integrations.

**Domain Services Layer:**
- Purpose: Implement business workflows (AI generation, billing, recording, integrations, scheduling, virtualization).
- Location: `backend/src/services`, `src/services`, `apps/api/src/services`
- Contains: Service classes/modules, bridge clients, provider abstractions, orchestration helpers.
- Depends on: Data access layer, external providers, worker runtime bindings.
- Used by: Route handlers and background worker routines.

**Persistence & Schema Layer:**
- Purpose: Define data models and read/write access patterns for D1/Drizzle and related stores.
- Location: `backend/src/db/schema.ts`, `backend/src/schema`, `src/db`, `drizzle/`, `drizzle.config.ts`
- Contains: Drizzle table schemas, migrations, DB helper modules, typed entities.
- Depends on: Cloudflare D1 bindings, Drizzle ORM primitives.
- Used by: API routes, services, Durable Objects.

**Realtime & Coordination Layer:**
- Purpose: Coordinate long-running test execution and collaboration state with WebSockets and Durable Objects.
- Location: `src/durable-objects`, `src/websocket-collaboration-worker.ts`, `backend/src/services/collaboration`
- Contains: Durable Object classes, in-memory connection maps, heartbeat/metrics loops, event broadcasting.
- Depends on: Worker runtime APIs, database schema, WebSocket channels.
- Used by: Live execution dashboards and recording/execution flows.

## Data Flow

**Web App API Flow:**

1. Browser client loads route tree via `frontend/src/main.tsx` and `frontend/src/App.tsx`.
2. Protected screens gate access through `frontend/src/components/auth/ProtectedRoute.tsx` and `frontend/src/stores/authStore.ts`.
3. API calls are issued through composed client methods in `frontend/src/lib/api/index.ts`.
4. Requests hit mounted API routers in `backend/src/index.ts` (`/api` and `/api/v1`), then route modules in `backend/src/routes`.
5. Route handlers call services and/or Drizzle queries in `backend/src/services` and `backend/src/db/schema.ts`, then return JSON envelopes.

**Worker-Orchestrated Execution Flow:**

1. Worker entry `src/index.ts` accepts `/api/tests/:id/execute` and creates execution records.
2. Worker resolves Durable Object IDs and dispatches execution payloads to `src/durable-objects/test-execution-do.ts`.
3. Durable Object updates execution state, logs, metrics, and broadcasts progress over WebSockets.
4. Clients subscribe through `/ws/test-execution/:executionId` and render live status updates.

**Auth/OAuth Flow:**

1. UI triggers login or OAuth initiation from store actions in `frontend/src/stores/authStore.ts`.
2. Auth routes are mounted in `backend/src/index.ts` via `authRoute` and `oauthRoute`.
3. Token verification middleware (`backend/src/middleware/honoAuth.ts` and Express-compatible middleware in `backend/src/middleware/auth.ts`) injects identity context.
4. Protected route modules consume user context (`userId`/role) for scoped DB queries.

**State Management:**
- Web clients use persisted Zustand stores in `frontend/src/stores` and `questro-app/src/stores`.
- Mobile app state is split between Expo Router route state (`mobile/app`) and store/hooks in `mobile/src/stores` and `mobile/src/hooks`.
- Realtime execution state is maintained inside Durable Objects (`src/durable-objects/test-execution-do.ts`) and synchronized via WebSockets.

## Key Abstractions

**Router-Per-Domain Modules:**
- Purpose: Keep endpoint concerns isolated by feature.
- Examples: `backend/src/routes/projects.route.ts`, `backend/src/routes/runs.route.ts`, `apps/api/src/routes/tests.ts`
- Pattern: Feature routes export a router instance and are mounted centrally by an app entrypoint.

**Service-Oriented Orchestrators:**
- Purpose: Separate business workflow code from transport/controller code.
- Examples: `backend/src/services/AIService.ts`, `backend/src/services/PlaywrightBridge.ts`, `apps/api/src/services/testGenerator.ts`
- Pattern: Routes validate input and delegate side effects/computation to service modules.

**Composed API Client Core:**
- Purpose: Provide one frontend API surface backed by domain-specific modules.
- Examples: `frontend/src/lib/api/index.ts`, `frontend/src/lib/api/auth.ts`, `frontend/src/lib/api/testing.ts`
- Pattern: Core fetch/WebSocket wrapper is extended using factory functions per domain.

**Durable Object Runtime Entities:**
- Purpose: Hold mutable execution/collaboration state across requests.
- Examples: `src/durable-objects/test-execution-do.ts`, `src/durable-objects/session-do.ts`, `src/durable-objects/collaboration-do.ts`
- Pattern: HTTP + WebSocket handlers share in-object state and persist selected transitions.

## Entry Points

**Primary Backend API:**
- Location: `backend/src/index.ts`
- Triggers: Cloudflare Worker runtime request handling for `/api`, `/api/v1`, and health endpoints.
- Responsibilities: Global middleware, CORS/logging, route mounting, fallback handlers, virtualization interception.

**Primary Worker Platform API:**
- Location: `src/index.ts`
- Triggers: Cloudflare Worker `fetch` events configured by `wrangler.toml`.
- Responsibilities: Route composition, auth proxying, project/test/recording endpoints, Durable Object WebSocket gateways.

**Secondary API App:**
- Location: `apps/api/src/index.ts`
- Triggers: Worker runtime for package-scoped API service.
- Responsibilities: Smaller auth/tests/billing API surface with strict module boundaries.

**Frontend SPA:**
- Location: `frontend/src/main.tsx` and `frontend/src/App.tsx`
- Triggers: Browser bootstrap (`createRoot`).
- Responsibilities: Theme/load setup, route segmentation (public/auth/protected), lazy page loading.

**Mobile App Router:**
- Location: `mobile/app/_layout.tsx`
- Triggers: Expo Router app startup.
- Responsibilities: Root navigation stack setup, theme/auth bootstrap, tab/auth route separation.

**CLI Runtime:**
- Location: `cli/src/index.ts`
- Triggers: `qestro` command execution.
- Responsibilities: Command registration, global options, config/auth hooks, process-level error handling.

**MCP Server Runtime:**
- Location: `mcp-server/src/index.ts`
- Triggers: stdio transport startup for MCP host.
- Responsibilities: Tool registry, request dispatching, tool execution envelope handling.

## Error Handling

**Strategy:** Endpoint-local try/catch with JSON error envelopes, plus global framework-level fallback handlers.

**Patterns:**
- Route-level guarded DB/service calls returning explicit status codes (for example `backend/src/routes/projects.route.ts`, `apps/api/src/routes/tests.ts`).
- Global fallback handlers (`app.notFound`, `app.onError`) in API entries (`backend/src/index.ts`, `src/index.ts`, `apps/api/src/index.ts`).
- UI runtime containment through React error boundaries in `frontend/src/main.tsx` and `questro-app/src/components/ErrorBoundary.tsx`.

## Cross-Cutting Concerns

**Logging:** Request and service-level logging via middleware and logger utilities in `backend/src/index.ts` and `backend/src/utils/logger`.
**Validation:** Runtime schema validation with `zod` and parser helpers in route modules such as `backend/src/routes/projects.route.ts` and `apps/api/src/routes/auth.ts`.
**Authentication:** Bearer/JWT verification in `backend/src/middleware/honoAuth.ts`, `backend/src/middleware/auth.ts`, and worker middleware in `src/middleware/auth.ts`.

---

*Architecture analysis: 2026-04-22*
