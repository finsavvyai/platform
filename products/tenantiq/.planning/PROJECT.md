# TenantIQ — Launch-Ready Milestone

## What This Is

TenantIQ is an AI-powered Microsoft 365 security, compliance, and cost intelligence SaaS for MSPs. It provides real-time anomaly detection, CIS benchmark automation, skill-based remediation, and multi-tenant management — competing directly with CoreView, Syskit Point, and BetterCloud. The product is ~76% built; this milestone closes the remaining gaps to reach full competitive parity and production readiness for Q2 2026 launch.

## Core Value

MSPs can monitor, secure, and optimize every customer's M365 tenant from a single AI-native dashboard — without needing a per-user license or Global Admin every time.

## Requirements

### Validated

- ✓ Core dashboard (7 sections, 27 sidebar links) — existing
- ✓ Microsoft Graph integration (users, licenses, security score) — existing
- ✓ CIS benchmark automation (100+ controls, auto-remediation) — existing
- ✓ Email security analysis (threat detection, auth configuration) — existing
- ✓ Anomaly detection (AI-powered behavior analysis) — existing
- ✓ User lifecycle workflows (10 Graph actions) — existing
- ✓ Skill marketplace (20 skills: backup, compliance, cost optimization) — existing
- ✓ Multi-tenant architecture with RBAC — existing
- ✓ Billing integration (LemonSqueezy) — existing
- ✓ Config snapshot capture (client_credentials Graph flow) — existing
- ✓ Drift detection (baseline comparison, KV storage) — existing
- ✓ Platform admin panel (credential management, manual cron triggers) — existing
- ✓ Full test suite (1169 tests passing, 133 test files) — existing
- ✓ Enterprise SAML/OIDC SSO (per-org config, JIT provisioning, cert expiry monitor) — v1.0
- ✓ Copilot Readiness Assessment (M365 scan, readiness %, PDF export, license summary) — v1.0
- ✓ Config Snapshot diff viewer + drift summary widget on dashboard — v1.0
- ✓ Drift alerts surfaced in main alerts feed with snapshot diff link — v1.0
- ✓ Storage Analytics (OneDrive/SharePoint, top-20 consumers, ≥90% quota badge) — v1.0
- ✓ Storage scanner chunked parallel batching (fixes CPU limit on 100+ user tenants) — v1.0
- ✓ Production hardening (security headers, org-scope assertions, D1 compound indexes) — v1.0
- ✓ E2E test coverage (Playwright — MSP login, CIS scan, SSO, Copilot Readiness) — v1.0
- ✓ CI/CD pipeline hardening (Semgrep SAST, audit-ci, Gitleaks, merge gates) — v1.0

### Active

(None — v1.0 shipped; next milestone scope TBD via `/gsd:new-milestone`)

### Out of Scope

- Native mobile app — web-first, mobile post-launch
- Real-time Teams/Slack bot — post-launch phase
- Self-hosted / on-premises deployment — cloud-only SaaS
- Google Workspace integration — M365 focus for v1

## Context

**Stack:** Cloudflare Workers + Hono API, D1 SQLite (15 tables), KV, SvelteKit 5 frontend, Anthropic Claude AI, Microsoft Graph SDK, LemonSqueezy billing.

**Competitors:**
- **CoreView** — enterprise M365 governance, strong reporting, expensive, no AI
- **Syskit Point** — SharePoint/Teams focus, good UX, limited MSP features
- **BetterCloud** — SaaS ops platform, broad but M365 shallow, high cost

**Differentiators:** AI-native analysis, MSP-first pricing (per-skill not per-user), client_credentials daemon access (no per-customer Global Admin session required).

**Auth model:** Cookie-based sessions (HttpOnly), Microsoft OAuth, custom JWT (jose HS256). Refresh endpoint returns `{ ok: true }` + Set-Cookie (no token in body).

**Deployment:** `cd apps/api && npx wrangler deploy` (pushci). Web via Cloudflare Pages.

**Live tenant:** remit.co.il connected via client_credentials. First snapshot captured Apr 20 2026. Daily cron running.

## Constraints

- **Tech Stack**: Cloudflare Workers (edge-only, no Node.js APIs) — all runtime code must be Workers-compatible
- **File Size**: Max 200 lines per file (portfolio rule) — split on violation
- **Coverage**: 100% on auth/payments/permissions, ≥90% line overall, ≥85% branch
- **Timeline**: Q2 2026 launch target
- **Security**: SAST + dependency scan + secret scan on every PR, block on Critical/High

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| client_credentials Graph flow | Daemon access without per-customer refresh token | ✓ Good — working in production |
| Cookie-based auth (no token in URL) | XSS safety, no localStorage exposure | ✓ Good — deployed |
| D1 raw SQL over Drizzle ORM | Admin cron queries failed with Drizzle; raw SQL reliable | ✓ Good |
| Per-skill MSP pricing | Differentiates from CoreView/BetterCloud per-user pricing | — Pending market validation |
| SvelteKit 5 + Svelte 5 runes | Latest framework, best DX for reactive dashboard | ✓ Good |
| jose HS256 JWT + KV nonce (300s TTL) for SSO CSRF | Workers-compatible, no xmldom dep needed for OIDC | ✓ Good — v1.0 |
| `Promise.allSettled` + chunkArray(10) for Graph scans | Prevents Workers CPU overrun on 100+ user tenants without losing partial results | ✓ Good — v1.0 |
| `assertOrgId` helper in every cron/queue handler | Eliminates class of multi-tenant scope bugs at compile-time | ✓ Good — v1.0 |
| CI release-blocking: Semgrep + audit-ci + Gitleaks | Security per portfolio rule; block on Critical/High | ✓ Good — v1.0 |

---
*Last updated: 2026-04-22 after v1.0 Competitor-Parity Launch milestone*
