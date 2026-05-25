# Security Audit — amliq-frontend

**Audit Date:** 2026-04-21
**Auditor:** Claude (security-engineer mode)
**Branch:** main
**Prior art:** `.planning/codebase/CONCERNS.md` reviewed and cross-referenced

---

## Executive Summary

The frontend has a solid production guard on `VITE_API_URL` and no hardcoded secrets in source. However it has **three HIGH issues** and several medium/low issues that should be addressed before a compliance-grade production launch: auth tokens in localStorage with no XSS mitigation headers, OAuth error strings reflected directly from URL into the DOM, and admin routes without role enforcement at the route level.

---

## Findings

### 1. [HIGH] Auth Token Stored in localStorage — XSS Theft Risk

**File:** `src/context/AuthContext.tsx:42,47,56,61`, `src/api/client.ts:17,35`, `src/components/ui/ExportButton.tsx:17`, `src/pages/monitoring/CustomerImport.tsx:74`

**Description:** The bearer token `amliq_token` is written to and read from `localStorage` at 14+ call sites. Any JavaScript executing in the same origin (e.g., via a compromised npm dependency, injected ad script, or XSS vector) can read the token with `localStorage.getItem('amliq_token')` and exfiltrate it. `localStorage` is not HttpOnly and is fully accessible to JavaScript.

There is no CSP header configured (see finding #6) to constrain what scripts can execute, meaning there is no defence-in-depth layer protecting the token.

**Fix:**
- Short-term: Migrate to `sessionStorage` to reduce persistence window (token clears on tab close).
- Medium-term: Work with the backend team to introduce HttpOnly, Secure, SameSite=Strict session cookies for the auth token. Remove all `localStorage` token reads/writes from the frontend.
- Add CSP headers (see finding #6) as a complementary XSS mitigation.
- Create a single `TokenManager` module (replaces 14 scattered `localStorage` call sites) to make a future migration easy and ensure testability.

---

### 2. [HIGH] OAuth Error String Reflected from URL into DOM — Open Redirect / Information Disclosure

**File:** `src/pages/Login.tsx:21-27`

```tsx
const oauthError = searchParams.get('error');
if (oauthError) setError(oauthError);
```

**Description:** The raw value of the `?error=` query parameter is taken from the URL and rendered into the UI with no sanitisation or allow-listing. An attacker can craft a URL like:

```
https://app.amliq.finance/login?error=<any+arbitrary+message>
```

This enables phishing (crafted fake error messages persuade users to take unsafe actions) and, while React's JSX escaping prevents script injection here, the pattern is fragile — if this string is ever passed to `dangerouslySetInnerHTML` or a third-party tooltip component, XSS becomes possible. Additionally, verbose OAuth errors returned by the IdP may leak internal details (e.g., `client_id invalid`, `redirect_uri mismatch`).

**Fix:**
- Allow-list OAuth error strings against a known set (e.g., `{ access_denied: 'Access denied', ...}`).
- Fall back to a generic `'OAuth login failed'` for any unrecognised value.
- Never render a raw URL parameter value into user-facing text.

---

### 3. [HIGH] Admin Routes Have No Route-Level Role Enforcement

**File:** `src/routes/appRoutes.tsx:59-65`, `src/components/layout/ProtectedRoute.tsx`

**Description:** Admin routes (`/admin/tenants`, `/admin/health`, `/admin/list-health`, `/admin/data-sources`, `/admin/operations`, `/admin/tasks`) are wrapped in the generic `<P>` helper which calls `<ProtectedRoute>` without a `requiredRole` prop. `ProtectedRoute` only enforces authentication, not role. Any authenticated user can navigate directly to these admin pages.

```tsx
// ProtectedRoute.tsx — role check is skipped when requiredRole is undefined
if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
  return <Navigate to="/dashboard" replace />;
}
```

Nav UI hides links via `canAccess()` but URL-direct navigation bypasses that entirely.

**Fix:**
- Add `requiredRole="admin"` to `<ProtectedRoute>` for all `/admin/*` routes.
- Consider creating an `<AdminRoute>` wrapper for clarity.
- Note: Backend APIs must also enforce role — this is a defence-in-depth fix, not a replacement for server-side auth.

---

### 4. [MED] Password Reset Token Exposed via URL Query Parameter

**File:** `src/pages/ResetPassword.tsx:8`, `src/pages/Login.tsx:20-26`

**Description:** Password-reset tokens and OAuth tokens are passed as `?token=` query parameters. These values appear in:
- Browser history (persistent across sessions).
- Server access logs and reverse-proxy logs.
- `Referer` headers if the page contains any external resources.
- Browser DevTools network tab.

**Fix:**
- Use POST-based token exchange: the email link leads to a landing page that immediately POSTs the token server-side and stores the session cookie.
- If query parameters must be used, call `window.history.replaceState({}, '', '/reset-password')` immediately after extracting the token to remove it from the URL.

---

### 5. [MED] Direct `fetch()` in CustomerImport Bypasses Centralised API Client

**File:** `src/pages/monitoring/CustomerImport.tsx:72-76`

```tsx
const res = await fetch('/api/v1/ingest/customers/import', {
  method: 'POST',
  headers: { Authorization: `Bearer ${localStorage.getItem('amliq_token') ?? ''}` },
  body: fd,
})
```

**Description:** This raw `fetch` call:
1. Bypasses the centralised `api` client (`src/api/client.ts`) and its 401 handling (no redirect to `/login` on session expiry).
2. Does not validate HTTP error statuses — `res.json()` is called even on 4xx/5xx responses without checking `res.ok`.
3. Reads the token directly from localStorage (duplicated code, harder to migrate later).
4. Uses a relative URL (`/api/v1/...`) which will silently target localhost in production if `VITE_API_URL` differs from the current origin (though the production guard in `client.ts` would catch this at startup).

**Fix:**
- Use the centralised `api.post()` for multipart uploads by constructing the `FormData` and passing it through `fetchApi` with the appropriate `Content-Type` omitted (browser sets it with boundary for multipart).
- Alternatively, expose an `api.upload()` helper in `client.ts`.

---

### 6. [MED] No Content Security Policy (CSP) Headers

**File:** `index.html`, `Dockerfile`, `vite.config.ts`

**Description:** No CSP `<meta>` tag is present in `index.html`, and the Dockerfile uses `serve` without a custom header configuration file. There is no `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` header configured at the static server level.

Without CSP:
- XSS payloads can load arbitrary external scripts.
- Clickjacking via `<iframe>` is possible.
- MIME sniffing attacks are possible.

The app uses Google Fonts via `<link rel="preconnect">` and an external CDN, so CSP needs to allow those origins.

**Fix (serve-based Dockerfile):**
- Add a `serve.json` configuration file to `dist/` with security headers:

```json
{
  "headers": [
    {
      "source": "**",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' <VITE_API_URL>; img-src 'self' data:; frame-ancestors 'none'"
        }
      ]
    }
  ]
}
```

- Alternatively configure headers in a CDN/reverse proxy (Cloudflare, nginx, etc.).

---

### 7. [MED] i18n `escapeValue: false` Disables XSS Escaping in Translations

**File:** `src/i18n/config.ts:25`

```ts
interpolation: { escapeValue: false },
```

**Description:** The i18next `escapeValue: false` option disables HTML escaping of interpolated values. The comment in i18next docs says this is safe when React is used (since React escapes JSX), but it becomes dangerous if:
- Any translation string is ever passed to `dangerouslySetInnerHTML`.
- User-controlled data is ever interpolated into a translation key (e.g., `t('greeting', { name: userInput })`).

**Fix:**
- Keep `escapeValue: false` only if you confirm no user-controlled values are ever interpolated into translations.
- Audit all `t(key, { ...vars })` calls where the variables originate from API responses or user input.
- If in doubt, remove this option and handle the React double-escape issue explicitly.

---

### 8. [MED] `ExportButton` Error Leaked via `alert()` with Internal Details

**File:** `src/components/ui/ExportButton.tsx:36-37`

```tsx
console.error('Export error:', error);
alert(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
```

**Description:** Two issues:
1. `console.error` in production leaks error stack traces to the browser console — visible to any user opening DevTools.
2. `alert()` with the raw `error.message` may expose internal API error strings (e.g., internal server error messages, stack traces from the backend) to the user.

**Fix:**
- Replace `console.error` with a proper error reporting service (Sentry, Datadog, etc.) or at minimum guard with `if (import.meta.env.DEV)`.
- Replace `alert()` with the app's `Toast` component for a consistent UX and to control the message shown.
- Show a generic user-facing message; log the detailed error internally.

---

### 9. [MED] Performance Metrics Sent Without Auth — Potential Data Exfiltration Vector

**File:** `src/main.tsx:28-33`, `src/pages/ScreenEntity.tsx:49-54`

**Description:** Web vitals and screening performance metrics are POSTed unauthenticated to `/api/v1/analytics/vitals` and `/api/v1/analytics/perf-budget`. The request includes `location.href` (full URL including any query params). If a token ever appears in a URL (see finding #4), it would be sent to the analytics endpoint without auth. Additionally, these endpoints must accept unauthenticated POSTs on the backend, creating a potential abuse surface (metric spam/DoS).

**Fix:**
- Strip query parameters and fragments from `location.href` before including in analytics payloads: `new URL(location.href).pathname`.
- Consider rate-limiting these endpoints on the backend.
- Use `navigator.sendBeacon()` instead of `fetch(..., { keepalive: true })` for unload-safe delivery.

---

### 10. [LOW] `FAQSchema.tsx` Uses `dangerouslySetInnerHTML` — Low Risk but Pattern to Watch

**File:** `src/pages/marketing/FAQSchema.tsx:30`

```tsx
dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSchema()) }}
```

**Description:** The FAQ content is hardcoded static data, so there is no actual injection risk here. However, if the `faqs` array is ever populated from an API response or CMS, `JSON.stringify` of untrusted data injected into a `<script>` tag can enable script injection (e.g., via `</script>` in the content).

**Fix:**
- Document that this component must only use hardcoded static data.
- If CMS-sourced content is ever added, sanitise with a JSON encoder that escapes `<`, `>`, and `&` in string values before injecting into `<script>` tags.

---

### 11. [LOW] VITE_API_URL Production Guard Works — Verify Build Pipeline Enforces It

**File:** `src/api/client.ts:1-7`

```ts
const url = import.meta.env.VITE_API_URL;
if (!url && !import.meta.env.DEV) {
  throw new Error('VITE_API_URL is not set...');
}
```

**Description:** This guard correctly throws at module load time if `VITE_API_URL` is missing in production. However, `import.meta.env.DEV` is replaced at build time — if the build is run without setting `NODE_ENV=production` (e.g., running `vite build` without the env var), `DEV` evaluates to `false` and the throw would fire. Conversely, if someone runs a production build with `DEV=true` set, the guard is bypassed.

**Verification needed:** Confirm CI/CD pipeline:
1. Sets `VITE_API_URL` before `npm run build`.
2. Runs `vite build` (not `vite`) so `import.meta.env.DEV` is `false`.

**Fix:** Add a CI build-time smoke test that checks the compiled bundle does not contain `localhost:8080` as a hardcoded fallback. The fallback on line 6 would only fire in DEV mode, which is correct.

---

### 12. [LOW] npm audit — 4 Moderate Vulnerabilities (Dev Tools Only)

**Command:** `npm audit`

**Findings:**
- `esbuild <=0.24.2` — Moderate: dev server allows any website to read responses (GHSA-67mh-4wv8-2f99). Only affects the local dev server, not production builds.
- `vite <=6.4.1` — Depends on vulnerable esbuild.
- `vite-node` and `vitest` — Depend on vulnerable vite.

**Severity:** LOW for production (dev tooling only). No high/critical vulnerabilities detected.

**Fix:**
- Run `npm audit fix --force` in a branch and test — this upgrades to Vite 8 which is a breaking change.
- Acceptable to defer until Vite 8 migration is planned.
- Ensure dev server is never exposed to external networks (firewall/VPN).

---

### 13. [LOW] Role Check in ProtectedRoute Uses Equality Instead of Rank Hierarchy

**File:** `src/components/layout/ProtectedRoute.tsx:20`

```tsx
if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
```

**Description:** `ProtectedRoute` uses string equality for role comparison but `navItems.ts` uses a rank-based system (`ROLE_RANK`). This inconsistency means adding new roles between `user` and `admin` (e.g., `manager`) would not be granted access to protected routes even if `ROLE_RANK` says they should be.

**Fix:** Use the same `canAccess(user.role, requiredRole)` helper from `navItems.ts` in `ProtectedRoute`, or extract it to a shared auth utility.

---

## Summary Table

| # | Severity | Area | File | Issue |
|---|----------|------|------|-------|
| 1 | HIGH | Auth | `AuthContext.tsx`, `client.ts` | Token in localStorage, no HttpOnly cookie |
| 2 | HIGH | XSS/Phishing | `Login.tsx:27` | Raw URL param reflected into UI |
| 3 | HIGH | AuthZ | `appRoutes.tsx:59-65` | Admin routes have no role enforcement |
| 4 | MED | Auth | `ResetPassword.tsx:8` | Tokens in URL query params |
| 5 | MED | API | `CustomerImport.tsx:72` | Raw fetch bypasses centralised API client |
| 6 | MED | Headers | `index.html`, `Dockerfile` | No CSP or security headers |
| 7 | MED | XSS | `i18n/config.ts:25` | `escapeValue: false` disables HTML escaping |
| 8 | MED | Info Disclosure | `ExportButton.tsx:36-37` | Internal error in `alert()` + `console.error` in prod |
| 9 | MED | Privacy | `main.tsx:28`, `ScreenEntity.tsx:49` | `location.href` (incl. query params) sent to analytics |
| 10 | LOW | XSS | `FAQSchema.tsx:30` | `dangerouslySetInnerHTML` — static now, risky pattern |
| 11 | LOW | Config | `client.ts:1-7` | VITE_API_URL guard exists; needs CI verification |
| 12 | LOW | Deps | `package.json` | 4 moderate vulns in dev tooling (esbuild/vite) |
| 13 | LOW | AuthZ | `ProtectedRoute.tsx:20` | Role check uses equality, not rank hierarchy |

---

## Recommended Remediation Priority

1. **Immediate (block release):**
   - Finding #3: Add `requiredRole="admin"` to all `/admin/*` routes.
   - Finding #2: Allow-list OAuth error strings.

2. **Before next public launch:**
   - Finding #6: Add security headers via `serve.json` or CDN config.
   - Finding #5: Replace raw `fetch` with `api` client in `CustomerImport`.
   - Finding #8: Replace `alert()` + bare `console.error` with Toast + error service.

3. **Medium-term (sprint-level work):**
   - Finding #1: Plan HttpOnly cookie migration with backend team.
   - Finding #4: Clear token from URL with `history.replaceState`.
   - Finding #9: Strip query params from analytics payloads.
   - Finding #13: Unify role-check logic using `canAccess()`.

4. **Low priority / maintenance:**
   - Finding #7: Audit i18n interpolation for user-controlled values.
   - Finding #10: Document static-only constraint on `FAQSchema`.
   - Finding #11: Add CI build-time check for localhost in bundle.
   - Finding #12: Schedule Vite 8 upgrade.

---

*Audit performed by Claude (security-engineer mode) on 2026-04-21.*
