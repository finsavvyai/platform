# QA Report — tenantiq
**Date:** 2026-03-20
**Wave:** 2

## File Size Check (≤200 lines)
- Total source files: 45 (excluding node_modules, .wrangler, .svelte-kit)
- Files over 200 lines: 32
- **FAIL**: Multiple files exceed 200 lines
  - apps/api/src/routes/tenants.ts: 1,340 lines (CRITICAL)
  - apps/api/src/services/intelligence-engine.ts: 639 lines
  - apps/api/src/routes/tenants.test.ts: 557 lines
  - apps/api/src/routes/auth.test.ts: 537 lines
  - (28 more files over 200 lines)

## Test Results
- Test framework: Node/vitest + Playwright
- Tests present: 12 test files found
- Config: vitest, Playwright E2E
- Status: CONFIGURED (tests present but not executed in environment)

## Security Check
- Hardcoded secrets found: No
- Findings:
  - credential/token/api_key/secret references are all field definitions
  - No hardcoded credential values detected
  - Proper use of type definitions and configuration fields
  - Token handling appears to use environment variables and request parameters
- Status: PASS (no hardcoded secrets)

## Overall: FAIL
- File size violations: CRITICAL (32 files exceed 200 lines)
  - tenants.ts at 1,340 lines is 6.7x the limit
  - intelligence-engine.ts at 639 lines is 3.2x the limit
- Tests: Configured and present
- Security: PASS

**Recommendation**: Urgent refactoring required - tenants.ts and intelligence-engine.ts need significant splitting.
