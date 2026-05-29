# QueryFlux — CLAUDE.md

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md`. All portfolio rules apply.

> Upstream CLAUDE.md preserved as `CLAUDE.source.md`.

## Mission

The AI-native database workspace. Safe, observable, governed data surface for AI-authored applications.

## Target user

Devs shipping production apps where AI agents need read/write DB access. Secondary: data engineers giving agents query access without raw credentials.

## Architecture constraints

- All agent-issued queries pass through a policy gate (allow/deny by table, column, row predicate).
- All agent-issued queries emit an audit event per platform convention: `{ts, actor_id, event:"queryflux.query", resource, decision, reason}`.
- No agent gets raw DB credentials. Auth mediated through a connection broker.
- Multi-tenant by default. Tenant isolation is a hard boundary.

## Test matrix

- **100% coverage** on: policy gate, audit emit, tenant isolation, SQL parameterization.
- **>=90% line / >=85% branch** elsewhere.
- Integration: agent query happy/denied, audit integrity under load.
- E2E: web workspace, MCP server, VSCode flows.

## Security controls

- SQL injection: zero tolerance; parameterized queries enforced at broker.
- PII redaction in audit logs (use platform redact module patterns).
- API keys scoped per-agent, revocable, with expiry.
- Default deny on schema introspection until explicitly granted.
- Per-agent rate limit.
- Secrets only in Cloudflare Worker secrets — never in committed env files.

## Release checklist

- Gates green: typecheck, test, coverage, audit, secret-scan.
- D1 migrations forward-only.
- New policy rule types have audit-log integration test.
- Perf: p95 query proxy overhead < 50ms.
- Apple HIG visual + a11y audit for web workspace.
- Lighthouse CI ≥ 90 Perf + A11y.

## Consolidation TODOs

See `CONSOLIDATION_TODO.md`. Top: restructure subdirs, wire to platform auth/billing/telemetry/policy.

## Desktop runtime

Desktop runtime: Tauri (Electron archived 2026-05-29).

## Tree shape (post P0-1 + infra fold, 2026-05-29)

8 product dirs + `extensions/`, `_archive/`, `scripts/`, `infra/`, `docs/`, `tests/`:

- `web/` — Vite + React 19 SPA (was `src/` + root vite/tailwind/postcss configs + `public/`).
- `website/` — Next.js 15 marketing + billing site (unchanged).
- `desktop/` — Tauri desktop (was `queryflux-desktop/`).
- `mobile/` — React Native (unchanged).
- `mcp-server/` — MCP SDK stdio server (was `queryflux-mcp-server/`).
- `lens/` — QueryLens family: `lens/core/` (sqlite + scripts), `lens/api-java/` (Spring Boot NLP-to-SQL), `lens/vectorize-worker/` (CF Worker + Vectorize binding), plus the existing `lens/src/`.
- `backend/` — Go monolith (canonical); TS Express layer parked at `backend/server-ts/`. Now also holds the data layer: `backend/cloudflare-d1/` (D1 schemas, folded from root), `backend/supabase/` (Supabase migrations, folded from root), and `backend/migrations/init-db.sql` (folded from root).
- `workers/` — Cloudflare workers: `workers/api/` (was `queryflux-worker/`), `workers/edge/` (was `worker/`), `workers/api-js/` (was `cloudflare-workers/`), `workers/legacy/` (was top-level `workers/`).
- `extensions/` — sibling parking dir for editor + AI app extensions: `vscode-queryflux/`, `vscode-pgdesktop/`, `openai-app-full/`, `openai-app-lite/`, `gemini-functions/`.
- `infra/` — deploy-target configs: `infra/netlify/functions/` (folded from root `netlify/`), `infra/nginx/` (folded `nginx.conf` + `nginx.prod.conf` from root).
- `tests/` — consolidated test tree: `tests/e2e-playwright/` (folded from root `e2e/`), plus existing `tests/{__tests__,e2e,fixtures,integration,standalone}`.
- `docs/` — product docs (kept at top level per portfolio rule).
