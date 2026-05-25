# Technology Stack

**Analysis Date:** 2026-04-22

## Languages

**Primary:**
- TypeScript 5.x - Core application language across `frontend/`, `backend/`, `apps/api/`, `mobile/`, `src/`, and `packages/*` (see `package.json`, `frontend/package.json`, `backend/package.json`, `apps/api/package.json`, `mobile/package.json`).
- JavaScript (ESM) - Tooling and scripts in root and backend (`esbuild.config.mjs`, `scripts/*.mjs`, `backend/build.cjs`, `src/standalone-worker.js`).

**Secondary:**
- Python >=3.11 - Orchestrator service in `orchestrator/` (`orchestrator/pyproject.toml`).
- SQL (SQLite/Postgres dialects) - Migrations and schema in `drizzle/migrations`, `backend/src/database/migrations`, and `backend/src/db`.

## Runtime

**Environment:**
- Node.js >=18 required (`package.json`, `backend/package.json`, `mcp-server/package.json`).
- Volta-pinned Node.js 22.22.0 for local consistency (`package.json`).
- Cloudflare Workers runtime for API/edge services (`wrangler.toml`, `backend/wrangler.toml`, `apps/api/package.json` scripts).
- Python 3.11+ for orchestration CLI and agents (`orchestrator/pyproject.toml`).

**Package Manager:**
- npm (workspace root + per-package installs via `npm --prefix ...`) (`package.json` scripts).
- Lockfile: present (`package-lock.json`, plus package-level lockfiles in `frontend/package-lock.json`, `backend/package-lock.json`, `mobile/package-lock.json`, `questro-io/package-lock.json`, `packages/self-healing/package-lock.json`).

## Frameworks

**Core:**
- React 19 + React DOM 19 - Web UIs (`frontend/package.json`, `questro-app/package.json`, `questro-io/package.json`).
- Vite 7 - Frontend bundling/dev server (`frontend/package.json`, `frontend/vite.config.ts`).
- Hono 4 - Worker/API routing (`package.json` deps, `apps/api/package.json`, `src/api/*.ts`, `backend/src/routes/testCases.route.ts`).
- Express 4 - Backend HTTP server and legacy/service routes (`backend/package.json`, `backend/src/routes/*.ts`).
- Expo + React Native - Mobile app runtime (`mobile/package.json`).
- Drizzle ORM + Drizzle Kit - Data access and migrations (`package.json`, `backend/package.json`, root `db:*` scripts).

**Testing:**
- Vitest - Unit/integration testing for frontend/workers/shared modules (`package.json`, `frontend/package.json`, `vitest.config.ts`, `frontend/vite.config.ts` test block).
- Jest - Backend and mobile tests (`backend/package.json`, `mobile/package.json`).
- Playwright - E2E and browser automation (`package.json`, `playwright.config.ts`, `tests/e2e/**`).
- Maestro - Mobile E2E command integration (`mobile/package.json` `test:maestro`).

**Build/Dev:**
- Wrangler 4 (and v3 in `apps/api`) - Worker/Pages dev and deploy (`package.json`, `apps/api/package.json`, `wrangler.toml`).
- esbuild - Worker/build pipeline (`package.json`, `backend/package.json`).
- tsx - TypeScript execution for scripts/workers (`backend/package.json`, `mcp-server/package.json`, `mcp/package.json`).
- ESLint + Prettier - Lint/format (`package.json`, `frontend/package.json`, `backend/package.json`, `mobile/package.json`).

## Key Dependencies

**Critical:**
- `hono` - Main API framework for Workers and modern API routes (`apps/api/package.json`, `src/api/ai.ts`, `backend/src/virtualizationRoutes.ts`).
- `drizzle-orm` / `drizzle-kit` - Database query/migration foundation (`package.json`, `backend/package.json`, root `db:*` scripts).
- `react`, `react-dom`, `react-router-dom` - Frontend rendering/routing (`frontend/package.json`).
- `openai`, `@anthropic-ai/sdk`, `@huggingface/inference` - AI generation/provider clients (`backend/package.json`, `orchestrator/pyproject.toml`).
- `stripe` and LemonSqueezy API clients via `axios/fetch` - Billing stack (`backend/package.json`, `backend/src/services/LemonSqueezyService.ts`, `backend/src/services/billing/StripeService.ts`).

**Infrastructure:**
- `wrangler`, `@cloudflare/workers-types`, `miniflare` - Cloudflare runtime/deploy/dev (`package.json`, `apps/api/package.json`).
- `redis`, `pg`, `postgres`, `mysql2`, `mongodb` - Multi-database connectors (`backend/package.json`).
- `socket.io`, `ws` - Realtime channels (`backend/package.json`).
- `@modelcontextprotocol/sdk` - MCP server/connectors (`mcp-server/package.json`, `mcp/package.json`).

## Configuration

**Environment:**
- Central typed env parsing in backend via `backend/src/config/env.ts`.
- Worker bindings and per-environment vars in `wrangler.toml` and `backend/wrangler.toml`.
- Example env templates present at root and services (`.env.example`, `.env.development.example`, `backend/.env.example`, `frontend/.env.example`, `orchestrator/.env.example`).
- `.env*` files are present for local/stage setups; values are externalized and not committed as secrets (detected in repo root and `backend/`, `frontend/`, `orchestrator/`).

**Build:**
- Root multi-service scripts orchestrate frontend/backend/workers/mobile builds (`package.json`).
- Frontend build config in `frontend/vite.config.ts`.
- Worker build/deploy in `wrangler.toml`, `backend/wrangler.toml`, and `apps/api/package.json`.
- Containerized dev/prod configs in `docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.production.yml`, `config/production/docker-compose.prod.yml`.

## Platform Requirements

**Development:**
- Node.js + npm (minimum from engines in `package.json`).
- Docker for local Postgres/Redis/WireMock stack (`docker-compose.yml`).
- Wrangler auth/session for Cloudflare development (`package.json` `setup:workers`, `wrangler:auth`).
- Python 3.11+ for orchestrator workflows (`orchestrator/pyproject.toml`).

**Production:**
- Cloudflare Workers + Pages as primary runtime/hosting (`wrangler.toml`, root deploy scripts in `package.json`).
- Additional deployment path through Docker image + Render pipelines (`.github/workflows/ci-cd.yml`, `.github/workflows/production-deploy.yml`).
- GitHub Actions as primary CI orchestration (`.github/workflows/*.yml`).

---

*Stack analysis: 2026-04-22*
