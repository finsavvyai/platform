# TenantIQ Smoke Test — Atlas Prompt (~5 min)

Autonomous browser check after every deploy. Walks the 8 highest-
signal paths, reports pass/fail + one bug list.

## Targets
- Landing: https://tenantiq.app
- App: https://app.tenantiq.app
- API: https://api.tenantiq.app

## Credentials
- Microsoft super_admin: shacharsol@remit.co.il
- (LinkedIn + non-admin M365 = skip unless explicitly asked)

## 8 smoke tests — run in order, stop on first FAIL

1. **Landing loads with 4 auth buttons**
   - GET https://tenantiq.app → expect 200
   - DOM must contain text: "Sign in with Microsoft", "Sign in
     with LinkedIn", "Try with my M365 account only", "Onboard
     your organization"
   - No console errors, no CSP violations in DevTools

2. **API health is green**
   - GET https://api.tenantiq.app/health → JSON
   - Assert: status === "healthy", checks.database === "healthy",
     checks.version === "1.0.0"

3. **Admin sign-in works**
   - Landing → "Sign in with Microsoft" → authenticate as
     shacharsol@remit.co.il
   - After callback, verify:
     - URL ends up on app.tenantiq.app/
     - localStorage.tenantiq_user.role === "super_admin"
     - localStorage.tenantiq_user.scopeLevel === "admin"
     - Cookie tenantiq_session present (HttpOnly)

4. **Dashboard KPIs populate**
   - Still on /, wait 5s for XHR to settle
   - Screenshot the dashboard
   - At least 3 KPI cards show numeric values (not "—" or spinners)

5. **Tenant list renders**
   - GET https://api.tenantiq.app/api/tenants with Bearer token
     from localStorage
   - Assert: 200, array.length === 2, tenants contain
     "Finsavvyai" and "Global Remit"

6. **Platform Admin accessible**
   - Navigate to /platform/admin
   - Assert: "Platform Admin" heading visible, Overview tab
     selected, no 403 toast
   - GET https://api.tenantiq.app/api/platform/admin/overview →
     200, totalTenants >= 2

7. **AI agent responds**
   - Navigate to /ai
   - Type "How many users are in my tenant?" into the input, send
   - Within 30s, at least one streaming response chunk appears in
     the chat log. Pass if ANY response arrives (content-agnostic).

8. **Tenant isolation holds (security check)**
   - From the browser, call
     GET https://api.tenantiq.app/api/tenants/deadbeef-not-my-tenant/alerts
     with your Bearer token
   - Assert: 403 with "You do not have access to this tenant"

## Report

Return exactly this table:

| # | Test | Status | Duration | Evidence |
|---|------|--------|----------|----------|
| 1 | Landing 4 buttons | PASS/FAIL | Xms | screenshot URL |
| 2 | API health | PASS/FAIL | Xms | JSON response |
| 3 | Admin sign-in | PASS/FAIL | Xms | storage dump |
| 4 | Dashboard KPIs | PASS/FAIL | Xms | screenshot URL |
| 5 | Tenant list | PASS/FAIL | Xms | response body |
| 6 | Platform Admin | PASS/FAIL | Xms | screenshot + JSON |
| 7 | AI agent | PASS/FAIL | Xms | chat screenshot |
| 8 | Tenant isolation | PASS/FAIL | Xms | response code |

Then **one** "Critical failures" bullet list with reproduction steps
for each FAIL.

## Constraints
- Read-only. No POST/PUT/DELETE.
- Abort any single step at 60s.
- Total budget: 5 min wall clock.
- If step 3 fails (sign-in blocked), abort remaining; they
  depend on auth. Report "auth blocker" as the root cause.
