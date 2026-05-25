---
phase: 04-e2e-ci-hardening
plan: 02
subsystem: testing
tags: [playwright, e2e, red-stubs, tdd, msp-login, cis-scan, sso, copilot-readiness]

requires:
  - phase: 01-enterprise-sso
    provides: SSO routes and settings page that E2E-04 targets
  - phase: 02-frontend-completions
    provides: Copilot Readiness page and CIS benchmark UI that E2E-03/05 target

provides:
  - Four E2E RED stub spec files under tests/e2e/flows/ covering E2E-02 through E2E-05
  - page.route() mock pattern for all four flows
  - data-testid selector targets that define Wave 2 implementation contract

affects: [04-e2e-ci-hardening wave-2, copilot-readiness, cis-benchmark, msp-dashboard, sso-settings]

tech-stack:
  added: []
  patterns:
    - "page.route() mocking pattern for all authenticated flows (reuses sso.spec.ts pattern)"
    - "setupAuthenticatedAdmin helper inlined per spec (no shared fixture file — keep specs self-contained)"
    - "Permissive OR-locators for RED stubs: data-testid primary, text fallback"

key-files:
  created:
    - tests/e2e/flows/msp-login.spec.ts
    - tests/e2e/flows/cis-scan.spec.ts
    - tests/e2e/flows/sso-provisioning.spec.ts
    - tests/e2e/flows/copilot-readiness.spec.ts
  modified: []

key-decisions:
  - "setupAuthenticatedAdmin inlined in each spec (not extracted to shared fixture) to keep spec files self-contained and avoid cross-file coupling in RED phase"
  - "SSO provisioning test 2 reuses API request fixture (not page.route mock) for login initiation — consistent with existing sso.spec.ts SSO Login Initiation pattern"
  - "RED selectors use .or() with text fallback so the test fails on missing data-testid but passes once either the testid OR text is present — lower friction for Wave 2 implementation"

patterns-established:
  - "E2E flow spec: import { test, expect, type Page } → inline setupAuthenticatedAdmin → test.describe → test.beforeEach → 3 tests"
  - "Route mock order: auth/me → tenants → feature-specific routes → wildcard tenants/** catch-all"

requirements-completed: [E2E-01, E2E-02, E2E-03, E2E-04, E2E-05]

duration: 2min
completed: 2026-04-22
---

# Phase 04 Plan 02: E2E RED Stubs Summary

**12 Playwright RED stubs across 4 spec files define passing criteria for MSP login, CIS scan, SSO provisioning, and Copilot Readiness flows before Wave 2 selector implementation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-22T09:26:46Z
- **Completed:** 2026-04-22T09:28:04Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- Created `tests/e2e/flows/` directory with 4 spec files (msp-login, cis-scan, sso-provisioning, copilot-readiness)
- 12 tests discovered by Playwright across 4 files — all in RED state pending Wave 2 data-testid additions
- page.route() mocking follows established sso.spec.ts pattern exactly; no live IdP or running API needed

## Task Commits

1. **Task 1: msp-login.spec.ts + cis-scan.spec.ts** - `5500d0c` (test)
2. **Task 2: sso-provisioning.spec.ts + copilot-readiness.spec.ts** - `8b65e4c` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `tests/e2e/flows/msp-login.spec.ts` — 3 tests: dashboard secure-score RED, tenant name visible, unauthenticated redirect (E2E-02)
- `tests/e2e/flows/cis-scan.spec.ts` — 3 tests: control table RED, severity badge RED, scan trigger button RED (E2E-03)
- `tests/e2e/flows/sso-provisioning.spec.ts` — 3 tests: connection domain visible, login endpoint guard, OIDC callback guard (E2E-04)
- `tests/e2e/flows/copilot-readiness.spec.ts` — 3 tests: readiness-score RED, category breakdown RED, assess button RED (E2E-05)

## RED Selector Summary

| File | RED Selector | Reason fails |
|------|-------------|-------------|
| msp-login | `[data-testid="secure-score"]` | Dashboard metric card lacks data-testid |
| cis-scan | `[data-testid="cis-control-table"]` | CIS table lacks data-testid |
| cis-scan | `[data-testid="severity-badge"]` | Severity badge lacks data-testid |
| cis-scan | `button:has-text("Run Scan")` | Trigger button text may differ |
| sso-provisioning | `text=corp.example.com` | Mocked domain — will pass once SSO section renders connections |
| copilot-readiness | `[data-testid="readiness-score"]` | Score element lacks data-testid |
| copilot-readiness | `button:has-text("Assess")` | Assessment trigger button text unconfirmed |

## Decisions Made

- `setupAuthenticatedAdmin` inlined in each spec (not extracted) to keep spec files self-contained in RED phase
- SSO provisioning tests 2 and 3 use `request` fixture (direct API) matching existing sso.spec.ts SSO Login Initiation pattern
- OR-locators (`.or()`) used for RED stubs: primary `data-testid` target, text fallback — passes once either is present, reducing Wave 2 friction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 (04-03+) must add `data-testid="secure-score"` to dashboard, `data-testid="cis-control-table"` and `data-testid="severity-badge"` to CIS page, `data-testid="readiness-score"` to Copilot Readiness page to make these stubs GREEN
- SSO provisioning test 1 (`text=corp.example.com`) will turn GREEN once SsoSettingsTab renders connection list items with domain text
- CIS scan trigger button test will turn GREEN once button text matches "Run Scan", "Trigger", or "Scan"

---
*Phase: 04-e2e-ci-hardening*
*Completed: 2026-04-22*
