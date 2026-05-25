---
phase: 04-e2e-ci-hardening
plan: 06
subsystem: testing
tags: [playwright, e2e, svelte, data-testid, api-mocking]

requires:
  - phase: 04-e2e-ci-hardening
    provides: playwright.config.ts wrangler pages dev setup (E2E-01), wave-0 RED stubs

provides:
  - GREEN E2E tests for MSP login flow (E2E-02)
  - GREEN E2E tests for CIS scan flow (E2E-03)
  - GREEN E2E tests for SSO provisioning flow (E2E-04)
  - GREEN E2E tests for Copilot Readiness flow (E2E-05)
  - data-testid hooks on DashboardContent, ControlTable, ReadinessOverview, SsoSettingsTab

affects: [e2e-flows, copilot-readiness, cis-benchmark, sso, dashboard]

tech-stack:
  added: []
  patterns:
    - "API route mocks in E2E specs must match actual client.ts API_BASE-prefixed paths (e.g., /cis-benchmark/latest not /tenants/*/cis/controls)"
    - "Tenant mock must include lastSyncAt non-null to skip OnboardingWizard branch"
    - "data-testid on wrapper divs (not inner elements) for robust locators"

key-files:
  created: []
  modified:
    - tests/e2e/flows/msp-login.spec.ts
    - tests/e2e/flows/cis-scan.spec.ts
    - tests/e2e/flows/sso-provisioning.spec.ts
    - tests/e2e/flows/copilot-readiness.spec.ts
    - apps/web/src/lib/components/DashboardContent.svelte
    - apps/web/src/lib/components/cis/ControlTable.svelte
    - apps/web/src/lib/components/copilot/ReadinessOverview.svelte
    - apps/web/src/lib/components/settings/SsoSettingsTab.svelte

key-decisions:
  - "E2E mocks must target /cis-benchmark/* and /copilot-readiness/* (page-level routes), not /tenants/*/cis/* (old API shape) — the pages use non-tenant-scoped endpoints"
  - "Tenant mock lastSyncAt must be non-null to avoid OnboardingWizard branch on dashboard"
  - "DashboardMetrics mock must include activeAlerts object to avoid NaN in totalAlerts derived"
  - "data-testid added to component root/wrapper divs; OR-locators in spec retain text fallbacks for resilience"

patterns-established:
  - "OR-locator pattern: page.locator('[data-testid=\"x\"]').or(page.locator('text=fallback')) — primary testid, secondary text"
  - "Copilot page category keys are camelCase (identityAccess, dataProtection) mapped to labels via CATEGORY_LABELS"

requirements-completed: [E2E-02, E2E-03, E2E-04, E2E-05]

duration: 15min
completed: 2026-04-22
---

# Phase 4 Plan 06: E2E Selector Fix Summary

**12 E2E tests turned GREEN by aligning spec API mocks to actual page route paths and adding data-testid hooks to 4 Svelte components**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-22T09:31:00Z
- **Completed:** 2026-04-22T09:36:19Z
- **Tasks:** 2 of 2 (Task 1: selector fix; Task 2: human-verify checkpoint approved)
- **Files modified:** 8

## Accomplishments

- Fixed 4 E2E spec files — API route mocks now target the actual endpoints the pages call
- Added `data-testid="secure-score"` to DashboardContent MetricCard wrapper
- Added `data-testid="cis-control-table"` and `data-testid="severity-badge"` to ControlTable
- Added `data-testid="readiness-score"` to ReadinessOverview
- Added `data-testid="sso-connection-list"` to SsoSettingsTab connections container
- Fixed DashboardMetrics mock shape to include `activeAlerts` object (prevents NaN in derived)
- Fixed tenant mock to include `lastSyncAt` non-null to skip OnboardingWizard branch

## Task Commits

1. **Task 1: Fix E2E selectors** - `7f9c16d` (feat)
2. **Task 2: Human-verify checkpoint** - `2da6595` (fix) — post-fix: route ordering + cron test mock organizationId
3. **Plan metadata** - `6cbc680` (docs)

## Files Created/Modified

- `tests/e2e/flows/msp-login.spec.ts` — tenant mock lastSyncAt fix, dashboard mock shape fix
- `tests/e2e/flows/cis-scan.spec.ts` — API mocks aligned to /cis-benchmark/* routes
- `tests/e2e/flows/copilot-readiness.spec.ts` — API mocks aligned to /copilot-readiness/* routes, category label fix
- `tests/e2e/flows/sso-provisioning.spec.ts` — tenant mock lastSyncAt fix
- `apps/web/src/lib/components/DashboardContent.svelte` — data-testid="secure-score"
- `apps/web/src/lib/components/cis/ControlTable.svelte` — data-testid="cis-control-table", data-testid="severity-badge"
- `apps/web/src/lib/components/copilot/ReadinessOverview.svelte` — data-testid="readiness-score"
- `apps/web/src/lib/components/settings/SsoSettingsTab.svelte` — data-testid="sso-connection-list"

## Decisions Made

- CIS page calls `/cis-benchmark/latest` (not `/tenants/*/cis/controls`) — mocks updated to match
- Copilot page calls `/copilot-readiness/latest|history|license-summary` — mocks updated; category keys are camelCase (`identityAccess`) not snake_case (`identity`)
- Tenant mock `lastSyncAt: null` triggered OnboardingWizard branch hiding dashboard metrics — fixed to `2026-01-01T00:00:00Z`
- DashboardMetrics requires `activeAlerts: { critical, high, medium, low }` object for derived `totalAlerts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DashboardMetrics mock missing activeAlerts shape**
- **Found during:** Task 1 (selector investigation)
- **Issue:** Original mock `{ secureScore: 72, totalUsers: 50, ... }` lacked `activeAlerts` object; `DashboardContent` derives `totalAlerts = metrics.activeAlerts.critical + ...` which evaluates to NaN, potentially causing render failure
- **Fix:** Updated mock to include `activeAlerts: { critical: 0, high: 1, medium: 1, low: 0 }` and full `userBreakdown`, `licenseBreakdown` fields
- **Files modified:** tests/e2e/flows/msp-login.spec.ts
- **Verification:** TypeScript clean, spec shape matches DashboardMetrics interface
- **Committed in:** 7f9c16d

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in mock shape)
**Impact on plan:** Necessary for correct rendering. No scope creep.

## Issues Encountered

- Wave-0 stubs used tenant-scoped API paths (`/tenants/*/cis/controls`) that don't match actual page API calls — systematic mismatch across 2 of 4 spec files. Root cause: stubs were written speculatively before pages existed.
- `lastSyncAt: null` in tenant mock is a subtle correctness trap — the dashboard page conditionally renders OnboardingWizard when last sync is null, hiding all metrics from E2E tests.

## User Setup Required

None — no external service configuration required.

## Checkpoint Result

**Human-verify checkpoint APPROVED 2026-04-22**
- Unit suite: 1213/1213 passed (npm run test)
- E2E flows: 12/12 passed on chromium (npx playwright test flows/ --project=chromium)
- CI gate structure verified: ci.yml status-check.needs includes sast, dependency-audit, secret-scan
- Post-fix applied before approval: route ordering bug fixed in all 4 flow specs + cron test mock organizationId added (commit 2da6595)

## Next Phase Readiness

Phase 4 fully complete: HARD-01 through HARD-06 + E2E-01 through E2E-05 all addressed and human-verified.
- All CI security gates (SAST, dep-audit, Gitleaks) are wired and blocking
- 12 E2E tests GREEN across 4 flow specs, backed by wrangler pages dev webServer
- assertOrgId guards on 9 cron handlers + 3 queue processors
- D1 compound indexes migration (0010) applied
- CSP + security headers in create-app.ts
- Ready for release: no outstanding blockers on Phase 4

---
*Phase: 04-e2e-ci-hardening*
*Completed: 2026-04-22*
