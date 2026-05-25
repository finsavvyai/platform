> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 9: Enterprise — SSO, Admin Panel & Compliance Export (2 weeks)

## Goal
Enterprise customers can use their own identity provider (Okta, Azure AD),
platform operators have an admin panel, and compliance teams can export
audit logs and reports as PDF/CSV.

## Dependencies
- Sprint 8 complete (RBAC, teams, organizations)

## Tasks

### 9.1 SSO / SAML Integration
- [ ] Create D1 migration:
  ```sql
  CREATE TABLE sso_configs (
    id TEXT PRIMARY KEY,
    orgId TEXT UNIQUE NOT NULL REFERENCES organizations(id),
    provider TEXT NOT NULL, -- 'saml', 'oidc'
    entityId TEXT,          -- SAML entity ID
    ssoUrl TEXT,            -- SAML SSO URL
    certificate TEXT,       -- SAML x509 cert
    oidcClientId TEXT,      -- OIDC client ID
    oidcClientSecret TEXT,  -- OIDC client secret (encrypted)
    oidcIssuer TEXT,        -- OIDC issuer URL
    autoProvision INTEGER DEFAULT 0, -- auto-create users
    defaultRole TEXT DEFAULT 'viewer',
    isActive INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  ```
- [ ] Update Drizzle schema
- [ ] Write migration tests

#### SAML Support
- [ ] Create `apps/api/src/services/saml.ts` (< 200 lines):
  - Parse SAML assertion XML
  - Validate signature against stored certificate
  - Extract user attributes (email, name, groups)
  - Map SAML groups → OpenSyber roles
- [ ] Create `apps/api/src/routes/sso.ts`:
  - `GET /api/sso/:orgSlug/saml/metadata` — SP metadata XML
  - `POST /api/sso/:orgSlug/saml/acs` — assertion consumer service
  - `GET /api/sso/:orgSlug/saml/login` — initiate SAML flow
- [ ] Write tests for SAML assertion parsing and validation

#### OIDC Support
- [ ] Create `apps/api/src/services/oidc.ts` (< 200 lines):
  - OpenID Connect discovery (`.well-known/openid-configuration`)
  - Authorization code flow with PKCE
  - Token exchange and userinfo retrieval
  - Map OIDC claims → OpenSyber user
- [ ] Create OIDC routes in `routes/sso.ts`:
  - `GET /api/sso/:orgSlug/oidc/login` — redirect to IdP
  - `GET /api/sso/:orgSlug/oidc/callback` — handle code exchange
- [ ] Write tests for OIDC flow

#### SSO UI
- [ ] Create `app/dashboard/team/sso/page.tsx`:
  - SSO configuration form (SAML or OIDC)
  - Test connection button
  - Enable/disable toggle
  - Auto-provisioning toggle
  - Default role select
- [ ] Create `components/dashboard/team/SsoConfigForm.tsx`
- [ ] Write component tests

### 9.2 Admin Panel
- [ ] Add `isAdmin` boolean to `users` schema
- [ ] Create `apps/api/src/middleware/admin.ts`:
  - Check `isAdmin` flag on user
  - Return 403 for non-admins
- [ ] Create admin API routes `apps/api/src/routes/admin.ts`:
  - `GET /api/admin/stats` — total users, instances, events, revenue
  - `GET /api/admin/users` — paginated user list with search
  - `GET /api/admin/users/:id` — user detail with instances
  - `PATCH /api/admin/users/:id` — suspend/unsuspend user
  - `GET /api/admin/organizations` — all orgs with member counts
  - `GET /api/admin/instances` — all instances across all users
  - `GET /api/admin/skills` — skill moderation queue
  - `PATCH /api/admin/skills/:id` — approve/reject skill submission
  - `GET /api/admin/billing` — revenue dashboard data
  - `GET /api/admin/events` — system-wide security event stream
- [ ] Write tests for all admin endpoints

#### Admin UI
- [ ] Create `apps/web/src/app/admin/layout.tsx`:
  - Admin sidebar: Dashboard, Users, Organizations, Instances, Skills, Billing, Events
  - Guard: redirect non-admins to `/dashboard`
- [ ] Create admin pages:
  - `/admin` — stats overview (cards + charts)
  - `/admin/users` — user table with search, suspend action
  - `/admin/users/[id]` — user detail with instances list
  - `/admin/organizations` — org table
  - `/admin/instances` — global instance view
  - `/admin/skills` — moderation queue (approve/reject)
  - `/admin/billing` — revenue charts (MRR, churn, upgrades)
  - `/admin/events` — system-wide security event feed
- [ ] Write component tests for admin pages

### 9.3 Compliance Report Export
- [ ] Create `apps/api/src/services/report-export.ts` (< 200 lines):
  - `exportToPdf(reportData)` — generate PDF using @react-pdf/renderer
  - `exportToCsv(reportData)` — generate CSV string
  - Store exports in R2 bucket
  - Return signed R2 URL (expires in 1 hour)
- [ ] Add export endpoints:
  - `GET /api/security/instances/:id/compliance-reports/:reportId/export?format=pdf`
  - `GET /api/security/instances/:id/compliance-reports/:reportId/export?format=csv`
- [ ] Add audit log export:
  - `GET /api/security/instances/:id/audit/export?from=&to=&format=csv`
  - Stream large exports (don't buffer entire dataset)
- [ ] Write tests for PDF/CSV generation

#### Export UI
- [ ] Create `components/dashboard/security/ExportReportButton.tsx`:
  - Dropdown: PDF / CSV
  - Triggers download via signed URL
- [ ] Create `components/dashboard/security/ExportAuditButton.tsx`:
  - Date range picker + format select + Download
- [ ] Add export buttons to compliance and audit pages
- [ ] Write component tests

### 9.4 Extended Compliance Frameworks
- [ ] Add new frameworks to compliance engine:
  - HIPAA (healthcare)
  - GDPR (EU data protection)
  - NIST CSF (cybersecurity framework)
  - PCI-DSS (payment card)
- [ ] Update `ComplianceFramework` type in `packages/shared/`:
  - `'soc2' | 'iso27001' | 'cis' | 'hipaa' | 'gdpr' | 'nist_csf' | 'pci_dss'`
- [ ] Create control mappings for each new framework
- [ ] Update `GenerateComplianceReport` modal with new options
- [ ] Write tests for each new framework scoring

### 9.5 Audit Log Improvements
- [ ] Add `actorId` column to `audit_log` table:
  - Who performed the action (userId, not just systemId)
  - Required for SOC2 CC5.3 compliance
- [ ] Add pagination to all data endpoints:
  - Support `?cursor=&limit=` query params
  - Default limit: 50, max limit: 200
  - Return `{ data, nextCursor, hasMore }`
- [ ] Add date range filtering:
  - Support `?from=&to=` ISO date params
  - Index `created_at` columns for performance
- [ ] Enforce `auditLogRetentionDays` per plan:
  - Cron job: delete audit entries older than retention
  - Free: 3 days, Personal: 7, Pro: 90, Team: 365
- [ ] Write tests for pagination, filtering, retention

## Definition of Done
- [ ] Enterprise org can configure SAML or OIDC SSO
- [ ] SSO users auto-provisioned with correct role
- [ ] Admin panel shows all users, orgs, instances, skills, billing
- [ ] Admins can moderate skill submissions (approve/reject)
- [ ] Compliance reports downloadable as PDF and CSV
- [ ] Audit logs exportable with date range filter
- [ ] 7 compliance frameworks supported
- [ ] All data endpoints support pagination
- [ ] Audit log retention enforced per plan
- [ ] All new code has tests (>80% coverage)

## Estimated Effort
| Task | Days |
|---|---|
| 9.1 SSO (SAML + OIDC + UI) | 3 |
| 9.2 Admin panel (API + UI) | 3 |
| 9.3 Compliance/audit export | 2 |
| 9.4 Extended frameworks | 1 |
| 9.5 Audit log improvements | 1 |
| **Total** | **10 days** |
