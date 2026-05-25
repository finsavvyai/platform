# Requirements: Audit Defect Remediation

**Date**: 2026-03-09
**Scope**: Remaining audit defects from code review (M1/M7, M2/M6, M5)
**Priority**: P1 — Must fix before release

---

## Background

A comprehensive code review on 2026-03-07 identified 7 critical and 14 major issues. All 7 critical issues (C1-C7) have been resolved. This document covers the remaining open major issues.

---

## R1: Add Authentication Middleware to Data Room, SOC2, and SLA Routes

### Description
Three API route files serve sensitive data without authentication middleware:
- `apps/api/src/routes/data-room.ts` — Investor metrics (org counts, revenue, product usage)
- `apps/api/src/routes/soc2-readiness.ts` — SOC2 compliance readiness data
- `apps/api/src/routes/sla-monitoring.ts` — SLA performance metrics

These routes access `c.get('orgId')` but no middleware sets it. They are mounted via `register-admin.ts` but Hono sub-routers do not inherit parent middleware.

### Acceptance Criteria

- [ ] `data-room.ts` has `.use('*', dbMiddleware, authMiddleware, adminMiddleware)` — admin-only access
- [ ] `soc2-readiness.ts` has `.use('*', dbMiddleware, authMiddleware, resolveOrgContext)` — org-scoped access
- [ ] `sla-monitoring.ts` has `.use('*', dbMiddleware, authMiddleware, resolveOrgContext)` — org-scoped access
- [ ] All three routes return 401 when called without a valid Clerk JWT
- [ ] `soc2-readiness.ts` and `sla-monitoring.ts` return 403 when called without org context
- [ ] Existing functionality is unchanged for authenticated requests
- [ ] Unit tests cover unauthenticated and unauthorized access for all three routes

### References
- Code review: M1 (full report), M7 (API report)
- Pattern to follow: `apps/api/src/routes/alert-channels/index.ts:31` (uses `.use('*', dbMiddleware, authMiddleware, resolveOrgContext)`)

---

## R2: Add Audit Logging for Solo Mode RBAC Bypass

### Description
When the `X-Org-Id` header is absent, `requirePermission` in `apps/api/src/middleware/rbac.ts` silently bypasses all permission checks. This is intentional for single-user backward compatibility, but there is zero audit trail for operations performed in solo mode.

### Acceptance Criteria

- [ ] When solo mode bypasses a permission check, log: `{ event: 'rbac.solo_bypass', userId, permission, path, method, timestamp }`
- [ ] Logging uses `console.log` (Cloudflare Workers structured logging) — NOT `console.warn` or `console.error`
- [ ] Log format is JSON for structured log parsing
- [ ] Solo mode behavior is unchanged — still grants full access
- [ ] No performance regression: logging must not add DB writes or KV operations in the hot path
- [ ] Unit tests verify log output when solo mode is active

### Design Constraints
- Do NOT add database writes for audit logging in solo mode (too expensive for every request)
- Use structured `console.log` which Cloudflare Workers captures in Workers Logs
- Keep the log line minimal — one JSON object per bypassed check

### References
- Code review: M2 (full report), M6 (API report)
- File: `apps/api/src/middleware/rbac.ts:23-29`

---

## R3: Split Oversized Frontend Files

### Description
Three frontend files exceed the 200-line maximum enforced by CLAUDE.md:
- `apps/web/src/components/HomeClient.tsx` — 328 lines
- `apps/web/src/app/(public)/trust/TrustPageClient.tsx` — 251 lines
- `apps/web/src/components/DemoClient.tsx` — 235 lines

### Acceptance Criteria

- [ ] `HomeClient.tsx` is split into ≤200-line files, each containing one logical section (hero, features, CTA, etc.)
- [ ] `TrustPageClient.tsx` is split into ≤200-line files by section (trust signals, compliance badges, etc.)
- [ ] `DemoClient.tsx` is split into ≤200-line files by tab/section (overview, events, network tabs)
- [ ] All resulting files are under 200 lines
- [ ] No visual regression — pages render identically before and after split
- [ ] Exports are maintained so parent pages don't need changes (or parent pages are updated accordingly)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

### Design Constraints
- Split by feature/section, not by arbitrary line count
- Each extracted component should be a meaningful, self-contained unit
- Colocate extracted components near the parent file (same directory or a subdirectory)
- Use named exports, not default exports, for extracted components

### References
- Code review: M5
- CLAUDE.md: "Maximum 200 lines per file"

---

## Non-Functional Requirements

### NFR1: No New Dependencies
All fixes must use existing project dependencies only.

### NFR2: Test Coverage
Each fix must include unit tests covering:
- Happy path (authenticated access works)
- Error path (unauthenticated/unauthorized returns proper status)
- Edge cases (solo mode, missing headers)

### NFR3: Backward Compatibility
- Solo mode must continue to work without `X-Org-Id` header
- Existing authenticated API calls must not break
- Frontend pages must render identically after file splits

---

## Out of Scope

These items are acknowledged but deferred to future sprints:
- Zod validation on remaining ~56 route files (M1 in API report)
- Raw SQL migration to Drizzle ORM (M2 in API report)
- `any` type elimination (M3/M4 in API report)
- Response envelope standardization (M5 in API report)
- Accessibility improvements (P3 in full report)
- CI pipeline creation
- Test coverage increase for web frontend
