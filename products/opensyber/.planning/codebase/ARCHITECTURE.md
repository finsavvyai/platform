# Architecture

## High-level pattern

OpenSyber follows a **Jamstack-style split**:

1. **`apps/web`** — Next.js **BFF-less** UI: marketing pages, authenticated dashboard, admin, marketplace UI. Talks to the API over HTTPS using cookies/sessions and TokenForge headers where applicable.
2. **`apps/api`** — **Hono** application on **Cloudflare Workers** — single HTTP surface for REST-style JSON APIs, webhooks, cron handlers, and AI endpoints.
3. **`apps/agent`** — Optional **Node.js** process running near customer workloads, calling the API and Claw gateway for skills and monitoring.
4. **`packages/db` + D1** — Canonical persistence; Drizzle models domain (organizations, instances, security findings, marketplace, etc.).

Data flows **Browser → (Next.js) → api.opensyber.cloud → D1/KV/DO/R2/Vectorize**. Background work uses **cron** (`apps/api/wrangler.toml` `[triggers]`) and in-worker schedulers (`runScheduledJobs`, trial/health/audit services imported from `apps/api/src/index.ts`).

## API composition (Hono)

Entry point: `apps/api/src/index.ts`.

- Constructs `new Hono<{ Bindings: Env; Variables: Variables }>()`.
- Global middleware: logging, pretty JSON, security headers, body size limit, **CORS** (production origins + localhost in non-prod).
- **TokenForge** middleware wraps `/api/*` with nonce storage and skip/sensitive path rules.
- **Rate limiting** applied per route class (`rateLimitMiddleware` with keys like `'authenticated'`, `'public'`, `'agent'`).
- **Route registration** is centralized in `apps/api/src/routes/register.ts` — many `app.route('/api/...', ...)` mounts. Domain areas include: agent gateway, instances, skills, security dashboard, organizations, SSO, cloud/CSPM, SaaS, AI, remediation, vault, marketplace-adjacent APIs, webhooks, public threat/score endpoints.

## Durable Objects & real-time state

- **`AgentInstance`** — Exported from `apps/api/src/durable-objects/agent-instance.js` and registered in `wrangler.toml` DO bindings. Used for per-agent coordination (see DO class implementation under `apps/api/src/durable-objects/`).

## TokenForge

- Library: `packages/tokenforge` — device binding, middleware adapters, storage abstraction (`D1Storage` in API).
- API integrates internal middleware to enforce session integrity on mutating routes; `skipPaths` must stay aligned with actual auth mechanisms (comment block in `apps/api/src/index.ts`).

## Multi-app Cloudflare

- **`apps/claw-gateway`** — AI gateway Worker (session DO, LLM proxy) — portfolio-shared infrastructure per `CLAUDE.md`.
- **`apps/tokenforge-api`**, **`apps/tokenforge-web`**, **`apps/tokenforge-proxy`** — TokenForge product vertical; may share auth patterns with main app.

## Frontend architecture (web)

- **App Router** — `apps/web/src/app/` — route groups for marketing, auth, dashboard, admin, docs, etc.
- **i18n** — `next-intl`; locale helpers under `apps/web/src/i18n/`.
- **Shared UI** — `@opensyber/ui` for primitives; large local component tree under `apps/web/src/components/`.
- **Auth session** — `SessionProvider` in root layout (`apps/web/src/app/layout.tsx`).

## Skills & marketplace

- **Skill packages** — Top-level `skills/` directory (marketplace skill implementations).
- **Skill SDK** — `packages/skill-sdk` for definitions and tests.
- API exposes skill installation/runtime endpoints (see `register.ts` `skillRoutes`, instance skill routes).

## Diagram (conceptual)

```
[Browser] --HTTPS--> [Next.js apps/web]
                          |
                          +--> [api Worker apps/api] --+--> D1 (Drizzle)
                          |                             +--> KV / DO / R2 / Vectorize
                          +--> [claw-gateway Worker] --> LLM providers / Workers AI

[apps/agent Node] --HTTPS--> [api Worker] / [claw-gateway]
```

---
*Generated for GSD codebase map — focus: architecture*
