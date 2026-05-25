# Code Review Report

**Scope**: OpenSyber / Sprint 24 -- Agent Security Platform + Thin CSPM
**Date**: 2026-03-06
**Reviewer**: Code Review Agent
**Based on**: implementation-plan.md, design.md, requirements.md

---

## Executive Summary

**Overall Status**: APPROVED WITH CONDITIONS

**Summary**: Sprint 24 implements a substantial feature set across 30+ completed tasks including AWS CSPM scanning, multi-channel alert dispatch, risk trend tracking, plan enforcement, and supporting UI. The architecture is well-structured with good separation of concerns, comprehensive error handling, and proper use of the async dispatch pattern. However, several critical and major issues must be addressed before production deployment, most notably a cryptographic signing bug in the AWS scanner that will cause 100% failure of real AWS API calls.

**Statistics**:
- Files Reviewed: 38 source files + 25 test files
- Critical Issues: 3
- Major Issues: 7
- Minor Issues: 8
- Suggestions: 5

---

## Detailed Findings

### Critical Issues

#### Issue #1: AWS SigV4 HMAC parameter order is reversed in STS client and S3 checks

- **File**: `apps/api/src/services/aws-scanner/sts-client.ts:90-94`
- **File**: `apps/api/src/services/aws-scanner/checks/s3.ts:64-69, 329-333`
- **Severity**: Critical
- **Category**: Functionality / Security
- **Description**: The `hmacSha256(key, data)` function in `sts-client.ts` and `s3.ts` defines parameters as `(key: Uint8Array, data: Uint8Array)`, but the signing derivation calls reverse the arguments. AWS SigV4 requires `HMAC(kSecret, dateStamp)` but the code calls `hmacSha256(encode(dateStamp), kSecret)`, passing dateStamp as the key and kSecret as the data. This produces invalid signatures. The EC2, RDS, CloudTrail, and GuardDuty modules have a different function signature `(key: string|Uint8Array, data: string)` and call it correctly.
- **Impact**: All STS AssumeRole calls and S3 API calls will fail with `SignatureDoesNotMatch` in production. The entire CSPM scanning pipeline is non-functional against real AWS accounts.
- **Recommendation**: Align `sts-client.ts` and `s3.ts` HMAC calls with the EC2/RDS/CloudTrail pattern, or swap the parameter order in the calling code.
- **Code Example**:
```typescript
// Current (sts-client.ts:90) - WRONG
const kDate = await hmacSha256(new TextEncoder().encode(dateStamp), kSecret);

// Fix option 1: swap arguments at call site
const kDate = await hmacSha256(kSecret, new TextEncoder().encode(dateStamp));

// Fix option 2: adopt the EC2 pattern (key: string|Uint8Array, data: string)
async function hmacSha256(key: string | Uint8Array, data: string): Promise<Uint8Array> { ... }
const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
```

#### Issue #2: Duplicated SigV4 signing code across 6+ files with inconsistent implementations

- **File**: `apps/api/src/services/aws-scanner/sts-client.ts`, `checks/s3.ts`, `checks/iam.ts`, `checks/ec2.ts`, `checks/rds.ts`, `checks/cloudtrail.ts`, `checks/guardduty.ts`
- **Severity**: Critical
- **Category**: Security / Code Quality
- **Description**: The AWS Signature Version 4 signing logic (sha256, hmacSha256, canonical request building) is copy-pasted into every check module with subtle differences. The STS/S3 version has reversed parameters while EC2/RDS/CloudTrail/GuardDuty have a different (correct) signature. This fragmentation makes it extremely difficult to verify correctness and introduces a high risk of additional signing bugs.
- **Impact**: Bugs in signing code are security-critical. Having 7 copies means 7 surfaces for signing bugs. Issue #1 was caused directly by this duplication.
- **Recommendation**: Extract a shared `aws-signer.ts` module with a single, tested SigV4 implementation. All check modules should import from this shared module.

#### Issue #3: Alert channel config stored as encrypted blob but sensitive data exposed in GET responses

- **File**: `apps/api/src/routes/alert-channels.ts:144-151`
- **Severity**: Critical
- **Category**: Security
- **Description**: The GET `/api/alert-channels` (list) endpoint returns the full channel record including the `config` field. While the config is encrypted, returning the encrypted ciphertext to the client is unnecessary and reduces defense-in-depth. The GET `/:id` endpoint (line 299) correctly strips the config field, but the list endpoint does not.
- **Impact**: Encrypted webhook URLs, API keys, and integration keys are returned to any user with `agent.policy.read` permission. While encrypted, this data could be used in replay attacks if the encryption key is ever compromised.
- **Recommendation**: Strip the `config` field from the list response, matching the pattern used in the individual GET endpoint.
- **Code Example**:
```typescript
// Current (line 150)
return c.json({ data: channels });

// Fix: strip config from list results
const sanitized = channels.map(({ config: _, ...rest }) => rest);
return c.json({ data: sanitized });
```

### Major Issues

#### Issue #4: 12 files exceed the 200-line maximum

- **Files**:
  - `aws-scanner/checks/s3.ts`: 388 lines
  - `aws-scanner/checks/iam.ts`: 370 lines
  - `aws-scanner/checks/ec2.ts`: 306 lines
  - `aws-scanner/checks/rds.ts`: 273 lines
  - `aws-scanner/checks/cloudtrail.ts`: 300 lines
  - `aws-scanner/checks/guardduty.ts`: 242 lines
  - `aws-scanner/orchestrator.ts`: 347 lines
  - `aws-scanner/sts-client.ts`: 318 lines
  - `alerts/dispatcher.ts`: 499 lines
  - `alerts/types.ts`: 226 lines
  - `alerts/channels/email.ts`: 270 lines
  - `routes/alert-channels.ts`: 509 lines
  - `services/risk-snapshotter.ts`: 333 lines
  - `services/activity-cspm-linker.ts`: 267 lines
  - `services/cspm-scan-scheduler.ts`: 222 lines
- **Severity**: Major
- **Category**: Code Quality
- **Description**: The project CLAUDE.md mandates a hard 200-line limit per source file. 15 source files exceed this limit, with the worst offenders being `alert-channels.ts` (509 lines) and `dispatcher.ts` (499 lines).
- **Recommendation**: Split `alert-channels.ts` into separate files for validation, CRUD handlers, and test handler. Extract duplicated SigV4 signing into a shared module (fixes Issue #2 and reduces all check files below 200 lines). Split `dispatcher.ts` into core dispatch, violation alerts, and CSPM alerts.

#### Issue #5: No Zod validation on any API route request bodies

- **File**: All routes in `apps/api/src/routes/alert-channels.ts`, `agent-risk-trend.ts`, `cloud-accounts.ts`
- **Severity**: Major
- **Category**: Security / Code Quality
- **Description**: The project CLAUDE.md requires "Zod for all API request body validation." None of the Sprint 24 routes use Zod. The `alert-channels.ts` route uses manual type assertions and hand-written validation functions instead.
- **Impact**: Manual validation is error-prone, lacks composability, and does not produce typed outputs. The hand-written validators miss edge cases (e.g., email validation regex is too permissive, no length limits on webhook URLs).
- **Recommendation**: Define Zod schemas for all request bodies (CreateChannelSchema, UpdateChannelSchema, etc.) and use `z.parse()` or a Hono Zod middleware.

#### Issue #6: `any` type usage in production code

- **Files**:
  - `aws-scanner/checks/cloudtrail.ts:129`: `(trail: any)`
  - `alerts/dispatcher.ts:186,303,304,479`: `as any` casts on channel types
  - `alerts/channels/teams.ts:57`: `as any`
  - `services/risk-snapshotter.ts:187`: `as any` on insert values
- **Severity**: Major
- **Category**: Code Quality
- **Description**: The CLAUDE.md mandates "No `any` -- use `unknown` + type guards." Several `any` types appear in production source code (not just tests).
- **Recommendation**: Replace with proper type narrowing. For `dispatcher.ts`, define a type guard for channel DB records. For `cloudtrail.ts`, define a `Trail` interface for the XML parse result.

#### Issue #7: `createdAt` defaults use `new Date().toISOString()` which captures module load time

- **File**: `packages/db/src/schema/alert-channels.ts:20-23`, `packages/db/src/schema/risk-snapshots.ts:16-18`
- **Severity**: Major
- **Category**: Functionality
- **Description**: The Drizzle schema defaults for `createdAt` and `updatedAt` use `new Date().toISOString()`. This evaluates once when the module is loaded, not when each row is inserted. All rows will have the same timestamp (the Worker startup time) unless the application explicitly provides a value.
- **Impact**: The `createdAt` field will be incorrect for all records where the value is not explicitly provided. Note that the migration SQL correctly uses `DEFAULT (datetime('now'))`, so this only affects Drizzle ORM inserts that rely on the schema default.
- **Recommendation**: Use `sql\`(datetime('now'))\`` as the default in the Drizzle schema, matching the migration SQL.
- **Code Example**:
```typescript
// Current (captures module load time)
createdAt: text('created_at').notNull().default(new Date().toISOString()),

// Fix (uses SQL default, evaluates at insert time)
import { sql } from 'drizzle-orm';
createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
```

#### Issue #8: Raw SQL string interpolation in scan scheduler

- **File**: `apps/api/src/services/cspm-scan-scheduler.ts:114`
- **Severity**: Major
- **Category**: Security
- **Description**: The query uses `sql\`'${now}'\`` which interpolates the `now` variable directly into a raw SQL template literal. While `now` is currently derived from `new Date().toISOString()` (safe), this pattern violates the CLAUDE.md rule "No raw SQL -- always use Drizzle query builder" and is fragile.
- **Impact**: If the `now` parameter source changes (e.g., accepting user input via options), this becomes a SQL injection vector.
- **Recommendation**: Use Drizzle's parameterized approach or `sql.placeholder()`.

#### Issue #9: Alert channels RBAC uses manual permission checks instead of middleware

- **File**: `apps/api/src/routes/alert-channels.ts:132-135, 157-159, etc.`
- **Severity**: Major
- **Category**: Security / Code Quality
- **Description**: Each route handler manually checks permissions with `if (role && !hasPermission(...))`. The CLAUDE.md pattern is `requirePermission('resource.action')` middleware. The manual check has a subtle bug: when `role` is undefined (solo mode without org context), the permission check is silently skipped.
- **Impact**: In solo mode (no `X-Org-Id` header), any authenticated user can access alert channel endpoints without permission verification.
- **Recommendation**: Use `requirePermission('agent.policy.read')` and `requirePermission('agent.policy.write')` as middleware on the route groups.

#### Issue #10: PagerDuty skips incidents for medium/low severity silently returning success

- **File**: `apps/api/src/services/alerts/channels/pagerduty.ts:108-114`
- **Severity**: Major
- **Category**: Functionality
- **Description**: The PagerDuty channel returns `{ success: true }` for medium/low severity alerts without actually sending anything. This is misleading -- the dispatcher counts it as a successful delivery when nothing was sent.
- **Recommendation**: Return a distinct status (e.g., `{ success: true, skipped: true }`) or let the severity filtering in the dispatcher handle this rather than having the channel silently drop messages.

### Minor Issues

#### Issue #11: Massive code duplication in AWS check modules

- **Files**: All files in `apps/api/src/services/aws-scanner/checks/`
- **Severity**: Minor
- **Category**: Code Quality
- **Description**: Each check module (EC2, RDS, CloudTrail, GuardDuty) contains an identical copy of `sha256()`, `hmacSha256()`, and the SigV4 request signing logic (~60 lines each). The S3 and IAM modules have yet another variant.
- **Recommendation**: Extract shared AWS request utilities into `aws-scanner/aws-request.ts`.

#### Issue #12: Missing migration for `scan_schedule` and `next_scan_at` columns

- **File**: `packages/db/migrations/0012_agent_security_platform.sql`
- **Severity**: Minor
- **Category**: Functionality
- **Description**: The migration creates the `cloud_accounts` table with a fixed schema. The implementation plan task 1.4 states `cloud_accounts` should have `scanSchedule` and `nextScanAt` columns added via ALTER TABLE, but the migration does not include these ALTERs. The Drizzle schema may have them, but existing databases from earlier sprints will lack these columns.
- **Recommendation**: Create a migration 0013 that adds `scan_schedule` and `next_scan_at` to `cloud_accounts` if not already present.

#### Issue #13: `useEffect` for data fetching in RiskTrendChart

- **File**: `apps/web/src/components/dashboard/RiskTrendChart.tsx:30-47`
- **Severity**: Minor
- **Category**: Code Quality
- **Description**: CLAUDE.md states "Use `fetch` for data -- no `useEffect` for data fetching." The RiskTrendChart uses `useEffect` + `useState` for fetching trend data.
- **Recommendation**: Consider using a server component pattern or the existing proxy route to fetch data on the server side. If client-side fetching is required, document the exception.

#### Issue #14: Missing `loadPlanConfig` middleware on personal risk-trend route

- **File**: `apps/api/src/routes/agent-risk-trend.ts:12`
- **Severity**: Minor
- **Category**: Functionality
- **Description**: The personal risk-trend route (`GET /risk-trend`) uses `dbMiddleware, authMiddleware` but does not include `loadPlanConfig`. This means personal risk trends are available to all plans including free, which may or may not be intentional.
- **Recommendation**: If risk trends should be plan-gated, add `loadPlanConfig` and `requirePlanFeature` to this route.

#### Issue #15: `requirePlanLimit` accepts static count rather than a count function

- **File**: `apps/api/src/middleware/plan-enforcement.ts:117-120`
- **Severity**: Minor
- **Category**: Functionality
- **Description**: The implementation plan specifies `requirePlanLimit('cspmAccounts', countFn)` where `countFn` dynamically queries the current count. The actual implementation takes `currentCount: number` as a static value, which means the count must be computed before the middleware runs -- this is awkward to use as middleware since the count depends on the request context.
- **Recommendation**: Accept an async count function `() => Promise<number>` instead of a pre-computed number, matching the design spec.

#### Issue #16: S3 `listS3Buckets` doesn't include `Host` header

- **File**: `apps/api/src/services/aws-scanner/checks/s3.ts:345-352`
- **Severity**: Minor
- **Category**: Functionality
- **Description**: The `listS3Buckets` function's fetch call doesn't include the `Host` header, though it's included in `s3Request`. Some AWS endpoints require an explicit `Host` header for SigV4 verification.
- **Recommendation**: Add the `Host` header to the fetch call for consistency.

#### Issue #17: `getEventAction` in PagerDuty returns 'acknowledge' for medium/low

- **File**: `apps/api/src/services/alerts/channels/pagerduty.ts:34-37`
- **Severity**: Minor
- **Category**: Functionality
- **Description**: The `getEventAction` function returns `'acknowledge'` for medium/low severity. However, acknowledging requires an existing incident `dedup_key`. For new alerts, this will fail unless there's already an active incident with that key.
- **Recommendation**: Since medium/low are already skipped in `send()`, this function is dead code for those severities. Remove the `acknowledge` branch or use `trigger` for all.

#### Issue #18: DOMParser usage in sts-client.ts may not be available in all CF Workers environments

- **File**: `apps/api/src/services/aws-scanner/sts-client.ts:149-150`
- **Severity**: Minor
- **Category**: Functionality
- **Description**: `DOMParser` is used to parse XML responses. While available in modern Cloudflare Workers, it may not be available in all edge runtime environments. The check modules use `fast-xml-parser` which is a more portable choice.
- **Recommendation**: Replace `DOMParser` with `fast-xml-parser` for consistency with the check modules.

### Suggestions

#### Suggestion #1: Extract shared AWS signing utility

- **Description**: Create `apps/api/src/services/aws-scanner/aws-signer.ts` with a single, well-tested SigV4 implementation. This would eliminate ~400 lines of duplicated code and ensure signing correctness across all modules.

#### Suggestion #2: Add retry logic for AWS API calls

- **Description**: AWS API calls can transiently fail. Consider adding exponential backoff retry (1-3 attempts) around the check module API calls. The orchestrator's `Promise.allSettled` pattern already handles failures gracefully, but retries would improve scan completeness.

#### Suggestion #3: Add audit logging for alert channel CRUD operations

- **Description**: The CLAUDE.md requires "audit logging for state-changing operations." Alert channel create, update, delete, and test operations should log `actorId + action + resourceId` to the audit log.

#### Suggestion #4: Consider rate-limiting the scan scheduler more aggressively

- **Description**: Processing up to 5 concurrent scans per cron invocation could cause timeouts in Cloudflare Workers (30-second limit for standard Workers). Consider reducing to 2-3, or using durable objects for long-running scans.

#### Suggestion #5: Add input sanitization for webhook URLs

- **Description**: Webhook URLs for Slack, Teams, and Discord should be validated against SSRF attacks. Consider restricting to known hostname patterns (e.g., `hooks.slack.com`, `discord.com/api/webhooks`). The Slack validator already does this but Teams and Discord do not.

---

## Positive Highlights

- **Comprehensive alert dispatch system**: The multi-channel alert dispatcher with severity filtering, rate limiting via KV, and parallel dispatch using `Promise.allSettled` is well-architected for resilience.
- **Clean plan enforcement middleware**: The `loadPlanConfig` / `requirePlanFeature` / `requirePlanLimit` middleware chain is elegant and reusable.
- **Good error handling in orchestrator**: The scan orchestrator gracefully handles partial failures (some checks fail, others succeed) and properly transitions scan run states.
- **Encrypted alert channel configs**: Sensitive webhook URLs and API keys are encrypted before storage using the `encrypt()` utility, which is a strong security practice.
- **All 906 tests pass**: The existing test suite is healthy with no failures.
- **Well-structured type system**: The `SecurityFinding`, `AlertMessage`, `ChannelConfig` union types, and related interfaces provide good type safety.
- **Risk snapshot cron with idempotency**: Snapshot IDs include `userId + date`, preventing duplicate snapshots on re-execution.
- **Activity-CSPM cross-linker**: Creative heuristic matching strategies that correlate agent behavior with cloud posture findings.

---

## File-by-File Review

### `packages/db/src/schema/alert-channels.ts`
**Status**: Needs Changes
**Issues**: #7 (createdAt default captures module load time)
**Strengths**: Clean 25-line schema, proper FK with cascade delete

### `packages/db/src/schema/risk-snapshots.ts`
**Status**: Needs Changes
**Issues**: #7 (createdAt default)
**Strengths**: Clean 19-line schema, proper nullable FKs for user/org

### `packages/db/migrations/0012_agent_security_platform.sql`
**Status**: Needs Changes
**Issues**: #12 (missing scan_schedule, next_scan_at columns)
**Strengths**: Comprehensive schema with CHECK constraints, proper indexes, IF NOT EXISTS

### `apps/api/src/middleware/plan-enforcement.ts`
**Status**: Approved
**Issues**: #15 (static count for requirePlanLimit -- minor)
**Strengths**: Clean 158 lines, proper org/solo context handling, good error messages with upgrade info

### `apps/api/src/services/aws-scanner/sts-client.ts`
**Status**: Blocked
**Issues**: #1 (reversed HMAC params), #2 (duplicated signing), #18 (DOMParser)
**Strengths**: Thorough STS response parsing, proper error handling

### `apps/api/src/services/aws-scanner/orchestrator.ts`
**Status**: Approved with Comments
**Issues**: #4 (347 lines, exceeds 200 limit)
**Strengths**: Excellent error handling, batch insert pattern, proper status transitions

### `apps/api/src/services/aws-scanner/checks/s3.ts`
**Status**: Blocked
**Issues**: #1 (reversed HMAC params in listS3Buckets), #4 (388 lines), #16 (missing Host header)
**Strengths**: Comprehensive S3 checks (ACL, encryption, versioning)

### `apps/api/src/services/aws-scanner/checks/iam.ts`
**Status**: Approved with Comments
**Issues**: #4 (370 lines), #11 (duplicated signing code)
**Strengths**: Good CIS benchmark coverage, proper XML parsing

### `apps/api/src/services/aws-scanner/checks/ec2.ts`
**Status**: Approved with Comments
**Issues**: #4 (306 lines), #11 (duplicated signing code)
**Strengths**: Correct SigV4 implementation, SSH/RDP/public IP checks

### `apps/api/src/services/aws-scanner/checks/rds.ts`
**Status**: Approved with Comments
**Issues**: #4 (273 lines), #11 (duplicated signing code)
**Strengths**: Encryption, public access, backup retention checks

### `apps/api/src/services/aws-scanner/checks/cloudtrail.ts`
**Status**: Needs Changes
**Issues**: #4 (300 lines), #6 (`any` type at line 129), #11 (duplicated code)
**Strengths**: Multi-region trail, encryption, log validation checks

### `apps/api/src/services/aws-scanner/checks/guardduty.ts`
**Status**: Approved with Comments
**Issues**: #4 (242 lines), #11 (duplicated code)
**Strengths**: Detector status check with AccessDenied handling

### `apps/api/src/services/alerts/dispatcher.ts`
**Status**: Needs Changes
**Issues**: #4 (499 lines), #6 (4x `as any`), #10 (silent PD skip)
**Strengths**: Rate limiting, severity filtering, parallel dispatch, violation/CSPM alert builders

### `apps/api/src/services/alerts/types.ts`
**Status**: Approved with Comments
**Issues**: #4 (226 lines -- slightly over)
**Strengths**: Comprehensive type definitions, severity utilities

### `apps/api/src/services/alerts/channels/email.ts`
**Status**: Approved with Comments
**Issues**: #4 (270 lines)
**Strengths**: HTML + plain text templates, XSS escaping, Resend API integration

### `apps/api/src/services/alerts/channels/slack.ts`
**Status**: Approved
**Strengths**: Rich Block Kit formatting, webhook URL validation, proper text escaping

### `apps/api/src/services/alerts/channels/pagerduty.ts`
**Status**: Approved with Comments
**Issues**: #10 (silent skip), #17 (dead acknowledge code)
**Strengths**: Events API v2 integration, EU region support, dedup keys

### `apps/api/src/routes/alert-channels.ts`
**Status**: Needs Changes
**Issues**: #3 (config exposure in list), #4 (509 lines), #5 (no Zod), #9 (manual RBAC)
**Strengths**: Complete CRUD + test, encrypted config storage, plan enforcement

### `apps/api/src/routes/agent-risk-trend.ts`
**Status**: Approved with Comments
**Issues**: #14 (missing plan gate on personal route)
**Strengths**: Clean route structure, org member verification, proper days validation

### `apps/api/src/services/risk-snapshotter.ts`
**Status**: Needs Changes
**Issues**: #4 (333 lines), #6 (`as any` on insert)
**Strengths**: User + org snapshot patterns, idempotent IDs, trend query

### `apps/api/src/services/cspm-scan-scheduler.ts`
**Status**: Needs Changes
**Issues**: #4 (222 lines), #8 (raw SQL interpolation)
**Strengths**: Schedule calculation, status transitions, error handling

### `apps/api/src/services/activity-cspm-linker.ts`
**Status**: Approved with Comments
**Issues**: #4 (267 lines)
**Strengths**: Creative 4-strategy matching, early termination at 5 findings

### `apps/web/src/components/dashboard/RiskTrendChart.tsx`
**Status**: Approved with Comments
**Issues**: #13 (useEffect for data fetching)
**Strengths**: SVG-based chart (no heavy charting library), loading skeleton, empty state, dark theme

### `apps/api/src/cron/risk-snapshot.ts`
**Status**: Approved
**Strengths**: Clean 138 lines, dynamic imports for CF Workers, manual trigger support

---

## Test Coverage Analysis

**Overall Test State**: 906 tests passing across 75 test files

**Sprint 24 Test Coverage**:
| Module | Tests | Status |
|---|---|---|
| plan-enforcement middleware | 8 | Passing |
| STS client | 6 | Passing |
| Scanner orchestrator | 8 | Passing |
| Alert dispatcher | 22 | Passing |
| Email channel | Tests exist | Passing |
| Slack channel | Tests exist | Passing |
| PagerDuty channel | Tests exist | Passing |
| Risk snapshotter | 16 | Passing |
| Scan scheduler | 10 | Passing |
| Activity-CSPM linker | 14 | Passing |
| Cron handlers | 6 | Passing |
| Policy evaluator | Tests exist | Passing |
| RiskTrendChart component | 5 | Passing |
| S3 checks | Tests exist | Passing |
| IAM checks | Tests exist | Passing |
| EC2 checks | Tests exist | Passing |
| RDS checks | Tests exist | Passing |
| CloudTrail checks | Tests exist | Passing |
| GuardDuty checks | Tests exist | Passing |

**Gaps Identified**:
- Tasks 4.3-4.8 are not yet complete (plan enforcement coverage, integration tests, full validation)
- AWS check module tests mock all crypto operations, so the HMAC parameter reversal bug (Issue #1) is not caught
- No integration test verifying actual SigV4 signature output against known good values
- Alert channel route tests are missing (no `alert-channels.test.ts`)
- Risk trend route tests are missing (no `agent-risk-trend.test.ts`)

**Recommendations**:
- Add a SigV4 signature verification test with known inputs/outputs from AWS documentation
- Complete tasks 4.3-4.8 for comprehensive coverage
- Add route-level tests for alert-channels and agent-risk-trend

---

## Security Analysis

**Security Score**: Needs Improvement

**Findings**:

1. **CRITICAL**: AWS SigV4 signing bug (Issue #1) -- currently non-functional but would be a security concern if it produced valid but predictable signatures
2. **CRITICAL**: Encrypted config leaked in list endpoint (Issue #3)
3. **MAJOR**: No Zod validation on API request bodies (Issue #5) -- manual validation is present but less rigorous
4. **MAJOR**: RBAC bypass in solo mode for alert channels (Issue #9)
5. **MAJOR**: Raw SQL interpolation risk (Issue #8)
6. **POSITIVE**: Sensitive channel configs encrypted at rest with AES-GCM
7. **POSITIVE**: Auth middleware applied to all routes
8. **POSITIVE**: Plan enforcement gates premium features
9. **POSITIVE**: Rate limiting on alert dispatch via KV
10. **POSITIVE**: XSS escaping in email/Slack message templates

**Security Checklist**:
- [x] No hardcoded secrets or API keys
- [ ] Input validation on all user inputs (Zod missing)
- [x] SQL injection prevention (Drizzle ORM, one exception in scheduler)
- [x] XSS protection (output encoding in alert templates)
- [x] Authentication properly implemented
- [ ] Authorization checks before sensitive operations (RBAC bypass in solo mode)
- [x] Sensitive data encrypted at rest
- [x] Error messages don't leak sensitive information
- [ ] Dependencies scanned for vulnerabilities (not verified)
- [x] Rate limiting on alert dispatch

---

## Performance Analysis

**Performance Score**: Good

**Findings**:
1. **Good**: `Promise.allSettled` for concurrent check execution avoids serial bottleneck
2. **Good**: Batch insert for findings (100 per batch) respects D1 limits
3. **Good**: S3 bucket scanning limited to first 50 buckets
4. **Good**: Scan scheduler limits to 5 concurrent scans per cron
5. **Concern**: CloudTrail, GuardDuty make duplicate `DescribeTrails`/`ListDetectors` calls (one per check function)
6. **Concern**: IAM check `checkUsersWithoutMFA` and `checkOldAccessKeys` both call `ListUsers` separately -- N+1 for MFA/key checks per user
7. **Concern**: Risk snapshotter queries all activities per user (no aggregation at DB level)

**Recommendations**:
- Cache `ListUsers` result and share across IAM checks
- Cache `DescribeTrails` / `ListDetectors` across CloudTrail/GuardDuty checks
- Use SQL COUNT/GROUP BY for risk snapshot activity summaries instead of fetching all rows

---

## Compliance Check

### Design Compliance
- [x] Follows design specifications for plan enforcement architecture
- [x] Alert dispatch uses `ctx.waitUntil()` pattern (referenced in index.ts)
- [x] STS AssumeRole flow implemented (with signing bug)
- [x] Risk snapshot cron architecture matches design
- [x] Activity-CSPM cross-linker implements 4 matching strategies as designed
- [ ] PDF reports implemented but not verified for dark theme styling

### Requirements Compliance
- [x] Plan enforcement gates premium features across 4 tiers
- [x] Multi-channel alerts: email, Slack, PagerDuty, OpsGenie, Teams, Discord
- [x] Risk trend API with 7/30/90 day windows
- [x] RiskTrendChart with 3 lines (combined, agent, CSPM)
- [x] Scan scheduler with manual/daily/weekly schedules
- [x] Activity retention cron respects plan-tier history days
- [ ] 20 Prowler-equivalent checks implemented (have ~18 across 6 services)
- [ ] Tasks 4.3-4.8 (testing phase) incomplete

### Code Standards Compliance
- [ ] Max 200 lines per file (15 files exceed limit)
- [ ] No `any` types (several in production code)
- [ ] Zod validation on all API inputs (none used)
- [x] Proper error handling throughout
- [x] Kebab-case file naming
- [x] Feature grouping (aws-scanner/, alerts/)
- [x] Barrel exports (aws-scanner/index.ts, alerts/index.ts)

---

## Action Items

### Must Fix Before Deploy
1. **Issue #1**: Fix AWS SigV4 HMAC parameter order in sts-client.ts and s3.ts
2. **Issue #3**: Strip encrypted config from alert channel list endpoint
3. **Issue #9**: Replace manual RBAC checks with `requirePermission` middleware in alert-channels.ts

### Should Fix Before Release
4. **Issue #2**: Extract shared SigV4 signing utility (also fixes file size issues for checks)
5. **Issue #4**: Split files exceeding 200 lines (especially alert-channels.ts at 509 lines and dispatcher.ts at 499 lines)
6. **Issue #5**: Add Zod schemas for all API request body validation
7. **Issue #6**: Remove all `any` types from production code
8. **Issue #7**: Fix createdAt/updatedAt schema defaults
9. **Issue #8**: Replace raw SQL interpolation with parameterized query
10. **Issue #10**: Fix PagerDuty silent success for skipped severities
11. Complete tasks 4.3-4.8 (testing phase)

### Nice to Have
12. **Issue #11**: Deduplicate AWS check module signing code
13. **Issue #13**: Replace useEffect data fetching in RiskTrendChart
14. **Suggestion #1**: Shared AWS signing utility
15. **Suggestion #3**: Add audit logging for alert channel CRUD
16. **Suggestion #5**: SSRF protection on webhook URLs

---

## Review Checklist

- [x] Functionality matches requirements (with signing bug exception)
- [ ] Code quality is acceptable (file size violations, any types)
- [ ] Security review completed (3 critical issues found)
- [x] Performance review completed
- [x] Tests are adequate (906 passing, gaps noted)
- [x] Documentation is updated (implementation plan tracks progress)
- [ ] No blocking issues found (3 critical issues are blocking)

---

## Recommendation

**Final Verdict**: APPROVED WITH CONDITIONS

The Sprint 24 implementation demonstrates strong architectural decisions and comprehensive feature coverage. The multi-channel alert system, plan enforcement middleware, risk trend tracking, and AWS scanner orchestration are well-designed. However, three critical issues must be resolved before any production deployment:

1. The SigV4 signing bug will cause 100% failure of real AWS API calls
2. Encrypted secrets are exposed in the alert channel list endpoint
3. RBAC is bypassed for alert channels in solo mode

Additionally, 15 files exceed the mandatory 200-line limit, no Zod validation is used (violating project standards), and several `any` types exist in production code.

**Next Steps**:
1. Fix the 3 critical issues (estimated: 2-4 hours)
2. Extract shared AWS signing module to fix signing and file size issues (estimated: 4-6 hours)
3. Add Zod schemas to alert-channels route (estimated: 1-2 hours)
4. Complete tasks 4.3-4.8 for testing coverage (estimated: 1-2 days)
5. Re-review after fixes

---

## Appendix

### Review Methodology
- Manual code review of all Sprint 24 source files
- Comparison against design.md architecture decisions
- Verification against requirements.md acceptance criteria
- Static analysis for `any` types, file sizes, and coding standards
- Test execution validation (906/906 passing)
- Security-focused review of auth, RBAC, encryption, and input validation

### Standards Applied
- Project CLAUDE.md (200-line limit, strict TypeScript, Zod, RBAC, audit logging)
- Portfolio CLAUDE.md (security scans, coverage targets, Apple HIG)
- CIS AWS Foundations Benchmark (for CSPM check accuracy)
- OWASP Top 10 (for API security)
- AWS Signature Version 4 specification (for signing correctness)

### References
- Design Document: `.luna/sprint-24-agent-security-platform/design.md`
- Requirements: `.luna/sprint-24-agent-security-platform/requirements.md`
- Implementation Plan: `.luna/sprint-24-agent-security-platform/implementation-plan.md`
