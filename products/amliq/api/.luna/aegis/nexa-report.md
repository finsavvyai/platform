# Nexa AI Analysis Report — AMLIQ

**Date**: 2026-03-29
**Scope**: Full-stack analysis (Go backend + React frontend + architecture)

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Backend | 7 | 14 | 17 | 7 | 45 |
| Frontend | 5 | 10 | 14 | 8 | 37 |
| Tech Debt | 4 | 3 | — | — | 7 |
| **Total** | **16** | **27** | **31** | **15** | **89** |

**Architecture Strengths**: Excellent layer separation (zero import violations), near-perfect file size discipline (only 4/480+ files exceed 100 lines), no panic/fmt.Print in production code, zero TODO/FIXME comments. Screening engine is well-decomposed.

---

## CRITICAL ISSUES (16) — Must Fix Before Production

### Backend Critical

| # | Issue | File | Description |
|---|-------|------|-------------|
| B-C1 | SHA-256 Password Hashing | `api/handler_auth.go:97-100` | Unsalted SHA-256 — trivially crackable. Replace with bcrypt/argon2id |
| B-C2 | Empty JWT Secret Allowed | `internal/config/loader.go:29` | Server starts with empty TOKEN_SECRET — anyone can forge JWTs |
| B-C3 | CORS Wildcard | `api/middleware_cors.go:7` | `Access-Control-Allow-Origin: *` — any website can make authenticated requests |
| B-C4 | No Graceful Shutdown | `api/server.go:32-34` | `Shutdown()` is a no-op — in-flight requests dropped on deploy |
| B-C5 | Fake Auth Middleware | `api/middleware_auth.go:31-37` | `isValidToken`/`isValidAPIKey` accept any non-empty string |
| B-C6 | Nil Context in Webhooks | `api/handler_webhook_persist.go:29,77` | Passes `nil` to billing service — will panic on ctx.Value() |
| B-C7 | OAuth Errors Swallowed | `api/handler_oauth_callback.go:111,114` | Malformed OAuth responses proceed silently, creating users with empty emails |

### Frontend Critical

| # | Issue | File | Description |
|---|-------|------|-------------|
| F-C1 | Token in URL | `pages/Login.tsx:20-22` | JWT passed via `?token=` query param — exposed in history/logs/referrer |
| F-C2 | 6+ Pages Bypass API Client | `admin/Tenants.tsx`, `platform/*.tsx`, etc. | Raw `fetch()` sends no auth headers or `Bearer undefined` |
| F-C3 | `token` Not on AuthContext | `context/AuthContext.tsx` | 3 pages destructure `{ token }` which is `undefined` — API calls non-functional |
| F-C4 | No Role Protection on Admin Routes | `App.tsx:58-60` | Any authenticated user can access admin pages |
| F-C5 | API Key Revoke — No Auth, No Confirm | `pages/platform/APIKeys.tsx:21-23` | Single click revokes production keys with no authentication |

### Architecture Critical

| # | Issue | File | Description |
|---|-------|------|-------------|
| A-C1 | SHA-256 Passwords | (same as B-C1) | Release blocker |
| A-C2 | CORS Wildcard | (same as B-C3) | Release blocker |
| A-C3 | No Graceful Shutdown | (same as B-C4) | Deployment reliability |
| A-C4 | OAuth Errors Swallowed | (same as B-C7) | Silent user corruption |

---

## HIGH ISSUES (27) — Fix Before Beta

### Backend High (14)

| # | Issue | File | Impact |
|---|-------|------|--------|
| B-H1 | OAuth State Never Validated | `handler_oauth.go:45`, `handler_oauth_callback.go:15-27` | CSRF attack on OAuth flow |
| B-H2 | Callback URL from Origin Header | `handler_oauth_callback.go:99-100` | SSRF/open redirect — attacker steals OAuth codes |
| B-H3 | OAuth Token in Redirect URL | `handler_oauth_callback.go:53` | JWT in browser history/logs/referrer |
| B-H4 | IDOR: GetScreening | `handler_screen.go:5-30` | Any tenant can read any screening |
| B-H5 | IDOR: GetAlert | `handler_alerts.go:46-64` | Any tenant can read any alert |
| B-H6 | IDOR: GetBatch/GetResults | `handler_batch_status.go:20-59` | Any tenant can read any batch |
| B-H7 | IDOR: GetCase | `handler_cases.go:35-50` | Any tenant can read any case |
| B-H8 | IDOR: Case Actions | `handler_cases_action.go` | Any tenant can mutate any case |
| B-H9 | IDOR: EDD Get | `handler_edd.go:48-56` | Any tenant can read any EDD file |
| B-H10 | IDOR: ResolveAlert | `handler_alerts_resolve.go:35` | Any tenant can resolve any alert |
| B-H11 | iFrame No Key Validation | `handler_iframe.go:27-32` | Any non-empty string passes as API key |
| B-H12 | Rate Limiter Memory Leak | `middleware_rate.go:60` | sync.Map grows unbounded — OOM over time |
| B-H13 | iFrame Whitelist Always `*` | `middleware_iframe.go:39-47` | Whitelist middleware defeated |
| B-H14 | Domain Check Uses Contains | `middleware_iframe.go:54` | `evil-example.com` matches `example.com` |

### Frontend High (10)

| # | Issue | File | Impact |
|---|-------|------|--------|
| F-H1 | `useApi` refetch broken | `hooks/useApi.ts:32` | Returned refetch never updates state — stale data |
| F-H2 | Race condition in useScreening | `hooks/useScreening.ts` | Rapid submissions overwrite correct results |
| F-H3 | MatchingDemo leaks 5/6 timeouts | `pages/marketing/MatchingDemo.tsx:85-88` | Only last setTimeout stored — 5 timers never cleared |
| F-H4 | Alert actions are no-ops | `pages/AlertDetailPage.tsx:55` | All 4 action buttons pass `() => {}` — workflow non-functional |
| F-H5 | useMediaQuery infinite loop | `hooks/useMediaQuery.ts:11` | `matches` in own dependency array |
| F-H6 | ActiveSubscriptions no error handling | `components/billing/` | Failed API leaves UI in permanent loading |
| F-H7 | SeatManager no error handling | `components/billing/` | Same permanent loading issue |
| F-H8 | InvoiceList no error handling | `components/billing/` | Same permanent loading issue |
| F-H9 | Duplicate analytics API calls | `pages/Analytics.tsx` | No caching, fires on every render |
| F-H10 | Plan type mismatch | `pages/billing/UpgradeModal.tsx` | `monthlyPriceCents` vs `monthlyPrice` |

### Architecture High (3)

| # | Issue | Description |
|---|-------|-------------|
| A-H1 | Rate Limiter Memory Leak | sync.Map never evicts — unbounded growth |
| A-H2 | Logging Is a No-Op | `logRequest` discards all params — zero observability |
| A-H3 | 161 Go Files Without Tests | Ingestion parsers, pgx repos, config loading untested |

---

## MEDIUM ISSUES (31) — Fix Before GA

### Backend Medium (17)

| # | Issue | File |
|---|-------|------|
| B-M1 | No request body size limit | `api/request.go:10-18` |
| B-M2 | Dedupe O(n^2) with no input cap | `handler_resolution.go:35-44` |
| B-M3 | Entity search unlimited results | `handler_entities.go:46-50` |
| B-M4 | context.Background() instead of r.Context() | `handler_entities.go:53` |
| B-M5 | String context keys (collision risk) | `middleware_tenant.go:8` |
| B-M6 | Usage enforcement silent bypass | `middleware_usage.go:20-29` |
| B-M7 | ListAlerts filters in memory | `handler_alerts.go:23-41` |
| B-M8 | Platform Overview N+1 queries | `handler_platform.go:29-43` |
| B-M9 | PlatformUsers N+1 queries | `handler_platform_users.go:22-49` |
| B-M10 | Logging middleware is no-op | `middleware_logging.go:38-44` |
| B-M11 | parseInt always returns 12 | `handler_usage.go:85-87` |
| B-M12 | Webhook 500 on unknown events | `internal/billing/ls_webhook.go:50` |
| B-M13 | Timestamp-based subscription IDs | `handler_webhook_persist.go:80-89` |
| B-M14 | Timestamp-based user IDs | `handler_team.go:45` |
| B-M15 | Timestamp-based seat IDs | `handler_billing_seats.go:30` |
| B-M16 | TenantConfig allows threshold > 1.0 | `internal/domain/tenant_config.go:54` |
| B-M17 | NewTenantID errors ignored (10+ handlers) | Multiple files |

### Frontend Medium (14)

- Pervasive `as any` type casts across billing pages
- Hardcoded "John Smith" in sidebar avatar
- Index-as-key in ScreeningResults list
- Missing URL encoding for path parameters
- Inline styles in admin pages
- PromoCodeInput `discountPercent` vs `percent` shape mismatch
- AuditTrail badge color string not in union type
- Missing `aliases` prop in test fixtures
- Missing `description` prop in EmptyState tests
- `import.meta.env` not typed (Vite env)
- billingApi export missing from api/billing module
- 3 pages reference removed `token` on AuthContextValue
- No loading/error states in several compliance pages
- Sidebar test expects "AMLIQ" text that no longer exists

---

## LOW ISSUES (15)

- csv.Writer errors not checked
- json.Encoder errors discarded in response helpers
- Hand-rolled base64url decode (use stdlib)
- WeightedScorer.SetWeight not thread-safe
- Success response timestamp always 0
- No size limit on fetched sanctions list data
- User repository is in-memory (dev placeholder)
- Multiple `act()` warnings in React tests

---

## Recommended Fix Order

### Phase 1: Security Blockers (before any deployment)
1. Replace SHA-256 with bcrypt for password hashing
2. Require TOKEN_SECRET at startup (fail-fast)
3. Restrict CORS to configured origins
4. Add tenant ownership checks to all GET-by-ID endpoints (7 IDOR fixes)
5. Implement OAuth state validation (CSRF)
6. Use configured callback URL instead of Origin header
7. Fix nil context in webhook handlers
8. Add role-based route protection on admin/platform pages

### Phase 2: Functional Blockers (before beta)
9. Fix `useApi` refetch to actually update state
10. Implement alert action handlers (currently no-ops)
11. Fix auth context — expose token or use API client consistently
12. Make all admin/platform pages use centralized API client
13. Fix UpgradeModal Plan type mismatch
14. Add confirmation dialog for API key revocation

### Phase 3: Reliability (before GA)
15. Implement graceful shutdown
16. Fix rate limiter memory leak (add eviction)
17. Implement real request logging
18. Add request body size limits
19. Fix N+1 queries in platform endpoints
20. Push alert filters to database queries
21. Replace timestamp-based IDs with UUIDs

### Phase 4: Quality & Coverage
22. Fix 29 TypeScript type errors
23. Fix 7 Go test compilation failures
24. Add ESLint configuration
25. Add tests for 161 untested Go files
26. Code-split 710 kB JS bundle
27. Upgrade pgx to v5.5.4 (SQL injection fix)
28. Upgrade Go to 1.25.8 (stdlib vulns)
