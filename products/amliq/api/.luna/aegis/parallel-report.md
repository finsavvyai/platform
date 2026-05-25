# Parallel Run Report — AMLIQ

**Date**: 2026-03-29
**Project**: aegis (AMLIQ v2)

## Summary

| Agent | Status | Details |
|-------|--------|---------|
| **Lint** | FAIL | No ESLint configuration found |
| **Typecheck** | FAIL | 29 type errors across 13 files |
| **Test** | FAIL | Go: 7 packages fail to compile, 4 runtime failures; React: 1/221 test failing |
| **Security** | FAIL | 1 critical (pgx SQL injection), 7 high (Go stdlib), 5 moderate (NPM) |
| **Build** | PASS | Go compiles cleanly, React builds in 1.88s (710 kB JS bundle) |

**Overall: FAIL** (4 of 5 agents failed)

---

## 1. Lint — FAIL

No ESLint configuration file found in `web/`. ESLint cannot run without `.eslintrc` or `eslint.config.*`.

**Fix**: Run `npm init @eslint/config` from `web/` to generate a config extending `eslint:recommended`, `plugin:react/recommended`, and `plugin:@typescript-eslint/recommended`.

---

## 2. Typecheck — FAIL (29 errors, 13 files)

### By category

| Category | Count | Files |
|----------|-------|-------|
| Missing/mismatched properties on types | 15 | UsageOverview, UpgradeModal, AlertCard.test, EmptyState.test, test/utils |
| Missing export `billingApi` | 3 | CurrentPlan, PlanComparison, UsageOverview |
| `token` not on `AuthContextValue` | 3 | Tenants, TenantDetail, Team |
| `import.meta.env` not typed | 2 | client.ts, SignInButtons |
| String not assignable to union | 1 | AuditTrail badge color |
| State shape mismatch | 1 | PromoCodeInput `discountPercent` vs `percent` |
| Test fixtures stale | 4 | Tests missing `aliases` and `description` props |

### Key fixes needed

1. **UsageOverview.tsx**: `UsageRecord` type is out of sync — properties `period`, `screeningCount`, `screeningLimit`, `apiCallCount`, `apiCallLimit` don't exist
2. **UpgradeModal.tsx**: `Plan` type uses `monthlyPrice` not `monthlyPriceCents`; no `screeningLimit` property
3. **billing API**: `billingApi` export missing from `api/billing` module
4. **AuthContextValue**: `token` property removed/renamed — 3 pages reference it
5. **Vite env types**: Add `/// <reference types="vite/client" />` to `env.d.ts`

---

## 3. Test — FAIL

### Go Backend

**7 packages fail to compile:**
- `internal/billing` — redeclared test functions, undefined types (`CheckoutData`, `CheckoutAttrs`, `NewInMemoryUsageMeter`)
- `internal/domain` — string-to-`TenantID` conversion errors in billing_event/invoice tests
- `internal/storage` — undefined `NewMockBillingEventRepository`, `TenantID` conversion errors
- `internal/storage/pgx` — wrong number of arguments in `Create`/`GetByID`/`Delete`
- `internal/ingestion` — `string` vs `domain.ListSource` mismatch, unused import
- `api` — undefined `BillingHandler`, `router`; wrong args to `NewScreenRequest`
- `tests/integration` — unused variable `req`

**4 runtime test failures:**
- `cmd/worker` — `TestSchedulerDue/future_schedule_not_due`
- `internal/screening` — `TestJaroWinklerSimilarity/one_char_diff`, `TestPhoneticMatcher/no_match`, `TestTokenMatcher/token_overlap`, `TestTokenMatcher/multiple_candidates`

**5 packages pass:** `internal/config`, `internal/mcp`, `internal/webhook`, `pkg/errors`, `pkg/hash`

### React Frontend

- **40 test files**: 1 failed, 39 passed
- **221 tests**: 1 failed, 220 passed
- **Failing test**: `Sidebar.test.tsx` — expects text "AMLIQ" but logo/branding changed
- **Note**: Many `act(...)` warnings (non-blocking)

---

## 4. Security — FAIL

### Go Dependencies (govulncheck) — 1 Critical, 7 High, 1 Moderate

| Priority | ID | Package | Severity | Fix |
|----------|----|---------|----------|-----|
| **P0** | GO-2024-2606 | `pgx/v5` v5.5.0 | **CRITICAL — SQL injection** | Upgrade to v5.5.4 |
| P1 | GO-2024-2567 | `pgx/v5` v5.5.0 | High — Panic in Pipeline | Upgrade to v5.5.2 |
| P1 | GO-2026-4602 | `os` (stdlib) | High | Upgrade Go to 1.25.8 |
| P1 | GO-2026-4601 | `net/url` (stdlib) | High | Upgrade Go to 1.25.8 |
| P1 | GO-2026-4341 | `net/url` (stdlib) | High | Upgrade Go to 1.25.6 |
| P1 | GO-2026-4340 | `crypto/tls` (stdlib) | High | Upgrade Go to 1.25.6 |
| P1 | GO-2026-4337 | `crypto/tls` (stdlib) | High | Upgrade Go to 1.25.7 |
| P2 | GO-2025-4175 | `crypto/x509` (stdlib) | High | Upgrade Go to 1.25.5 |
| P2 | GO-2025-4155 | `crypto/x509` (stdlib) | Moderate | Upgrade Go to 1.25.5 |

### NPM Dependencies (npm audit) — 5 Moderate

| Package | Severity | Description |
|---------|----------|-------------|
| `brace-expansion` <1.1.13 | Moderate | Process hang / memory exhaustion |
| `esbuild` <=0.24.2 | Moderate | Dev server request forgery |
| `vite` 0.11.0-6.1.6 | Moderate | Depends on vulnerable esbuild |
| `vite-node` <=2.2.0-beta.2 | Moderate | Depends on vulnerable vite |
| `vitest` 0.3.3-2.2.0-beta.2 | Moderate | Depends on vulnerable vite chain |

### Release blockers (per CLAUDE.md security rules)

- **CRITICAL**: pgx v5.5.0 SQL injection — must upgrade before release
- **HIGH**: 7 Go stdlib vulnerabilities — must upgrade Go to 1.25.8

---

## 5. Build — PASS

### Go Backend
- `go build ./cmd/api/...` — compiles cleanly (0 errors)

### React Frontend
- `npm run build` — 2,281 modules transformed in 1.88s
- **Bundle sizes**:
  - `index.html` — 0.63 kB (0.43 kB gzip)
  - `index.css` — 41.48 kB (7.43 kB gzip)
  - `index.js` — 709.73 kB (196.33 kB gzip)
- **Warning**: JS chunk exceeds 500 kB — consider code-splitting with dynamic `import()`

---

## Recommended Action Order

1. **Security P0**: Upgrade `pgx/v5` to v5.5.4 (SQL injection fix)
2. **Security P1**: Upgrade Go to 1.25.8 (7 stdlib vulns)
3. **Typecheck**: Fix 29 type errors (billing types out of sync, auth token, Vite env)
4. **Tests**: Fix Go compilation errors in 7 packages + 4 runtime failures + 1 React test
5. **Lint**: Add ESLint configuration
6. **Build**: Consider code-splitting to reduce 710 kB JS bundle
7. **NPM audit**: Run `npm audit fix` for brace-expansion; evaluate vite upgrade
