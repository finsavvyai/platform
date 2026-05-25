# Security Audit Report

**Date:** 2026-04-02
**Scope:** All Go, TypeScript, and TSX source files in PushCI
**Summary:** 14 issues found, 11 fixed, 3 noted for future work

## Critical (3 found, 3 fixed)

1. **Wildcard CORS override** (`api/src/index.ts`)
   - Used `cors()` from hono which allows ALL origins, overriding the
     stricter custom CORS middleware. Replaced with `corsMiddleware`.

2. **Stripe webhook signature not verified** (`api/src/billing.ts`)
   - Webhook endpoint accepted any payload without signature check.
     Added HMAC-SHA256 verification of `stripe-signature` header.

3. **No auth on API endpoints** (`api/src/index.ts`)
   - `/api/runs`, `/api/projects` had no authentication.
     Added JWT `authCheck` to all data-access endpoints.

## Medium (6 found, 5 fixed, 1 noted)

4. **Unprotected migrate endpoint** - restricted to `ENVIRONMENT=development`
5. **Hardcoded mock token exposed in UI** (`RunnersPage.tsx`) - removed
6. **Placeholder OAuth client ID** (`useAuth.ts`) - now errors if unset
7. **Mock data as fallback on API error** (`useRuns.ts`) - removed fallback
8. **HTML injection in email notifications** (`email.go`) - added escaping
9. **GitHub signature skip on empty sig** (`github.go`) - now rejects
   missing signatures when webhook secret is configured (noted: when
   secret is unconfigured, skip remains for local dev)

## Low (5 found, 3 fixed, 2 noted)

10. **Hardcoded billing URLs** (`billing.ts`) - now reads `APP_URL` env
11. **Hardcoded webhook URL in dashboard** (`WebhookDisplay.tsx`) - now
    reads `VITE_API_URL` env variable
12. **Mock data labeled as real** - renamed all mock files to sample/
    placeholder, cleared fake org names and data
13. **Rate limiting uses X-Forwarded-For** (Go `ratelimit.go`) - noted:
    spoofable header, should use trusted proxy chain in production
14. **Cloud runner endpoints lack auth** (`cloud-runners.ts`) - noted:
    currently stub endpoints, must add auth before production use

## Recommendations

- Add auth middleware to `/api/cloud/*`, `/api/ai/*`, `/api/nlp/*`
  routes before they reach production
- Use a trusted proxy setup for IP-based rate limiting
- Add CSRF protection for state-changing endpoints
- Rotate JWT secrets on a schedule; consider short-lived tokens
- Add input length validation on all user-supplied strings
- Run `npm audit` and `govulncheck` in CI pipeline
