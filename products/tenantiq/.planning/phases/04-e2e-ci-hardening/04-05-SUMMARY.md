---
phase: 04-e2e-ci-hardening
plan: "05"
subsystem: infra
tags: [ci, github-actions, security, semgrep, gitleaks, playwright, wrangler]

requires: []
provides:
  - Merge-blocking SAST (Semgrep), dependency audit (pnpm audit), secret scan (Gitleaks) in ci.yml status-check
  - Gitleaks job in security.yml for defense-in-depth secret scanning
  - Playwright webServer using wrangler pages dev (production-matched Cloudflare runtime)
affects: [e2e-testing, ci-pipeline, security-posture]

tech-stack:
  added: [gitleaks/gitleaks-action@v2]
  patterns:
    - "Security jobs must be in status-check needs array to block merges"
    - "wrangler pages dev used for E2E to match Cloudflare Pages production runtime"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/security.yml
    - playwright.config.ts

key-decisions:
  - "200-line file cap applies to src/app/lib source files only — .github/workflows/*.yml are infra config and exempt"
  - "Gitleaks added to both ci.yml (PR merge gate) and security.yml (scheduled workflow) for defense-in-depth"
  - "wrangler pages dev replaces pnpm dev in playwright webServer — requires pnpm build first; CI e2e job already has pnpm build step"

patterns-established:
  - "CI security gate pattern: add job definition before status-check, add to needs array, add result to results array"

requirements-completed: [HARD-02, HARD-03, HARD-04, E2E-01, E2E-05]

duration: 1min
completed: 2026-04-22
---

# Phase 04 Plan 05: CI Security Gate + Playwright wrangler pages dev Summary

**Semgrep SAST, pnpm dependency audit, and Gitleaks wired into ci.yml merge gate; Gitleaks added to security.yml; playwright.config.ts switched to wrangler pages dev for Cloudflare-matched E2E runtime**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-22T09:27:06Z
- **Completed:** 2026-04-22T09:28:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `status-check` in ci.yml now needs all 9 jobs (was 6): added `sast`, `dependency-audit`, `secret-scan` — any failure blocks merge (HARD-02, HARD-03, HARD-04)
- Gitleaks added to security.yml alongside TruffleHog for defense-in-depth secret scanning on the scheduled security workflow
- Playwright E2E now boots wrangler pages dev against `apps/web/.svelte-kit/cloudflare` — production Cloudflare runtime (D1/KV/R2 bindings) instead of Vite dev server (E2E-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add security jobs to ci.yml + Gitleaks to security.yml** - `c0f7c9e` (feat)
2. **Task 2: Update playwright.config.ts to use wrangler pages dev** - `52fec97` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `.github/workflows/ci.yml` — Added `sast`, `dependency-audit`, `secret-scan` jobs; updated `status-check` needs and results array from 6 to 9 jobs
- `.github/workflows/security.yml` — Added `gitleaks` job; updated `security-gate` needs from 4 to 5 jobs
- `playwright.config.ts` — Changed `webServer[0].command` from `pnpm --filter @tenantiq/web dev` to `wrangler pages dev apps/web/.svelte-kit/cloudflare --port 5173 --compatibility-date 2024-09-23`; added explanatory comment

## Key Changes (Before → After)

### ci.yml status-check.needs
```
Before: [line-limit, lint, typecheck, test, e2e, build]
After:  [line-limit, lint, typecheck, test, e2e, build, sast, dependency-audit, secret-scan]
```

### playwright.config.ts webServer[0].command
```
Before: 'pnpm --filter @tenantiq/web dev'
After:  'wrangler pages dev apps/web/.svelte-kit/cloudflare --port 5173 --compatibility-date 2024-09-23'
```

## Decisions Made
- 200-line file cap applies to `src/`, `app/`, `lib/` source files only per CLAUDE.md — `.github/workflows/*.yml` are infrastructure config and exempt
- Gitleaks placed in both ci.yml (PR gate via `secret-scan` job) and security.yml (scheduled defense-in-depth via `gitleaks` job) — two different job names to avoid confusion, same action
- `wrangler pages dev` requires `pnpm build` to have run first; the CI `e2e` job already has `- run: pnpm build` step, so this is a no-op change for CI. Local developers must run `pnpm build` before E2E — documented in comment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Gitleaks action uses `GITHUB_TOKEN` (auto-provided by GitHub Actions, no secret setup needed).

## Next Phase Readiness
- CI merge gate now enforces SAST, dependency audit, and secret scan — any new PR with high/critical vulnerabilities or leaked secrets will be blocked
- E2E tests in CI will use production-matched Cloudflare runtime
- `samlify` pinned to >=2.10.0 (CVE-2025-47949) will now be caught by the `dependency-audit` job in ci.yml

---
*Phase: 04-e2e-ci-hardening*
*Completed: 2026-04-22*
