# Concerns

Items to treat carefully when planning refactors, releases, or security reviews. This is a **living snapshot**, not an exhaustive bug list.

## Architecture & scale

- **Single API Worker surface** — `apps/api` centralizes a very large route graph (`apps/api/src/routes/register.ts`). Risk: accidental cross-cutting effects (middleware order, CORS, rate limits, TokenForge scope). Changes to global middleware require regression on both public and authenticated routes.
- **D1 + edge consistency** — Primary DB is **D1**; patterns that assume traditional RDB connection pooling or long transactions may not fit. Multi-region notes in `apps/api/wrangler.toml` imply data-residency complexity — verify query and replication assumptions before new features.

## Auth & session security

- **TokenForge middleware** — `skipPaths` and `sensitiveOps` in `apps/api/src/index.ts` are security-critical. Misclassification could expose authenticated routes or block legitimate traffic.
- **NextAuth + TokenForge** — Two layers (browser session vs device-bound API). Feature work must clarify which identity and proof mechanism applies.

## Secrets & configuration

- **Many secrets via Wrangler** — API comments list `AUTH_SECRET`, LemonSqueezy, Cloudflare tokens, `ENCRYPTION_KEY`, etc. Documentation in generated maps must **never** paste real values (IDs in `wrangler.toml` are structural; treat env-specific values as sensitive in prose).
- **`turbo.json` `globalEnv`** — Lists integration env vars; missing vars can cause silent build/test drift across machines.

## Testing & flake risk

- **E2E dependency on auth artifact** — Playwright authenticated flows need `apps/web/e2e/.auth/user.json`. Visual baselines are not committed per `e2e/visual/README.md` — first-time or CI runs need snapshot/update discipline.
- **Vitest version drift** — `apps/agent` uses Vitest 3.x while some packages use 4.x; watch for config API differences when sharing patterns.

## Operational

- **Cron and background work** — Hourly and scheduled jobs (`apps/api/wrangler.toml`, `runScheduledJobs`, trial/health/audit imports) can duplicate work or amplify load if misconfigured.
- **Public rate-limited endpoints** — Threat/score/achievement-style routes use `rateLimitMiddleware('public')`; abuse or caching behavior can affect perceived availability.

## Dependency & supply chain

- **Large dependency surface** — Next.js, Cloudflare, Drizzle, AI SDKs, payment webhooks. Routine `pnpm audit` and lockfile review should be part of release hygiene.

## Documentation drift

- **Multiple “products” in one repo** — OpenSyber web/API vs TokenForge apps vs claw-gateway. `CLAUDE.md` may be ahead of or behind specific packages; prefer verifying paths in `apps/` and `packages/` before execution.

---
*Generated for GSD codebase map — focus: concerns / tech debt*
