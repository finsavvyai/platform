# Phase E — Google Workspace Beta

**Goal:** 10x TAM. Multi-cloud play. Unlock SMB / education segment heavily Google-dominated.

**Effort:** 3 weeks (15 working days). Solo eng.

**Prerequisite:** Phase A done (multi-tenant SSO model stable). Phase E touches `tenants` table; do not race with Phase A migrations.

## Verified Current State

| File | LOC | Notes |
|------|-----|-------|
| `packages/graph/` | — | Microsoft Graph SDK wrapper |
| `tenants` table | — | `azure_tenant_id` column required (NOT NULL per schema) |
| `packages/google-workspace/` | — | **does not exist** |
| `apps/api/src/lib/cis/scanner.ts` | — | M365-coupled control engine |
| Onboarding flows | — | M365 OAuth only (verify exact paths during E1) |

## Honest Gaps (Greenfield)

1. **No Google Workspace API client** — entire SDK to build.
2. **No abstract tenant provider** — `tenants.azure_tenant_id` is non-nullable, baked into 70+ routes.
3. **No Workspace CIS controls** — different control set from M365 (different OAuth scopes, different admin console concepts).
4. **No multi-provider UI** — onboarding wizard, dashboard, alerts all assume M365.

## Tasks (atomic commits)

### E1 — Provider abstraction (3d, FOUNDATIONAL)
- [ ] E1.1 Read all routes referencing `tenants.azure_tenant_id` (`grep -rE "azure_tenant_id" apps/api/src/`) — count + categorize
- [ ] E1.2 Migration `0023_tenant_provider.sql` — add `provider TEXT NOT NULL DEFAULT 'microsoft'`, make `azure_tenant_id` nullable, add `external_tenant_id TEXT` (provider-agnostic ID), backfill existing rows from `azure_tenant_id`
- [ ] E1.3 Update Drizzle schema in `packages/db/src/schema-d1.ts`
- [ ] E1.4 `apps/api/src/lib/providers/types.ts` — `TenantProvider = 'microsoft' | 'google'`, `ProviderClient` interface (auth, fetch user list, fetch security state)
- [ ] E1.5 `apps/api/src/lib/providers/registry.ts` — get provider client by tenant.provider
- [ ] E1.6 Routes refactor: replace direct `azure_tenant_id` access with `getTenantProvider(tenant)` (incremental — start w/ `/api/tenants/sync`, expand)
- [ ] E1.7 Unit tests for provider registry; integration test: existing M365 tenant still works post-migration
- [ ] E1.8 Type-check + run full test suite (must stay green)

**Commit:** `refactor(tenants): add provider abstraction without breaking M365 path`

### E2 — `@tenantiq/google-workspace` package (3d)
- [ ] E2.1 Create `packages/google-workspace/` workspace
- [ ] E2.2 `packages/google-workspace/src/client.ts` — Admin SDK wrapper, service-account JWT signing, domain-wide delegation
- [ ] E2.3 `packages/google-workspace/src/users.ts` — list, get, security state (2SV enrollment, last login)
- [ ] E2.4 `packages/google-workspace/src/groups.ts` — group enumeration, members
- [ ] E2.5 `packages/google-workspace/src/security.ts` — alert center, login activity reports
- [ ] E2.6 `packages/google-workspace/src/drive.ts` — basic drive activity (defer deep analytics to v2)
- [ ] E2.7 `packages/google-workspace/src/types.ts` — `GoogleUser`, `GoogleGroup`, `GoogleSecurityAlert` types
- [ ] E2.8 Unit tests w/ mocked googleapis responses

**Commit:** `feat(google-workspace): admin-sdk client + users/groups/security modules`

### E3 — OAuth + service account onboarding (2d)
- [ ] E3.1 Migration `0024_google_workspace_credentials.sql` — `google_credentials(id, tenant_id, sa_email, key_json_kv_ref, customer_id, domain, status, created_at)` (private key in KV w/ encryption)
- [ ] E3.2 `apps/api/src/routes/tenants/connect-google.ts` — instructions endpoint: returns step-by-step (create SA, enable APIs, grant DWD scopes), accepts uploaded SA JSON
- [ ] E3.3 SA key encryption: existing pattern (whatever Microsoft tokens use); reuse
- [ ] E3.4 Connection test endpoint: `POST /api/tenants/:id/google/test` — list 1 user, return success/failure
- [ ] E3.5 UI `apps/web/src/routes/tenants/connect/google/+page.svelte` — wizard w/ video walkthrough, JSON upload, test button
- [ ] E3.6 Onboarding flow: provider picker (Microsoft / Google) at start

**Commit:** `feat(google-workspace): service account onboarding wizard`

### E4 — Workspace CIS controls (4d)
- [ ] E4.1 `apps/api/src/lib/cis/google/control-defs.ts` — define ~30 controls from CIS Google Workspace Foundations Benchmark v1.x (subset for v1; full coverage in later phase)
- [ ] E4.2 `apps/api/src/lib/cis/google/scanner.ts` — fetch Workspace state, run evaluation (mirror M365 pattern: `fetchWorkspaceData`, `runEvaluation`)
- [ ] E4.3 `apps/api/src/lib/cis/google/scanner-types.ts` — Workspace-specific result types (or extend shared)
- [ ] E4.4 Wire into existing `cis_scans` table — verify column compatibility (provider column needed?)
- [ ] E4.5 Migration `0025_cis_scans_provider.sql` — add `provider TEXT NOT NULL DEFAULT 'microsoft'` to `cis_scans`
- [ ] E4.6 Route `/api/cis-benchmark/scan` provider-aware — dispatch to M365 or Workspace scanner
- [ ] E4.7 Unit tests: each control has fixture + expected result
- [ ] E4.8 Integration test against real Workspace dev tenant

**Commit:** `feat(cis): Google Workspace control engine and scanner`

### E5 — UI provider-aware (2d)
- [ ] E5.1 `apps/web/src/lib/stores/tenant.ts` — extend tenant store with provider field
- [ ] E5.2 Dashboard `/`: provider badge per tenant, hide M365-specific widgets when provider=google
- [ ] E5.3 `/security/cis/+page.svelte` — provider-aware control labels, link to Workspace admin console for remediation steps
- [ ] E5.4 Alerts UI: provider-aware iconography
- [ ] E5.5 Hide irrelevant nav links (e.g., `/security/email` if M365-only) per provider
- [ ] E5.6 Component tests

**Commit:** `feat(web): provider-aware dashboard and CIS UI`

### E6 — Beta gating + telemetry (1d)
- [ ] E6.1 Feature flag `google_workspace_beta` (existing flags engine)
- [ ] E6.2 Beta opt-in flow: `/settings/beta` page or banner
- [ ] E6.3 Telemetry: track sync success rate, scan duration, error categories per provider
- [ ] E6.4 Beta exit criteria documented: ≥10 active beta tenants, <5% scan failure rate, no P0 bugs for 14d

**Commit:** `feat(google-workspace): feature flag and beta telemetry`

## Acceptance Gates

- [ ] Real Workspace dev tenant connects in <10min following docs
- [ ] User list, group list, basic security state all populate
- [ ] CIS scan runs end-to-end, produces score, ≥25 of 30 controls evaluate (≥83% coverage of defined set)
- [ ] Existing M365 tenants unaffected (verify w/ smoke test on staging)
- [ ] Provider migration zero-downtime (test via canary deploy)

## Risks / Unknowns

- **Domain-wide delegation review** — Google requires admin to manually grant scopes via admin console; can't fully automate. Doc must be flawless.
- **Service account key rotation** — keys can be revoked by customer. Need rotation alerting (defer to post-beta).
- **Workspace API quotas** — different limits than Graph. Need separate rate-limit profile.
- **CIS Workspace control parity** — control IDs differ from M365 CIS. Cross-reference table needed for "compare M365 vs Google tenants" (scope creep risk).
- **Existing route assumptions** — many lib files assume Graph. E1 categorization may surface 30-50 places needing changes; budget could grow 1-2d.
- **Drive analytics deep dive** — explicitly out-of-scope here; oversharing scanner for Workspace is Phase B-equivalent for Workspace, not v1.

## NOT In Scope

- Workspace Drive deep analytics / oversharing (defer post-beta)
- Gemini governance (defer)
- Google Cloud IAM (separate product surface)
- Cross-provider unified inbox / unified user view
- Workspace SSO acting AS IdP for TenantIQ login (Phase A is separate concern)
- Auto-remediation of Workspace controls (read-only beta first)

## Files Touched (Concrete)

```
NEW:
  packages/db/migrations/0023_tenant_provider.sql
  packages/db/migrations/0024_google_workspace_credentials.sql
  packages/db/migrations/0025_cis_scans_provider.sql
  packages/google-workspace/{package.json,tsconfig.json,README.md}
  packages/google-workspace/src/{client,users,groups,security,drive,types,index}.ts
  apps/api/src/lib/providers/{types,registry}.ts
  apps/api/src/lib/cis/google/{control-defs,scanner,scanner-types}.ts
  apps/api/src/routes/tenants/connect-google.ts
  apps/web/src/routes/tenants/connect/google/+page.svelte
  apps/web/src/routes/settings/beta/+page.svelte

MODIFIED:
  packages/db/src/schema-d1.ts (add provider, nullable azure_tenant_id)
  apps/api/src/routes/cis-benchmark.ts (provider dispatch)
  apps/api/src/lib/feature-flag-defaults.ts (add google_workspace_beta)
  apps/api/src/routes/tenants/* (provider-aware sync paths)
  apps/web/src/routes/+page.svelte (provider badges)
  apps/web/src/routes/security/cis/+page.svelte (provider-aware)
  apps/web/src/lib/stores/tenant.ts (provider field)
```
