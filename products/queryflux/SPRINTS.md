# QueryFlux — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 3 · **Readiness:** 40% · **Stack:** Go/Tauri (Rust + React)
> **Timeline:** 7 days · **Ship by:** Week 7

---

## Product Direction

QueryFlux is now oriented around the vibecoding-era product vision: an AI-native database workspace for builders shipping apps with agents.

Implementation priorities:

1. Web app as the SaaS control plane for workspaces, schema context, QueryLens, generated backend artifacts, collaboration, and billing.
2. Tauri desktop app as the secure local/private database bridge with OS credential storage and SSH/private network access.
3. Mobile app as the production pulse companion for alerts, approvals, and constrained read-only checks.
4. MCP server as a first-class agent interface for Cursor, Claude, Codex, Windsurf, and similar tools.
5. Safety by default: read-only agent operations, destructive-query guardrails, environment awareness, approval flows, and audit logs.

See `docs/strategy/VIBECODING_PRODUCT_VISION.md` for the canonical product vision.

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Go REST API setup with @finsavvyai/go-db and @finsavvyai/go-auth [PARALLEL]
**Prompt:**
Set up the Go REST API backend for QueryFlux multi-database management. Use `@finsavvyai/go-db` for database connectivity (PostgreSQL, MySQL, SQLite, MongoDB drivers). Implement JWT auth using `@finsavvyai/go-auth` with role-based access control (admin, analyst, viewer).

Define endpoints: `POST /api/v1/databases/connect`, `GET /api/v1/databases/{id}/tables`, `POST /api/v1/query/execute`, `GET /api/v1/query/{id}/results`. Use OpenAPI 3.0 schema. Ensure all handler files stay ≤200 lines per QUALITY_STANDARDS.md. Run `gosec ./...` and `go test -coverprofile=cover.out ./...` to verify 95%+ coverage and zero security findings.

### Agent B: Tauri desktop app scaffold with React + query executor UI [PARALLEL]
**Prompt:**
Bootstrap the Tauri desktop application with a React frontend. Create core UI components: database connection wizard (form with host/port/credentials), query editor (syntax-highlighted editor with autocomplete), and results table (virtualized, handles 100K+ rows). Use CSS Grid 8pt spacing following Apple HIG. Implement dark mode support. Scaffold IPC bridge to Go backend. Run `npm run build` to ensure no TypeScript errors.

---

## Sprint Tasks

### Agent C: Payment integration with go-pay [PARALLEL with D]
**Prompt:**
Integrate payment processing using `@finsavvyai/go-pay` (Stripe/LemonSqueezy). Implement endpoint `POST /api/v1/billing/checkout` that creates a checkout session. Handle webhook for `payment.success` event to upgrade user tier (free → pro → enterprise). Store subscription state in PostgreSQL. Add rate limiting (100 requests/min) on all public endpoints using middleware. Ensure zero hardcoded secrets — use environment variables only. Run `bandit -r src/` to verify no security issues.

### Agent D: Database management UI + testing [PARALLEL with C]
**Prompt:**
Build database management panel in React: list connected databases (connection status indicators), bulk query execution (CSV upload + run across all DBs), export results (JSON/CSV/Parquet). Implement browser E2E tests for 5 personas (guest, free-tier, pro, enterprise, expired subscription) using Playwright. Target 95%+ coverage with unit tests (@unit) for query executor, integration tests (@integration) with test PostgreSQL container. Run `vitest --coverage --fail_under=95`.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL]
**Prompt:**
Execute comprehensive quality verification:

1. Test coverage: `go test -coverprofile=cover.out ./...` + `vitest --coverage` — both must show ≥95%
2. Security: `gosec ./...` and `npm audit` — zero high/critical findings
3. File size: Verify all `.go` and `.ts` files ≤200 lines using provided check script
4. API validation: OpenAPI schema validation and endpoint contract tests
5. E2E browser flows: Playwright suite for all 5 personas
6. Build artifacts: `cargo build --release` for Tauri (Windows/macOS/Linux), `npm run build` for React
7. Documentation: README with setup, API docs, deployment guide

Report any failures and blockers. All checks must pass before merge.

---

## Quality Gate Checklist
□ 95%+ test coverage (Go + React)
□ ≤200 lines per source file (.go, .ts, .tsx)
□ Security scan clean (gosec, npm audit — zero high/critical)
□ No secrets in code (environment variables only)
□ All API endpoints tested (contract + E2E)
□ Apple HIG for desktop UI (dark mode, 8pt grid, system colors)
□ Payment integration working (test webhook flow)
□ Tauri app builds for all 3 platforms
□ Browser test personas all pass (5 minimum)
□ OpenAPI schema valid and documented
