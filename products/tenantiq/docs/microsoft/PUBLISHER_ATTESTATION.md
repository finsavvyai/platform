# Microsoft 365 Publisher Attestation — Pre-filled Answers

For Partner Center → Cloud Partner Program → M365 App Compliance → Attestation.

Last updated: 2026-05-08
Status: **Ready to submit once Partner Center account is created.**

Each answer cites a verifiable source: file path, command, or live URL. Reviewer can spot-check.

---

## A. Application identity

### A1. Application name
TenantIQ

### A2. Microsoft Entra app ID
`<set from Azure portal → App registrations → TenantIQ overview>`

### A3. App description
> AI-native Microsoft 365 control plane for managed service providers (MSPs). Audits CIS Benchmark across many customer tenants, detects configuration drift attributed to specific actors, runs source-pinned auto-fix recipes with anomaly-watch rollback, and exposes posture data to AI clients via Model Context Protocol (MCP).

### A4. Categories
Security; Productivity; Compliance.

### A5. Customer-facing documentation URL
https://app.tenantiq.app/changelog
https://app.tenantiq.app/ciso-demo
https://app.tenantiq.app/support

---

## B. Data handling

### B1. What customer data does the app store?

Microsoft 365 metadata pulled via Graph API: tenant-scoped user lists, license assignments, security alerts, mailbox rules, conditional access policies, audit log entries, configuration snapshots. **No mailbox content, no file content, no chat messages.**

Source: `packages/db/src/schema-d1.ts` defines the 34 tables. Fields include `tenant_id`, `org_id`, `user_principal_name`, `display_name`, `risk_signal`, `policy_id`, `event_type`, etc.

### B2. Where is data stored?

Cloudflare D1 (SQLite-on-edge), region: distributed across Cloudflare's global edge with primary writes to `wnam` (Western North America). Cloudflare KV for cached tokens + JTI deny-list. Cloudflare R2 for snapshot exports + PDF reports.

Source: `apps/api/wrangler.toml` — D1 binding `tenantiq-production`, KV binding, R2 binding.

### B3. How is data encrypted?
- **At rest**: Cloudflare D1 + KV + R2 — AES-256 at the storage layer (Cloudflare-managed).
- **In transit**: TLS 1.3 enforced. HSTS header set with `max-age=31536000; includeSubDomains; preload`.
- **Application-layer**: secrets stored as Wrangler secrets (AAD app secret, AI API keys, marketplace credentials). Never written to D1.

Source: `apps/api/wrangler.toml` for binding configs; `apps/web/src/routes/+layout.svelte` headers; `apps/api/src/middleware/security-headers.ts`.

### B4. Data retention policy
- Tenant config snapshots: 90 days rolling, exportable to R2 for longer retention by customer.
- Audit logs: 1 year (configurable per tenant).
- KV-cached tokens: max 1 hour.
- Marketplace events: 90 days (`expirationTtl: 90 * 86400` in `apps/api/src/routes/marketplace.ts`).

### B5. Data deletion on customer request

GDPR Art. 17 / M365 Cert C7 fully implemented. `DELETE /api/account` triggers a 33-table cascade — verified by drift-resistant contract test.

Source: `apps/api/src/lib/account-deletion.ts` (~160 LOC). Test: `apps/api/src/lib/account-deletion-cascade.test.ts` asserts `deleteOrganization` hits exactly 33 tables.

### B6. Sub-processor list
Maintained at `app.tenantiq.app/privacy`. Drift between code and disclosed sub-processors caught in CI by `scripts/check-cert-drift.ts`. Current sub-processors: Cloudflare (compute, storage, edge), Anthropic (AI inference), Resend (email), LemonSqueezy (legacy billing — being deprecated for AppSource Marketplace), Sentry (error tracking, PII-scrubbed).

---

## C. Identity & access management

### C1. How are users authenticated?
Microsoft OAuth 2.0 against Entra ID. JWT issued internally with HS256 + RS256 dual-algorithm fallback, includes `iss=tenantiq.app` and `aud=tenantiq-api` claims (verified server-side). JWT IDs (JTI) tracked in a deny-list KV namespace for revocation.

Source: `apps/api/src/routes/auth.ts`, `apps/api/src/routes/auth-session.ts`, `apps/api/src/middleware/auth.ts`.

### C2. Multi-factor authentication
Customer's M365 admin account inherits M365's MFA settings (we don't bypass them). For MSP staff signing in directly to TenantIQ, WebAuthn (passkeys) supported as a second factor.

Source: `apps/api/src/routes/auth-webauthn-register.ts`, `apps/api/src/routes/auth-webauthn-auth.ts`.

### C3. RBAC model
Five roles enforced server-side: `platform_admin`, `super_admin`, `tenant_admin`, `tenant_engineer`, `contractor`. Every D1 query is org-scoped via `tenantScopingMiddleware` (`WHERE org_id = ?`).

Source: `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/tenant-scoping.ts`.

### C4. Privileged access
Platform-admin tier-grant operations are audit-logged. SCIM 2.0 endpoints for automated user provisioning from MSP's IDP. SAML / OIDC SSO for enterprise tier.

Source: `apps/api/src/routes/scim/users.ts`, `apps/api/src/routes/scim/groups.ts`, `apps/api/src/routes/sso-login.ts`, `apps/api/src/routes/sso-callback.ts`.

### C5. Session management
HttpOnly + Secure + SameSite=Lax session cookie named `tenantiq_session`. Token revocation on logout via JTI deny-list (KV-backed). No local-storage of session secrets — verified by grep across `apps/web/src/`.

---

## D. Application security

### D1. Secure SDLC
- Strict TypeScript + Drizzle ORM (no string concat for SQL).
- Zod schema validation on all API inputs.
- File-size cap of 200 lines enforced via `scripts/check-max-lines.sh`.
- Pre-commit and pre-push hooks run lint + typecheck + tests.

### D2. Code review
- All commits to `main` go through CI (lint, typecheck, 1590+ unit tests).
- `.luna/tenantiq/no-bluf-report.md` auto-audits each commit's claims against actual code.
- Daily smoke against production via GitHub Actions `cert-status.yml`.

### D3. Dependency vulnerability scanning
- `npm audit` runs in CI on every PR.
- Dependabot enabled.
- License compliance check.

### D4. Static analysis
ESLint + TypeScript strict mode. Cloudflare Workers static-analysis happens at deploy time via Wrangler.

### D5. Secret scanning
GitHub secret scanning enabled on the repo. Pre-commit hook blocks commits containing `BEGIN PRIVATE KEY` patterns. Production secrets stored as Wrangler secrets, never in code.

### D6. SSRF protection
Outbound fetches go through `apps/api/src/lib/ssrf-guard.ts` which blocks RFC1918 + link-local + AWS metadata IPs.

### D7. Rate limiting
KV-backed rate limiter on public surfaces: prospect scan = 5/hr/IP, OpenAPI endpoint, MCP public endpoint. Bucket key: `${prefix}:${ip}`. Source: `apps/api/src/lib/rate-limit.ts`.

### D8. Audit logging
Tamper-evident logging: every auth event, admin action, and sensitive data mutation writes to `audit_logs` table with ISO-timestamped, append-only design. JTI revocations logged. Marketplace events logged with operation ID.

Source: `apps/api/src/lib/audit-logger.ts`.

---

## E. Operational security

### E1. Monitoring & alerting
Cloudflare Analytics for performance/uptime. Sentry for error tracking with PII scrubbing (`apps/api/src/lib/sentry.ts`).

### E2. Incident response runbook
- Daily prod smoke via GitHub Actions
- Sentry alerts on error rate > threshold
- Status page: (TODO — currently single-vendor, dual-vendor planned)

### E3. Backup & disaster recovery
D1 has automatic point-in-time recovery (Cloudflare-managed). KV durability is regional with cross-region replication on the roadmap. Snapshot exports in R2 are versioned.

### E4. Business continuity
TenantIQ is a stateless edge worker — region failover is automatic via Cloudflare's global anycast network. RPO ~5 min (D1 PITR window). RTO ~10 min for planned cutover.

### E5. Change management
All production changes go through git → CI → deploy. Wrangler deploy creates an immutable version with rollback capability (`wrangler rollback`).

### E6. Vendor management
Sub-processors are explicitly listed at `/privacy`. Adding a new outbound vendor requires updating that page; CI fails on drift.

---

## F. Compliance frameworks claimed

- **SOC 2 Type 1**: In flight Q3 2026 (Vanta-managed evidence collection).
- **ISO 27001:2022 Annex A**: 25 telemetry-evaluable controls implemented; engine at `apps/api/src/lib/iso27001/`. 68 organisational controls out of scope (these are policy/process, not engineering).
- **GDPR**: Art. 17 cascade contract test. DSAR endpoint at `/api/account/export` (TODO — currently stub).
- **HIPAA**: BAA-ready on Enterprise tier. Audit logs sufficient for HIPAA technical controls.
- **CIS Benchmark v3.1**: We implement the customer-facing scanner. We are not ourselves a CIS-Certified vendor — we use CIS Benchmark as the standard against which we audit customer M365 tenants.

---

## G. Microsoft Graph permissions requested

Each permission has a customer-facing justification. Customers see this list in admin consent.

| Permission | Type | Why TenantIQ needs it |
|---|---|---|
| User.Read | Delegated | Identify the signed-in admin |
| User.Read.All | Application | Enumerate tenant users for CIS audit |
| Directory.Read.All | Application | Read groups, roles, organizational policies |
| Group.Read.All | Application | Audit group membership for stale guests, dynamic group integrity |
| Policy.Read.All | Application | Audit conditional access + authentication policies (CIS controls) |
| AuditLog.Read.All | Application | Drift attribution from `directoryAudits` |
| SecurityEvents.Read.All | Application | Pull Defender alerts for cross-tenant rollup |
| Reports.Read.All | Application | Storage analytics, copilot usage |
| MailboxSettings.Read | Application | Mailbox rule auditor (BEC indicators) |
| Application.Read.All | Application | Federated identity auditor — workload identities |
| DelegatedAdminRelationship.ReadWrite.All | Delegated | GDAP — create + manage delegated admin relationships from inside TenantIQ |
| Marketplace.SubscriptionsApi | Application (subscription identity) | AppSource transactable offer validation |

All permissions documented at `app.tenantiq.app/privacy` with the same justifications. Drift between consent screen and disclosed list caught by `scripts/check-cert-drift.ts`.

---

## H. Honesty discipline

This is unusual to call out, but it's load-bearing for TenantIQ:

- **No-bluf scans** in `.luna/tenantiq/no-bluf-report.md` — every commit's claims verified against code. AI-generated marketing copy is auto-flagged.
- **Empty-state policy** — functions return `[]` when historical data is unavailable, never `Math.random()` synthetic metrics. This was a deliberate honesty pass on 2026-05-02 that removed 9 fabricated-metric fallbacks.
- **Public changelog** driven by `git log` — not handwritten. Customers (and reviewers) can verify shipped vs claimed.

This isn't a Microsoft attestation question, but it's the operating principle. We answer questions accurately; we'd rather lose a deal than mis-state our posture.

---

## I. Submission checklist

- [ ] Microsoft Entra app ID inserted in A2 (after app registration)
- [ ] Phone number for support contact
- [ ] Phone number for engineering contact
- [ ] Microsoft Entra tenant ID for marketplace technical config
- [ ] AppSource AAD app ID + secret stored as Wrangler secrets:
  - [ ] `MARKETPLACE_PUBLISHER_TENANT_ID`
  - [ ] `MARKETPLACE_AAD_APP_ID`
  - [ ] `MARKETPLACE_AAD_APP_SECRET`
- [ ] DNS TXT record for `tenantiq.app` for publisher domain verification
- [ ] D-U-N-S number applied for (gates Partner Center publisher verification)
- [ ] DPA template ready (Microsoft provides one in Standard Contract)
- [ ] Pen test report scheduled (gates Phase 5 M365 Cert)
- [ ] Vanta evidence collection started (gates Phase 4 SOC 2)

This document is the answer key. Paste each answer into the Partner Center form fields directly.
