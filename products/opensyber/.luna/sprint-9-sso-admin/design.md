# Design Document

**Scope**: OpenSyber / Sprint 9 — Enterprise SSO, Admin Panel & Compliance
**Date**: 2026-02-28
**Based on**: requirements.md

---

## 1. Database Changes

### 1.1 Migration 0009: SSO, Admin & Audit Improvements

```sql
-- SSO configuration per organization
CREATE TABLE sso_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('saml', 'oidc')),
  -- SAML fields
  entity_id TEXT,
  sso_url TEXT,
  certificate TEXT,
  -- OIDC fields
  oidc_client_id TEXT,
  oidc_client_secret_encrypted TEXT,
  oidc_issuer TEXT,
  -- Shared config
  auto_provision INTEGER NOT NULL DEFAULT 0,
  default_role TEXT NOT NULL DEFAULT 'viewer',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_sso_configs_org_id ON sso_configs(org_id);

-- Admin flag on users
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- Audit log actor tracking (SOC2 CC5.3)
ALTER TABLE audit_log ADD COLUMN actor_id TEXT;

-- Compliance framework enum expansion (D1 text columns, no ALTER needed)
-- complianceReports.framework already TEXT — new values work automatically

-- Indexes for pagination performance
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
```

### 1.2 Drizzle Schema Updates

**New file**: `packages/db/src/schema/sso.ts` (~35 lines)
```typescript
export const ssoConfigs = sqliteTable('sso_configs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  provider: text('provider', { enum: ['saml', 'oidc'] }).notNull(),
  entityId: text('entity_id'),
  ssoUrl: text('sso_url'),
  certificate: text('certificate'),
  oidcClientId: text('oidc_client_id'),
  oidcClientSecretEncrypted: text('oidc_client_secret_encrypted'),
  oidcIssuer: text('oidc_issuer'),
  autoProvision: integer('auto_provision').notNull().default(0),
  defaultRole: text('default_role').notNull().default('viewer'),
  isActive: integer('is_active').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

**Modified**: `packages/db/src/schema/users.ts` — add `isAdmin` column
**Modified**: `packages/db/src/schema/security.ts` — add `actorId` to `auditLog`
**Modified**: `packages/db/src/schema/index.ts` — export sso schema

---

## 2. SSO Architecture

### 2.1 SAML 2.0 Flow

```
User → /api/sso/:orgSlug/saml/login
  → Build AuthnRequest XML
  → Redirect to IdP SSO URL with SAMLRequest (base64 + deflate)

IdP authenticates user
  → POST /api/sso/:orgSlug/saml/acs with SAMLResponse

ACS handler:
  1. Decode base64 SAMLResponse
  2. Parse XML, extract Assertion
  3. Validate signature against stored x509 certificate
  4. Extract NameID (email), attributes (name, groups)
  5. Find or create user (if autoProvision)
  6. Find or create org membership
  7. Create Clerk session (via backend API)
  8. Redirect to /dashboard
```

### 2.2 OIDC Flow

```
User → /api/sso/:orgSlug/oidc/login
  → Discover endpoints via .well-known/openid-configuration
  → Generate state + code_verifier (PKCE)
  → Store state in KV (5min TTL)
  → Redirect to authorization_endpoint with code_challenge

IdP authenticates user
  → GET /api/sso/:orgSlug/oidc/callback?code=&state=

Callback handler:
  1. Validate state against KV
  2. Exchange code for tokens at token_endpoint
  3. Fetch userinfo from userinfo_endpoint
  4. Extract email, name, groups from claims
  5. Find or create user (if autoProvision)
  6. Find or create org membership
  7. Create Clerk session (via backend API)
  8. Redirect to /dashboard
```

### 2.3 SAML Implementation Constraints

SAML XML parsing in Workers is tricky — no `DOMParser` available. Two options:
- **Option A**: Use a minimal XML parser (e.g., `fast-xml-parser`) — lightweight, Workers-compatible
- **Option B**: Parse SAML response as text with regex extraction — fragile but zero-dependency

**Decision**: Option A — `fast-xml-parser` is <50KB, works in Workers, handles SAML assertions correctly. Signature validation uses Web Crypto API for RSA-SHA256 verification against the x509 certificate.

### 2.4 Session Creation After SSO

After successful SSO authentication, we need a Clerk session. Two approaches:
- **Option A**: Use Clerk Backend API `createSignInToken()` to generate a one-time token, redirect to `/sign-in#__clerk_ticket=<token>` — Clerk handles session creation
- **Option B**: Issue a custom JWT and bypass Clerk — breaks auth model

**Decision**: Option A — Clerk's `createSignInToken()` API lets us authenticate SSO users seamlessly. If user doesn't exist in Clerk, we create them first via `createUser()`.

---

## 3. Admin Panel Architecture

### 3.1 Middleware Design

```typescript
// middleware/admin.ts
export const adminMiddleware = createMiddleware(async (c, next) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const [user] = await db.select({ isAdmin: users.isAdmin })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);
  return next();
});
```

Admin middleware is independent of RBAC — it checks a platform-level flag, not org membership.

### 3.2 Route File Split (200-line constraint)

The 10 admin endpoints cannot fit in one file. Split by domain:
- `routes/admin-stats.ts` — GET /stats (~50 lines)
- `routes/admin-users.ts` — GET/PATCH users (~120 lines)
- `routes/admin-orgs.ts` — GET organizations (~60 lines)
- `routes/admin-instances.ts` — GET instances (~60 lines)
- `routes/admin-skills.ts` — GET/PATCH skills (~80 lines)
- `routes/admin-billing.ts` — GET billing (~60 lines)
- `routes/admin-events.ts` — GET events (~60 lines)

### 3.3 Admin UI Architecture

Separate `/admin` layout in Next.js — not under `/dashboard`:
- Own sidebar navigation
- `isAdmin` check in layout (fetch user, redirect if not admin)
- Proxy routes under `/api/proxy/admin/` forward to API

---

## 4. Compliance Export Architecture

### 4.1 PDF Generation in Workers

`@react-pdf/renderer` requires Node.js APIs. In Workers, alternatives:
- **Option A**: Generate HTML → use a headless browser API (expensive)
- **Option B**: Build CSV only (no PDF in Workers)
- **Option C**: Generate PDF on-demand in a serverless function (not Workers)

**Decision**: Start with CSV export only for V1. PDF can be added later via a dedicated serverless function or client-side generation using `jspdf`. CSV covers the compliance audit requirement.

### 4.2 Export Flow

```
User clicks "Export CSV" →
  Frontend POST /api/proxy/compliance-export →
  API generates CSV string →
  API stores in R2 (key: exports/{id}.csv) →
  API returns signed R2 URL (1hr expiry) →
  Frontend triggers browser download via signed URL
```

### 4.3 Audit Log Export (Streaming)

For large audit logs (100K+ rows), use chunked generation:
```typescript
// Build CSV in chunks of 1000 rows
let cursor = null;
const chunks: string[] = [csvHeader];
do {
  const { data, nextCursor } = await fetchAuditPage(db, instanceId, { cursor, limit: 1000, from, to });
  chunks.push(data.map(rowToCsv).join('\n'));
  cursor = nextCursor;
} while (cursor);
const csv = chunks.join('\n');
await r2.put(key, csv);
```

---

## 5. Extended Frameworks Architecture

### 5.1 Compliance Service Refactor

Current `services/compliance.ts` is 160 lines with 3 frameworks. Adding 4 more frameworks with control evaluation logic would exceed 200 lines.

**Solution**: Extract control definitions to `packages/shared`:
- `constants/compliance-hipaa.ts` — HIPAA control constants
- `constants/compliance-gdpr.ts` — GDPR control constants
- `constants/compliance-nist.ts` — NIST CSF control constants
- `constants/compliance-pci.ts` — PCI-DSS control constants

The `evaluateControl()` function remains generic — it maps control IDs to context checks. New control IDs follow existing patterns (policy-based, alert-based, vuln-based checks).

### 5.2 Framework Control Counts

| Framework | Controls | Categories |
|---|---|---|
| SOC2 | 20 | CC1-CC9, A1 |
| ISO 27001 | 15 | A5-A18 |
| CIS | 15 | 1-17 |
| HIPAA | 15 | Administrative, Physical, Technical Safeguards |
| GDPR | 12 | Articles 5, 25, 30, 32-35 |
| NIST CSF | 15 | Identify, Protect, Detect, Respond, Recover |
| PCI-DSS | 12 | Requirements 1-12 |

Total: 104 controls across 7 frameworks.

---

## 6. Audit Log Improvements Architecture

### 6.1 Cursor-Based Pagination

Standard cursor pattern using `createdAt` + `id` composite cursor:
```typescript
interface PaginationParams {
  cursor?: string;  // base64(JSON({ createdAt, id }))
  limit?: number;   // default 50, max 200
  from?: string;    // ISO date
  to?: string;      // ISO date
}

interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

### 6.2 Retention Cron

Added to the existing `scheduled()` handler in `index.ts`:
```typescript
async function enforceAuditRetention(db, env) {
  const plans = { free: 3, personal: 7, pro: 90, team: 365 };
  // For each plan tier, delete audit_log entries older than retention
  for (const [plan, days] of Object.entries(plans)) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    await db.delete(auditLog)
      .where(and(
        lte(auditLog.createdAt, cutoff),
        // Join with instances → users to get plan
      ));
  }
}
```

---

## 7. File Inventory

### New Files (30 estimated)

| File | Lines (est.) | Purpose |
|---|---|---|
| `packages/db/src/schema/sso.ts` | 35 | SSO Drizzle schema |
| `packages/db/migrations/0009_sso_admin.sql` | 25 | D1 migration |
| `packages/shared/src/constants/compliance-hipaa.ts` | 50 | HIPAA controls |
| `packages/shared/src/constants/compliance-gdpr.ts` | 45 | GDPR controls |
| `packages/shared/src/constants/compliance-nist.ts` | 50 | NIST CSF controls |
| `packages/shared/src/constants/compliance-pci.ts` | 45 | PCI-DSS controls |
| `packages/shared/src/types/sso.ts` | 35 | SSO TypeScript types |
| `packages/shared/src/types/admin.ts` | 30 | Admin panel types |
| `apps/api/src/middleware/admin.ts` | 30 | Admin auth middleware |
| `apps/api/src/middleware/admin.test.ts` | 60 | Admin middleware tests |
| `apps/api/src/services/saml.ts` | 150 | SAML assertion parsing |
| `apps/api/src/services/oidc.ts` | 130 | OIDC flow service |
| `apps/api/src/services/report-export.ts` | 100 | CSV export + R2 storage |
| `apps/api/src/services/audit-retention.ts` | 50 | Cron retention logic |
| `apps/api/src/routes/sso-saml.ts` | 120 | SAML routes |
| `apps/api/src/routes/sso-oidc.ts` | 100 | OIDC routes |
| `apps/api/src/routes/sso-config.ts` | 100 | SSO config CRUD |
| `apps/api/src/routes/admin-stats.ts` | 50 | Admin stats route |
| `apps/api/src/routes/admin-users.ts` | 120 | Admin user mgmt |
| `apps/api/src/routes/admin-orgs.ts` | 60 | Admin org list |
| `apps/api/src/routes/admin-instances.ts` | 60 | Admin instance list |
| `apps/api/src/routes/admin-skills.ts` | 80 | Skill moderation |
| `apps/api/src/routes/admin-billing.ts` | 60 | Billing data |
| `apps/api/src/routes/admin-events.ts` | 60 | Event stream |
| `apps/api/src/routes/compliance-export.ts` | 80 | Export endpoints |
| `apps/api/src/utils/pagination.ts` | 40 | Cursor pagination helper |
| `apps/web/src/app/admin/layout.tsx` | 80 | Admin layout + sidebar |
| `apps/web/src/app/admin/page.tsx` | 100 | Admin dashboard |
| `apps/web/src/app/dashboard/team/sso/page.tsx` | 80 | SSO config page |
| `apps/web/src/components/dashboard/team/SsoConfigForm.tsx` | 150 | SSO form |

### Modified Files (15 estimated)

| File | Change |
|---|---|
| `packages/db/src/schema/users.ts` | Add `isAdmin` column |
| `packages/db/src/schema/security.ts` | Add `actorId` to auditLog |
| `packages/db/src/schema/index.ts` | Export sso schema |
| `packages/shared/src/types/security.ts` | Expand ComplianceFramework |
| `packages/shared/src/types/index.ts` | Export sso + admin types |
| `packages/shared/src/constants/index.ts` | Export new framework constants |
| `packages/shared/src/constants/compliance.ts` | Import new frameworks |
| `apps/api/src/index.ts` | Mount SSO + admin + export routes |
| `apps/api/src/types.ts` | Add isAdmin to Variables |
| `apps/api/src/services/compliance.ts` | Add new framework mappings |
| `apps/web/src/app/dashboard/layout.tsx` | Add SSO link under Team |
| `apps/web/src/app/dashboard/security/compliance/page.tsx` | Add export buttons, new frameworks |
| `apps/web/src/app/dashboard/logs/page.tsx` | Add export button, pagination |

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| SAML XML parsing in Workers | High | Use fast-xml-parser (Workers-compatible) |
| PDF generation in Workers | Medium | Defer to CSV-only for V1 |
| Clerk SSO integration | Medium | Use createSignInToken() API |
| OIDC state replay attacks | High | Cryptographic nonce in KV with TTL |
| Admin privilege escalation | Critical | isAdmin check independent of RBAC |
| Large audit export OOM | Medium | Chunked generation, R2 streaming |
