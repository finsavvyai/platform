# TenantIQ Full E2E Test — Atlas Prompt (~30 min)

You are an autonomous browser testing agent. Walk every
critical path on the TenantIQ production deployment and
report findings in a structured table.

## Targets
- **Marketing landing**: https://tenantiq.app
- **App**: https://app.tenantiq.app
- **API**: https://api.tenantiq.app

## Credentials (if you need to sign in)
- Microsoft (super_admin): shacharsol@remit.co.il — password in 1Password
  (ask operator via DM if not cached)
- LinkedIn (personal scope): use any personal LinkedIn account
- Non-admin M365 (personal scope): create or reuse a fresh
  `*@onmicrosoft.com` test user

## Test matrix

### A. Landing page (tenantiq.app) — unauthenticated
1. GET /. Expect 200, CSP headers, 4 auth buttons visible:
   "Sign in with Microsoft", "Sign in with LinkedIn", "Try with
   my M365 account only", "Onboard your organization".
2. Click each button; confirm redirect chain terminates at the
   correct OAuth provider (login.microsoftonline.com or
   linkedin.com).
3. Expected: no console errors, no CSP violations, no broken
   images, OG image present in <meta>.

### B. Admin sign-in flow
1. On landing, click "Sign in with Microsoft".
2. Authenticate as shacharsol@remit.co.il.
3. Verify redirect to app.tenantiq.app with a session cookie
   `tenantiq_session` (HttpOnly + Secure + SameSite=Lax).
4. Verify localStorage contains `tenantiq_token` and
   `tenantiq_user`. Parse user JSON — expect
   `role=super_admin`, `scopeLevel=admin`, `tenantIds` non-empty.
5. Land on /. Dashboard KPIs must show non-zero numbers.

### C. Personal scope sign-in
1. Incognito. Landing → "Try with my M365 account only".
2. Authenticate as a non-admin M365 user.
3. After callback, localStorage user payload must have
   `scopeLevel=personal`.
4. Visit /security/cis — should render `<ScopeGuard>` upgrade
   CTA ("Admin access required"), not the CIS table.
5. Click "Ask my IT admin" — verify a mailto opens with a
   pre-filled body containing the /onboard-org URL.

### D. LinkedIn sign-in
1. Incognito. Landing → "Sign in with LinkedIn".
2. Authenticate with a LinkedIn account.
3. Verify lands on dashboard with `auth_provider=linkedin`,
   `scopeLevel=personal`.

### E. Onboard-org flow (Global Admin)
1. Incognito. Landing → "Onboard your organization".
2. Redirects to login.microsoftonline.com/organizations/adminconsent.
3. Sign in as remit.co.il Global Admin, click Accept.
4. Redirects to /api/auth/callback with admin_consent=True.
5. Confirms "Permissions granted" HTML.
6. Return to app.tenantiq.app and sign in normally — must
   succeed without "Sign-in Failed" error.

### F. Admin pages (after B completes)
Visit each and assert no 500, no 403, no empty page when real
data should be present:
- /platform/admin → tabs: Overview, Tenants, Sync Jobs,
  Metrics, Alerts, Audit Log, Revenue, Announcements, Flags
- /security/cis
- /alerts
- /licenses
- /threats
- /behavior
- /security/email
- /security/purview
- /security/signin-logs
- /backups
- /backups/config
- /workflows
- /workflows/lifecycle
- /governance
- /governance/storage
- /ai
- /audit
- /msp
- /settings
- /skills

For each: take a screenshot, record any Sentry errors from the
network tab, note if the page is empty / loading-spinner-forever /
showing real data.

### G. API contract tests
Hit these directly with the Bearer token from localStorage:
- GET /api/health → 200, status=healthy
- GET /api/auth/verify → 200, role=super_admin
- GET /api/platform/admin/overview → 200, contains totalTenants
- GET /api/tenants → 200, array length == 2
- POST /api/auth/refresh with Authorization: Bearer <token> →
  200, new token, claims re-loaded from DB

### H. Negative cases
- Visit any /api/tenants/:id/* route with a tenantId NOT in
  your tenantIds → expect 403.
- Send X-Tenant-Id header with a tenant you don't own → expect 403.
- Omit Authorization header on a protected route → 401.
- Hit /api/auth/login/linkedin without LINKEDIN_CLIENT_ID in
  env → (staging only) 503.

## Report format

Return a markdown table:

| Test | Status | Notes / URL of screenshot |
|------|--------|---------------------------|
| A.1 landing 200 | PASS | … |
| A.2 button: Microsoft redirects | PASS | … |
| …

Plus a "Top 5 bugs found" section ranked by severity, each with:
- Reproduction steps
- Expected vs actual
- Suggested fix location (file + line if you can)
- Screenshot link

## Constraints

- Do not modify production data unless specifically asked.
- Do not run write operations (POST/PUT/DELETE) against tenants
  with real customer data (Finsavvyai, Global Remit). Only read.
- If you encounter an admin-consent wall, do NOT try to brute
  force — log it, move on.
- Complete in under 30 minutes. If a single test exceeds 60s,
  skip and mark as "TIMEOUT".
