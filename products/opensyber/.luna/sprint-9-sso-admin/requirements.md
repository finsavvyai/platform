# Requirements Document

**Scope**: OpenSyber / Sprint 9 — Enterprise SSO, Admin Panel & Compliance
**Date**: 2026-02-28
**Status**: Draft
**Depends on**: Sprint 8 (Enterprise RBAC & Teams) — Complete

---

## 1. Overview

Sprint 9 adds three enterprise capabilities:
1. **SSO**: SAML 2.0 and OIDC identity provider integration per organization
2. **Admin Panel**: Platform-wide administration for operators
3. **Compliance**: Report export (PDF/CSV), 4 new frameworks, audit log improvements

---

## 2. Functional Requirements

### 2.1 SSO — SAML 2.0 & OIDC Integration

**FR-9.1.1** System shall store SSO configuration per organization in `sso_configs` table.

**FR-9.1.2** System shall support SAML 2.0 Service Provider flow:
- Expose SP metadata XML at `GET /api/sso/:orgSlug/saml/metadata`
- Accept IdP assertions at `POST /api/sso/:orgSlug/saml/acs`
- Initiate login at `GET /api/sso/:orgSlug/saml/login`
- Validate XML signature against stored x509 certificate
- Extract email, name, groups from SAML assertion attributes

**FR-9.1.3** System shall support OIDC Authorization Code flow with PKCE:
- Redirect to IdP at `GET /api/sso/:orgSlug/oidc/login`
- Handle callback at `GET /api/sso/:orgSlug/oidc/callback`
- Perform token exchange and userinfo retrieval
- Discover IdP endpoints via `.well-known/openid-configuration`

**FR-9.1.4** SSO auto-provisioning:
- When enabled, create user + org membership on first SSO login
- Use configurable `defaultRole` for new members
- Map IdP groups to OpenSyber roles when group mapping is configured

**FR-9.1.5** SSO UI:
- Configuration form in `/dashboard/team/sso` (admin+ only)
- Toggle between SAML and OIDC provider types
- Test connection button to validate configuration
- Enable/disable toggle (isActive)
- Auto-provisioning toggle with default role select

**FR-9.1.6** SSO routes shall be unauthenticated (IdP callbacks don't carry Clerk tokens). Auth is established by the SSO flow itself.

---

### 2.2 Admin Panel

**FR-9.2.1** System shall support `isAdmin` flag on users table.

**FR-9.2.2** Admin middleware shall:
- Check `isAdmin === true` on the authenticated user
- Return 403 for non-admin users
- Be independent of org-level RBAC (admin is platform-wide)

**FR-9.2.3** Admin API endpoints:
| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/stats` | GET | Platform stats: total users, instances, events, MRR |
| `/api/admin/users` | GET | Paginated user list with search |
| `/api/admin/users/:id` | GET | User detail with instances and orgs |
| `/api/admin/users/:id` | PATCH | Suspend/unsuspend user |
| `/api/admin/organizations` | GET | All orgs with member counts |
| `/api/admin/instances` | GET | All instances across all users |
| `/api/admin/skills` | GET | Skill moderation queue |
| `/api/admin/skills/:id` | PATCH | Approve/reject skill submission |
| `/api/admin/billing` | GET | Revenue dashboard data |
| `/api/admin/events` | GET | System-wide security event stream |

**FR-9.2.4** Admin UI pages:
- `/admin` layout with sidebar, admin-only guard
- Dashboard (stats cards + charts), Users, User Detail, Organizations, Instances, Skills Moderation, Billing, Events
- 8 pages total, each under 200 lines

**FR-9.2.5** Admin user suspension:
- Suspended users cannot log in or make API calls
- Existing instances continue running (no auto-destroy)
- Suspension is reversible (unsuspend action)

---

### 2.3 Compliance Report Export

**FR-9.3.1** System shall export compliance reports as PDF and CSV:
- `GET /api/security/instances/:id/compliance-reports/:reportId/export?format=pdf|csv`
- PDF: formatted report with framework name, score, control results, evidence
- CSV: one row per control with columns: controlId, name, category, status, evidence

**FR-9.3.2** System shall export audit logs as CSV:
- `GET /api/security/instances/:id/audit/export?from=&to=&format=csv`
- Support date range filtering via `from` and `to` ISO date params
- Stream large exports (don't buffer entire dataset in memory)

**FR-9.3.3** Export storage:
- Store generated files in R2 bucket (key: `exports/{reportId}.{format}`)
- Return signed R2 URL with 1-hour expiry
- Clean up exports older than 24 hours via cron

**FR-9.3.4** Export UI:
- `ExportReportButton` component on compliance report cards (PDF/CSV dropdown)
- `ExportAuditButton` component on audit log page (date range picker + format)
- Download triggered via signed URL (browser handles download)

---

### 2.4 Extended Compliance Frameworks

**FR-9.4.1** Add 4 new compliance frameworks:
- HIPAA (healthcare data protection) — 15 controls
- GDPR (EU data protection) — 12 controls
- NIST CSF (cybersecurity framework) — 15 controls
- PCI-DSS (payment card industry) — 12 controls

**FR-9.4.2** Update `ComplianceFramework` type:
```typescript
type ComplianceFramework = 'soc2' | 'iso27001' | 'cis' | 'hipaa' | 'gdpr' | 'nist_csf' | 'pci_dss';
```

**FR-9.4.3** Each framework shall have:
- Named control constants in `packages/shared/src/constants/compliance.ts`
- Evaluation logic in the compliance service
- Framework label and description for UI display

**FR-9.4.4** Update DB `complianceReports.framework` column to accept new values.

**FR-9.4.5** Update `GenerateComplianceReport` modal to show all 7 frameworks.

---

### 2.5 Audit Log Improvements

**FR-9.5.1** Add `actorId` column to `audit_log` table:
- Records which user/system performed the action
- Required for SOC2 CC5.3 compliance
- Backfill existing rows with `'system'` default

**FR-9.5.2** Cursor-based pagination on all data list endpoints:
- Query params: `?cursor=&limit=` (default 50, max 200)
- Response format: `{ data, nextCursor, hasMore }`
- Apply to: audit log, security events, instances, users (admin)

**FR-9.5.3** Date range filtering:
- Query params: `?from=&to=` (ISO 8601 date strings)
- Apply to: audit log, security events, compliance reports
- Add index on `created_at` columns for query performance

**FR-9.5.4** Audit log retention enforcement:
- Cron job deletes entries older than plan retention limit
- Free: 3 days, Personal: 7 days, Pro: 90 days, Team: 365 days
- Run daily via Cloudflare scheduled handler

---

## 3. Non-Functional Requirements

**NFR-9.1** All new files under 200 lines (CLAUDE.md constraint).

**NFR-9.2** SAML certificate and OIDC client secret encrypted at rest (AES-GCM).

**NFR-9.3** SSO callback endpoints must complete within 5 seconds (IdP timeout).

**NFR-9.4** PDF generation must work in Cloudflare Workers runtime.

**NFR-9.5** Admin endpoints must not expose user credentials, tokens, or secrets.

**NFR-9.6** All new code must have corresponding test files (>=80% coverage).

**NFR-9.7** Audit log export must handle 100K+ rows without OOM (streaming).

**NFR-9.8** SSO endpoints must validate SAML response signatures to prevent assertion forgery.

---

## 4. Security Requirements

**SEC-9.1** SAML assertions must be signature-validated before trusting attributes.

**SEC-9.2** OIDC `state` parameter must use cryptographic nonce to prevent CSRF.

**SEC-9.3** OIDC client secrets must be encrypted before storage (same pattern as gateway tokens).

**SEC-9.4** Admin panel must be behind `isAdmin` check — no RBAC bypass via org roles.

**SEC-9.5** Admin actions must be audit-logged (who suspended which user, when).

**SEC-9.6** Export signed URLs must be time-limited (1 hour) and not guessable.

**SEC-9.7** SSO routes must validate `orgSlug` exists and has active SSO config before processing.

**SEC-9.8** Rate limit SSO endpoints (10 requests/minute per org) to prevent brute force.

---

## 5. Test Requirements

| Category | Coverage Target | Scope |
|---|---|---|
| SAML parsing & validation | 100% | services/saml.ts |
| OIDC flow & token exchange | 100% | services/oidc.ts |
| Admin middleware | 100% | middleware/admin.ts |
| Admin API endpoints | >=90% | routes/admin-*.ts |
| Compliance export (PDF/CSV) | >=90% | services/report-export.ts |
| New framework controls | 100% | constants/compliance-*.ts |
| Audit log pagination | >=90% | routes/security-dashboard.ts |
| SSO route handlers | >=90% | routes/sso-*.ts |
| SSO UI components | >=80% | components/team/SsoConfigForm |
| Admin UI pages | >=80% | app/admin/* |
