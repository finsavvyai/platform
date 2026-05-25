# TenantIQ — Code Review Report

**Date**: 2026-04-20
**Scope**: Project-level (all)
**Reviewer**: luna-code-review
**Verdict**: **CHANGES REQUIRED — NO-GO for production merge**

---

## Executive Summary

TenantIQ has strong architectural bones — CI/security pipelines exist, tenant-middleware enforces membership, `createApp` layers CSRF + CORS + secureHeaders + rate-limits, cron + queues + DLQs are modeled correctly, Zod validation is present on ~39 routes, and 139 API test files + 45 root tests exist. But several **critical security defects** sit in the happy path:

1. JWT leaked via URL fragment + `localStorage` (defeats HttpOnly cookie).
2. Two parallel auth middlewares with divergent algorithm pinning and tenant enforcement.
3. Rate limiting uses non-atomic KV (race-window bypass).
4. Graph webhook accepts payloads without `clientState` and without HMAC verification.
5. `security-stack-actions.ts` writes tenant id into the `org_id` audit column (corrupts compliance logs).
6. Silent `success: true` on unknown security actions (compliance liar).
7. Multiple tenant lookups missing `AND organization_id = ?` defense-in-depth.

**File-size policy failing**: 16 non-test source files exceed 200-LOC cap. `schema-d1.ts` is 616 LOC (3.1x).

**Type safety leak**: 1,203 `any` occurrences across 211 API files.

**Coverage enforcement broken**: CI shell check passes if `coverage-summary.json` is missing. No `thresholds` block in vitest configs.

Go/no-go: **NO-GO for production merge** until Critical-1 through Critical-7 resolved.

---

## Critical Issues

### C-1. JWT exfiltration via URL fragment + localStorage
**File**: `apps/api/src/routes/auth-callback.ts:111-112`, `apps/web/src/lib/api/client.ts:204-206`
**Problem**: `auth-callback.ts` places the full JWT in `location.hash` (`#token=${jwt}&user=...`). Client persists it to `localStorage`. Any XSS, any 3p script on the callback page, any extension reads the token. The HttpOnly cookie set on line 103-107 is defeated because the frontend stores a plaintext JS-readable copy anyway.
**Fix**: Stop placing JWT in URL. Rely exclusively on the HttpOnly cookie. `/api/*` calls already hit the same root domain — use `credentials: 'include'` and drop the `Authorization` header. Remove `localStorage.setItem('tenantiq_token', ...)`.

### C-2. Two divergent auth middlewares; one lacks tenant isolation enforcement
**File**: `apps/api/src/middleware/auth.middleware.ts:21-76` vs `apps/api/src/middleware/auth.ts:8-26`
**Problem**: `auth.middleware.ts` pins HS256 only, checks `X-Tenant-Id` membership. `auth.ts` tries RS256→HS256 but does NOT read/validate `X-Tenant-Id` — only sets `c.set('user', payload)`. Which file runs depends on each route's import. Routes using `auth.ts` rely on downstream `tenantMiddleware`, not applied to every route.
**Fix**: Delete one. Keep `auth.ts` (RS256-capable), port `X-Tenant-Id` enforcement into it, migrate imports.

### C-3. Rate limiter has KV race condition
**File**: `apps/api/src/middleware/ratelimit.ts:20-35`
**Problem**: `KV.get` then `KV.put` non-atomic. N concurrent requests read `count=limit-1`, pass check, all increment. Auth `/login` (5/min) burst-past-able. `waitUntil` makes write non-blocking — widens window.
**Fix**: Migrate to Durable Objects or CF Rate Limiting API (`env.RATE_LIMITER.limit({ key })`). Stopgap: blocking `await KV.put`.

### C-4. Graph webhook skips payloads with no `clientState`
**File**: `apps/api/src/routes/graph-webhook.ts:67-110`
**Problem**: Loop only processes notifications `if (notification.clientState)`. Attacker POST to `/api/graph/webhook` with no `validationToken` + no `clientState` = 200 OK with zero HMAC check, zero origin check, zero IP allowlist. No rate limit. DoS + subscription-ID fingerprinting.
**Fix**: Reject missing `clientState`. IP-allowlist Microsoft Graph CIDRs. Add ratelimit middleware. Zod-validate `subscriptionId`.

### C-5. Audit log writes tenant id into `org_id` column
**File**: `apps/api/src/routes/tenants/security-stack-actions.ts:152-154`
**Problem**:
```ts
await db.prepare(
  'INSERT INTO audit_logs (id, org_id, user_id, action, ...) VALUES (?, ?, ?, ?, ...)'
).bind(logId, id, 'system', `${product}:${action}`, ...)
```
`id` = `c.req.param('id')` (tenant id, line 96), not org id. `user_id` hardcoded `'system'` instead of `c.get('user').sub`. Poisons compliance logs, breaks SOC-2 evidence, breaks per-org filtering.
**Fix**: Bind `user.orgId` → `org_id`, `user.sub` → `user_id`. Add `tenant_id` column if absent. Cover with integration test.

### C-6. `security-stack-actions.ts` silently succeeds on unknown action
**File**: `apps/api/src/routes/tenants/security-stack-actions.ts:119-126`
**Problem**:
```ts
if (!productActions || !action || !productActions[action]) {
  return c.json({ success: true, message: 'configuration triggered', productId: productId || product });
}
```
Returns `success: true` when no executor exists. UI shows green check, user thinks MFA policy applied. Compliance liar.
**Fix**: Return `{ success: false, error: 'Unknown action' }` 400. Log to audit.

### C-7. Tenant lookups lack org-scope defense-in-depth
**File**: `apps/api/src/routes/tenants/security-stack-actions.ts:114, 187, 227`, `apps/api/src/routes/tenants/audit-history.ts:22-24`, `apps/api/src/routes/auth-callback.ts:83`
**Problem**: `SELECT ... FROM tenants WHERE id = ?` without `AND organization_id = ?`. Middleware checks JWT `tenantIds` array — populated at issue time, not re-validated. User removed from org post-token-issue = token valid 24h.
**Fix**: Add `AND organization_id = ?` scoping everywhere. JWT TTL → 15m + refresh flow. Invalidate sessions on role/org change.

---

## Major Issues

### M-1. Coverage thresholds not enforced
**File**: `.github/workflows/ci.yml:46-60`
**Problem**: Shell check only fails if `coverage-summary.json` exists. Missing file → silent pass. No `thresholds` block in `apps/web/vitest.config.ts` or `apps/api/vitest.config.ts`.
**Fix**: Add `test.coverage.thresholds.lines = 90`, `branches = 85` in both vitest configs. Fail CI if coverage file missing.

### M-2. `graph-sync.ts` destructive cache rebuild without transaction
**File**: `apps/api/src/lib/graph-sync.ts:49, 91`
**Problem**: `DELETE FROM users_cache WHERE tenant_id = ?` then loop of INSERTs. Mid-loop failure = tenant has zero users until next 6h cron. Inserts swallow errors via `.catch(() => {})`.
**Fix**: Use `db.batch(stmts)` (D1 atomic). Or `INSERT OR REPLACE` without pre-delete. Remove silent catches.

### M-3. `last_sync_at` column/type mismatch
**File**: `apps/api/src/lib/graph-sync.ts:182` vs `packages/db/src/schema-d1.ts:38`
**Problem**: Code binds `new Date().toISOString()` (string) to `last_sync_at` declared `integer`. SQLite loose, but all reads expect epoch ms. Breaks `ORDER BY last_sync_at DESC`.
**Fix**: `.bind(Date.now(), 'active', tenantId)`.

### M-4. Module-level key caching not env-keyed
**File**: `apps/api/src/lib/jwt-keys.ts:4-27`
**Problem**: `cachedPrivateKey` / `cachedPublicKey` / `cachedHs256Secret` module-global. `JWT_SECRET` rotation via new deploy → in-flight isolate keeps stale cache until recycled. HS256 rotation non-deterministic.
**Fix**: Key cache by secret content (hash), or drop cache (`importPKCS8` is microseconds).

### M-5. `localStorage` token persistence
**File**: `apps/web/src/lib/api/client.ts:204-205`
Duplicate of C-1. Remove. Cookie-only.

### M-6. Billing webhook has no replay protection
**File**: `apps/api/src/routes/billing.ts:75-121`
**Problem**: Signature verified, but no stored `webhookEventId`. Captured valid payload replay → double subscription/cancel.
**Fix**: Extract LemonSqueezy event ID, `INSERT ... ON CONFLICT DO NOTHING` into `billing_webhook_seen(event_id)`, reject if seen.

### M-7. CORS origin check case-sensitive exact match
**File**: `apps/api/src/app/create-app.ts:44-45`
**Problem**: `allowedOrigins.includes(origin)` — trailing slash, case diff = rejected. Fragile.
**Fix**: Normalize origin (lowercase + strip trailing slash).

### M-8. File-size cap violations (16 files)
See File-Size Violations table below.

### M-9. Ratelimit keyed on `user.sub ?? ip`
**File**: `apps/api/src/middleware/ratelimit.ts:18`
**Problem**: Anonymous users behind NAT share counter. One hits limit, all blocked.
**Fix**: Always include IP in key when authenticated; add `User-Agent` hash for anonymous.

### M-10. `SignInHero.svelte` hardcodes production API URL
**File**: `apps/web/src/lib/components/landing/SignInHero.svelte:40, 45, 50`
**Problem**: `https://api.tenantiq.app/api/auth/login` hardcoded. Dev sign-in hits prod.
**Fix**: Use `import.meta.env.PUBLIC_API_URL` or relative `/api/auth/login` proxy.

### M-11. Inline HTML with runtime script
**File**: `apps/api/src/routes/auth-callback.ts:17-24`
**Problem**: Inline `<script>` rendered — blocked by strict CSP. `secureHeaders` doesn't set strict CSP.
**Fix**: Serve as static asset or tighten CSP + externalize script.

### M-12. 1,203 `any` occurrences
**Scope**: `apps/api/src` — 211 files
**Egregious**: `routes/tenants/audit-history.ts:19,38,50,53`, `lib/ai-anthropic.ts:100`, `lib/graph-sync.ts:35,37,43`, `lib/security-stack-monitor.ts:44`, all Graph return parsing.
**Fix**: Define `GraphUsersResponse`, `GraphAuditResponse`, etc. in `packages/graph/src/types.ts`. Add `eslint: no-explicit-any` CI failure. Gradually shrink.

### M-13. Lifecycle page is 378 LOC Svelte file
**File**: `apps/web/src/routes/workflows/lifecycle/+page.svelte`
**Problem**: `AVAILABLE_STEPS` + CRUD + UI + DnD reorder all in one file.
**Fix**: Extract `AVAILABLE_STEPS` → `$lib/workflows/lifecycle-steps.ts`. CRUD → `useLifecycle.ts`. DnD → `StepReorder.svelte`.

### M-14. Ratelimit-after-auth ordering
**File**: `apps/api/src/routes/sso.ts:15-16` (vs correct order in `auth.ts:18`)
**Problem**: Unauth requests hit 401 without ratelimit counter. Credential stuffing bypasses ratelimit.
**Fix**: Rate-limit unauth requests first, then auth.

### M-15. No structured error codes
**Problem**: `{ error: string }` (billing.ts:84,87) vs `{ error: { code, message } }` (create-app.ts:75) mixed. Clients can't reliably branch.
**Fix**: Centralize via `AppError.toJSON()` + linter rule.

---

## Minor Issues

- **m-1** `security-stack-actions.ts:30-31` — `eslint-disable no-explicit-any` instead of fixing.
- **m-2** `billing.ts:49` — cycle parse silently coerces invalid to monthly; should 400.
- **m-3** `billing.ts:116-118` — handler error logged, returns 200. LemonSqueezy won't retry, silent failure.
- **m-4** `graph-webhook.ts:93` — `.catch((e) => console.error(...))` swallows alert-insert failures.
- **m-5** `apps/web/src/lib/api/client.ts:165-179` — 30s hardcoded timeout; reports need 60s.
- **m-6** `auth.ts:122-124` — `err.name === 'AppError'` fails after minification; use `instanceof`.
- **m-7** `SignInHero.svelte:41` — inline SVG lacks `aria-label`; decorative imgs missing `aria-hidden`.
- **m-8** `auth.ts:143` — `catch { /* expired */ }` hides real KV errors.
- **m-9** `audit-history.ts:19` — `c: any` parameter; should be `Context<AppEnv>`.
- **m-10** 257 `console.log`/`console.error` in API; route through `logger` for Sentry.
- **m-11** `auth.middleware.ts:33` — `console.error('CRITICAL')` log level mismatch; use `logger.fatal`.
- **m-12** `ai-anthropic.ts:95-99` — Anthropic call has no `AbortSignal`. Stalls worker to 30s CF timeout.
- **m-13** `auth-callback.ts:103` — cookie `Domain=${cookieHost}` strips `app.` — breaks custom customer domains.
- **m-14** `+layout.svelte:32` — `PUBLIC_ROUTES` ad-hoc; should derive from route-guard config.
- **m-15** 8 `TODO`/`FIXME` markers in `apps/**` — CLAUDE.md forbids without linked issue.

---

## Security Findings

### Auth / Session
- C-1 JWT via URL fragment + localStorage (critical)
- C-2 Divergent auth middlewares (critical)
- C-3 Rate-limit race (critical)
- C-7 Missing org-scope (critical)
- M-4 Module-global key cache not env-keyed
- M-14 Auth-before-ratelimit ordering

### Webhooks / External Entrypoints
- C-4 Graph webhook accepts `clientState`-less payloads (critical)
- M-6 Billing webhook no replay protection
- `apps/api/src/routes/webhooks/openclaw.ts:27-68` — signature verified AFTER `JSON.parse(body)`. Malformed body throws pre-sig-check, lets attacker probe parsing. **Fix**: parse after verify, or wrap in same try.

### SQLi / Injection
- No raw SQL concat with user input (sampled). All D1 via `.prepare().bind()`.
- No `eval`, no `dangerouslySetInnerHTML`, no `.innerHTML =`.

### Multi-tenant Isolation
- Every sampled query uses `tenant_id = ?` or `org_id = ?` — 106 occurrences / 20 route files. **Good**.
- Gap: `tenants` table lookups often miss org scope (C-7).

### Secret Handling
- TruffleHog runs on PR + main (`.github/workflows/security.yml:48-57`). Good.
- `auth.ts:33-34` — 503 without leaking which env var. Good.
- `billing.ts:22` — LemonSqueezy key not logged. Good.

### CORS / CSRF
- csrf + cors middleware global (`create-app.ts:32-60`). Good.
- M-7 origin compare fragility.

### OWASP Top 10 Quick Pass
| ID | Category | Status |
|---|---|---|
| A01 | Broken Access Control | **Findings**: C-7, M-1 |
| A02 | Crypto Failures | **Findings**: C-1, M-4 |
| A03 | Injection | Clean |
| A05 | Security Misconfig | **Findings**: C-6, M-11 |
| A07 | Auth Failures | **Findings**: C-2, C-3 |
| A08 | Integrity | **Findings**: M-6 |
| A09 | Logging | **Findings**: M-1, m-4, m-10 |

---

## Performance Findings

- **P-1** `graph-sync.ts:51-70` — per-user INSERT loop. 999 users = 999 round trips. Use `db.batch(stmts)`. ~10x speedup.
- **P-2** `audit-history.ts:36-60` — Graph role-history query uncached. Runs every page view.
- **P-3** `apps/web/src/lib/api/client.ts:87-103` — fixed 60s SWR TTL, no per-endpoint override. Reports refresh too often, alerts cache too long.
- **P-4** `ratelimit.ts:20` — `await KV.get` blocks every request (50-200ms cold). Upgrade to Cache API + DO or CF Rate Limiting.
- **P-5** `schema-d1.ts` — 57 indexes reasonable. Verify composite `users_cache(tenant_id, last_sign_in_at)` for workflow-executor inactive-user queries.
- **P-6** Anthropic calls have no timeout — slow response blocks worker slot.
- **P-7** `SignInHero.svelte` — 301-line component with 3 orbs + mesh animations. Landing-page LCP impact. Gate behind `prefers-reduced-motion` + lazy-mount.

---

## Requirements Coverage Matrix

| Requirement | Status | Evidence / Gap |
|---|---|---|
| FR-1.1.1 Inactive User Detection | Partial | `workflow-executor.ts`, intelligence route; thresholds hardcoded, no per-tenant config |
| FR-1.1.2 License Waste Analysis | Partial | `license-autopilot.ts`, `cost-optimization/*`; SKU cost estimates only, Commerce API missing |
| FR-1.1.3 CIS Misconfiguration | Complete | `lib/cis/*`, 100+ controls, remediation hints |
| FR-1.1.4 Threat Detection | Partial | Anomaly detection + risky users; real-time via `graph-webhook.ts` gated by C-4 |
| FR-1.1.5 Compliance Gaps | Complete | SOC2/HIPAA/GDPR engines; custom frameworks missing |
| FR-1.1.6 Backup Health | Partial | `backup-health.ts` + cron; SLA reporting missing |
| FR-1.2.1 Real-time Alerts | Implemented | `alerts.ts`, `alert-analytics.ts`, `alert-generator.ts`, `/alerts` UI |
| P1: Enterprise SSO | Implemented | `sso.ts` + `sso_connections`; E2E with Okta + Entra pending |
| P2: Copilot Readiness | Implemented | `lib/copilot/readiness-checks.ts`, `copilot-readiness.ts`, PDF export |
| P3: Config Snapshot/Drift | Implemented | `config-snapshots.ts`, `config-drifts.ts`, `lib/snapshots/*`, `cron/drift-detection.ts` |
| P4: Storage Analytics | Partial | `storage-analytics.ts` + cron; OneDrive per-user, mailbox, orphaned-content missing |
| P5: Admin Panel | Implemented | `routes/platform/*` (9 endpoints), `apps/web/src/routes/platform/admin/` |
| NFR: 90% line / 85% branch | **Not enforced** | CI passes when file missing; no vitest thresholds (M-1) |
| NFR: 200 LOC cap | **Violated** | 16 files over cap |
| NFR: JWT security | **Failed** | C-1 fragment+localStorage exposure |
| NFR: Multi-tenant isolation | **Partial** | Middleware strong; direct tenant queries miss org scope (C-7) |

---

## File-Size Violations (200-LOC cap)

Rule: `Maximum source file size: 200 lines per file in src/, app/, lib/.`

| Path | LOC | Over | Suggested Split |
|---|---|---|---|
| `packages/db/src/schema-d1.ts` | 616 | 3.1x | Split per-domain: `schema/identity.ts`, `schema/security.ts`, `schema/billing.ts`, `schema/governance.ts`, `schema/platform.ts` |
| `apps/web/src/routes/workflows/lifecycle/+page.svelte` | 378 | 1.9x | Extract `AVAILABLE_STEPS` → `$lib/workflows/lifecycle-steps.ts`; CRUD → `useLifecycleTemplates.ts`; DnD → `StepReorder.svelte` |
| `apps/api/drizzle/schema/saas-platform.schema.ts` | 359 | 1.8x | Same per-domain split |
| `packages/db/src/schema.ts` | 306 | 1.5x | Mirror D1 split |
| `apps/web/src/lib/components/landing/SignInHero.svelte` | 301 | 1.5x | Extract `HeroAnimations.svelte`, `SignInCard.svelte`, `TrustBadges.svelte` |
| `apps/web/src/lib/api/client.ts` | 266 | 1.3x | Extract `request`, `cache` (SWR), `circuit` modules |
| `packages/openclaw-skill/src/index.ts` | 265 | 1.3x | Split types / dispatchers / handlers |
| `apps/web/src/routes/reports/+page.svelte` | 232 | 1.2x | Extract report-list + filters subcomponents |
| `apps/api/src/routes/tenants/security-stack-actions.ts` | 231 | 1.2x | Move `SECURITY_TEMPLATES` + `actionMap` → `lib/security-stack/templates.ts` |
| `apps/web/src/routes/threats/+page.svelte` | 229 | 1.1x | Extract `ThreatList.svelte`, `ThreatFilters.svelte` |
| `packages/shared/src/types.ts` | 218 | 1.1x | Split by domain: `types/alert.ts`, `types/workflow.ts`, `types/tenant.ts` |
| `apps/web/src/lib/components/settings/BillingPlans.svelte` | 216 | 1.1x | Extract `PlanCard.svelte`, `PlanComparison.svelte` |
| `apps/api/src/lib/security-stack-monitor.ts` | 215 | 1.1x | Split snapshot-capture vs drift-detect |
| `apps/web/src/routes/workflows/+page.svelte` | 213 | 1.1x | Extract `WorkflowList.svelte` |
| `apps/web/src/routes/security/stack/+page.svelte` | 211 | 1.1x | Extract `StackSummary.svelte` |
| `apps/web/src/lib/components/landing/PricingSection.svelte` | 210 | 1.1x | Extract `PricingCard.svelte` |

---

## Coverage Gaps

- **Frontend unit tests**: 14 `.test.ts` files against 70+ components under `apps/web/src/lib/components/` — ≤20% of components tested.
- **Critical path 100% coverage not verified** for: `auth-callback.ts`, `auth.ts` (refresh + logout), `billing.ts` (webhook), `security-stack-actions.ts`, `graph-sync.ts`, `graph-webhook.ts`, `ratelimit.ts`, `jwt-keys.ts`, `middleware/auth*.ts`. CI enforces line/branch totals only.
- **E2E gap**: 10 spec files vs 127-test / 21-section target in `CLAUDE_BROWSER_TEST_SUITE.md`.
- **Integration tests**: 45 files exist, no named end-to-end for auth-callback → graph-webhook → alert-creation.
- **Missing tests**: `auth-callback-helpers.ts`, `ratelimit.ts`, `jwt-keys.ts`, `graph-webhook.ts`, `tokenforge.ts` middleware.
- **Vitest threshold block absent** in `apps/web/vitest.config.ts` and `apps/api/vitest.config.ts`.

---

## Dependency Audit (quick)

- `drizzle-orm 0.45.2` — stable, no known CVEs at cutoff.
- `hono 4.7.0` — current.
- `jose 5.9.0` — stable (6.x exists, 5.9 supported).
- `zod 3.24.0` — stable.
- `@cloudflare/workers-types` — app dep `4.20250109.0` vs root pnpm override `4.20260405.1` — inconsistency; verify only override ships.
- `bcryptjs 3.0.3` — only used for `platformUsers.passwordHash`; verify or remove.
- `@vitest/coverage-v8 4.1.2` — rare; confirm Svelte 5 instrumentation compatibility.

Run `pnpm audit --audit-level=high` to confirm zero findings.

---

## Design Alignment

- **Request flow** (design.md: OAuth → JWT → authMiddleware → orgId scope → response) — **divergences**. Two middleware impls (C-2). JWT issuance puts token in cookie + fragment — non-standard.
- **Data sync pipeline** (Graph → D1 → anomaly → queue) — **implemented** in `graph-sync.ts`, `anomaly-detection.ts`, `NOTIFICATION_QUEUE`. DLQs present. Delete-and-replay diverges from incremental goal.
- **CIS compliance loop** — **implemented** with `cis/scanner.ts`, `control-definitions.ts`, per-domain modules. Baseline comparison present. Matches design.

---

## Apple HIG / Accessibility

- **Reduced-motion**: only 7 files respect `prefers-reduced-motion`. `SignInHero.svelte` has orbs + mesh without override.
- **ARIA / role / tabindex**: sparse on route pages. Concentrated in reports, ai/agent, marketplace. Tables/modals need explicit `aria-label`, `role="dialog"`, focus management.
- **Focus trap**: `apps/web/src/lib/utils/focus-trap.ts` exists — verify modal wiring.
- **Contrast**: unverified. Run `ll-a11y-scan` for axe-core WCAG 2.1 AA. Required before launch.
- **Landing hardcoded prod URLs** (M-10) — breaks dev/QA sign-in journey.

---

## Prioritized Recommendations

### P0 — Block merge until fixed
1. Remove JWT from URL fragment; remove `localStorage.setItem('tenantiq_token', ...)`. Cookie-only with `credentials: include`. (C-1)
2. Consolidate auth middleware into one file with RS256 + `X-Tenant-Id` enforcement. Migrate imports. Delete the other. (C-2)
3. Fix graph-webhook to require `clientState` and IP-allowlist Microsoft Graph CIDRs. (C-4)
4. Fix `security-stack-actions.ts` audit-log `org_id` / `user_id` binding (C-5). Remove silent-success branch (C-6).
5. Add `AND organization_id = ?` to every `tenants` query. Reduce JWT TTL to 15m + refresh flow. (C-7)
6. Replace KV ratelimit with DO or CF Rate Limiting API. (C-3)

### P1 — Before release
7. Enforce coverage thresholds via vitest config, not shell. Add critical-path 100% allowlist. (M-1)
8. Make `graph-sync` atomic via `db.batch`. Fix `last_sync_at` type. (M-2, M-3)
9. Add billing-webhook idempotency table. (M-6)
10. Split all 16 files > 200 LOC. Start with `schema-d1.ts` and lifecycle page. (M-8)
11. Drive `any` count down. Add ESLint `no-explicit-any: error` with baseline. Shrink weekly. (M-12)
12. Replace hardcoded prod URLs in `SignInHero.svelte` with env-driven. (M-10)

### P2 — Post-launch quality
13. Reorder middleware so ratelimit precedes auth on public endpoints. (M-14)
14. Standardize error shape via `AppError.toJSON()`. (M-15)
15. Axe-core sweep on all 27 pages. Verify focus-trap wiring on modals.
16. Replace module-global key cache with request-scoped or content-hashed. (M-4)
17. Add tests for auth-callback, ratelimit, graph-webhook.

---

## Approval Status

**Decision**: **NO-GO for production merge**.

**Blockers**: C-1, C-2, C-3, C-4, C-5, C-6, C-7 (7 critical).

**Next step**: Address P0 items, then re-run `/luna-agents:ll-review` for re-verification. After clean review, proceed to `/luna-test`.
