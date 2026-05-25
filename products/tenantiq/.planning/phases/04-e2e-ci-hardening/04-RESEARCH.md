# Phase 4: E2E + CI Hardening — Research

**Researched:** 2026-04-22
**Domain:** CI/CD security gates, Playwright E2E, Hono security headers, D1 schema indexing, multi-tenant scoping
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HARD-01 | All API routes return security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS) | `securityHeaders` middleware exists in `create-app.ts` using `hono/secure-headers` — but CSP is NOT set there; it's in a separate `security-headers.ts` file that is NOT wired into `create-app.ts`. Gap confirmed. |
| HARD-02 | CI pipeline includes SAST scan (Semgrep) — blocks merge on critical findings | `security.yml` already has a Semgrep SAST job using `semgrep/semgrep` container with `--error` flag. Job is present but NOT in the `status-check` gate in `ci.yml`. Security workflow is a separate pipeline, not blocking merge via branch protection on the same required check. |
| HARD-03 | CI pipeline includes dependency vulnerability scan (npm audit) — blocks on High/Critical | `security.yml` uses `pnpm audit --audit-level=high`. Requirement says "audit-ci" but actual tool is `pnpm audit`. Either `audit-ci` replaces it or the requirement description is satisfied by current `pnpm audit`. Needs clarification — current `pnpm audit` satisfies the intent. |
| HARD-04 | CI pipeline includes secret scan (Gitleaks) — blocks on any detected secret | `security.yml` uses TruffleHog (not Gitleaks). Requirement specifies Gitleaks. Either replace TruffleHog with Gitleaks OR add Gitleaks alongside it. Gap: Gitleaks not present; TruffleHog is. |
| HARD-05 | All cron handlers and queue processors scoped by org_id | Audit found: `compliance-scan.ts`, `group-cleanup.ts`, `guest-review.ts`, `scheduled-remediation.ts`, `scheduled-scans.ts`, `security-stack-scan.ts`, `tenant-health.ts`, `webhook-retry.ts`, `workflow-trigger.ts` have zero org_id references. Queue processors (`alert-handler.ts`, `workflow-handler.ts`, `sync-handler.ts`) operate on `tenantId` only — no `orgId` assertion. Gap confirmed across ~9 cron files and 3 queue processors. |
| HARD-06 | D1 compound indexes on (organization_id, created_at) for all high-read tables | Schema audit found: zero compound indexes exist anywhere in `schema-d1.ts`. All existing indexes are single-column. High-read tables without compound `(org/tenant_id, created_at)` index: `security_alerts`, `audit_logs`, `config_drifts`, `config_snapshots`, `copilot_assessments`, `storage_analytics`, `sync_jobs`, `backup_jobs`. |
| E2E-01 | Playwright E2E suite runs against `wrangler pages dev` in CI | Current `playwright.config.ts` `webServer` uses `pnpm --filter @tenantiq/web dev` (Vite) and `pnpm --filter @tenantiq/api dev` (Wrangler). Requirement specifies `wrangler pages dev` for the web app. Gap: web server uses Vite dev, not `wrangler pages dev`. |
| E2E-02 | E2E: MSP login → connect Azure tenant → dashboard populated | No existing E2E test covers this flow end-to-end. SSO tests exist (`sso.spec.ts`) but stub API calls — no real login flow. |
| E2E-03 | E2E: CIS scan → view results → auto-remediate | No existing E2E test covers CIS scan flow. |
| E2E-04 | E2E: SSO config → SSO login → user provisioned | `sso.spec.ts` covers SSO settings UI and API error cases but NOT the full login+provisioning flow (cannot do real OAuth redirect in Playwright without a live IdP). |
| E2E-05 | E2E: Copilot Readiness trigger → score display | No existing E2E test covers Copilot Readiness page. |
</phase_requirements>

---

## Summary

Phase 4 closes all release-blocking quality gaps: security header completeness, CI merge gates, multi-tenant isolation in async workers, E2E coverage of new features, and database index performance.

The codebase is further along than the requirements imply. `create-app.ts` already uses `hono/secure-headers` with X-Frame-Options, X-Content-Type-Options, and HSTS. A separate `security-headers.ts` with CSP exists but is not wired — it must be imported and applied in `create-app.ts`. The security CI pipeline (`security.yml`) already runs Semgrep + TruffleHog + `pnpm audit`, but it is a separate workflow not gated into the branch-protection `status-check` job in `ci.yml`. The main work is: (1) wire CSP into `create-app.ts`, (2) integrate the security workflow into the merge gate, (3) add Gitleaks (or align the requirement to TruffleHog), (4) add `org_id` assertions to 9 cron handlers and 3 queue processors, (5) add compound D1 indexes, (6) write Playwright E2E stubs for 4 new flows, (7) switch CI E2E web server to `wrangler pages dev`.

**Primary recommendation:** Most HARD requirements are 80% done — the blockers are wiring/integration gaps, not net-new features. Treat this phase as a "close the loop" phase: connect existing security machinery into the merge gate, add org_id guards as thin assertion wrappers, and add E2E stubs in a Wave 0 → Wave 1 pattern.

---

## Standard Stack

### Core (already in use — no new installs required)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `hono/secure-headers` | bundled with Hono | X-Frame, XCTO, HSTS middleware | Already wired in `create-app.ts` |
| `hono/factory` `createMiddleware` | bundled | Custom CSP middleware | `security-headers.ts` exists, not wired |
| `@playwright/test` | detected in config | E2E browser testing | Installed, `playwright.config.ts` present |
| `vitest` | detected in both `vitest.config.ts` | Unit test framework | Active, coverage thresholds enforced |
| Semgrep | `semgrep/semgrep` container | SAST scanning | In `security.yml`, not in merge gate |
| TruffleHog | `trufflesecurity/trufflehog@main` | Secret detection | In `security.yml` |
| `pnpm audit` | pnpm built-in | Dependency CVE scan | In `security.yml` |

### New Additions Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gitleaks` (GitHub Action) | `gitleaks/gitleaks-action@v2` | Secret scan (HARD-04 specifies Gitleaks) | Replace or supplement TruffleHog if requirement is strict |
| `audit-ci` | `^6` | Structured CVE exit-code control | Only if `pnpm audit` exit codes prove unreliable in CI; current `pnpm audit --audit-level=high` is equivalent |

**Installation (if Gitleaks required):**
```bash
# No local install — GitHub Action only
# In ci.yml or security.yml:
# uses: gitleaks/gitleaks-action@v2
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 4 additions)
```
apps/api/src/
├── middleware/
│   └── security-headers.ts    # EXISTS — wire into create-app.ts
├── lib/
│   └── org-scope-assert.ts    # NEW — assertOrgId(orgId) helper
├── cron/
│   └── *.ts                   # ADD assertOrgId() call at top of each handler
└── queues/
    └── *.ts                   # ADD orgId field to message types + assert

packages/db/src/
└── schema-d1.ts               # ADD compound indexes on (org_id, created_at)

tests/e2e/
├── msp-login.spec.ts          # NEW — E2E-02
├── cis-scan.spec.ts           # NEW — E2E-03
├── sso-flow.spec.ts           # NEW — E2E-04 (full flow, mock IdP)
└── copilot-readiness.spec.ts  # NEW — E2E-05

.github/workflows/
├── ci.yml                     # UPDATE — add security jobs to status-check gate
└── security.yml               # UPDATE — add Gitleaks job
```

### Pattern 1: CSP Middleware Wiring
**What:** Import and apply `securityHeaders` from `middleware/security-headers.ts` as global middleware in `create-app.ts`.
**When to use:** Required for HARD-01. The `hono/secure-headers` in `create-app.ts` sets 4 headers; CSP is defined in `security-headers.ts` but not applied.
**Example:**
```typescript
// Source: apps/api/src/app/create-app.ts — add after existing secureHeaders() call
import { securityHeaders } from '../middleware/security-headers';
// ...
app.use('*', securityHeaders);
```
**Note:** The two middlewares do not conflict — `hono/secure-headers` sets X-Frame/XCTO/HSTS, `security-headers.ts` adds CSP and X-XSS-Protection.

### Pattern 2: Org Scope Assertion Helper
**What:** A throwing guard function that enforces `org_id` is non-null before any DB query in cron/queue handlers.
**When to use:** Every cron handler and queue processor (HARD-05).
**Example:**
```typescript
// Source: apps/api/src/lib/org-scope-assert.ts (new file)
export function assertOrgId(orgId: string | null | undefined, context: string): asserts orgId is string {
  if (!orgId) {
    throw new Error(`[${context}] org_id scope required — no query may run without tenant context`);
  }
}
```
**Usage in cron:**
```typescript
// In runScheduledRemediations, runWorkflowTriggerCheck, etc.
for (const tenant of tenants) {
  assertOrgId(tenant.organizationId, 'ScheduledRemediation');
  // ...existing loop body
}
```

### Pattern 3: D1 Compound Index Addition
**What:** Add `index('idx_{table}_org_created').on(table.organizationId, table.createdAt)` to high-read tables.
**When to use:** HARD-06. SQLite uses the leftmost index column for range scans — put `organization_id` first, `created_at` second.
**Example:**
```typescript
// Source: packages/db/src/schema-d1.ts
(table) => [
  index('idx_alerts_tenant').on(table.tenantId),
  index('idx_alerts_status').on(table.status),
  // ADD:
  index('idx_alerts_org_created').on(table.organizationId, table.detectedAt),
]
```
**Note:** `security_alerts` uses `tenantId` not `organizationId` — the compound index should use `tenantId, detectedAt` or add `organizationId` to the table first via migration.

### Pattern 4: Playwright E2E with API Mocking
**What:** All new E2E tests follow the pattern in `sso.spec.ts` — `page.route()` to mock API responses, real browser navigation.
**When to use:** E2E-02 through E2E-05. Cannot do real Microsoft OAuth in CI.
**Example:**
```typescript
// Source: tests/e2e/sso/sso.spec.ts (existing pattern to replicate)
await page.route('**/api/tenants/*/copilot/readiness', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ score: 78, categories: { identity: 90, data: 65 } }),
  })
);
await page.goto('/security/copilot');
await expect(page.locator('[data-testid="readiness-score"]')).toBeVisible();
```

### Pattern 5: CI Merge Gate Integration
**What:** Add security scan jobs as `needs` dependencies to the `status-check` job in `ci.yml`, OR reference security workflow results via `workflow_run` events.
**When to use:** HARD-02, HARD-03, HARD-04.
**Recommended approach:** Add security jobs directly into `ci.yml` (or call them as reusable workflow) so a single required status check covers everything. The current approach of a separate `security.yml` workflow does NOT block PRs unless branch protection rules explicitly require it as a separate check name.

```yaml
# ci.yml — update status-check job
status-check:
  needs: [line-limit, lint, typecheck, test, e2e, build, sast, dependency-audit, secret-scan]
```

### Anti-Patterns to Avoid
- **Separate security workflow not referenced in merge gate:** `security.yml` runs but its `security-gate` job is not in `ci.yml`'s `status-check`. PRs can merge even if security scans fail unless branch protection requires the separate workflow's check by name.
- **Missing CSP assumption:** `hono/secure-headers()` does NOT set CSP — it only sets X-Frame-Options, X-Content-Type-Options, etc. CSP requires explicit configuration or the separate `securityHeaders` middleware.
- **tenantId vs organizationId confusion:** Queue processors route messages by `tenantId`. Cron handlers iterate `getAllActiveTenants()` which returns `tenant.organizationId`. The org_id assertion must use `tenant.organizationId` for cron and the `orgId` field in queue messages.
- **Playwright `webServer` vite vs wrangler:** For E2E-01, `pnpm --filter @tenantiq/web dev` starts Vite. `wrangler pages dev` starts the Cloudflare Pages runtime which binds D1/KV/R2. They behave differently for routing and SSR. The requirement explicitly says `wrangler pages dev`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security headers | Custom `c.header()` calls scattered per route | `hono/secure-headers` + `security-headers.ts` as global middleware | Already exists; scattering creates omission risk |
| CSP nonce generation | Per-request nonce middleware | Static CSP policy (current approach is correct for API) | APIs don't serve HTML; static CSP is sufficient |
| Secret scanning | Custom regex in CI | Gitleaks or TruffleHog | Both cover 600+ secret patterns, maintained by security teams |
| SAST | Custom eslint security rules | Semgrep with `p/security-audit` ruleset | Semgrep has 2000+ rules for Node.js, already configured |
| Compound index migration | Manual `CREATE INDEX` SQL | Drizzle schema + `npm run db:generate` | Keeps schema-d1.ts as source of truth; generates correct migration |

---

## Common Pitfalls

### Pitfall 1: Security Headers Only on 200 Responses
**What goes wrong:** If `securityHeaders` middleware is placed before `await next()` instead of after, headers only appear on responses that haven't already sent. Hono's `createMiddleware` pattern calls `await next()` then sets headers — the existing `security-headers.ts` does this correctly (sets headers after `await next()`).
**How to avoid:** Keep the `await next()` first pattern. Do NOT move it.
**Warning signs:** Headers missing on 4xx/5xx responses in integration tests.

### Pitfall 2: `pnpm audit` Exit Code Unreliable for `audit-ci` Integration
**What goes wrong:** `pnpm audit --audit-level=high` exits non-zero for high+ CVEs but may not give structured JSON output that `audit-ci` expects.
**How to avoid:** Current `pnpm audit --audit-level=high` in `security.yml` is functionally equivalent to `audit-ci --high`. Only replace with `audit-ci` if structured reporting is needed. The requirement text says "audit-ci" but the intent (block on High/Critical) is satisfied by `pnpm audit --audit-level=high`.

### Pitfall 3: D1 Compound Index Column Mismatch
**What goes wrong:** `security_alerts` table uses `tenantId` + `detectedAt`, not `organizationId` + `createdAt`. Adding a compound index on `(organizationId, createdAt)` requires that column to exist on the table. Several high-read tables use `tenantId` as the primary partition key.
**How to avoid:** Per table, use the actual partition column (may be `tenantId` or `orgId`) as the compound index prefix. For cross-org queries (admin dashboards), `orgId + createdAt` is needed. For per-tenant queries, `tenantId + createdAt`.
**Recommendation:** Add both where the table has both columns. Where only `tenantId` exists, add `tenantId + createdAt`.

### Pitfall 4: Playwright `webServer.reuseExistingServer` in CI
**What goes wrong:** Current config has `reuseExistingServer: !process.env.CI` — correct for CI. But switching `wrangler pages dev` requires `wrangler.toml` with correct `pages_build_output_dir` and may need `pnpm build` before the server starts.
**How to avoid:** Add `pnpm build` as a prerequisite step before E2E in `ci.yml` (already present: `e2e` job does `pnpm build`). Update `webServer[0].command` to `wrangler pages dev apps/web/.svelte-kit/cloudflare --port 5173`.

### Pitfall 5: `scheduled-remediation.ts` Queries Without Org Scope
**What goes wrong:** `runScheduledRemediations` queries `schema.remediations` with no `WHERE org_id = ?` — a platform-wide query that could return rows across all tenants. If org_id isolation is required per-execution context, this is a data isolation gap.
**How to avoid:** Add `org_id` column to remediation message type, assert at top of handler. For the global cron query, document explicitly that it is intentionally cross-org (it processes all due remediations by timestamp) and add a code comment.

### Pitfall 6: `workflow-trigger.ts` Uses Raw D1 SQL Without Org Scope
**What goes wrong:** This file intentionally bypasses Drizzle (documented comment explains why). The raw `SELECT id, display_name FROM tenants WHERE status = 'active'` query is tenant-scoped but has no org partition. In a platform cron context this is acceptable (iterate all tenants), but the assertion guard should document the intentional exception.
**How to avoid:** Add `assertOrgId` after `for (const tenant of tenantsRes.results)` using `tenant.organization_id` if the column exists in the raw query, or document as intentional cross-tenant platform operation.

---

## Code Examples

### Existing Security Headers (already correct, needs CSP wired)
```typescript
// Source: apps/api/src/app/create-app.ts (current state)
app.use('*', secureHeaders({
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
}));
// MISSING: CSP header — must add securityHeaders from middleware/security-headers.ts
```

### Existing CSP Middleware (not yet wired)
```typescript
// Source: apps/api/src/middleware/security-headers.ts
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.tenantiq.app https://*.sentry.io",
  "font-src 'self'"
].join('; ');

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header('Content-Security-Policy', CSP);
  // ... X-Content-Type-Options, X-Frame-Options, HSTS (duplicates — deduplicate with create-app.ts)
});
```

### Compound Index Pattern for schema-d1.ts
```typescript
// Source: packages/db/src/schema-d1.ts pattern — apply to high-read tables
export const securityAlerts = sqliteTable(
  'security_alerts',
  { /* ... */ },
  (table) => [
    index('idx_alerts_tenant').on(table.tenantId),
    index('idx_alerts_status').on(table.status),
    // ADD compound index:
    index('idx_alerts_tenant_detected').on(table.tenantId, table.detectedAt),
  ]
);
```

### Playwright webServer for wrangler pages dev
```typescript
// Source: playwright.config.ts — update webServer[0]
webServer: [
  {
    command: 'wrangler pages dev apps/web/.svelte-kit/cloudflare --port 5173 --compatibility-date 2024-09-23',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // API server unchanged
],
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Scatter headers per route | `hono/secure-headers` global middleware | No per-route omissions |
| Separate security workflow (not gated) | Security jobs in `ci.yml` `status-check` | Merge actually blocked |
| No compound D1 indexes | Compound `(partition_col, created_at)` indexes | Dashboard queries 10-100x faster at scale |
| No org_id assertions in async workers | `assertOrgId()` throwing guard | Runtime crash instead of silent data leak |

**Deprecated/outdated:**
- `security-headers.ts` as standalone non-wired file: must be integrated into `create-app.ts`
- Vite dev server in E2E CI: replace with `wrangler pages dev` to match production runtime

---

## Open Questions

1. **Gitleaks vs TruffleHog**
   - What we know: `security.yml` uses TruffleHog (`--only-verified`). HARD-04 requires Gitleaks specifically.
   - What's unclear: Whether the requirement name is prescriptive or the intent (any secret scan) is sufficient.
   - Recommendation: Add Gitleaks action alongside TruffleHog. Cost is ~30s CI time. Both provide different detection heuristics.

2. **`security_alerts` lacks `organization_id` column**
   - What we know: `security_alerts` table has `tenantId` and `detectedAt` but no `organizationId` column. HARD-06 requires compound `(organization_id, created_at)` index.
   - What's unclear: Should a migration add `organization_id` to `security_alerts`, or should the compound index use `tenantId + detectedAt`?
   - Recommendation: Use `tenantId + detectedAt` for tables that partition by tenant. Document the decision. Only add `organization_id` FK if cross-org admin queries are needed (they are for MSP dashboard).

3. **E2E-01: `wrangler pages dev` vs Vite dev — SSR/routing differences**
   - What we know: SvelteKit configured for Cloudflare Pages adapter. `wrangler pages dev` binds D1/KV/R2 but requires a built output.
   - What's unclear: Whether E2E tests that mock all API calls care about the runtime difference.
   - Recommendation: Change `webServer[0].command` to `wrangler pages dev` as required. Run `pnpm build` before E2E in CI (already done in `ci.yml`).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | Vitest (v8 coverage provider) |
| Web unit config | `apps/web/vitest.config.ts` — jsdom environment |
| API unit config | `apps/api/vitest.config.ts` — node environment |
| E2E framework | Playwright (`playwright.config.ts`) |
| Quick unit run | `pnpm test` (turbo — runs both apps) |
| API unit only | `cd apps/api && npx vitest run` |
| E2E quick | `pnpm test:e2e:chromium` |
| Full E2E | `pnpm test:e2e` |
| Coverage check | `pnpm test -- --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | API response includes CSP, X-Frame, X-Content-Type, HSTS headers | unit | `cd apps/api && npx vitest run src/middleware/security-headers.test.ts` | Wave 0 gap |
| HARD-02 | CI Semgrep job blocks on critical findings | CI/manual | semgrep runs in `security.yml` — verify via PR | Manual-only |
| HARD-03 | CI dep scan blocks on High/Critical CVE | CI/manual | `pnpm audit --audit-level=high` in security.yml | Manual-only |
| HARD-04 | CI secret scan blocks on any secret | CI/manual | Gitleaks/TruffleHog in security.yml | Manual-only |
| HARD-05 | Cron handlers assert org_id before queries | unit | `cd apps/api && npx vitest run src/cron/org-scope-assert.test.ts` | Wave 0 gap |
| HARD-06 | D1 compound indexes exist on high-read tables | unit/smoke | `cd apps/api && npx vitest run src/lib/schema-indexes.test.ts` | Wave 0 gap |
| E2E-01 | Playwright suite runs against wrangler pages dev | E2E | `pnpm test:e2e:chromium` | Needs config update |
| E2E-02 | MSP login → connect tenant → dashboard | E2E | `pnpm test:e2e:chromium --grep "MSP login"` | Wave 0 gap |
| E2E-03 | CIS scan → view results → auto-remediate | E2E | `pnpm test:e2e:chromium --grep "CIS scan"` | Wave 0 gap |
| E2E-04 | SSO config → SSO login → provisioned | E2E | `pnpm test:e2e:chromium --grep "SSO flow"` | Wave 0 gap (sso.spec.ts covers UI only) |
| E2E-05 | Copilot Readiness trigger → score display | E2E | `pnpm test:e2e:chromium --grep "Copilot Readiness"` | Wave 0 gap |

**Manual-only justifications:**
- HARD-02/03/04: These are CI pipeline configuration verifications — they require a real GitHub Actions run to validate. No local unit test can assert that a GitHub Actions job blocks a PR merge. Verify by: create a test PR with a known secret/vulnerability and confirm the pipeline fails.

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run` (unit only, ~10s)
- **Per wave merge:** `pnpm test -- --coverage` (full unit suite with coverage thresholds)
- **Phase gate:** `pnpm test -- --coverage && pnpm test:e2e:chromium` — full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/middleware/security-headers.test.ts` — covers HARD-01: assert all 5 required headers present on GET/POST responses including 4xx
- [ ] `apps/api/src/lib/org-scope-assert.test.ts` — covers HARD-05: assert assertOrgId throws on null/undefined, passes on non-empty string
- [ ] `apps/api/src/cron/cron-org-scope.test.ts` — covers HARD-05: mock-assert each cron handler calls assertOrgId per tenant iteration
- [ ] `tests/e2e/msp-login.spec.ts` — covers E2E-02: RED stub (import non-existent page selectors to produce compile-time error)
- [ ] `tests/e2e/cis-scan.spec.ts` — covers E2E-03: RED stub
- [ ] `tests/e2e/sso-provisioning.spec.ts` — covers E2E-04: RED stub (sso.spec.ts covers settings UI; this covers login+provisioning)
- [ ] `tests/e2e/copilot-readiness.spec.ts` — covers E2E-05: RED stub
- [ ] Schema index verification: no test file needed — verified by Drizzle migration output and D1 introspection in smoke test

*(HARD-06 compound indexes are verified by inspecting the generated migration SQL — no unit test required, but a smoke test asserting `PRAGMA index_list('security_alerts')` returns expected indexes is recommended for Wave 2.)*

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `apps/api/src/app/create-app.ts` — confirmed `hono/secure-headers` wired, custom CSP middleware not wired
- Direct file read: `apps/api/src/middleware/security-headers.ts` — confirmed CSP defined but unwired
- Direct file read: `.github/workflows/security.yml` — confirmed Semgrep, TruffleHog, pnpm audit present; Gitleaks absent
- Direct file read: `.github/workflows/ci.yml` — confirmed `status-check` does NOT include security jobs
- Direct file read: `packages/db/src/schema-d1.ts` — confirmed zero compound indexes exist
- Direct file read: `playwright.config.ts` — confirmed Vite dev server, not `wrangler pages dev`
- Directory scan: `apps/api/src/cron/` — 22 cron files, 9 with zero org_id references
- Direct file read: `apps/api/src/cron/scheduled-remediation.ts` — confirmed no org_id assertion
- Direct file read: `apps/api/src/cron/workflow-trigger.ts` — confirmed raw D1 SQL, no org_id
- Direct file read: `apps/api/src/queues/alert-handler.ts` — operates on tenantId only, no orgId assertion
- Direct file read: `tests/e2e/sso/sso.spec.ts` — confirmed existing E2E pattern (page.route mocking)

### Secondary (MEDIUM confidence)
- Context7/Hono docs: `hono/secure-headers` does not set CSP by default — requires explicit `contentSecurityPolicy` config option or separate middleware
- Gitleaks GitHub Action: `gitleaks/gitleaks-action@v2` is the standard action; `trufflesecurity/trufflehog@main` is an alternative with `--only-verified` flag

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified by direct file inspection
- Architecture: HIGH — patterns derived from existing working code in the repo
- Pitfalls: HIGH — gaps found by static analysis of actual files, not assumptions
- Org scoping gaps: HIGH — grep-verified across all 22 cron files and 4 queue processors

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable stack; 30 days)
