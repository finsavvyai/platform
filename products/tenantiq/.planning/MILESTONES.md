# Milestones

## v1.0 Competitor-Parity Launch (Shipped: 2026-04-22)

**Phases completed:** 4 phases, 19 plans
**Requirements:** 31/31 shipped (SSO-01..06, COP-01..06, SNAP-01..03, STOR-01..05, HARD-01..06, E2E-01..05)

**Key accomplishments:**
1. **Enterprise SSO** — SAML 2.0 + OIDC login flow, JIT user/org provisioning, cert expiry alerts (60/30/7d), CSRF state+nonce with 300s KV TTL. Unblocks 75-80% of enterprise deals.
2. **Frontend completions** — DriftSummaryWidget on dashboard, snapshot diff viewer, OversharingPanel + LicenseSummaryPanel on Copilot Readiness, ConsumersTable top-20 + ≥90% quota badges on Storage Analytics.
3. **Storage scanner hardening** — Replaced sequential Graph loops with `chunkArray` + `Promise.allSettled` batches of 10, removed `.slice` hard caps, raised `$top` limits. Storage scan now completes on 100+ user tenants without CPU overrun.
4. **CI security gates** — Release-blocking Semgrep SAST, audit-ci (High/Critical CVE), Gitleaks secret scan; security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) wired into `create-app.ts`.
5. **Org-scope hardening** — `assertOrgId` guard added to 9 cron handlers + 3 queue processors; D1 compound indexes on `(organization_id, created_at)` for 7 high-read tables.
6. **E2E coverage** — Playwright suite runs against `wrangler pages dev` in CI covering MSP login, CIS scan, SSO config, Copilot Readiness flows.

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---

