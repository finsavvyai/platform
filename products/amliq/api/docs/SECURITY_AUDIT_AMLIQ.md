# Security Audit Report - AMLIQ v2

**Date:** 2026-04-02
**Scope:** api/, internal/, cmd/, web/src/ (excluding runlocal/)

## Critical Findings

### 1. Plaintext Cloudflare API Token in deploy.sh [FIXED]
- **File:** `deploy.sh:28`
- **Issue:** `CLOUDFLARE_API_TOKEN` was hardcoded in plaintext
- **Fix:** Replaced with env var check; script exits if not set
- **Action needed:** Rotate the exposed token immediately via Cloudflare dashboard.
  The token value was committed to git history and must be considered compromised.

## Medium Findings

### 2. OAuth Token Response Logged in Plaintext [FIXED]
- **File:** `api/handler_oauth_exchange.go:53`
- **Issue:** Full OAuth token exchange response body (including access_token) was logged
- **Fix:** Changed to only log HTTP status code, no response body

### 3. Mock Data in Production Component [FIXED]
- **File:** `web/src/pages/BatchJobs.tsx`
- **Issue:** Page rendered hardcoded `mockJobs` array instead of calling the API
- **Fix:** Rewrote to use `useApi` hook calling `GET /api/v1/batch`

### 4. CORS Localhost Origins in Production [FIXED]
- **File:** `api/middleware_cors.go`
- **Issue:** `localhost:5173` and `localhost:3000` always in allowed origins
- **Fix:** Localhost origins now only added when `ENV` is unset or "development"

## Low Findings

### 5. Unauthenticated Onboarding Endpoint [NO CHANGE]
- **Route:** `GET /api/v1/onboarding/lists`
- **Assessment:** Returns only public sanctions list metadata (names, URLs).
  No tenant or sensitive data exposed. Acceptable for onboarding UX.

### 6. Public Demo Endpoints [NO CHANGE]
- **Routes:** `POST /api/v1/screen/public-demo`, `POST /api/v1/pep/public-search`
- **Assessment:** Rate-limited (2/hour/IP), bot-detection enabled. Acceptable.

## Items Verified Clean

| Check                     | Result |
|---------------------------|--------|
| SQL injection             | No string interpolation in SQL; all queries use parameterized pgx |
| Command injection         | No `exec.Command` in AMLIQ code (only in excluded runlocal/) |
| Path traversal            | No user input used in file paths |
| Auth on protected routes  | All data routes use `authChain` middleware |
| XSS                       | No `dangerouslySetInnerHTML`; API returns JSON only |
| JWT signing               | HMAC-SHA256 with constant-time comparison; acceptable |
| Webhook verification      | HMAC-SHA256 signature validation on LemonSqueezy webhooks |
| Secrets in logs           | Fixed (item 2); no other secret logging found |
| TODO/FIXME/HACK comments  | None found in Go or TypeScript source files |
| Hardcoded test keys       | Only in `*_test.go` files (acceptable) |
| Frontend API base URL     | Reads from `VITE_API_URL` env var with localhost fallback |

## Recommended Follow-Up

1. **Rotate the Cloudflare API token immediately** - it was in git history
2. Consider adding `git-secrets` or a pre-commit hook to prevent future leaks
3. Add `Content-Security-Policy` headers to the Swagger UI endpoint
4. Set `ALLOWED_ORIGINS` and `ENV=production` in production deployments
