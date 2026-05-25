# Code Review Report

**Scope**: OpenSyber Monorepo (Full Project) -- Follow-up Review
**Date**: 2026-03-30
**Reviewer**: Code Review Agent
**Focus**: API routes, middleware, services, database schema, type safety

---

## Executive Summary

**Overall Status**: Changes Required

**Summary**: This follow-up review focuses on the six areas specified: code quality, error handling, API security, architecture, performance, and type safety. The previous review (2026-03-29) identified 3 critical issues; this review confirms some fixes were applied (SQL wildcard escaping in admin-users.ts now uses `escapeLike()`, score endpoint now has `authMiddleware`) but identifies 4 new critical issues and 7 high-severity findings. The most significant systemic problem is that 27 route files bypass Zod validation by using `c.req.json<Type>()` (TypeScript generic type assertion, zero runtime validation), creating a broad input validation gap across the API surface.

**Statistics**:
- Files Reviewed: 42 route files, 12 middleware files, 6 schema files, 4 service files
- Critical Issues: 4
- High Issues: 7
- Medium Issues: 8
- Low Issues: 5

---

## Detailed Findings

### Critical Issues

#### CRIT-1: Missing Zod Validation on 27+ Route Files (Input Validation Bypass)

- **Files**: `marketplace-publish.ts`, `security-gateway.ts`, `org-members.ts`, `scim-users.ts`, `admin-users.ts:62`, `kill-chain.ts:60`, `webhooks-integrations.ts:66,98,128`, `trust-events.ts`, `marketplace-admin.ts`, `marketplace-rate.ts`, `incident-events.ts`, `supply-chain.ts`, `agent-registry.ts`, `security-gateway-infra.ts`, `mcp-monitoring.ts`, `sla-config.ts`, `data-residency.ts`, `saas-accounts.ts`, `otel-ingest.ts`, `webhooks-agent-provisioned.ts`, `compliance.ts`, `security-vulns.ts`, `webhooks-agent-health.ts`, `instance-skills.ts`, `saas-oauth.ts`, `remediation-runs.ts`, `admin-skills.ts`
- **Severity**: Critical
- **Category**: Security -- Input Validation
- **Description**: These 27 route files use `c.req.json<Type>()` with a TypeScript generic instead of Zod schema validation. TypeScript generics are erased at runtime and provide zero validation. The request body is trusted as-is, allowing any shape of data to flow into database operations. Example from `org-members.ts:23`:
  ```typescript
  const { role: newRole } = await c.req.json<{ role: Role }>();
  ```
  This accepts any JSON body at runtime regardless of shape. The `Role` type is not checked.
- **Impact**: Attackers can inject unexpected fields, wrong types, or oversized payloads. Any field used in SQL operations without validation is a potential injection vector. This violates the project's own CLAUDE.md rule: "Zod schemas for all API request bodies."
- **Recommendation**: Create Zod schemas in `routes/validation/` for every route that accepts a request body. Replace `c.req.json<Type>()` with `schema.safeParse(await c.req.json())`.

#### CRIT-2: SCIM Routes Use Raw SQL Bypassing Drizzle ORM

- **File**: `apps/api/src/routes/scim-users.ts:60-74`
- **Severity**: Critical
- **Category**: Security -- SQL Injection Surface
- **Description**: The SCIM user list endpoint constructs SQL by string concatenation (`let query = ...; query += ...`) and uses `c.env.DB.prepare()` directly instead of the Drizzle ORM. While parameters are bound via `?` placeholders, the approach is fragile. The filter parsing (`filter.match(/userName\s+eq\s+"([^"]+)"/)`) extracts values via regex and passes them as bound parameters, but any future filter additions following this concatenation pattern could easily introduce SQL injection. The SCIM POST route (line 113-116) also uses raw SQL for INSERT.
- **Impact**: The raw SQL approach bypasses Drizzle schema constraints and type safety. Future developers extending the filter syntax may not realize they need to use parameterized queries, especially given the string-building pattern.
- **Recommendation**: Rewrite SCIM routes to use Drizzle ORM queries with `eq()` and `and()` conditions, matching the pattern used in every other route file in the codebase.

#### CRIT-3: Webhook Integration Routes Have No Signature Verification

- **File**: `apps/api/src/routes/webhooks-integrations.ts`
- **Severity**: Critical
- **Category**: Security -- Authentication
- **Description**: The GitHub, GitLab, and generic webhook routes (`/webhooks/integrations/github`, `/webhooks/integrations/gitlab`, `/webhooks/integrations/:slug`) have no signature verification. The route applies only `dbMiddleware` (line 16-17). GitHub webhooks should verify `X-Hub-Signature-256`, GitLab should verify `X-Gitlab-Token`. The generic `/:slug` webhook route accepts arbitrary payloads from anyone on the internet. Compare with `webhooks-lemonsqueezy.ts` which correctly verifies HMAC signatures.
- **Impact**: Any external party can forge webhook payloads, injecting false security events (severity=critical) into the system. This poisons the security event data that feeds alerts, kill chain detection, and the security score -- all core product features.
- **Recommendation**: Add HMAC signature verification for GitHub (using the webhook secret stored in env), token verification for GitLab, and require API key auth or shared secret for the generic endpoint. The `timingSafeCompare` utility already exists in `lib/timing-safe.ts`.

#### CRIT-4: Admin User PATCH Has No Zod Validation on Privilege Fields

- **File**: `apps/api/src/routes/admin-users.ts:59-93`
- **Severity**: Critical
- **Category**: Security -- Privilege Escalation
- **Description**: The admin PATCH endpoint reads `body.isSuspended`, `body.plan`, and `body.isAdmin` from `await c.req.json()` with no Zod schema validation (line 62). While there is a basic plan inclusion check against a hardcoded array, the `isAdmin` field can be set without restriction -- there is no check to prevent removing the last admin, and no Zod schema constrains the body shape or types.
- **Impact**: Any admin can grant or revoke admin privileges to any user without safeguards. Unexpected fields in the body are silently ignored but the lack of schema means the contract is implicit.
- **Recommendation**: Add a Zod schema in `routes/validation/admin-users.ts`. Add business logic to prevent removing the last admin user.

---

### High Issues

#### HIGH-1: N+1 Query in Organization Details Endpoint

- **File**: `apps/api/src/routes/organizations.ts:113-122`
- **Severity**: High
- **Category**: Performance
- **Description**: The GET `/:orgId` endpoint fetches all active org members, then issues a separate `SELECT` from `users` for each member inside `Promise.all`:
  ```typescript
  const members = await Promise.all(
    memberRows.map(async (m) => {
      const [user] = await db.select({ name: users.name, email: users.email })
        .from(users).where(eq(users.id, m.userId)).limit(1);
      return { ...m, name: user?.name, email: user?.email };
    }),
  );
  ```
  With 50 org members, this produces 51 queries.
- **Impact**: Latency scales linearly with member count. For enterprise orgs with hundreds of members, this could cause timeouts on Cloudflare Workers (50ms CPU limit per request on free tier, ~30s on paid).
- **Recommendation**: Replace with a single query using `innerJoin(users, eq(orgMembers.userId, users.id))`.

#### HIGH-2: RBAC Solo Mode Bypass Grants Full Access Without Org Header

- **File**: `apps/api/src/middleware/rbac.ts:21-39`
- **Severity**: High
- **Category**: Security -- Authorization
- **Description**: When no `X-Org-Id` header is provided, `requirePermission()` skips ALL permission checks and calls `next()`. This is documented as "backward compatible solo mode" but means that any authenticated user who omits the org header can bypass RBAC on org-scoped routes. For example, `requirePermission('org.delete')` on the org DELETE route (organizations.ts:146) can be bypassed by not sending `X-Org-Id`.
- **Impact**: Routes that protect org-scoped resources via `requirePermission()` are not actually protected when the org header is absent. The route handler must independently verify ownership, but this creates a defense-in-depth gap.
- **Recommendation**: For routes that are inherently org-scoped (URL contains `/:orgId/`), either (a) require `X-Org-Id` header to be present, or (b) create a `requireOrgPermission()` variant that rejects requests without org context.

#### HIGH-3: 680 `as any` Occurrences Across 106 API Files

- **Files**: 106 files in `apps/api/src/`
- **Severity**: High
- **Category**: Type Safety
- **Description**: There are 680 uses of `as any` across the API source. The highest-risk patterns in production code:
  - `db as any` passed to utility functions (e.g., `verifyInstanceAccess(db as any, ...)` in `instances.ts:29,42,57,84`) -- 6+ occurrences per file
  - `DrizzleD1Database<any>` in 7 service files (17 total occurrences)
  - `category: body.category as any` in `marketplace-publish.ts:39` -- bypasses enum validation
  - `as typeof securityEvents.$inferInsert.severity` unsafe enum cast in `security-gateway.ts:53-54`
  - `(rows as Array<{ status: string }>)` in `score.ts:88` -- casting unknown query result
- **Impact**: Every `as any` disables the compiler. The `db as any` pattern is particularly concerning -- it suggests a type mismatch between the middleware-injected DB instance and the utility function signature that should be fixed at the type definition level, not papered over.
- **Recommendation**: Define a shared `AppDb` type in `types.ts` that matches the Drizzle D1 instance with full schema. Replace all `db as any` with properly typed parameters. This single change would eliminate a large portion of the 680 occurrences.

#### HIGH-4: Score Endpoint Performs 9+ Unbounded Queries Per Request

- **File**: `apps/api/src/routes/score.ts:60-92`
- **Severity**: High
- **Category**: Performance
- **Description**: The `GET /:instanceId` score endpoint makes at minimum 9 separate database queries: instance lookup (x2), security events, skill installations with join, security policies, alert rules, open alerts, incidents (then filtered in JS), file baselines, and vulnerabilities. Most queries have no `LIMIT` clause. The events query has `LIMIT 200` but others are unbounded.
- **Impact**: For instances with thousands of security events, vulnerabilities, or policies, this endpoint will be extremely slow and could hit Cloudflare's subrequest limit (1000/invocation). Despite the `Cache-Control: s-maxage=300` header, the computation still runs on every cache miss.
- **Recommendation**: Add `LIMIT` clauses to all queries. Cache the computed score in KV with a 5-minute TTL. Serve from cache and recompute asynchronously via a cron job.

#### HIGH-5: Score Trend Endpoint Allows Querying Any User's/Org's Data

- **File**: `apps/api/src/routes/score.ts:130-166`
- **Severity**: High
- **Category**: Security -- Broken Object-Level Authorization (BOLA)
- **Description**: The `GET /api/score/trend` endpoint accepts `userId` and `orgId` as query parameters. While the route requires auth (via `authMiddleware` on line 25), there is no check that the authenticated user matches the requested `userId` or is a member of the requested `orgId`. Any authenticated user can query any other user's risk trend data by guessing or enumerating user IDs.
- **Impact**: Information disclosure of security posture trends for arbitrary users and organizations. This is OWASP API3:2023 -- Broken Object Property Level Authorization.
- **Recommendation**: Replace query-parameter-based user selection with the authenticated user's own `userId` from `c.get('userId')`. For org data, use `c.get('orgId')` via `resolveOrgContext` middleware.

#### HIGH-6: Invitation Accept Sets Wrong `invitedAt` Value (Copy-Paste Bug)

- **File**: `apps/api/src/routes/org-invitations.ts:163`
- **Severity**: High
- **Category**: Functionality -- Data Integrity
- **Description**: When accepting an invitation, the new `orgMembers` record is created with:
  ```typescript
  invitedAt: invitation.expiresAt,  // BUG: should be the original invite time
  ```
  This stores the invitation's expiration date (7 days in the future) as the `invitedAt` timestamp.
- **Impact**: Every accepted invitation has a corrupted `invitedAt` timestamp in the org_members table. This breaks audit trails and any reporting that relies on invitation timing.
- **Recommendation**: Use the invitation's creation timestamp or the original `invitedAt` field if available. If the invitation table does not store a creation timestamp, use a `createdAt` field or derive it from `expiresAt - 7 days`.

#### HIGH-7: Organization Delete Does Not Clean Up Dependent Data

- **File**: `apps/api/src/routes/organizations.ts:146-153`
- **Severity**: High
- **Category**: Functionality -- Data Integrity
- **Description**: The org DELETE endpoint executes only:
  ```typescript
  await db.delete(organizations).where(eq(organizations.id, orgId));
  ```
  While the schema has `onDelete: 'cascade'` for `orgMembers` and `orgInvitations`, there is no cleanup for: instances (which have `orgId` as a nullable field, not a cascading FK), security policies, incidents, custom roles, SSO configs, SLA configs, data residency configs, or SCIM tokens.
- **Impact**: Orphaned data across multiple tables after org deletion. Instances continue running without an org context. Custom roles and SSO configs become unreachable. Data residency enforcement is lost.
- **Recommendation**: Either add cascading FK constraints for all org-scoped tables, implement a soft-delete with a scheduled cleanup, or add explicit deletion of dependent data in the route handler.

---

### Medium Issues

#### MED-1: `register.ts` Is Exactly 200 Lines (At Hard Limit)

- **File**: `apps/api/src/routes/register.ts` (200 lines)
- **Severity**: Medium
- **Category**: Code Quality -- File Size
- **Description**: This file registers 95+ route imports and 103 route mounts. It is at exactly the 200-line enforced limit. Adding any new route will exceed it.
- **Recommendation**: Split into domain sub-registries (e.g., `register-security.ts`, `register-org.ts`, `register-cloud.ts`, `register-admin.ts`).

#### MED-2: Inconsistent Error Response Shapes Across Routes

- **Files**: Various route files
- **Severity**: Medium
- **Category**: Code Quality -- API Design
- **Description**: Error responses use at least 3 different shapes:
  - `{ error: string, message: string }` (most routes)
  - `{ error: string, details: object }` (custom-roles.ts:50)
  - Success responses vary: `{ data: ... }` (org routes), `{ instances: [...] }` (instance routes), `{ skills: [...] }` (skill routes), `{ keys: [...] }` (API key routes)
- **Recommendation**: Define a standard response envelope type (e.g., always `{ data: T }` for success, `{ error: string, message: string }` for errors) and enforce it via a response helper.

#### MED-3: Security Gateway Inserts Events in Sequential Loop

- **File**: `apps/api/src/routes/security-gateway.ts:46-62, 89-100, 130-148`
- **Severity**: Medium
- **Category**: Performance
- **Description**: Events, audit entries, and vulnerabilities are each inserted one at a time in a `for` loop. A single agent report with 100 events produces 100 sequential DB insert operations.
- **Recommendation**: Use `db.batch()` to insert all events in a single database round-trip.

#### MED-4: Rate Limiter Has Race Condition (Non-Atomic Read-Then-Write)

- **File**: `apps/api/src/middleware/rate-limit.ts:38-65`
- **Severity**: Medium
- **Category**: Security -- Race Condition
- **Description**: The rate limiter reads the count from KV, increments it locally, and writes back. Under concurrent requests, two requests can read the same count value and both pass the limit check, effectively allowing 2x the configured rate during burst traffic.
- **Recommendation**: Accept the approximation and document it, or use Cloudflare Durable Objects for atomic counter operations.

#### MED-5: Custom Role Permissions Parsed with Unguarded JSON.parse

- **File**: `apps/api/src/middleware/rbac.ts:86`
- **Severity**: Medium
- **Category**: Robustness
- **Description**: Custom role permissions are stored as a JSON string and parsed with `JSON.parse(custom.permissions)` on every RBAC check. If the stored value is corrupted or not a valid JSON array, this throws an unhandled exception, crashing the request.
- **Recommendation**: Wrap in try/catch. Consider validating the parsed result is an array of strings.

#### MED-6: Org Member Role Change Missing Zod Validation

- **File**: `apps/api/src/routes/org-members.ts:23`
- **Severity**: Medium
- **Category**: Security -- Input Validation
- **Description**: Uses `c.req.json<{ role: Role }>()` without Zod. The role value is not validated against the Role enum at runtime.
- **Recommendation**: Add a Zod schema: `z.object({ role: z.enum([...ROLE_VALUES]) })`.

#### MED-7: Batch Ingest Processes Events Sequentially

- **File**: `apps/api/src/routes/ingest.ts:116-139`
- **Severity**: Medium
- **Category**: Performance
- **Description**: The batch ingest endpoint processes up to 50 events sequentially, with individual DB inserts and connection resolution for each event.
- **Recommendation**: Pre-resolve connections by source, then use `db.batch()` for all inserts.

#### MED-8: Missing Pagination on List Endpoints

- **Files**: `skills.ts` GET `/`, `alerts.ts` GET `/instances/:id/alerts`, `organizations.ts` GET `/:orgId` members
- **Severity**: Medium
- **Category**: Performance
- **Description**: Several list endpoints fetch all rows without pagination. The skills list fetches all approved skills into memory and filters by category in JavaScript (line 29-33).
- **Recommendation**: Add cursor-based pagination. For skills, add category to the Drizzle `where()` clause instead of filtering in memory.

---

### Low Issues

#### LOW-1: Duplicate Org Member Lookup in RBAC Middleware

- **File**: `apps/api/src/middleware/rbac.ts` (lines 44-55 repeated at 140-157)
- **Severity**: Low
- **Category**: Code Quality -- DRY
- **Description**: `requirePermission` and `resolveOrgContext` contain identical member lookup and context-building code.
- **Recommendation**: Extract into a shared `lookupOrgMember()` function.

#### LOW-2: Health Endpoint Version Hardcoded

- **File**: `apps/api/src/routes/health.ts:97`
- **Severity**: Low
- **Category**: Code Quality
- **Description**: `version: '0.3.0'` is a hardcoded string that will drift from the actual package version.
- **Recommendation**: Read from an env variable or constant in `@opensyber/shared`.

#### LOW-3: Kill Chain Routes Return Empty Arrays (Stub Implementation)

- **File**: `apps/api/src/routes/kill-chain.ts:44-55, 66-79`
- **Severity**: Low
- **Category**: Code Quality
- **Description**: Two endpoints return empty arrays with commented-out real implementation. These are live routes serving no data.
- **Recommendation**: Either implement or return 501 Not Implemented.

#### LOW-4: API Key Generation Has Minor Modulo Bias

- **File**: `apps/api/src/routes/api-keys.ts:27-30`
- **Severity**: Low
- **Category**: Security (Minor)
- **Description**: `chars[b % chars.length]` with 62 charset chars and byte values 0-255 produces slight bias (256 % 62 = 8, so first 8 chars are ~1.6% more likely).
- **Recommendation**: Use rejection sampling or generate the key as hex/base64 from `crypto.getRandomValues`.

#### LOW-5: Invitation Token Exposed in API Response

- **File**: `apps/api/src/routes/org-invitations.ts:79`
- **Severity**: Low
- **Category**: Security -- Information Exposure
- **Description**: The invitation creation response includes `{ email, role, token }`. The token is the secret credential used to accept the invitation. If the API response is logged or intercepted, the token is exposed outside the email channel.
- **Recommendation**: Return only the invitation ID in the API response. The token should only appear in the email.

---

## Positive Highlights

- **Timing-safe comparisons**: Gateway auth (`gateway-auth.ts`) and LemonSqueezy webhook verification (`webhooks-lemonsqueezy.ts`) both use `timingSafeCompare()` -- preventing timing attacks on token/signature verification.
- **HMAC JWT verification with constant-time XOR**: The auth middleware (`auth.ts:28-31`) implements bitwise constant-time comparison correctly.
- **Consistent middleware stacking**: Nearly all routes follow `dbMiddleware -> authMiddleware -> resolveOrgContext/requirePermission`, providing defense-in-depth.
- **XSS protection in emails**: `escapeHtml()` is used for user-supplied names in email templates.
- **Comprehensive security headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control.
- **Vault design**: Secrets encrypted at rest, gateway-facing vault verifies instance ID match, secret values never returned in list endpoints.
- **Plan enforcement architecture**: Clean `loadPlanConfig` middleware with `requirePlanFeature()` and `requirePlanLimit()` guards.
- **Schema organization**: Well-split by domain across 38 schema files with proper foreign keys and cascading deletes where appropriate.
- **Webhook idempotency and resilience**: Integration webhooks use idempotency middleware and resilience wrappers.
- **API key security**: Keys stored as SHA-256 hashes (never plaintext), expiration checked, `lastUsedAt` updated non-blocking via `waitUntil`.
- **LemonSqueezy webhook**: Full HMAC-SHA256 verification, grace period handling, plan enforcement on subscription events.
- **Admin middleware**: Properly checks `isAdmin` flag from DB (not from JWT claims that could be tampered with).
- **Validation directory pattern**: Dedicated `routes/validation/` directory with Zod schemas is clean separation -- the problem is that not all routes use it.

---

## Security Analysis

**Security Score**: Needs Improvement

**Critical Gaps**:
1. 27 route files accept unvalidated request bodies (CRIT-1)
2. SCIM routes bypass Drizzle ORM with raw SQL (CRIT-2)
3. Integration webhooks have no signature verification (CRIT-3)
4. Score trend endpoint allows BOLA -- querying any user's data (HIGH-5)
5. RBAC solo-mode bypass may grant unintended access on org routes (HIGH-2)

**Strengths**:
- HMAC JWT verification with timing-safe comparison
- Encrypted vault with instance-scoped access
- Security headers on all responses
- Rate limiting per tier (public/authenticated/agent/AI)
- Admin middleware with DB-backed isAdmin check
- LemonSqueezy webhook signature verification
- Gateway token verification with KV lookup

---

## Performance Analysis

**Performance Score**: Needs Improvement

**Key Findings**:
1. N+1 query in org details -- O(n) queries per org member (HIGH-1)
2. 9 unbounded queries in score endpoint -- no caching despite heavy computation (HIGH-4)
3. Sequential inserts in security gateway -- O(n) round-trips per batch (MED-3)
4. Sequential batch ingest -- same pattern (MED-7)
5. In-memory filtering instead of SQL WHERE clause for skills (MED-8)
6. Non-atomic rate limiter allows burst bypass (MED-4)

**Strengths**:
- Health checks parallelized with `Promise.all`
- Fire-and-forget for non-critical updates (`waitUntil` for API key lastUsedAt)
- Cursor-based pagination in admin routes
- Cache-Control headers on score endpoint

---

## Type Safety Analysis

**Overall**: Significant debt

- **680** `as any` occurrences across 106 files in `apps/api/src/`
- **17** `DrizzleD1Database<any>` usages in 7 service files
- **39** `c.req.json<Type>()` calls providing zero runtime type checking
- **Unsafe casts**: `roleValue as Role` (rbac.ts:95), `member.status as 'pending' | 'active' | 'removed'` (rbac.ts:106), `body.category as any` (marketplace-publish.ts:39)
- **Unguarded JSON.parse**: `JSON.parse(custom.permissions)` in rbac.ts:86, `JSON.parse(k.scopes)` in api-keys.ts:94

The root cause of most `as any` usage is that utility functions define `db` parameters as `DrizzleD1Database<any>` instead of a properly typed alias. Creating a single `AppDb` type that includes the full schema would eliminate hundreds of occurrences.

---

## Action Items

### Must Fix Before Deploy
1. **CRIT-1**: Add Zod validation to all 27 route files using `c.req.json<Type>()`
2. **CRIT-2**: Rewrite SCIM routes to use Drizzle ORM
3. **CRIT-3**: Add webhook signature verification for GitHub/GitLab integration webhooks
4. **CRIT-4**: Add Zod validation for admin user PATCH
5. **HIGH-2**: Prevent RBAC solo-mode bypass on org-scoped routes
6. **HIGH-5**: Fix BOLA on score trend endpoint -- use authenticated userId, not query param

### Should Fix Before Release
7. **HIGH-1**: Eliminate N+1 query in org details (use JOIN)
8. **HIGH-3**: Create `AppDb` type to reduce `as any` count
9. **HIGH-4**: Cache score computation in KV or add query limits
10. **HIGH-6**: Fix `invitedAt` copy-paste bug in invitation accept
11. **HIGH-7**: Handle org-scoped data cleanup on org deletion
12. **MED-3**: Batch security gateway event inserts
13. **MED-6**: Add Zod validation for org member role change

### Nice to Have
14. **MED-1**: Split `register.ts` into domain sub-registries
15. **MED-2**: Standardize error/success response envelope
16. **MED-4**: Document or fix rate limiter race condition
17. **MED-5**: Add try/catch for JSON.parse in RBAC middleware
18. **MED-7**: Batch ingest operations
19. **MED-8**: Add pagination to unbounded list endpoints
20. **LOW-1** through **LOW-5**: Quality improvements

---

## Recommendation

**Final Verdict**: Changes Required

The codebase has strong security foundations (timing-safe auth, encrypted vault, rate limiting, security headers) but has accumulated input validation debt across 27 route files that bypass Zod entirely. Combined with the unauthenticated webhook integration endpoint and the BOLA vulnerability on the score trend API, these create an exploitable attack surface.

**Priority order for remediation**:
1. **Highest ROI**: Add Zod schemas to the 27 unvalidated routes (systematic, file-by-file)
2. **Quick win**: Add webhook signature verification (one file, utility already exists)
3. **Quick win**: Fix score trend authorization (replace query param with `c.get('userId')`)
4. **Quick win**: Fix invitation `invitedAt` bug (one-line change)
5. **Structural**: Rewrite SCIM to use Drizzle ORM (one file)
6. **Structural**: Create `AppDb` type alias to drive down `as any` count

---

## Appendix

### Review Methodology
- Manual code review of 42 route handlers, 12 middleware files, 6 schema files, 4 service files
- Pattern search: `as any` (680 hits), `c.req.json<` (39 hits), `c.env.DB.prepare` (raw SQL), missing middleware chains
- Line count analysis for 200-line file size compliance
- Cross-reference of validation schema files vs. route files that accept request bodies
- OWASP API Security Top 10 (2023) checklist applied

### Standards Applied
- OpenSyber CLAUDE.md: "Zod schemas for all API request bodies", "No any types", "Max 200 lines per file"
- Portfolio CLAUDE.md: 90% line coverage, 85% branch coverage, security is release-blocking
- OWASP API Security Top 10 2023: API1 (BOLA), API3 (Broken Object Property Auth), API8 (Security Misconfiguration)
- Cloudflare Workers runtime constraints (subrequest limits, CPU time budgets)

### Key Files Referenced
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/middleware/auth.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/middleware/rbac.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/middleware/rate-limit.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/score.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/org-invitations.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/organizations.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/scim-users.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/webhooks-integrations.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/admin-users.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/security-gateway.ts`
- `/Users/shaharsolomon/dev/projects/portfolio/opensyber/apps/api/src/routes/register.ts`
