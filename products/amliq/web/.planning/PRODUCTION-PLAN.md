# AMLIQ — Production Launch Plan

**Date:** 2026-04-21  
**Status:** BLOCKED — fix P0 items before launch  
**Sources:** AUDIT-production.md, AUDIT-security.md, COMPETE-SUMMARY.md

---

## Current State

- Build: PASS (2.43s, clean)
- Tests: PASS (316/316, 52 files)
- Lint: PASS
- TypeScript: **FAIL (3 errors)**
- CI Security Scans: **MISSING**
- Coverage Enforcement: **MISSING**
- Auth Security: **3 HIGH findings**

---

## Phase 1 — Launch Blockers (fix before any production traffic)

These are release-blocking per portfolio CLAUDE.md rules (security is non-negotiable).

### 1.1 TypeScript Errors (est: 1h)

**Fix `src/pages/monitoring/CustomerImport.tsx`:**
- Lines 122, 159: `Card` component does not accept `style` prop
- Add `style?: React.CSSProperties` to `CardProps` in `src/components/ui/Card.tsx`

**Fix `src/pages/ScreenEntity.tsx`:**
- Line 87: `source_type` does not exist on `ScreenMatch` type
- Add `source_type?: string` to `ScreenMatch` in `src/types/screening.ts`

### 1.2 Admin Route Role Enforcement — HIGH Security (est: 30min)

**File:** `src/routes/appRoutes.tsx:59-65`

All `/admin/*` routes use `<P>` wrapper with no `requiredRole`. Any authenticated user can navigate to admin pages by URL.

Fix: Add `requiredRole="admin"` to all admin route `<ProtectedRoute>` wrappers:
```tsx
// Routes: /admin/tenants, /admin/health, /admin/list-health,
//         /admin/data-sources, /admin/operations, /admin/tasks
<ProtectedRoute requiredRole="admin">
```

### 1.3 OAuth Error URL Reflection — HIGH Security (est: 30min)

**File:** `src/pages/Login.tsx:21-27`

`setError(searchParams.get('error'))` renders raw URL param into DOM — enables phishing via crafted URLs.

Fix: Allow-list OAuth errors:
```ts
const OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'Access was denied.',
  server_error: 'Authentication server error. Please try again.',
};
const oauthError = searchParams.get('error');
if (oauthError) setError(OAUTH_ERRORS[oauthError] ?? 'OAuth login failed.');
```

### 1.4 CI Security Scanning (est: 2h)

**File:** `.github/workflows/ci.yml`

Add three new CI jobs (block merge on failure):

```yaml
security:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: npm }
    - run: npm ci
    - name: Dependency vuln scan
      run: npm audit --audit-level=high
    - name: Secret scan
      uses: trufflesecurity/trufflehog@main
      with: { path: './', base: main, head: HEAD }
    - name: SAST
      uses: returntocorp/semgrep-action@v1
      with: { config: p/typescript p/react p/owasp-top-ten }
    - name: License check
      run: npx license-checker --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause'
```

### 1.5 Coverage Thresholds in CI (est: 1h)

**File:** `vitest.config.ts`

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    lines: 90,
    branches: 85,
    functions: 90,
    statements: 90,
  },
},
```

Also write `src/context/AuthContext.test.tsx` — currently 0% coverage on auth context (critical path per portfolio rules requires 100%).

### 1.6 CustomerImport Raw Fetch (est: 45min)

**File:** `src/pages/monitoring/CustomerImport.tsx:72-76`

Replace raw `fetch()` with centralised API client. Also add `res.ok` guard and 401 redirect.

```ts
// Replace raw fetch with:
const data = await api.upload('/ingest/customers/import', formData);
```

Add `api.upload()` to `src/api/client.ts` that handles `multipart/form-data` (omit Content-Type header so browser sets boundary).

---

## Phase 2 — Pre-Launch (fix within 1 week of P0)

### 2.1 Security Headers (est: 2h)

No CSP, no X-Frame-Options, no X-Content-Type-Options in production.

**Option A (Cloudflare Pages):** Add `_headers` file to `public/`:
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' VITE_API_URL; img-src 'self' data:; frame-ancestors 'none'
```

### 2.2 Token URL Exposure (est: 1h)

**File:** `src/pages/ResetPassword.tsx`, `src/pages/Login.tsx`

Add `window.history.replaceState({}, '', '/reset-password')` immediately after token extraction to prevent token from persisting in browser history and server logs.

### 2.3 ExportButton Error Leakage (est: 30min)

**File:** `src/components/ui/ExportButton.tsx:36-37`

Replace `alert()` with Toast component. Guard `console.error` with `import.meta.env.DEV`. Show generic user-facing message.

### 2.4 Analytics URL Stripping (est: 30min)

**Files:** `src/main.tsx:28`, `src/pages/ScreenEntity.tsx:49`

Strip query params and fragments before sending to analytics:
```ts
url: new URL(location.href).pathname  // not location.href
```

### 2.5 AlertQueue Error State + Retry (est: 45min)

**File:** `src/pages/AlertQueue.tsx:99`

- Guard: `{error && !loading && <p role="alert">...}` 
- Add Retry button that re-calls `useAlerts()`

### 2.6 CSS Import Ordering (est: 15min)

**File:** `src/index.css`

Move `@import './styles/effects.css'` to line 1, before all `@tailwind` directives.

### 2.7 Vendor Chunk Splitting (est: 1h)

**File:** `vite.config.ts`

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        charts: ['recharts'],
        motion: ['framer-motion'],
        i18n: ['i18next', 'react-i18next'],
      }
    }
  }
}
```

### 2.8 Twitter OG Image (est: 15min)

**File:** `index.html`

Add: `<meta name="twitter:image" content="https://amliq.finance/logo.png">`

### 2.9 HeroSection File Split (est: 1h)

**File:** `src/pages/marketing/HeroSection.tsx` (219 lines — exceeds 200-line cap)

Extract `<HeroContent>`, `<HeroBg>`, `<HeroScreeningCard>` into separate files under `src/components/marketing/`.

---

## Phase 3 — Polish Sprint (fix within 2 weeks)

### 3.1 Per-Route Error Boundaries (est: 2h)
Wrap each route group in `src/App.tsx` with its own `<ErrorBoundary>` to prevent full-app crashes from page-level errors.

### 3.2 Critical Page Tests (est: 8h)
Priority order:
1. `AlertDetailPage.test.tsx`
2. `CryptoScreening.test.tsx`, `TxnScreening.test.tsx`, `VesselScreening.test.tsx`
3. `MFASetup.test.tsx`, `ResetPassword.test.tsx`
4. `useAlerts.test.ts`, `useApi.test.ts`, `useSmartSort.test.ts`

### 3.3 TokenManager Abstraction (est: 2h)
Create `src/utils/tokenManager.ts` as single source of truth for all token read/write operations. Replace 14 scattered `localStorage.getItem('amliq_token')` call sites.

### 3.4 CSV Parser Replacement (est: 1h)
**File:** `src/pages/monitoring/CustomerImport.tsx`
Replace naive comma-split with `papaparse`. Handle BOM markers, CRLF, quoted fields, and row count limits client-side.

### 3.5 Role Check Unification (est: 30min)
**File:** `src/components/layout/ProtectedRoute.tsx`
Use `canAccess(user.role, requiredRole)` from `navItems.ts` instead of string equality. Prevents inconsistency as new roles are added.

### 3.6 `any` Type Cleanup (est: 2h)
Priority: `AlertDetailSidebar.tsx`, `StatusBadge.tsx` (define `ColorMap` type); `NotesCard.tsx` (define `SpeechRecognitionEvent` interface).

### 3.7 PerformanceObserver Batching (est: 1h)
**File:** `src/pages/ScreenEntity.tsx`
Batch metrics via `navigator.sendBeacon()` instead of per-screen `fetch`. Add 10% sampling rate in production.

---

## Phase 4 — Pre-Enterprise (before targeting Tier 2 banks)

These are required to enter deals with LexisNexis/Quantexa displacement prospects.

### 4.1 SOC 2 Type II Certification
Engage auditor. AMLIQ currently has no security certifications. ComplyAdvantage and LexisNexis both hold SOC 2 + ISO 27001. This is a hard requirement for any mid-market bank procurement.

### 4.2 HttpOnly Cookie Migration
Work with backend team to replace `localStorage` token with HttpOnly, Secure, SameSite=Strict cookie. This closes finding #1 (HIGH) from the security audit — the only remaining high-severity item after Phase 1.

### 4.3 SAR/STR Filing Automation
Build as premium feature in case management — closes the compliance workflow loop from alert to regulatory submission. No competitor offers this except via manual export.

### 4.4 Self-Serve Rule Builder
Allow compliance analysts to configure detection thresholds and rule logic without a vendor support ticket. ComplyAdvantage's primary UX complaint.

### 4.5 Published Pricing Page
Transparent SaaS tiers with no-sales-call access below $5K/month. Directly attacks ComplyAdvantage's pricing cliff and all enterprise-only competitors.

### 4.6 KYC Partner Integration
Sumsub or Onfido embedded in onboarding flow — creates a single-vendor KYC → screening → monitoring funnel that no competitor offers.

---

## Launch Readiness Scorecard

| Area | Status | Blocking? |
|---|---|---|
| Build | PASS | No |
| TypeScript errors | **FAIL (3)** | **Yes** |
| Lint | PASS | No |
| Unit tests | PASS (316) | No |
| Coverage enforcement | **MISSING** | **Yes** |
| CI security scans | **MISSING** | **Yes** |
| Admin route auth | **HIGH SECURITY** | **Yes** |
| OAuth error reflection | **HIGH SECURITY** | **Yes** |
| Token in localStorage | HIGH (mitigation in P2) | No (short-term) |
| CustomerImport raw fetch | MED SECURITY | **Yes** |
| CSS import warning | Low | No |
| Vendor chunk splitting | Recommended | No |
| HeroSection 200-line cap | **Violates policy** | **Yes** |
| Error boundaries | Partial | No |
| 25 untested pages | Low coverage | No (Phase 3) |

**Estimated total effort to reach Phase 1 launch-ready:** ~8 hours of engineering work.

---

## Quick Reference: Immediate Fixes (in order)

```
1. src/routes/appRoutes.tsx — add requiredRole="admin" to all /admin/* routes (30min)
2. src/pages/Login.tsx — allow-list OAuth error strings (30min)
3. src/components/ui/Card.tsx — add style?: React.CSSProperties to CardProps (15min)
4. src/types/screening.ts — add source_type?: string to ScreenMatch (15min)
5. src/pages/ScreenEntity.tsx line 87 — fix source_type filter (15min)
6. src/api/client.ts — add api.upload() helper for multipart (30min)
7. src/pages/monitoring/CustomerImport.tsx — replace raw fetch with api.upload() (30min)
8. vitest.config.ts — add coverage thresholds (15min)
9. src/context/AuthContext.test.tsx — write auth context tests (2h)
10. .github/workflows/ci.yml — add security scan jobs (2h)
11. src/pages/marketing/HeroSection.tsx — split into sub-components (1h)
```
