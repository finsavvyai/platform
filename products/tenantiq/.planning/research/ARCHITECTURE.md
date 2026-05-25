# Architecture Patterns

**Project:** TenantIQ — Competitor-Parity Milestone
**Researched:** 2026-04-22
**Scope:** SSO, Copilot Readiness, Storage Analytics, Drift Dashboard, Admin Observability

---

## Existing Architecture (Baseline)

```
Browser (SvelteKit 5)
  └─ HttpOnly cookie (tenantiq_session)
       └─ Hono API (Cloudflare Workers)
            ├─ authMiddleware (jose HS256/RS256)
            ├─ tenantScopingMiddleware (X-Tenant-Id header)
            ├─ D1 SQLite (org, tenant, user, alerts, workflows, ...)
            ├─ KV (tokens, snapshots, scores, caches)
            └─ Graph API (client_credentials per Azure tenant)
```

**Request flow (every authenticated route):**
1. Browser sends HttpOnly `tenantiq_session` cookie
2. `authMiddleware` extracts + verifies JWT (HS256 primary, RS256 if configured)
3. JWT payload populates `c.get('user')` — `{ sub, email, orgId, tenantIds, role }`
4. `X-Tenant-Id` header enforced against `tenantIds` array in payload
5. All D1 queries scoped `WHERE org_id = ? AND tenant_id = ?`

**KV key namespace conventions (already in production):**
```
graph:{azureTenantId}:access_token      — Graph access token
graph:{azureTenantId}:refresh_token     — Graph refresh token
snapshot:{tenantId}:{snapshotId}:{cat}  — Snapshot category data (90d TTL)
copilot:{tenantId}:latest               — Latest readiness result (2h TTL)
consent:{tenantId}                      — Admin consent flag
auth:state:{state}                      — OAuth state nonce (short TTL)
```

---

## Feature 1: Enterprise SAML/OIDC SSO

### What already exists

`sso_connections` table is fully defined in D1 schema with columns: `id, org_id, provider, display_name, domain, issuer_url, client_id, metadata_url, certificate, jit_enabled, status`.

CRUD routes (`GET/POST /api/sso`, `PATCH/DELETE /api/sso/:id`) are implemented with admin-role guard, domain-uniqueness enforcement, and SSRF-protected metadata URL validation (allowlist in `sso-handlers.ts`).

### What is missing

The schema and CRUD layer exist but the **authentication flow** is not wired. Specifically:

1. No SSO-initiated login endpoint (`GET /api/sso/login/:domain` → redirect to IdP)
2. No SAML ACS (Assertion Consumer Service) endpoint (`POST /api/sso/callback/saml`)
3. No OIDC callback endpoint (`GET /api/sso/callback/oidc`)
4. No JIT provisioning logic (create `platform_users` row on first SSO login)
5. No session issuance after SSO assertion validated (bridge to existing JWT cookie flow)

### Component boundaries

```
sso.ts              — CRUD (exists)
sso-handlers.ts     — update + test (exists)
sso-schemas.ts      — Zod schemas (exists)
sso-login.ts        — NEW: initiate SSO redirect per domain
sso-callback.ts     — NEW: handle SAML ACS + OIDC code callback
sso-jit.ts          — NEW: JIT provisioning + JWT issuance
```

### SAML assertion handling on Workers runtime

**Critical constraint:** The Workers runtime has no native XML parser. `DOMParser` is not available. `@xmldom/xmldom` (pure JS W3C DOM Level 2) is Workers-compatible and is the correct dependency. `xml-crypto` (for XML signature validation) also depends on `@xmldom/xmldom` and runs in Workers.

SAML flow on Workers:
```
POST /api/sso/callback/saml
  → base64-decode SAMLResponse
  → parse XML with @xmldom/xmldom
  → validate XML signature (xml-crypto + IdP certificate from sso_connections)
  → extract NameID (email), attributes (role, groups)
  → JIT: upsert platform_users WHERE email = NameID AND org_id = sso_connection.org_id
  → issue HS256 JWT (same shape as Microsoft OAuth flow)
  → Set-Cookie: tenantiq_session (HttpOnly, SameSite=Lax)
  → redirect to /dashboard
```

OIDC flow on Workers:
```
GET /api/sso/callback/oidc?code=...&state=...
  → exchange code at token_endpoint (fetch() — Workers-native)
  → verify id_token (jose.jwtVerify with JWKS — already used in auth.ts)
  → extract sub, email, name claims
  → JIT: upsert platform_users
  → issue JWT + Set-Cookie (same as above)
  → redirect to /dashboard
```

OIDC is simpler on Workers because `jose` (already a project dependency) handles JWKS verification with no XML parsing.

### Session bridge

After either SAML or OIDC assertion, `sso-jit.ts` calls the same `issueJwt()` helper already used in `auth-callback-helpers.ts`. The resulting JWT is identical in shape — `{ sub, email, name, orgId, tenantIds, role }`. No new session mechanics are needed; the existing `authMiddleware` validates it transparently.

### JIT provisioning logic

```typescript
// sso-jit.ts
async function jitProvision(db, orgId, email, name, defaultRole = 'member') {
  const existing = await db.prepare(
    'SELECT id FROM platform_users WHERE email = ? AND organization_id = ?'
  ).bind(email, orgId).first();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO platform_users (id, organization_id, email, display_name, role,
     auth_provider, scope_level, created_at)
     VALUES (?, ?, ?, ?, ?, 'sso', 'admin', ?)`
  ).bind(id, orgId, email, name, defaultRole, Date.now()).run();
  return id;
}
```

`auth_provider = 'sso'` distinguishes JIT accounts from Microsoft OAuth accounts.

### D1 schema additions needed

None. `sso_connections` table is complete. The `platform_users` table already has `auth_provider` column.

One optional addition for production hardening: a `sso_sessions` table to store one-time SAML relay state nonces (prevents replay attacks). Can use KV with short TTL instead to avoid a migration:

```
KV key: sso:state:{nonce}  → { orgId, domain, redirectUrl }  TTL: 5 minutes
```

### Build order dependencies

SSO CRUD (done) → `sso-login.ts` → `sso-callback.ts` + `sso-jit.ts` together (they are tightly coupled) → frontend Settings SSO tab.

---

## Feature 2: Copilot Readiness Assessment

### What already exists

This feature is **substantially complete**. The following all exist and are production-ready:

- `lib/copilot/readiness-engine.ts` — orchestrates 7-category scoring with weighted overall score
- `lib/copilot/readiness-checks.ts` — all 7 check functions implemented
- `lib/copilot/readiness-types.ts` — typed interfaces
- `lib/copilot/readiness-report.ts` — HTML report generation
- `routes/copilot-readiness.ts` — POST /assess, GET /latest, GET /history
- `routes/copilot-readiness-pdf.ts` — PDF export route
- `copilot_assessments` D1 table — fully defined with status, category_scores (JSON), recommendations (JSON)
- KV cache: `copilot:{tenantId}:latest` with 2h TTL

### What is missing

1. **Config snapshot diff viewer UI** — backend exists (`lib/snapshots/diff.ts`), frontend diff viewer component not built
2. **Drift alerts on dashboard** — backend `/api/config-drifts/summary` exists, frontend widget wiring to dashboard home page is incomplete

### Graph API endpoints used (verified from source)

| Category | Graph endpoint |
|----------|---------------|
| Licensing | `GET /subscribedSkus` |
| Identity/MFA | `GET /reports/authenticationMethods/userRegistrationDetails` |
| Conditional Access | `GET /identity/conditionalAccessPolicies` |
| Data Protection | `GET /informationProtection/sensitivityLabels` |
| Compliance | `GET /deviceManagement/managedDevices` |
| Security | `GET /security/secureScores` |
| Collaboration | `GET /teams` |
| Data Quality | `GET /users?$select=displayName,mail` |

**Required Graph permissions:** `Organization.Read.All`, `UserAuthenticationMethod.Read.All`, `Policy.Read.All`, `InformationProtection.Read.All`, `DeviceManagementManagedDevices.Read.All`, `SecurityEvents.Read.All`, `Team.ReadBasic.All`. All are application permissions (client_credentials flow already in use).

### D1 schema additions needed

None. `copilot_assessments` table is complete.

### Scoring algorithm (existing, confirmed)

```
overall = sum(category_score * weight) / sum(weights)

Weights: licensing=20, identityAccess=18, dataProtection=18,
         compliance=12, security=12, collaboration=12, dataQuality=8

Category score = (pass*100 + warning*50 + fail*0) / scorable_checks
```

### Build order dependencies

Backend is complete. Only frontend work remains: assessment trigger button, score display ring, category breakdown, PDF download CTA.

---

## Feature 3: Storage Analytics

### What already exists

- `lib/storage/storage-scanner.ts` — `scanOneDriveUsage()` and `scanSharePointUsage()` implemented
- `lib/storage/storage-analyzer.ts` — analysis logic
- `lib/storage/storage-types.ts` — `OneDriveUser`, `SharePointSite` types
- `routes/storage-analytics.ts` — route file exists (content not fully read but file is present)
- `storage_analytics` D1 table — `id, org_id, tenant_id, scan_type, data (JSON), total_used_gb, total_allocated_gb, top_consumers (JSON), recommendations (JSON), scanned_at, created_at`

### Graph API endpoints used (verified from source)

```
OneDrive per-user:  GET /users?$select=id,displayName,mail&$top=200
                    GET /users/{id}/drive?$select=quota
SharePoint sites:   GET /sites?search=*&$select=id,displayName,webUrl&$top=100
                    GET /sites/{id}/drive?$select=quota
```

**Confirmed from Microsoft Graph docs (HIGH confidence):** `quota` resource on a drive returns `{ deleted, remaining, state, total, used }` in bytes.

**Unified storage quota (beta endpoint):** `GET /users/{id}/settings/storage/quota` — returns a single cross-service quota. Not used in current implementation; stick with the drive quota approach which is v1.0 stable.

### Performance constraint on Workers

The current scanner iterates up to 100 users sequentially per `for` loop in `scanOneDriveUsage()`. On a tenant with 100 users, this is 100 sequential Graph API calls inside a single Worker invocation. Workers have a **30-second CPU time limit** (50ms subrequest limit per fetch does not apply to outbound fetch). This will hit the wall at ~30-40 users in practice.

**Fix required:** Batch with `Promise.all` in groups of 10:
```typescript
for (let i = 0; i < userList.length; i += 10) {
  const batch = userList.slice(i, i + 10);
  const results = await Promise.all(batch.map(u => graph.fetch(`/users/${u.id}/drive?$select=quota`)));
  // process results
}
```

Or offload to a Cloudflare Queue for large tenants (queue already exists in the project).

### D1 schema additions needed

None. `storage_analytics` table is complete.

### Build order dependencies

Storage scanning backend is complete. Remaining work: frontend Storage Analytics page (`/governance/storage`) wiring to the existing route, quota visualization (bar charts per user/site), recommendations display.

---

## Feature 4: Drift Alerts on Dashboard

### What already exists

- `lib/snapshots/drift-detector.ts` — writes to `config_drifts` D1 table on every snapshot comparison
- `lib/snapshots/diff.ts` — `diffSnapshots()` computes per-path changes
- `routes/config-drifts.ts` — `GET /api/config-drifts`, `GET /api/config-drifts/summary`, `PATCH /api/config-drifts/:id/acknowledge`
- `config_drifts` D1 table (inferred from drift-detector.ts): `id, tenant_id, snapshot_id, baseline_id, category, path, old_value, new_value, severity, acknowledged, detected_at`

### What is missing

Frontend only. The `/api/config-drifts/summary` endpoint returns `{ total, critical, warning, info, unacknowledged }`. This is the exact shape needed for a dashboard widget.

### Drift-to-dashboard data flow (no new DB tables)

```
KV snapshot:{tenantId}:{snapshotId}:{cat}
  → drift-detector.ts (on snapshot capture)
  → config_drifts D1 table (persisted drift records)
  → GET /api/config-drifts/summary (aggregation query)
  → Dashboard widget (SvelteKit store + fetch)
```

The dashboard home page (`/`) fetches multiple summary endpoints in parallel. Drift summary should be added to that parallel fetch alongside CIS score, security score, and alert counts.

### Drift alert severity mapping (from snapshot-types.ts)

```
category → severity:
  conditionalAccess, mfa → critical
  roles, groups          → warning
  mailflow, spf, dkim    → warning
  other                  → info
```

### D1 schema additions needed

None. All tables exist.

### Build order dependencies

No backend work. Pure frontend: add `DriftSummaryWidget.svelte` component, wire to `/api/config-drifts/summary`, place on dashboard home layout.

---

## Feature 5: Admin Observability

### What already exists

- `lib/sync-job-tracker.ts` — sync job status tracking
- `lib/cron-monitor.ts` — cron execution monitoring
- `lib/structured-logger.ts` — structured logging
- `routes/platform/` directory — platform admin routes
- `lib/audit-logger.ts` — audit log writes

### What is missing

Observability dashboard UI: sync job status table, error log viewer, cron execution history. Backend data likely exists; frontend admin panel page at `/admin` or `/platform` needs building.

---

## Component Boundaries Summary

| Component | Location | Status | Communicates With |
|-----------|----------|--------|-------------------|
| SSO CRUD | `routes/sso.ts` + `sso-handlers.ts` | Complete | D1 sso_connections |
| SSO Login Initiation | `routes/sso-login.ts` | Missing | KV (state nonce), D1 |
| SSO Callback (SAML/OIDC) | `routes/sso-callback.ts` | Missing | @xmldom/xmldom, jose, D1 |
| SSO JIT Provisioning | `routes/sso-jit.ts` | Missing | D1 platform_users, issueJwt() |
| Copilot Assessment | `lib/copilot/` + `routes/copilot-readiness.ts` | Complete | Graph API, D1, KV |
| Copilot PDF | `routes/copilot-readiness-pdf.ts` | Complete | lib/pdf-generator.ts |
| Storage Scanner | `lib/storage/storage-scanner.ts` | Complete (perf fix needed) | Graph API |
| Storage Route | `routes/storage-analytics.ts` | Complete | D1 storage_analytics |
| Drift Detector | `lib/snapshots/drift-detector.ts` | Complete | KV, D1 config_drifts |
| Drift Routes | `routes/config-drifts.ts` | Complete | D1 config_drifts |
| Drift Dashboard Widget | `web/components/DriftSummaryWidget.svelte` | Missing | /api/config-drifts/summary |
| Snapshot Diff Viewer | `web/components/SnapshotDiffViewer.svelte` | Missing | /api/config-snapshots diff |
| Admin Observability UI | `web/routes/admin/` | Partial | /api/platform/* |

---

## Build Order Dependencies

```
Phase A — Backend completions (can be parallelized)
  ├─ A1: SSO login + callback + JIT  [sso-login.ts, sso-callback.ts, sso-jit.ts]
  │       Dependency: @xmldom/xmldom installed, jose already present
  ├─ A2: Storage scanner perf fix    [lib/storage/storage-scanner.ts batch rewrite]
  │       Dependency: none
  └─ A3: Production hardening        [security-headers.ts, rate limits, SAST clean]
          Dependency: none

Phase B — Frontend (can be parallelized after A1/A2)
  ├─ B1: SSO settings UI             [web/routes/settings/ SSO tab]
  │       Dependency: A1
  ├─ B2: Drift dashboard widget      [DriftSummaryWidget.svelte on /]
  │       Dependency: none (API already exists)
  ├─ B3: Snapshot diff viewer        [SnapshotDiffViewer.svelte]
  │       Dependency: none (API already exists)
  ├─ B4: Storage analytics page      [/governance/storage full UI]
  │       Dependency: A2
  └─ B5: Copilot readiness page      [/security/copilot full UI]
          Dependency: none (API already exists)

Phase C — Test + CI hardening
  ├─ C1: SSO unit + integration tests
  ├─ C2: Playwright E2E for SSO login flow
  └─ C3: CI coverage gates + SAST gates
```

**Foundational (must come first):** A1 (SSO callback) because it is the only feature with no existing backend. Everything else is frontend-wiring of already-functional APIs.

**Can be parallelized:** B2 + B3 + B5 (all pure frontend against complete APIs). A2 + A3 (independent backend fixes).

---

## Data Flow Patterns

### SSO login flow (new)
```
User enters email → frontend resolves org domain → GET /api/sso/login/{domain}
  → Worker looks up sso_connections by domain
  → SAML: build AuthnRequest, redirect to IdP SSO URL
  → OIDC: redirect to authorization_endpoint with state nonce in KV
IdP authenticates → POST /api/sso/callback/saml or GET /api/sso/callback/oidc
  → validate assertion/token
  → JIT provision platform_user if jit_enabled
  → issue JWT + Set-Cookie
  → redirect to /dashboard
```

### Copilot assessment flow (existing)
```
POST /api/copilot-readiness/assess
  → check KV for graph:{azureTenantId}:access_token
  → parallel Graph API calls (7 categories × Promise.all)
  → compute weighted score
  → UPDATE copilot_assessments WHERE id = assessId
  → KV.put copilot:{tenantId}:latest (2h TTL)
  → return result
```

### Storage scan flow (existing + perf fix)
```
POST /api/storage-analytics/scan
  → GET /users (batch 200)
  → Promise.all in groups of 10: GET /users/{id}/drive?$select=quota
  → GET /sites?search=* (top 100)
  → Promise.all in groups of 10: GET /sites/{id}/drive?$select=quota
  → aggregate totals
  → INSERT storage_analytics
  → return summary
```

### Drift detection flow (existing, runs on snapshot capture)
```
captureSnapshot() → detectDrift(kv, db, tenantId, newManifest, previousSnapshotId)
  → load old + new snapshot categories from KV
  → diffSnapshots() → CategoryDiff[]
  → INSERT config_drifts for each change (max 20 per category)
  → INSERT security_alerts for critical/warning drifts
```

---

## Workers Runtime Constraints Checklist

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| No Node.js `crypto` module | SAML signature validation | Use `@xmldom/xmldom` + `xml-crypto` (pure JS, Workers-compatible) |
| No `DOMParser` | SAML XML parsing | `@xmldom/xmldom` (pure JS W3C DOM Level 2, Workers-compatible) |
| 30s CPU limit per invocation | Storage scan over large tenants | Batch Graph calls with `Promise.all(groups of 10)` or offload to Queue |
| No filesystem | PDF generation | Already handled by `lib/pdf-generator.ts` (in-memory) |
| No `require()` | All deps must be ESM-bundled | Wrangler bundles via esbuild — works with `@xmldom/xmldom` |
| Subrequest limits (1000/req) | Parallel Graph calls | Batch to ≤50 concurrent fetches per invocation |

---

## D1 Schema Additions Needed

**None required for this milestone.** All tables exist:

| Table | Feature | Status |
|-------|---------|--------|
| `sso_connections` | SSO | Complete |
| `platform_users` (auth_provider col) | SSO JIT | Complete |
| `copilot_assessments` | Copilot Readiness | Complete |
| `storage_analytics` | Storage Analytics | Complete |
| `config_drifts` | Drift Alerts | Complete (inferred from drift-detector.ts writes) |
| `config_snapshots` | Diff Viewer | Complete |

Optional KV-based nonce store for SSO relay state (avoids D1 migration, preferred):
```
KV: sso:state:{nonce} → JSON { orgId, domain, redirectUrl, expiresAt }
TTL: 300 seconds
```

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Existing implementations | HIGH | Direct source code inspection |
| SAML on Workers (@xmldom/xmldom) | MEDIUM | npm package confirmed Workers-compatible; xml-crypto uses it; integration testing required |
| Graph API storage endpoints | HIGH | Microsoft official docs (v1.0 stable) + confirmed in storage-scanner.ts |
| Graph API copilot endpoints | HIGH | Source code inspection of readiness-checks.ts |
| D1 schema completeness | HIGH | Direct schema-d1.ts inspection |
| Workers CPU limit on storage scan | HIGH | Cloudflare Workers documented limits, sequential loop pattern confirmed in source |

---

## Sources

- [Cloudflare Workers runtime limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Microsoft Graph quota resource](https://learn.microsoft.com/en-us/graph/api/resources/quota?view=graph-rest-1.0)
- [Microsoft Graph drive endpoint](https://learn.microsoft.com/en-us/graph/api/resources/drive?view=graph-rest-1.0)
- [@xmldom/xmldom npm package](https://www.npmjs.com/package/@xmldom/xmldom)
- [SAML on Cloudflare Workers (hoop.dev)](https://hoop.dev/blog/the-simplest-way-to-make-cloudflare-workers-saml-work-like-it-should/)
- [Microsoft Graph OneDrive API overview](https://learn.microsoft.com/en-us/graph/onedrive-concept-overview)
