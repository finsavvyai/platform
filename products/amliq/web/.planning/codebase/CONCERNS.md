# Codebase Concerns

**Analysis Date:** 2026-04-21

## Pre-Existing TypeScript Errors

**Type incompatibility in Card component styling:**
- Issue: `Card` component does not accept `style` prop with `borderColor`, but code passes inline styles
- Files: `src/pages/monitoring/CustomerImport.tsx` (lines 122, 159)
- Impact: TypeScript compilation fails; style props silently ignored if component updated
- Fix approach: Either extend `CardProps` type to accept `style`, or refactor to use className with CSS variables instead

**Missing property on ScreenMatch type:**
- Issue: `source_type` property accessed but not defined on `ScreenMatch` type
- Files: `src/pages/ScreenEntity.tsx` (line 87)
- Impact: Runtime access to undefined property; filtering logic may fail silently
- Fix approach: Either add `source_type` to `ScreenMatch` type definition in `src/types/screening.ts`, or use optional chaining with fallback

## Security Considerations

**Token storage in localStorage:**
- Risk: Auth tokens stored in browser localStorage are vulnerable to XSS attacks if any dependency or inline script is compromised
- Files: `src/context/AuthContext.tsx`, `src/api/client.ts`, `src/pages/monitoring/CustomerImport.tsx`, `src/components/ui/ExportButton.tsx`
- Current mitigation: Standard browser API; tokens are valid only for current session
- Recommendations: 
  - Add HttpOnly cookie fallback for production (requires backend support)
  - Implement token refresh with short-lived access tokens + longer-lived refresh tokens
  - Add CSP headers to prevent inline script injection
  - Consider using `sessionStorage` instead of `localStorage` to limit token lifetime to tab closure

**Password handling in forms:**
- Risk: Passwords passed as strings through React components and stored in state; potential for unintended logging or memory dumps
- Files: `src/context/AuthContext.tsx`, `src/components/auth/LoginForm.tsx`
- Current mitigation: None detected
- Recommendations:
  - Add browser password manager integration (autocomplete)
  - Clear password state immediately after login
  - Use `cleartext` form submissions with POST only
  - Avoid logging authentication state in development console

**Direct API endpoint in CSV import:**
- Risk: Hardcoded fetch to `/api/v1/ingest/customers/import` with bearer token
- Files: `src/pages/monitoring/CustomerImport.tsx` (line 72)
- Current mitigation: Token comes from localStorage
- Recommendations: Use centralized API client (`api.post()` instead of `fetch()`) to ensure consistent header handling and error handling

**Query parameter token handling:**
- Risk: Token passed via URL query parameter (`?token=...`) can be logged in browser history, server logs, or referer headers
- Files: `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`
- Current mitigation: Token extracted and stored in localStorage immediately
- Recommendations:
  - Use POST-based token exchange instead of query parameters
  - Clear URL history after token extraction using `window.history.replaceState()`
  - Add explicit guidance to never share links containing tokens

## Performance Bottlenecks

**Large component: HeroSection exceeds 200-line limit:**
- Problem: Component at 219 lines with multiple nested animations and gradient calculations
- Files: `src/pages/marketing/HeroSection.tsx`
- Cause: Combines hero content, background effects, and card mock-up in single component
- Improvement path: Split into `<HeroContent>`, `<HeroBg>`, and `<HeroScreeningCard>` (already partially extracted), then move to separate files

**Large components approaching 200-line limit:**
- Files near limit:
  - `src/pages/SourceHealth.tsx` (184 lines)
  - `src/pages/monitoring/CustomerImport.tsx` (180 lines)
  - `src/components/webhooks/IncomingWebhookCard.tsx` (169 lines)
  - `src/components/ubo/OwnershipGraph.tsx` (165 lines)
  - `src/components/layout/Sidebar.tsx` (163 lines)
  - `src/components/batch/BatchJobCard.tsx` (162 lines)
  - `src/components/automation/RuleBuilder.tsx` (152 lines)
  - `src/components/analytics/ScreeningHeatmap.tsx` (144 lines)
- Impact: Violates portfolio CLAUDE.md max file size of 200 lines; difficult to test and refactor
- Improvement path: Extract hooks for state management, split large render blocks into child components, move form logic to custom hooks

**Performance observer on ScreenEntity:**
- Problem: PerformanceObserver attached to measure screening latency, with network call on production
- Files: `src/pages/ScreenEntity.tsx` (lines 37-60)
- Cause: Sends metrics fetch on every screening result in production (except dev)
- Improvement path: Batch metrics sends, use sendBeacon API instead, implement circuit breaker for metrics endpoint

## Test Coverage Gaps

**Minimal page test coverage:**
- Untested pages: ~244 of 292 tsx files lack `.test.tsx` counterpart (83% uncovered)
- Critical untested pages:
  - `src/pages/ScreenEntity.tsx` - Core screening functionality (157 lines, tested partially in `ScreenEntity.test.tsx` 106 lines but incomplete)
  - `src/pages/PEPScreening.tsx` - PEP screening flow (no test file)
  - `src/pages/monitoring/CustomerImport.tsx` - Bulk import (no test file)
  - `src/pages/AlertQueue.tsx` - Alert management (no test file)
  - `src/pages/VesselScreening.tsx` - Sanctions screening (no test file)
  - `src/pages/Configuration.tsx` - Admin configuration (no test file)
- Risk: Breaking changes to screening, import, or alert flows detected only in manual testing
- Priority: High - these are revenue-critical paths

**No tests for auth context:**
- Untested: `src/context/AuthContext.tsx` - Token storage, login/signup/logout flows
- Risk: Auth state mutations (login, logout, token refresh) can break silently
- Coverage gap: Session persistence, token invalidation, race conditions in concurrent auth calls

**No tests for error handling:**
- Error components exist (`src/components/ui/ErrorBoundary.tsx`) but boundary behavior untested
- API error scenarios (`src/api/client.ts`) handle 401, but no tests for:
  - 402 quota exceeded handling
  - Network timeouts
  - Malformed JSON responses
  - Missing required fields in data

**Weak component test coverage:**
- Core UI components have minimal tests:
  - `src/components/ui/Card.tsx` - No test
  - `src/components/ui/Button.tsx` - No test
  - `src/components/ui/Badge.tsx` - No test
  - `src/components/ui/ExportButton.tsx` - No test (relies on localStorage/fetch)
  - `src/components/ui/ConfirmModal.tsx` - No test

**Hooks untested:**
- `src/hooks/useScreening.ts` - Core screening hook (157 lines, 1 test file with only `useAlertSummary.test.ts` at 148 lines)
- `src/hooks/useAlerts.ts` - Alert fetching (no test)
- `src/hooks/useApi.ts` - Generic API hook (no test)
- `src/hooks/useSmartSort.ts` - Alert sorting logic (no test)

## Fragile Areas

**Type-unsafe filtering logic:**
- Files: `src/pages/ScreenEntity.tsx` (lines 84-97)
- Why fragile: Client-side filtering by string concatenation of `dataset`, `source_type`, `lists`, `source_url` fields; relies on case-insensitive substring matching
- Safe modification: Add strict type guard for match layers; create `getMatchLayers()` helper; add tests for edge cases (null fields, empty arrays)
- Test coverage: Missing tests for layer filtering logic

**Loosely-typed screening results:**
- Files: `src/types/screening.ts`
- Why fragile: Multiple fields marked as optional; backend can return different structures (e.g., `lists` as string, array, or CSV)
- Safe modification: Make normalizer functions (`normalizeStringArray`) tests explicit; add validation at API boundary in `src/api/client.ts`
- Test coverage: No tests for `normalizeStringArray` behavior with edge cases

**CSV parsing in CustomerImport:**
- Files: `src/pages/monitoring/CustomerImport.tsx` (lines 21-27)
- Why fragile: Simple split-by-comma parsing fails on:
  - Quoted fields with commas: `"Smith, Jr.",`
  - Unicode whitespace
  - CRLF vs LF line endings (partly handled by regex)
  - BOM markers in UTF-8 files
- Safe modification: Use CSV parser library (e.g., `papaparse`) or validate stricter format
- Test coverage: No tests for edge cases

**Alert state mutations without loading guards:**
- Files: `src/pages/AlertQueue.tsx` (line 99)
- Why fragile: `error` rendered without checking if it's defined; `useAlerts()` hook may return stale error after successful load
- Safe modification: Add explicit error state reset on data load; render error only if `error && !loading`
- Test coverage: No tests for error state lifecycle

**Direct localStorage access scattered throughout:**
- Files: Multiple (AuthContext, ExportButton, CSS var in Sidebar)
- Why fragile: No single source of truth for token management; race conditions possible if token cleared during fetch
- Safe modification: Create `TokenManager` class or hook for all localStorage operations; add tests for concurrent access
- Test coverage: No tests for localStorage access patterns

## Missing Loading and Error States

**CustomerImport page:**
- Missing state: Parse error shown but no loading state during file processing (lines 21-27)
- Missing state: Network errors during upload catch but don't show file retry option
- Impact: User unsure if import succeeded if network flaky

**ExportButton:**
- Missing state: No loading indicator during download (just `disabled` prop)
- Missing state: No success confirmation after export
- Impact: Users may click multiple times or leave page thinking export failed

**AlertQueue:**
- Missing state: Error rendered (line 99) but `loading` state doesn't prevent render of filters/export
- Missing state: No retry button if `useAlerts()` fails
- Impact: Page appears interactive while data loads; error persists without recovery option

## Dependency Risks

**Outdated or risky patterns:**
- `localStorage` API directly accessed (16+ call sites) - no abstraction layer for testing
- `fetch()` used directly in `CustomerImport.tsx` instead of centralized `api` client - bypasses auth header injection
- Speech Recognition API accessed without feature detection in `src/components/alerts/NotesCard.tsx` (uses `as any` cast)

## Type Safety Issues

**Excessive use of `any` type:**
- Count: 89 occurrences of `any` in src/
- Critical files:
  - `src/components/alerts/NotesCard.tsx`: `(new () => any)` for SpeechRecognition, `e: any` for result event
  - `src/components/alerts/AlertDetailSidebar.tsx`: `as any` cast for color mapping (line 14)
  - `src/components/data/StatusBadge.tsx`: `as any` for color maps (lines 13, 29)
  - `src/types/audit.ts`: `details: Record<string, any>` unbounded object
- Risk: Loss of compile-time type checking; runtime errors in color mapping or event handling
- Fix approach: Define proper types for event payloads, create ColorMap type, remove `as any` assertions

**Untyped API responses:**
- Files: Most pages cast API responses without validation
- Example: `src/pages/monitoring/CustomerImport.tsx` line 77 - `json.imported ?? 0` assumes shape without type
- Risk: Backend schema changes break frontend silently

## Unsafe Optional Chaining

**Potential null-reference errors:**
- Files: Multiple (AlertQueue.tsx line 99 accesses `error.message` without null guard above)
- Pattern: Code checks `error &&` then accesses `error.message` in ternary, but doesn't account for `error` lacking `message` property

## Security: Unvalidated User Input

**CSV header validation insufficient:**
- Files: `src/pages/monitoring/CustomerImport.tsx` (line 57)
- Risk: Only checks for required columns; doesn't validate data types, reject injection patterns, or enforce row limits
- Fix: Add row count limit enforcement (claimed 100k limit not validated), sanitize data before display

## Missing Feature Completeness

**Quota/limit handling incomplete:**
- Files: Multiple pages handle 402 quota error, but no endpoint to check remaining quota before submission
- Impact: User attempts large operation, fails at last moment instead of warning upfront

---

*Concerns audit: 2026-04-21*
