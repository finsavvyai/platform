# Partner Center Submission — Copy-Paste Pack

> Pre-drafted answers for Microsoft Partner Center forms.
> Paths covered: **Publisher Verification → AppSource listing → M365 Certification (L1)**.
> Last updated: 2026-04-30. Each answer includes the docs/ evidence file the auditor will request.

---

## 0. Pre-flight checklist

- [ ] MPN ID registered (`partner.microsoft.com` — Account → Identifiers).
- [ ] Verified domain (`tenantiq.app`) ownership via Partner Center DNS TXT record.
- [ ] Tax + payment profiles complete.
- [ ] Publisher agreement + AI Cloud Partner Program agreement accepted.
- [ ] Two-step verification on the Partner Center primary account.

---

## 1. Publisher Verification

**Legal entity name**: TenantIQ Inc.
**Country of incorporation**: [TO FILL]
**MPN ID**: [TO FILL]
**Verified domain**: tenantiq.app
**Primary contact**: [TO FILL] — also the security responder per `docs/VULNERABILITY_DISCLOSURE.md`.

**Brief description (≤300 chars)**:
> AI-powered Microsoft 365 security, compliance, and cost intelligence for MSPs and IT teams. Real-time anomaly detection, CIS benchmark automation, and skill-based remediation across users, licenses, and data-protection posture.

---

## 2. AppSource listing

### Categories
- **Primary**: Security
- **Secondary**: IT Management, Analytics

### Industries
- IT Services, Healthcare, Finance, Education, Government

### Short description (≤100 chars)
> AI-driven M365 security, compliance, and cost monitoring built for MSPs.

### Long description (≤3000 chars)

> TenantIQ is a multi-tenant Microsoft 365 control plane that gives MSPs and IT teams continuous visibility into security posture, compliance drift, license waste, and operational risk across every tenant they manage.
>
> **What it does**
> - **CIS benchmark automation** — runs the M365 Foundations benchmark on demand or on a schedule, flagging non-compliant configurations against 100+ controls.
> - **Conditional Access + identity audit** — surfaces missing MFA, privileged-role exposure, sign-in anomalies, risky users, and external collaboration leaks.
> - **Email + Defender posture** — monitors mail-flow rules, anti-phishing settings, secure-score trend, and Defender alerts.
> - **Cost optimization** — detects unused licenses, idle accounts, and license-tier misalignment.
> - **AI-assisted remediation** — explains each finding, suggests the exact remediation, and (for safe controls) auto-applies the fix with full audit trail.
> - **Skill marketplace** — pluggable automation skills for backup, lifecycle workflows, and compliance reports.
>
> **For whom**
> MSPs who manage 5–500 tenants and need a single pane that scales without a per-user license model.
>
> **What it doesn't do**
> TenantIQ never reads mailbox contents, file contents, or chat messages. It only inspects configuration, identity, and security signals via Microsoft Graph delegated permissions. See the public [Privacy Policy](https://app.tenantiq.app/privacy), [Terms of Service](https://app.tenantiq.app/terms), and `.well-known/security.txt`.

### Logo + screenshots
- Logo: 216×216 PNG, transparent — `apps/web/static/icons/`
- Marketing assets: `landing-page/deploy/` (1280×720, 1920×1080)

### Pricing model
Per-tenant volume pricing, MSP-tier discounts. Stripe-equivalent via LemonSqueezy. See `docs/PRICING_STRATEGY.md`.

---

## 3. Microsoft 365 Certification — App Profile

### A. Architecture

> The TenantIQ control plane is hosted entirely on Cloudflare's global edge.
>
> **Compute**: Cloudflare Workers (V8 isolates) — `tenantiq-api` (Hono) and `tenantiq-web` (SvelteKit on Pages). No VMs, no containers, no shared kernels with customer data.
>
> **Storage**: Cloudflare D1 (SQLite, native encryption at rest), Workers KV (sessions + tokens), R2 (exports + backups).
>
> **External calls**: Microsoft Graph (per-tenant delegated OAuth), Anthropic (AI), Resend (email), Twilio (SMS), LemonSqueezy (billing), Sentry (error capture).
>
> **Identity**: Microsoft Entra ID via OAuth2 authorization-code flow. Self-issued JWT session signed RS256 (HS256 fallback for in-flight tokens during rotation). Public JWKS at `https://api.tenantiq.app/api/.well-known/jwks.json`.
>
> Diagrams + per-boundary STRIDE: `docs/THREAT_MODEL.md`, `docs/DATA_FLOW.md`.

### B. Authentication & authorization

- **End-user auth**: Microsoft Entra ID delegated OAuth (work/school accounts). State + nonce CSRF on the redirect; id_token cryptographically verified against Microsoft's per-tenant JWKS with audience + nonce check (`apps/api/src/lib/azure-id-token.ts`).
- **Session**: HttpOnly + Secure + SameSite=Lax cookie issued via short-lived xcode envelope POSTed to `/api/auth/exchange`. 24h TTL. RS256 signed; pubkey published.
- **Authorization**: every D1 query is `WHERE org_id = ?` or `WHERE tenant_id = ?`. RBAC enforced via `requireRole` middleware (`super_admin`, `admin`, `member`, `viewer`).
- **Server-to-server**: SCIM 2.0 endpoints accept long-lived Bearer tokens from the customer's IdP; CSRF middleware skipped for that path.

### C. Data handling

- **Classification scheme**: 4-tier (Public / Internal / Confidential / Restricted). Mapped per D1 table, KV prefix, R2 prefix in `docs/DATA_CLASSIFICATION.md`.
- **PII inventory**: only customer admin email + Azure OID + display name persisted. End-user PII (cached from the customer's tenant) lives under `users_cache` and is the customer's own data per the DPA.
- **Encryption at rest**: Cloudflare-native for all stores. Graph refresh tokens additionally wrapped in app-layer AES-256-GCM via `GRAPH_TOKEN_KEK` (`apps/api/src/lib/graph-token-store.ts`).
- **Encryption in transit**: TLS 1.3 via Cloudflare; HSTS `max-age=31536000; includeSubDomains` (preload pending).
- **Retention**: per-category schedule in `docs/DATA_RETENTION.md`.
- **Deletion**: `DELETE /api/account` (immediate hard-delete) or 30-day grace via `deleted_at` flag set on subscription expiry. Cascade reaches D1 (33 tables), KV (graph/session/consent prefixes), R2 (`exports/{org}/`, `snapshots/{org}/`, `reports/{org}/`). See `docs/DATA_DELETION.md`.
- **Portability**: `GET /api/account/export` (GDPR Art. 15) returns org + members + tenants in JSON.

### D. Microsoft Graph permissions

Full per-scope justification table in `docs/GRAPH_PERMISSIONS.md`. Submission narrative per scope follows the template:

> **Scope**: `<scope>` — **Feature**: `<UI route>` — **Data accessed**: `<minimal field list>` — **Storage**: `<D1 table or "computed on demand">` — **Why required**: `<one sentence>` — **Lower-priv considered**: `<scope or workaround>` — `<why insufficient>`

Pre-filled rows (top-priority):

- `User.Read` — Sign-in identity for the dashboard avatar. Read-only, no storage. — *No lower-priv option (required for OIDC).*
- `User.Read.All` — User inventory + lifecycle workflows on `/workflows/lifecycle`. Stored in `users_cache`. — *`User.ReadBasic.All` insufficient: needs department/manager fields for governance reports.*
- `User.ReadWrite.All` — Lifecycle remediation (disable account, reset MFA). Gated to paid plans. Audit-logged. — *Required for write actions.*
- `Group.Read.All` / `Group.ReadWrite.All` — Group audits and lifecycle remediation in governance dashboards. — *Group.Read.All insufficient when remediation is enabled.*
- `Directory.Read.All` — Tenant metadata + role assignments for the overview page. — *No lower-priv equivalent.*
- `Policy.Read.All` / `Policy.ReadWrite.ConditionalAccess` — CIS scanner reads CA policies; remediation flips on Block-Legacy-Auth and similar. — *Read.All cannot remediate.*
- `SecurityEvents.Read.All`, `IdentityRiskEvent.Read.All`, `IdentityRiskyUser.Read.All` — Alerts feed + behavior analytics. — *Required for risk surfaces.*
- `AuditLog.Read.All` — Sign-in & audit logs for compliance reports. — *Required by audit feature.*
- `MailboxSettings.Read` — Mailbox config audit (forwarding rules, etc.). Read-only. — *No lower-priv equivalent.*
- `Sites.Read.All` — SharePoint/OneDrive sharing audit. **Metadata only, never document content.** — *Files.Read.All would be over-privileged.*
- `Reports.Read.All` — Activity & Copilot readiness reports. — *Required.*
- `InformationProtectionPolicy.Read` — Sensitivity label inventory. — *`.ReadWrite.All` does not exist as delegated (see `docs/GRAPH_PERMISSIONS.md` note on AADSTS650053).*
- `CrossTenantInformation.ReadBasic.All` — External-tenant risk surfacing in collaboration audit. — *Required.*

### E. Security controls

- **SAST**: Semgrep on every PR (`.github/workflows/security.yml`).
- **DAST**: OWASP ZAP baseline on push to main against staging.
- **Dependency scan**: `pnpm audit --audit-level=high` blocks on Critical/High.
- **Secret scan**: TruffleHog + Gitleaks.
- **License compliance**: blocks GPL family in release artifacts.
- **Pen test**: external — scheduled.
- **Security headers**: CSP, HSTS, nosniff, frame-deny, referrer-policy, permissions-policy. See `apps/api/src/middleware/security-headers.ts`.
- **Sentry PII scrubber**: rule list + auditor narrative in `docs/SENTRY_SCRUBBING.md`.
- **Rate limiting**: per-route, KV-backed (`apps/api/src/middleware/ratelimit.ts`).
- **Webhook integrity**: HMAC-SHA256 + ±5min replay window (TokenForge `X-TF-Timestamp`, OpenClaw `payload.timestamp`); idempotency via KV digest 7-day TTL (LemonSqueezy — vendor doesn't sign timestamp).

### F. Operations

- **Logging**: structured JSON logs via Cloudflare observability + Sentry (`SENTRY_DSN` configured).
- **Audit logs**: `audit_logs` D1 table; `writeAuditLog` (`apps/api/src/lib/audit-logger.ts`) at 10 use sites + `logAdminAction` across the platform admin routes for state-changing actions.
- **Backups**: D1 nightly export to R2 `backups/d1/<date>.sql`, 30-day retention.
- **DR**: per-failure-domain runbook in `docs/DR_RUNBOOK.md`. RTO 4h, RPO 24h.
- **Incident response**: SEV matrix + customer-notification clock in `docs/INCIDENT_RESPONSE.md`. GDPR 72h timer wired to legal/comms templates.
- **Business continuity**: sub-processor outage scenarios + single-founder fallbacks in `docs/BUSINESS_CONTINUITY.md`.
- **Patch management**: Dependabot/Renovate weekly; SLA Critical 14d / High 30d (`docs/SDLC.md`).

### G. Sub-processors

Public list at `docs/SUB_PROCESSORS.md`. 30-day customer notice before adding a new one (DPA Art. 28.4).

| Vendor | Purpose | Region | DPA |
|---|---|---|---|
| Cloudflare | hosting (Workers/D1/KV/R2/Pages) | global edge | ✅ |
| Microsoft | Graph API integration | tenant region | ✅ via MSPA |
| Anthropic | AI analysis | US | ✅ |
| Resend | transactional email | US | ✅ |
| Twilio | SMS alerts | US | ✅ |
| LemonSqueezy | billing | US/EU | ✅ |
| Sentry | error capture | US | ✅ (with PII scrubber) |

### H. Public references

- Privacy Policy — https://app.tenantiq.app/privacy
- Terms of Service — https://app.tenantiq.app/terms
- Vulnerability Disclosure — `docs/VULNERABILITY_DISCLOSURE.md` + `https://app.tenantiq.app/.well-known/security.txt`
- DPA — `docs/DPA.md` (executable on request to legal@tenantiq.app)
- Sub-processors — `docs/SUB_PROCESSORS.md`
- Data Retention — `docs/DATA_RETENTION.md`
- Data Deletion procedure — `docs/DATA_DELETION.md`

---

## 4. Evidence package — auditor pull list

For Cert L1 review, the auditor downloads (or we attach):

1. `docs/MS_CERTIFICATION.md` — control-by-control status matrix
2. `docs/THREAT_MODEL.md` — STRIDE per trust boundary
3. `docs/DATA_FLOW.md` — diagram + PII inventory
4. `docs/DATA_CLASSIFICATION.md` — 4-tier scheme + table-by-table mapping
5. `docs/DATA_RETENTION.md` + `docs/DATA_DELETION.md`
6. `docs/SDLC.md` — secure-development lifecycle
7. `docs/INCIDENT_RESPONSE.md`
8. `docs/DR_RUNBOOK.md` + `docs/BUSINESS_CONTINUITY.md`
9. `docs/VULNERABILITY_DISCLOSURE.md`
10. `docs/SENTRY_SCRUBBING.md`
11. `docs/GRAPH_PERMISSIONS.md`
12. `docs/SUB_PROCESSORS.md`
13. CI security pipeline summary — `.github/workflows/security.yml` last 90-day run history
14. Pen test report (when complete)
15. **Optional**: SOC 2 Type II report (when available)

## 5. Known gaps (be honest with the reviewer)

- **No external pen test yet** — engagement scheduled, target completion before submission.
- **No SOC 2** — Type I drafted, Type II requires 6 months of operating evidence; not blocking L1.
- **No KV cross-region replication** — Cloudflare native durability accepted; documented in DR.
- **Status page on Cloudflare-hosted infra** — single-vendor; mitigation is the email + Resend (separate provider) comms path. Cross-vendor status page is a backlog item.

Disclosing these up front beats the auditor finding them.
