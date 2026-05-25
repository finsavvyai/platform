# Implementation Plan

**Scope**: OpenSyber / Sprint 9 — Enterprise SSO, Admin Panel & Compliance
**Generated**: 2026-02-28
**Based on**: design.md, requirements.md

---

## Overview

Sprint 9 adds enterprise capabilities across 5 work areas: SSO (SAML + OIDC), Admin Panel, Compliance Export, Extended Frameworks, and Audit Log Improvements. Implementation is structured in 6 phases with strict dependency ordering: foundation first (schema, types, migration), then services, routes, frontend, and finally integration testing.

## Implementation Phases

| Phase | Name | Tasks | Est. Days |
|---|---|---|---|
| 1 | Foundation (Schema + Types + Migration) | 1.1 — 1.7 | 1 |
| 2 | Services (SAML, OIDC, Export, Retention) | 2.1 — 2.5 | 2 |
| 3 | Backend Routes (SSO, Admin, Export) | 3.1 — 3.10 | 3 |
| 4 | Frontend (SSO UI, Admin Panel, Export UI) | 4.1 — 4.12 | 3 |
| 5 | Testing & Polish | 5.1 — 5.5 | 1 |

## Prerequisites

- [x] Sprint 8 complete (RBAC, teams, organizations)
- [x] All tests passing, typecheck green
- [ ] `fast-xml-parser` dependency installed (for SAML)

---

## Task List

### Phase 1: Foundation (Schema + Types + Migration)

---

- [x] **1.1 Create SSO types in shared package**
  - **Description**: Create `packages/shared/src/types/sso.ts` with `SsoConfig`, `SsoProvider`, `SamlConfig`, `OidcConfig`, `CreateSsoConfigInput`, `UpdateSsoConfigInput` interfaces. Update barrel export.
  - **Files**:
    - Create: `packages/shared/src/types/sso.ts`
    - Modify: `packages/shared/src/types/index.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `SsoProvider` type: `'saml' | 'oidc'`
    - [ ] `SsoConfig` interface matches DB schema
    - [ ] Input types for create/update operations
    - [ ] Re-exported from barrel

---

- [x] **1.2 Create admin types in shared package**
  - **Description**: Create `packages/shared/src/types/admin.ts` with `AdminStats`, `AdminUserDetail`, `AdminBillingData`, `SkillModerationItem` interfaces. Update barrel export.
  - **Files**:
    - Create: `packages/shared/src/types/admin.ts`
    - Modify: `packages/shared/src/types/index.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `AdminStats`: totalUsers, totalInstances, totalEvents, mrr
    - [ ] `AdminUserDetail`: user fields + instances + orgs
    - [ ] `SkillModerationItem`: skill fields + submitter + status
    - [ ] Re-exported from barrel

---

- [x] **1.3 Expand ComplianceFramework type and add new framework constants**
  - **Description**: Update `ComplianceFramework` type in `packages/shared/src/types/security.ts` to include 4 new values. Create 4 new constant files for HIPAA, GDPR, NIST CSF, and PCI-DSS control definitions. Update `packages/shared/src/constants/compliance.ts` barrel to include new frameworks.
  - **Files**:
    - Modify: `packages/shared/src/types/security.ts`
    - Create: `packages/shared/src/constants/compliance-hipaa.ts`
    - Create: `packages/shared/src/constants/compliance-gdpr.ts`
    - Create: `packages/shared/src/constants/compliance-nist.ts`
    - Create: `packages/shared/src/constants/compliance-pci.ts`
    - Modify: `packages/shared/src/constants/compliance.ts`
    - Modify: `packages/shared/src/constants/index.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: M (4 files with 12-15 controls each)
  - **Acceptance Criteria**:
    - [ ] `ComplianceFramework` type includes `'hipaa' | 'gdpr' | 'nist_csf' | 'pci_dss'`
    - [ ] Each framework file exports named control array constant
    - [ ] HIPAA: 15 controls, GDPR: 12, NIST CSF: 15, PCI-DSS: 12
    - [ ] `COMPLIANCE_FRAMEWORKS` object updated with new entries
    - [ ] `pnpm typecheck` passes

---

- [x] **1.4 Create cursor pagination utility**
  - **Description**: Create `apps/api/src/utils/pagination.ts` with `parseCursor()`, `buildNextCursor()`, and `parseDateRange()` helper functions. Also create `packages/shared/src/types/pagination.ts` with `PaginationParams` and `PaginatedResponse<T>` types.
  - **Files**:
    - Create: `apps/api/src/utils/pagination.ts`
    - Create: `packages/shared/src/types/pagination.ts`
    - Modify: `packages/shared/src/types/index.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `parseCursor(cursor)` decodes base64 JSON to `{ createdAt, id }`
    - [ ] `buildNextCursor(lastItem)` encodes to base64 JSON
    - [ ] `parseDateRange(from, to)` validates ISO dates, returns { from, to }
    - [ ] `PaginatedResponse<T>` type: `{ data: T[], nextCursor: string | null, hasMore: boolean }`
    - [ ] Default limit 50, max limit 200

---

- [x] **1.5 Create SSO Drizzle schema**
  - **Description**: Create `packages/db/src/schema/sso.ts` with `ssoConfigs` table definition. Update `packages/db/src/schema/index.ts` barrel export.
  - **Files**:
    - Create: `packages/db/src/schema/sso.ts`
    - Modify: `packages/db/src/schema/index.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `ssoConfigs` table with all fields from design doc
    - [ ] `orgId` is UNIQUE and references organizations
    - [ ] `oidcClientSecretEncrypted` for encrypted storage
    - [ ] Exported from barrel

---

- [x] **1.6 Update users and security schemas**
  - **Description**: Add `isAdmin` integer column to `users` table in `packages/db/src/schema/users.ts` (default 0). Add `actorId` text column to `auditLog` table in `packages/db/src/schema/security.ts`.
  - **Files**:
    - Modify: `packages/db/src/schema/users.ts`
    - Modify: `packages/db/src/schema/security.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `users.isAdmin` column: `integer('is_admin').notNull().default(0)`
    - [ ] `auditLog.actorId` column: `text('actor_id')`
    - [ ] `pnpm typecheck` passes

---

- [x] **1.7 Create D1 migration 0009**
  - **Description**: Create `packages/db/migrations/0009_sso_admin.sql` with CREATE TABLE for sso_configs, ALTER TABLE for users.isAdmin, ALTER TABLE for auditLog.actorId, and new indexes.
  - **Files**:
    - Create: `packages/db/migrations/0009_sso_admin.sql`
  - **Dependencies**: 1.5, 1.6
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `sso_configs` table created with all columns and constraints
    - [ ] `is_admin` column added to `users` with default 0
    - [ ] `actor_id` column added to `audit_log`
    - [ ] Indexes on sso_configs.org_id, audit_log.created_at, audit_log.actor_id, security_events.created_at
    - [ ] Migration is idempotent-safe

---

### Phase 2: Services

---

- [x] **2.1 Install fast-xml-parser dependency**
  - **Description**: Add `fast-xml-parser` to `apps/api/package.json` dependencies. Run `pnpm install`.
  - **Files**:
    - Modify: `apps/api/package.json`
    - Modify: `pnpm-lock.yaml`
  - **Dependencies**: None
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `fast-xml-parser` in dependencies
    - [ ] `pnpm install` completes
    - [ ] `pnpm typecheck` passes

---

- [x] **2.2 Create SAML service**
  - **Description**: Create `apps/api/src/services/saml.ts` with functions: `buildAuthnRequest(entityId, acsUrl)`, `parseSamlResponse(base64Response)`, `validateSignature(xml, certificate)`, `extractAttributes(assertion)`. Use `fast-xml-parser` for XML parsing and Web Crypto API for RSA-SHA256 signature validation.
  - **Files**:
    - Create: `apps/api/src/services/saml.ts`
    - Create: `apps/api/src/services/saml.test.ts`
  - **Dependencies**: 2.1
  - **Estimated Complexity**: L (complex XML + crypto)
  - **Acceptance Criteria**:
    - [ ] `buildAuthnRequest()` generates valid AuthnRequest XML
    - [ ] `parseSamlResponse()` decodes base64, parses XML
    - [ ] `validateSignature()` verifies RSA-SHA256 against x509 cert
    - [ ] `extractAttributes()` returns { email, name, groups }
    - [ ] File under 200 lines
    - [ ] Tests cover valid assertion, invalid signature, missing attributes

---

- [x] **2.3 Create OIDC service**
  - **Description**: Create `apps/api/src/services/oidc.ts` with functions: `discoverEndpoints(issuerUrl)`, `buildAuthUrl(config, state, codeChallenge)`, `exchangeCode(config, code, codeVerifier)`, `fetchUserInfo(accessToken, userinfoEndpoint)`. Use native `fetch()` and Web Crypto API for PKCE.
  - **Files**:
    - Create: `apps/api/src/services/oidc.ts`
    - Create: `apps/api/src/services/oidc.test.ts`
  - **Dependencies**: None
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `discoverEndpoints()` fetches .well-known config, extracts endpoints
    - [ ] `buildAuthUrl()` generates authorization URL with PKCE code_challenge
    - [ ] `exchangeCode()` POSTs to token_endpoint, returns tokens
    - [ ] `fetchUserInfo()` GETs userinfo_endpoint, returns claims
    - [ ] File under 200 lines
    - [ ] Tests mock fetch for all external calls

---

- [x] **2.4 Create report export service**
  - **Description**: Create `apps/api/src/services/report-export.ts` with functions: `exportComplianceToCsv(results)`, `exportAuditToCsv(db, instanceId, params)`, `storeExport(r2, key, content)`, `generateSignedUrl(r2, key)`. CSV only for V1 (PDF deferred).
  - **Files**:
    - Create: `apps/api/src/services/report-export.ts`
    - Create: `apps/api/src/services/report-export.test.ts`
  - **Dependencies**: 1.4 (pagination utility for audit export)
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `exportComplianceToCsv()` generates valid CSV with headers
    - [ ] `exportAuditToCsv()` uses chunked pagination for large datasets
    - [ ] `storeExport()` puts content to R2 with appropriate key
    - [ ] File under 200 lines
    - [ ] Tests verify CSV format and column correctness

---

- [x] **2.5 Create audit retention service**
  - **Description**: Create `apps/api/src/services/audit-retention.ts` with `enforceAuditRetention(db)` that deletes audit_log entries older than the plan-specific retention period. Joins audit_log → instances → users to determine plan.
  - **Files**:
    - Create: `apps/api/src/services/audit-retention.ts`
    - Create: `apps/api/src/services/audit-retention.test.ts`
  - **Dependencies**: 1.6 (actorId column)
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Retention days: free=3, personal=7, pro=90, team=365
    - [ ] Deletes audit_log entries older than cutoff per plan
    - [ ] Does not delete entries for instances without a user (orphan protection)
    - [ ] File under 200 lines
    - [ ] Test verifies correct cutoff dates per plan tier

---

### Phase 3: Backend Routes

---

- [x] **3.1 Create admin middleware**
  - **Description**: Create `apps/api/src/middleware/admin.ts` with `adminMiddleware` that checks `users.isAdmin === 1` for the authenticated user. Return 403 for non-admins.
  - **Files**:
    - Create: `apps/api/src/middleware/admin.ts`
    - Create: `apps/api/src/middleware/admin.test.ts`
  - **Dependencies**: 1.6
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Checks `isAdmin` flag from DB for authenticated user
    - [ ] Returns 403 with `{ error: 'Forbidden', message: 'Admin access required' }`
    - [ ] File under 200 lines
    - [ ] Tests cover: admin pass, non-admin reject, missing user 401

---

- [x] **3.2 Create SSO config CRUD routes**
  - **Description**: Create `apps/api/src/routes/sso-config.ts` with CRUD for SSO configuration. Only org admins+ can manage SSO. OIDC client secret encrypted before storage.
  - **Files**:
    - Create: `apps/api/src/routes/sso-config.ts`
    - Create: `apps/api/src/routes/sso-config.test.ts`
  - **Dependencies**: 1.5, 1.1
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `GET /api/organizations/:orgId/sso` — get SSO config
    - [ ] `PUT /api/organizations/:orgId/sso` — create/update config
    - [ ] `DELETE /api/organizations/:orgId/sso` — disable SSO
    - [ ] `POST /api/organizations/:orgId/sso/test` — test connection
    - [ ] OIDC client secret encrypted with AES-GCM before storage
    - [ ] Requires `org.update` permission
    - [ ] File under 200 lines

---

- [x] **3.3 Create SAML routes**
  - **Description**: Create `apps/api/src/routes/sso-saml.ts` with SAML SP metadata, login initiation, and ACS endpoint. These routes are unauthenticated (IdP callbacks).
  - **Files**:
    - Create: `apps/api/src/routes/sso-saml.ts`
    - Create: `apps/api/src/routes/sso-saml.test.ts`
  - **Dependencies**: 2.2, 1.5
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `GET /api/sso/:orgSlug/saml/metadata` — SP metadata XML
    - [ ] `GET /api/sso/:orgSlug/saml/login` — redirect to IdP with AuthnRequest
    - [ ] `POST /api/sso/:orgSlug/saml/acs` — validate assertion, provision user, create session
    - [ ] Validates org exists and SSO is active
    - [ ] Rate limited: 10 req/min per org
    - [ ] File under 200 lines

---

- [x] **3.4 Create OIDC routes**
  - **Description**: Create `apps/api/src/routes/sso-oidc.ts` with OIDC login initiation and callback. Uses KV for state/PKCE storage with 5-minute TTL.
  - **Files**:
    - Create: `apps/api/src/routes/sso-oidc.ts`
    - Create: `apps/api/src/routes/sso-oidc.test.ts`
  - **Dependencies**: 2.3, 1.5
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `GET /api/sso/:orgSlug/oidc/login` — redirect to IdP with PKCE
    - [ ] `GET /api/sso/:orgSlug/oidc/callback` — exchange code, provision user, create session
    - [ ] State stored in KV with 5min TTL (CSRF protection)
    - [ ] Code verifier stored in KV alongside state
    - [ ] Validates org exists and SSO is active
    - [ ] File under 200 lines

---

- [x] **3.5 Create admin stats route**
  - **Description**: Create `apps/api/src/routes/admin-stats.ts` with GET /api/admin/stats returning platform-wide statistics.
  - **Files**:
    - Create: `apps/api/src/routes/admin-stats.ts`
  - **Dependencies**: 3.1
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Returns: totalUsers, totalInstances, totalOrgs, totalEvents, activeInstances
    - [ ] Uses admin middleware
    - [ ] File under 200 lines

---

- [x] **3.6 Create admin users routes**
  - **Description**: Create `apps/api/src/routes/admin-users.ts` with paginated user list (search), user detail, and suspend/unsuspend.
  - **Files**:
    - Create: `apps/api/src/routes/admin-users.ts`
    - Create: `apps/api/src/routes/admin-users.test.ts`
  - **Dependencies**: 3.1, 1.4
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `GET /api/admin/users?search=&cursor=&limit=` — paginated user list
    - [ ] `GET /api/admin/users/:id` — user detail with instances and orgs
    - [ ] `PATCH /api/admin/users/:id` — suspend/unsuspend (set status field)
    - [ ] Search by name or email (LIKE query)
    - [ ] File under 200 lines

---

- [x] **3.7 Create admin orgs, instances, events routes**
  - **Description**: Create `apps/api/src/routes/admin-orgs.ts`, `admin-instances.ts`, and `admin-events.ts` with paginated list endpoints.
  - **Files**:
    - Create: `apps/api/src/routes/admin-orgs.ts`
    - Create: `apps/api/src/routes/admin-instances.ts`
    - Create: `apps/api/src/routes/admin-events.ts`
  - **Dependencies**: 3.1, 1.4
  - **Estimated Complexity**: M (3 files, straightforward)
  - **Acceptance Criteria**:
    - [ ] `GET /api/admin/organizations` — all orgs with member counts
    - [ ] `GET /api/admin/instances` — all instances with owner info
    - [ ] `GET /api/admin/events` — system-wide security events (paginated)
    - [ ] All use cursor pagination
    - [ ] Each file under 200 lines

---

- [x] **3.8 Create admin skills moderation and billing routes**
  - **Description**: Create `apps/api/src/routes/admin-skills.ts` for skill moderation queue and `apps/api/src/routes/admin-billing.ts` for revenue data.
  - **Files**:
    - Create: `apps/api/src/routes/admin-skills.ts`
    - Create: `apps/api/src/routes/admin-billing.ts`
  - **Dependencies**: 3.1
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `GET /api/admin/skills` — skills pending moderation
    - [ ] `PATCH /api/admin/skills/:id` — approve/reject with reason
    - [ ] `GET /api/admin/billing` — MRR, plan distribution, recent subscriptions
    - [ ] Each file under 200 lines

---

- [x] **3.9 Create compliance export routes**
  - **Description**: Create `apps/api/src/routes/compliance-export.ts` with endpoints for compliance report CSV export and audit log CSV export.
  - **Files**:
    - Create: `apps/api/src/routes/compliance-export.ts`
    - Create: `apps/api/src/routes/compliance-export.test.ts`
  - **Dependencies**: 2.4
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `GET /api/security/instances/:id/compliance-reports/:reportId/export?format=csv`
    - [ ] `GET /api/security/instances/:id/audit/export?from=&to=&format=csv`
    - [ ] Returns signed R2 URL for download
    - [ ] Requires `compliance.generate` and `audit.export` permissions
    - [ ] File under 200 lines

---

- [x] **3.10 Update compliance service with new frameworks and mount all routes**
  - **Description**: Update `apps/api/src/services/compliance.ts` to include HIPAA, GDPR, NIST CSF, PCI-DSS in `FRAMEWORK_CONTROLS` map. Add `evaluateControl` cases for new control IDs. Update `apps/api/src/index.ts` to mount SSO, admin, and export routes. Wire retention cron into `scheduled()` handler.
  - **Files**:
    - Modify: `apps/api/src/services/compliance.ts`
    - Modify: `apps/api/src/index.ts`
  - **Dependencies**: 1.3, 3.1-3.9
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] `FRAMEWORK_CONTROLS` includes all 7 frameworks
    - [ ] `evaluateControl()` handles new control IDs
    - [ ] All new routes mounted in index.ts
    - [ ] `scheduled()` calls `enforceAuditRetention()`
    - [ ] compliance.ts stays under 200 lines (split evaluateControl if needed)
    - [ ] `pnpm typecheck` passes

---

### Phase 4: Frontend

---

- [x] **4.1 Create SSO config page and form**
  - **Description**: Create `/dashboard/team/sso/page.tsx` (Server Component) and `SsoConfigForm.tsx` (Client Component). Form toggles between SAML and OIDC, shows appropriate fields, has test connection and save buttons.
  - **Files**:
    - Create: `apps/web/src/app/dashboard/team/sso/page.tsx`
    - Create: `apps/web/src/app/dashboard/team/sso/loading.tsx`
    - Create: `apps/web/src/components/dashboard/team/SsoConfigForm.tsx`
  - **Dependencies**: 3.2
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] Provider type toggle (SAML / OIDC)
    - [ ] SAML fields: Entity ID, SSO URL, Certificate (textarea)
    - [ ] OIDC fields: Client ID, Client Secret, Issuer URL
    - [ ] Auto-provisioning toggle + default role select
    - [ ] Enable/disable toggle
    - [ ] Test Connection button (calls POST /sso/test)
    - [ ] Save button (calls PUT /sso)
    - [ ] Each file under 200 lines

---

- [x] **4.2 Create web proxy routes for SSO and admin**
  - **Description**: Create proxy routes to forward SSO config and admin API requests from the web app to the API worker.
  - **Files**:
    - Create: `apps/web/src/app/api/proxy/organizations/[orgId]/sso/route.ts`
    - Create: `apps/web/src/app/api/proxy/organizations/[orgId]/sso/test/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/stats/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/users/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/users/[id]/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/organizations/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/instances/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/skills/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/skills/[id]/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/billing/route.ts`
    - Create: `apps/web/src/app/api/proxy/admin/events/route.ts`
  - **Dependencies**: 3.2, 3.5-3.8
  - **Estimated Complexity**: M (many files, but each is small ~30 lines)
  - **Acceptance Criteria**:
    - [ ] All admin proxy routes forward auth token
    - [ ] SSO proxy routes forward X-Org-Id header
    - [ ] Each file follows existing proxy pattern

---

- [x] **4.3 Create admin layout and sidebar**
  - **Description**: Create `/admin/layout.tsx` with admin sidebar navigation and isAdmin guard. Redirects non-admin users to `/dashboard`.
  - **Files**:
    - Create: `apps/web/src/app/admin/layout.tsx`
  - **Dependencies**: 4.2
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Sidebar: Dashboard, Users, Organizations, Instances, Skills, Billing, Events
    - [ ] Fetches user profile, checks isAdmin
    - [ ] Redirects non-admins to /dashboard
    - [ ] Consistent styling with dashboard layout
    - [ ] File under 200 lines

---

- [x] **4.4 Create admin dashboard page**
  - **Description**: Create `/admin/page.tsx` with stat cards (users, instances, orgs, events) and summary charts.
  - **Files**:
    - Create: `apps/web/src/app/admin/page.tsx`
    - Create: `apps/web/src/app/admin/loading.tsx`
  - **Dependencies**: 4.3
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] 4 stat cards with counts
    - [ ] Recent activity list
    - [ ] File under 200 lines

---

- [x] **4.5 Create admin users page**
  - **Description**: Create `/admin/users/page.tsx` with searchable, paginated user table. Search input, suspend/unsuspend action button.
  - **Files**:
    - Create: `apps/web/src/app/admin/users/page.tsx`
    - Create: `apps/web/src/app/admin/users/[id]/page.tsx`
    - Create: `apps/web/src/components/admin/UserTable.tsx`
    - Create: `apps/web/src/components/admin/SuspendUserButton.tsx`
  - **Dependencies**: 4.3
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] Search by name/email
    - [ ] Cursor-based pagination (Load More button)
    - [ ] User detail page shows instances and org memberships
    - [ ] Suspend/unsuspend toggle button
    - [ ] Each file under 200 lines

---

- [x] **4.6 Create admin organizations and instances pages**
  - **Description**: Create `/admin/organizations/page.tsx` and `/admin/instances/page.tsx` with paginated tables.
  - **Files**:
    - Create: `apps/web/src/app/admin/organizations/page.tsx`
    - Create: `apps/web/src/app/admin/instances/page.tsx`
  - **Dependencies**: 4.3
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Org table: name, slug, owner, member count, plan, created
    - [ ] Instance table: name, owner, status, region, created
    - [ ] Both use cursor pagination
    - [ ] Each file under 200 lines

---

- [x] **4.7 Create admin skills moderation page**
  - **Description**: Create `/admin/skills/page.tsx` with skill moderation queue. Approve/reject buttons with reason input.
  - **Files**:
    - Create: `apps/web/src/app/admin/skills/page.tsx`
    - Create: `apps/web/src/components/admin/SkillModerationCard.tsx`
  - **Dependencies**: 4.3
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Card per pending skill: name, description, submitter, submitted date
    - [ ] Approve button (green)
    - [ ] Reject button (red) with reason textarea
    - [ ] Each file under 200 lines

---

- [x] **4.8 Create admin billing and events pages**
  - **Description**: Create `/admin/billing/page.tsx` with revenue metrics and `/admin/events/page.tsx` with system-wide event stream.
  - **Files**:
    - Create: `apps/web/src/app/admin/billing/page.tsx`
    - Create: `apps/web/src/app/admin/events/page.tsx`
  - **Dependencies**: 4.3
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Billing: MRR card, plan distribution breakdown, recent subscriptions
    - [ ] Events: paginated event table with severity badges, type filter
    - [ ] Each file under 200 lines

---

- [x] **4.9 Create ExportReportButton component**
  - **Description**: Create `ExportReportButton.tsx` — a dropdown button with CSV option. Calls export API and triggers download via signed URL.
  - **Files**:
    - Create: `apps/web/src/components/dashboard/security/ExportReportButton.tsx`
  - **Dependencies**: 3.9
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Dropdown with "Export CSV" option
    - [ ] Calls export API, opens signed URL in new tab
    - [ ] Loading state while generating
    - [ ] File under 200 lines

---

- [x] **4.10 Create ExportAuditButton component**
  - **Description**: Create `ExportAuditButton.tsx` — a button with date range picker and format select. Calls audit export API.
  - **Files**:
    - Create: `apps/web/src/components/dashboard/security/ExportAuditButton.tsx`
  - **Dependencies**: 3.9
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Date range inputs (from, to)
    - [ ] Export button triggers download
    - [ ] Loading state
    - [ ] File under 200 lines

---

- [x] **4.11 Update compliance and audit pages with export buttons**
  - **Description**: Add `ExportReportButton` to compliance report cards and `ExportAuditButton` to the audit log page. Update compliance page to show all 7 frameworks in the generate modal.
  - **Files**:
    - Modify: `apps/web/src/app/dashboard/security/compliance/page.tsx`
    - Modify: `apps/web/src/app/dashboard/logs/page.tsx`
  - **Dependencies**: 4.9, 4.10
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Export button on each compliance report card
    - [ ] Export button on audit log page header
    - [ ] Generate modal shows all 7 framework options
    - [ ] Framework labels updated for new 4 frameworks

---

- [x] **4.12 Update dashboard sidebar with SSO link**
  - **Description**: Add "SSO" navigation item under the Team section in dashboard layout. Only visible to admin+ role in the org.
  - **Files**:
    - Modify: `apps/web/src/app/dashboard/layout.tsx`
  - **Dependencies**: 4.1
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] "SSO" link under Team section → `/dashboard/team/sso`
    - [ ] Uses Shield icon from lucide-react
    - [ ] Consistent styling

---

### Phase 5: Testing & Polish

---

- [x] **5.1 Write new framework compliance tests**
  - **Description**: Create tests for HIPAA, GDPR, NIST CSF, PCI-DSS control evaluation. Verify each framework's controls return correct pass/fail based on context.
  - **Files**:
    - Create: `packages/shared/src/constants/compliance-hipaa.test.ts`
    - Create: `packages/shared/src/constants/compliance-gdpr.test.ts`
    - Create: `packages/shared/src/constants/compliance-nist.test.ts`
    - Create: `packages/shared/src/constants/compliance-pci.test.ts`
  - **Dependencies**: 1.3
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] Each framework's control count verified
    - [ ] Control IDs are unique within framework
    - [ ] Each control has name, category, and id fields

---

- [x] **5.2 Write admin route integration tests**
  - **Description**: Create tests for all admin API endpoints. Verify admin-only access, pagination, search, and suspend/unsuspend behavior.
  - **Files**:
    - Create: `apps/api/src/routes/admin-users.test.ts`
    - Create: `apps/api/src/routes/admin-stats.test.ts`
  - **Dependencies**: 3.5, 3.6
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] Test: non-admin gets 403
    - [ ] Test: admin gets stats successfully
    - [ ] Test: user search returns matching results
    - [ ] Test: suspend sets user status
    - [ ] Test: pagination returns nextCursor and hasMore

---

- [x] **5.3 Write SSO security tests**
  - **Description**: Create security-focused tests for SSO endpoints. Test invalid signatures, expired assertions, CSRF protection, replay attacks.
  - **Files**:
    - Create: `apps/api/src/routes/sso-security.test.ts`
  - **Dependencies**: 3.3, 3.4
  - **Estimated Complexity**: M
  - **Acceptance Criteria**:
    - [ ] Test: invalid SAML signature returns 401
    - [ ] Test: expired SAML assertion returns 401
    - [ ] Test: OIDC callback without valid state returns 400
    - [ ] Test: OIDC callback with replayed state returns 400
    - [ ] Test: SSO on inactive config returns 404
    - [ ] Test: SSO on non-existent org returns 404

---

- [x] **5.4 Write pagination utility tests**
  - **Description**: Create tests for cursor encoding/decoding, date range parsing, and edge cases.
  - **Files**:
    - Create: `apps/api/src/utils/pagination.test.ts`
  - **Dependencies**: 1.4
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] Test: encode → decode round-trip preserves data
    - [ ] Test: invalid cursor returns null gracefully
    - [ ] Test: date range validates ISO format
    - [ ] Test: limit capped at 200

---

- [x] **5.5 Final validation: typecheck + test + build**
  - **Description**: Run full monorepo validation.
  - **Dependencies**: All previous tasks
  - **Estimated Complexity**: S
  - **Acceptance Criteria**:
    - [ ] `pnpm typecheck` passes (all packages)
    - [ ] `pnpm test` passes (all packages)
    - [ ] `pnpm build` succeeds (all packages)
    - [ ] No file exceeds 200 lines

---

## Progress Tracking

### Completion Status
- Total Tasks: 34
- Completed: 34
- In Progress: 0
- Not Started: 0

### Phase Status
- [x] Phase 1: Foundation (7/7 tasks)
- [x] Phase 2: Services (5/5 tasks)
- [x] Phase 3: Backend Routes (10/10 tasks)
- [x] Phase 4: Frontend (12/12 tasks)
- [x] Phase 5: Testing & Polish (5/5 tasks)

## Parallel Work Opportunities

**Phase 1 (3 parallel tracks)**:
- Track A: 1.1, 1.2 (types — independent)
- Track B: 1.3 (framework constants — independent)
- Track C: 1.4, 1.5, 1.6 → 1.7 (schema + migration)

**Phase 2 (4 parallel tracks)**:
- Track A: 2.1 → 2.2 (SAML)
- Track B: 2.3 (OIDC — independent)
- Track C: 2.4 (export — needs 1.4)
- Track D: 2.5 (retention — needs 1.6)

**Phase 3 (3 parallel tracks)**:
- Track A: 3.1 → 3.5-3.8 (admin routes)
- Track B: 3.2, 3.3, 3.4 (SSO routes)
- Track C: 3.9 (export routes)
- Join: 3.10 (mount all + update compliance)

**Phase 4 (3 parallel tracks)**:
- Track A: 4.1, 4.12 (SSO UI)
- Track B: 4.2, 4.3, 4.4-4.8 (admin UI)
- Track C: 4.9, 4.10, 4.11 (export UI)

## Critical Path

```
1.5 → 1.7 → 2.2 → 3.3 → 4.1 → 4.12  (SSO path)
1.6 → 1.7 → 3.1 → 3.6 → 4.5          (Admin path)
1.4 → 2.4 → 3.9 → 4.9 → 4.11         (Export path)
1.3 → 3.10 → 5.1                       (Framework path)
```

The SSO and Admin paths are the longest. Export and frameworks can proceed in parallel.
