# Integrations

External systems and how they connect to OpenSyber. Paths point to wiring or configuration.

## Cloudflare platform

- **Workers (HTTP API)** — `apps/api` deployed to route `api.opensyber.cloud` (see `apps/api/wrangler.toml` `routes`). Uses D1, KV, DO, R2, Vectorize, Workers AI, cron.
- **Pages / Workers (web)** — `apps/web` production deploy via OpenNext + Wrangler (`apps/web/package.json` `deploy`).
- **Claw gateway** — `apps/claw-gateway` — separate Worker for AI gateway traffic (LLM proxy patterns; see `CLAUDE.md` and `apps/claw-gateway/src/`).

## Authentication

- **Auth.js (NextAuth v5)** — Used by `apps/web` with shared logic in `packages/auth` (`next-auth` peer). Session and OAuth provider configuration live under web auth routes and auth package exports (`packages/auth/src/`).
- **TokenForge device-bound sessions** — Server middleware from `@opensyber/tokenforge/server/internal` on API (`apps/api/src/index.ts`) with `D1Storage` nonces (`TF_NONCES` KV). Skip paths and sensitive operations are documented inline in `index.ts`.

## Payments & subscriptions

- **LemonSqueezy** — Webhook and API integration (env vars referenced in `turbo.json` `globalEnv`: `LEMONSQUEEZY_*`, `OPENSYBER_LS_*`). API `wrangler.toml` comments list secret names for store/products.

## Infrastructure / ops

- **Hetzner** — `HETZNER_API_TOKEN` in `turbo.json` globalEnv (VM or related automation; see docs or services under `apps/api/src/services/` for usage).
- **Cloudflare account API** — `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` noted in API worker comments for platform operations.

## AI & LLM

- **Workers AI** — Binding `AI` in `apps/api/wrangler.toml` for embeddings and AI routes under `/api/ai/*` (registered in `apps/api/src/routes/register.ts`).
- **clawpipe-ai** — Dependency on `apps/api` (`package.json`) for AI pipeline features.
- **Anthropic / OpenAI / Workers AI** — Routed via claw-gateway services (`apps/claw-gateway`) per `CLAUDE.md` architecture notes.

## Data stores

- **D1 (SQL)** — Primary relational store; schema in `packages/db/src/schema/`, migrations in `packages/db/migrations/`.
- **KV** — Caching, vault metadata, TokenForge nonces (`CREDENTIAL_VAULT`, `CACHE`, `TF_NONCES`).
- **R2** — Object storage for backups, skill packages, audit logs (`STORAGE` binding).

## Observability

- **Sentry** — `@sentry/nextjs` on web (`apps/web/package.json`).

## Third-party security / intel (API routes)

Routes under `apps/api/src/routes/` include integrations for cloud CSPM, SaaS connectors, webhooks, threat/score public endpoints, etc. Specific vendor SDKs appear per-route — search `apps/api/src/services/` and `apps/api/src/routes/` for vendor names when planning changes.

## Agent runtime

- **Claw SDK** — `packages/claw-sdk` consumed by `apps/agent` for gateway communication.
- **On-host agent** — `apps/agent` monitors and skills execution; pairs with API `/api/agent/*` routes.

## Developer tooling

- **MCP** — `packages/opensyber-mcp` for Model Context Protocol surfaces.
- **VS Code** — `packages/vscode-extension`.

---
*Generated for GSD codebase map — focus: integrations*
