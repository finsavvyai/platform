# Production Readiness Audit

**Audit Date:** 2026-04-21  
**Auditor:** Claude Sonnet 4.6 (Production Readiness Agent)

---

## Status: NEEDS WORK

Build passes, all 316 unit tests pass, lint is clean. However 3 TypeScript errors block strict compilation, coverage enforcement is absent from CI, security scans are missing from CI, and ~25 pages have no test coverage.

---

## Blockers (must fix before launch)

### 1. TypeScript compilation errors (3 errors)
- `src/pages/monitoring/CustomerImport.tsx` lines 122, 159 — `Card` does not accept `style` prop; TypeScript rejects these inline `borderColor` styles
- `src/pages/ScreenEntity.tsx` line 87 — `source_type` property does not exist on `ScreenMatch` type; filtering logic silently returns wrong results at runtime
- **Fix:** Add `style?: React.CSSProperties` to `CardProps`; add `source_type?: string` to `ScreenMatch` in `src/types/screening.ts`

### 2. No CI security scanning
- CI (`ci.yml`) runs unit tests, E2E tests, and flake stress — zero SAST, dependency vulnerability, secret scan, or license compliance steps
- This violates the portfolio CLAUDE.md non-negotiable security rule (security is release-blocking)
- **Fix:** Add jobs for `npm audit --audit-level=high`, Semgrep SAST, Trivy secret scan, and license-checker before merge

### 3. Coverage not enforced in CI
- `vitest.config.ts` has no `coverage` thresholds configured; CI runs `npm run test -- --coverage` but no threshold enforcement
- Portfolio target: ≥90% line, ≥85% branch, 100% for auth/payments/security controls
- Auth context (`src/context/AuthContext.tsx`) has zero test coverage
- **Fix:** Add `coverage: { thresholds: { lines: 90, branches: 85 } }` to `vitest.config.ts`; write `AuthContext.test.tsx`

### 4. Auth tokens in localStorage (XSS risk)
- Tokens stored in `localStorage` across 4+ files; no HttpOnly cookie alternative; no CSP headers configured
- Auth token passed via URL query parameter in `Login.tsx` / `ResetPassword.tsx` — logged in browser history and server referer logs
- **Fix (short-term):** Call `window.history.replaceState()` immediately after token extraction; add CSP headers at CDN/server level; clear password state after login
- **Fix (long-term):** HttpOnly cookie-based token storage (requires backend support)

---

## High Priority (fix before launch)

### 5. Critical pages with no unit tests (25 untested pages)
Pages that exist as `.tsx` but have no `.test.tsx` counterpart:
- `AlertDetailPage` — alert review is a core compliance workflow
- `AlertQueue` — has a test file but it tests the page; `AddMonitorModal` has none
- `Analytics`, `AuditTrail`, `BatchJobs`, `CaseDetail`
- `CryptoScreening`, `TxnScreening`, `VesselScreening` — all 3 screening flows untested
- `MFASetup`, `ResetPassword` — auth flows
- `Monitoring`, `MonitorProfileCard`, `SanctionsLists`, `SanctionsListsSettings`
- `SourceHealth`, `TaskHistory`, `Webhooks`, `ListsMarketplace`, `DataSources` (in sub-dirs)
- `APIKeys`, `DocsPage`, `ContactPage`, `NotFoundPage`, `ProductPage`
- **Fix:** Prioritize `AlertDetailPage`, `CryptoScreening`, `TxnScreening`, `VesselScreening`, `MFASetup`, `ResetPassword`

### 6. No tests for core hooks
- `useAlerts.ts`, `useApi.ts`, `useSmartSort.ts` — no tests
- `useScreening.ts` — tested via `useAlertSummary.test.ts` only; core screening hook logic is uncovered
- **Fix:** Write `useAlerts.test.ts`, `useApi.test.ts`, `useSmartSort.test.ts`

### 7. Direct `fetch()` in CustomerImport bypasses API client
- `src/pages/monitoring/CustomerImport.tsx` line 72 calls raw `fetch('/api/v1/ingest/customers/import')` with token from `localStorage` directly
- Bypasses centralized error handling, auth header injection, and 402/quota logic
- **Fix:** Replace with `api.post('/ingest/customers/import', ...)` using the centralized client

### 8. CSS `@import` ordering warning in build
- `src/index.css` places `@import './styles/effects.css'` after `@tailwind` directives — PostCSS/Vite emits a warning on every build
- **Fix:** Move `@import './styles/effects.css'` to line 1, before all `@tailwind` directives

### 9. LandingPage bundle is 53 KB (12 KB gzip) — no code splitting configured
- `vite.config.ts` has no `rollupOptions.output.manualChunks` — the main `index` chunk is 463 KB raw / 153 KB gzip; `useAnalytics` is 413 KB raw / 111 KB gzip
- No vendor chunk splitting for React, React Router, or large third-party libs
- **Fix:** Add `manualChunks` to extract `react`, `react-dom`, `react-router-dom` into a separate vendor chunk; lazy-load marketing pages

---

## Medium Priority (fix within 2 weeks)

### 10. Missing error boundary on route-level (only root-level boundary)
- `App.tsx` wraps the entire tree in one `<ErrorBoundary>` — a runtime error in any page crashes the full app
- No per-route error boundaries; Suspense fallback is a generic `PageLoader`
- **Fix:** Add per-route `<ErrorBoundary>` wrappers inside `appRoutes`, `complianceRoutes`, `platformRoutes`

### 11. CustomerImport loading state gaps
- File processing has no loading indicator during parse; network errors don't offer a retry option
- `uploading` state disables the button but shows no spinner or progress feedback
- **Fix:** Add `LoadingSpinner` during upload; show retry button on network failure; add file parse progress

### 12. AlertQueue error state has no retry
- `src/pages/AlertQueue.tsx` line 99 renders the error message but no retry button; filters render while `loading` is true
- `error` is rendered without checking `!loading`, so stale error persists after successful reload
- **Fix:** Guard `error` render with `error && !loading`; add a "Retry" button that re-calls `useAlerts()`

### 13. HeroSection exceeds 200-line limit (219 lines)
- `src/pages/marketing/HeroSection.tsx` violates the portfolio 200-line cap
- **Fix:** Extract `<HeroContent>`, `<HeroBg>`, `<HeroScreeningCard>` into separate files

### 14. 89 `any` type usages
- Most impactful: `NotesCard.tsx` (SpeechRecognition API cast), `AlertDetailSidebar.tsx` (color mapping), `StatusBadge.tsx` (color maps)
- **Fix:** Define `ColorMap` type; define `SpeechRecognitionEvent` interface; replace `as any` assertions

### 15. CSV parsing is fragile (no library)
- `src/pages/monitoring/CustomerImport.tsx` uses naive split-by-comma; fails on quoted fields, BOM markers, CRLF
- **Fix:** Replace with `papaparse` or enforce strict format with user-facing error messages; add row count limit enforcement client-side

### 16. PerformanceObserver metrics sent on every screen in production
- `src/pages/ScreenEntity.tsx` lines 37–60 fires a `fetch` for metrics on every result; no batching or circuit breaker
- **Fix:** Batch with `sendBeacon`, add debounce/throttle, or use a sampling rate

### 17. Twitter OG image meta tag missing
- `index.html` has `twitter:card` and `twitter:title` but no `twitter:image` — Twitter cards will render without a preview image
- **Fix:** Add `<meta name="twitter:image" content="https://amliq.finance/logo.png">`

---

## Low Priority (fix eventually)

### 18. Direct localStorage access in 16+ locations
- No `TokenManager` abstraction; race conditions possible if token cleared mid-fetch
- Difficult to mock in tests; forces `localStorage.setItem` stubs
- **Fix:** Create `src/utils/tokenManager.ts` as single source of truth; replace all direct `localStorage` calls

### 19. React Router v6 future flag warnings in tests
- `BrowserRouter` emits `v7_startTransition` and `v7_relativeSplatPath` deprecation warnings during test runs
- Non-blocking but pollutes test output
- **Fix:** Add future flags to router config or upgrade to React Router v7

### 20. Quota check missing before large operations
- Multiple pages handle 402 quota errors reactively; no proactive quota check before bulk operations
- **Fix:** Add a `GET /quota` preflight check in `CustomerImport` and batch screening flows

### 21. Files approaching 200-line limit
- `SourceHealth.tsx` (184 lines), `CustomerImport.tsx` (180 lines), `IncomingWebhookCard.tsx` (169 lines), `OwnershipGraph.tsx` (165 lines), `Sidebar.tsx` (163 lines), `BatchJobCard.tsx` (162 lines)
- **Fix:** Extract hooks and sub-components before they cross the 200-line threshold

### 22. `act()` warning in Sidebar tests
- `Sidebar.test.tsx` triggers "update not wrapped in act()" warning on link click test
- **Fix:** Wrap navigation assertions with `await act(async () => { ... })`

---

## Already Good

- **Build:** Passes cleanly in 2.43s with full code splitting by route (lazy imports per page)
- **Tests:** 316 tests across 52 files, all pass; Vitest + Testing Library setup is correct
- **Lint:** ESLint passes with zero errors or warnings
- **SEO/Meta:** `index.html` has canonical URL, OG tags (type, url, title, description, image), Twitter card (card, title, description), structured data (JSON-LD), robots meta, theme-color, manifest, apple-touch-icon
- **Error boundary:** `App.tsx` wraps the full app in `<ErrorBoundary>` with Suspense fallback
- **Loading states (ScreenEntity):** Correctly handles `loading`, `error`, `isLimitError`, `LimitReachedBanner` — well-structured
- **Accessibility (images):** Only one `<img>` in non-test source (`MFASteps.tsx`) — has a proper `alt="TOTP QR Code"`
- **Env vars:** `.env.example` exists with all required `VITE_*` vars (`VITE_API_URL`, `VITE_APP_NAME`, `VITE_ENVIRONMENT`); `.env.production` contains only the production API URL (no secrets)
- **CI pipeline:** Exists with unit, E2E, and flake-stress jobs; E2E runs Playwright on Chromium
- **React Router future flags:** Non-breaking; app will run correctly until v7 migration

---

## Summary Scorecard

| Area | Status |
|---|---|
| Build | PASS (1 CSS warning) |
| TypeScript | FAIL (3 errors) |
| Lint | PASS |
| Unit Tests | PASS (316/316) |
| Coverage enforcement | MISSING |
| Security scans in CI | MISSING |
| Auth security | RISK (localStorage, URL tokens) |
| Page test coverage | LOW (25 pages untested) |
| Error boundaries | PARTIAL (root only) |
| Loading/error states | PARTIAL (ScreenEntity good; CustomerImport, AlertQueue gaps) |
| SEO/meta | GOOD (missing twitter:image) |
| Accessibility | GOOD |
| Env var documentation | GOOD |
| Bundle size | ACCEPTABLE (vendor splitting recommended) |
