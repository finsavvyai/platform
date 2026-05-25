# Stack

OpenSyber is a **pnpm + Turborepo** monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`, `samples/*`). Primary languages are **TypeScript** and **TSX**; Python appears in some TokenForge multi-language SDK paths under `packages/tokenforge-sdks/`.

## Runtime targets

| Surface | Package | Stack |
|--------|---------|--------|
| Marketing + dashboard UI | `apps/web` (`@opensyber/web`) | **Next.js 16** (`next@16.2.4`), **React 19**, App Router under `apps/web/src/app/`, **Tailwind CSS 4**, **next-intl** for i18n, **next-auth** v5 beta, **Framer Motion**, **Sentry** (`@sentry/nextjs`). Deploy path: **OpenNext Cloudflare** (`@opennextjs/cloudflare`, `build:cf` + `wrangler deploy`). |
| Public API | `apps/api` (`@opensyber/api`) | **Cloudflare Worker** — **Hono** (`hono@^4.12`), **Drizzle ORM** (`drizzle-orm@^0.45`), **Zod**, **wrangler** CLI. Entry: `apps/api/src/index.ts`. |
| AI gateway (portfolio) | `apps/claw-gateway` | CF Worker + **Hono**, **wrangler**. |
| TokenForge API | `apps/tokenforge-api` | CF Worker + Hono (sibling product surface). |
| TokenForge web | `apps/tokenforge-web` | Next.js app for TokenForge UI. |
| On-host agent daemon | `apps/agent` | **Node.js** — `tsx` for dev, compiled `dist/` for prod; **Vitest** for tests. |
| TokenForge edge proxy | `apps/tokenforge-proxy` | Minimal CF Worker. |

## Shared libraries (workspace)

- **`packages/db`** — Drizzle schema + migrations for **Cloudflare D1** (`packages/db/migrations/`). Consumed by API worker; migrations applied via `wrangler d1` (see `packages/db/package.json` scripts).
- **`packages/shared`** — Cross-cutting types, constants, utilities.
- **`packages/auth`** — Auth.js–oriented helpers (`peerDependencies`: `next-auth`), exported from `packages/auth/src/`.
- **`packages/tokenforge`** — TokenForge SDK (browser/server/adapters, device-bound sessions). API wires middleware from `@opensyber/tokenforge/server/internal` in `apps/api/src/index.ts`.
- **`packages/ui`** — Shared React UI primitives for web.
- **`packages/claw-sdk`** — Client for Claw gateway (`ClawClient`, streaming, sessions).
- **`packages/skill-sdk`**, **`packages/cli`**, **`packages/opensyber-mcp`**, **`packages/vscode-extension`** — Tooling and integrations.

## Data & platform (API bindings)

Configured in `apps/api/wrangler.toml` (representative):

- **D1** — `DB` → database `opensyber-db`; migrations from `packages/db/migrations`.
- **KV** — e.g. `CREDENTIAL_VAULT`, `CACHE`, `TF_NONCES`.
- **Durable Objects** — `AGENT_DO` / `AgentInstance` (agent instance state).
- **Vectorize** — `VECTORIZE` index for semantic search (skills, findings).
- **R2** — `STORAGE` bucket for backups, packages, audit artifacts.
- **Workers AI** — `[ai]` binding for embeddings / NL features.
- **Cron** — e.g. hourly triggers for security snapshots and scheduled jobs (see `apps/api/src/index.ts` exports and cron wiring).

## Tooling versions (indicative)

- **Package manager**: `pnpm@10.6.2` (root `package.json`).
- **Build orchestration**: **Turborepo** (`turbo.json`) — pipelines for `build`, `dev`, `lint`, `typecheck`, `test`, `deploy`, DB tasks.
- **Lint**: ESLint 9 + `eslint-config-next` on web.
- **Tests**: **Vitest** (v3–v4 depending on package), **Playwright** on web (`@playwright/test@^1.58`), optional **k6** load scripts under `apps/api/k6/`.

## Configuration hotspots

- **API Worker**: `apps/api/wrangler.toml` — routes, bindings, env-specific overrides (e.g. multi-region blocks).
- **Web**: `apps/web/next.config.ts`, `apps/web/playwright.config.ts`, Tailwind/PostCSS under `apps/web`.
- **DB**: `packages/db/drizzle.config.ts` (kit + schema generation).

---
*Generated for GSD codebase map — focus: tech*
