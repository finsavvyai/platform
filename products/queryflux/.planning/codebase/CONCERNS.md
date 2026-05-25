# Codebase Concerns

**Analysis Date:** 2026-05-23

---

## Critical Path Gaps (WIP Features)

### Query Execution Engine — Not Production Ready

**Issue:** Query execution layer incomplete and unsafe.

**Files:**
- `src/api/queries.ts` (203 lines — exceeds cap)
- `src/engine/validator.ts` (217 lines — exceeds cap)
- `backend/internal/server/handlers_queries.go` (563 lines)
- `backend/internal/services/query_execution_service.go` (414 lines)
- `backend/internal/services/enhanced_query_executor.go` (349 lines)

**Impact:** Queries cannot be safely executed in production. Safety checks are placeholder validation patterns, not comprehensive.

**Specific Problems:**
1. SQL injection patterns in `validator.ts` are superficial regex checks (`/(\*|;)\s*(DELETE|UPDATE|DROP)/i`) — not parser-based
2. `handlers_queries.go:519` has TODO "Implement actual query execution with progress updates"
3. `handlers_queries.go:350` has TODO "Implement WebSocket authentication"
4. Query cancellation (`handlers_queries.go:555`) is stubbed with TODO
5. No parameterized query support verified; strings concatenated in test flow
6. Max row limits not enforced at execution layer
7. Query timeout (30s) documented in spec but not implemented

**Fix Approach:**
1. Replace regex injection detection with full SQL parser (e.g., `sqlc` or `sqlparser-rs`)
2. Implement parameterized query execution with driver support for all adapters
3. Add query timeout enforcement in `enhanced_query_executor.go`
4. Implement actual progress streaming via WebSocket
5. Add result pagination and max-row enforcement
6. Create integration tests with real database for safety validation

**Priority:** CRITICAL — Blocks MVP launch

---

## File Size Violations (200-Line Cap)

Per `CLAUDE.md` requirement of **≤200 lines per source file**, these files exceed limit:

**Frontend (src/):**
- `src/contracts/vibecoding.ts` — 242 lines (shared product contract — justifiable but split recommended)
- `src/ai/query-suggest.ts` — 278 lines (NL→SQL logic, should split by feature)
- `src/engine/validator.ts` — 217 lines (SQL validation logic)
- `src/api/queries.ts` — 203 lines (CRUD operations)
- `src/ai/explain.ts` — 225 lines (Query explanation service)
- `src/pages/EnhancedDashboardPage.tsx` — 216 lines (Dashboard component)
- `src/components/layout/Layout.tsx` — 244 lines (Root layout)
- `src/pages/EnhancedQueryEditorPage.test.tsx` — 219 lines (test file — allowed overage)
- `src/engine/__tests__/parser.test.ts` — 289 lines (test file — allowed overage)
- `src/engine/__tests__/validator.test.ts` — 260 lines (test file — allowed overage)
- `src/ai/__tests__/query-suggest.test.ts` — 234 lines (test file — allowed overage)
- `src/api/__tests__/queries.test.ts` — 234 lines (test file — allowed overage)

**Backend (backend/):**
Critical oversized files (>300 lines):
- `cmd/server/main.go` — 809 lines (server initialization)
- `cmd/cli/main.go` — 824 lines (CLI commands)
- 40+ service/adapter files exceed 400-500 lines
- `handlers_queries.go` — 563 lines
- `handlers_connections.go` — 466 lines
- `handlers_auth.go` — 383 lines
- `middleware_subscription.go` — 345 lines
- `middleware_rbac.go` — 373 lines

**Impact:** Violates portfolio CLAUDE.md standard. Complex files harder to test, review, and maintain.

**Fix Approach:**
1. Split `src/contracts/vibecoding.ts` into domain boundaries (workspaces, queries, artifacts, security)
2. Extract validation logic from `validator.ts` into `safe-sql.ts`
3. Split NL→SQL service from explain service in `ai/` folder
4. Refactor `Layout.tsx` into composable subcomponents (Header, Sidebar, Main)
5. Extract `cmd/server/main.go` initialization into `internal/server/setup.go`
6. Split handler files into single-endpoint files or group by logical domain
7. Move middleware logic to `internal/middleware/` package structure

**Priority:** HIGH — Blocks code review quality gates

---

## Authentication & Authorization — WIP

**Issue:** SAML/OIDC SSO incomplete, signature verification broken.

**Files:**
- `backend/internal/infrastructure/sso/providers/saml_provider.go` (490 lines)
- `backend/internal/services/auth_service.go` (558 lines)
- `backend/internal/services/sso_auth_service.go` (810 lines)

**Specific Problems:**
1. **SAML Signature Verification Broken** (`saml_provider.go:255`):
   ```go
   // TODO: Fix signature verification - Verify method unavailable on Response struct in this version
   // if err := response.Verify(idpCert); err != nil {
   //     return fmt.Errorf("failed to verify SAML response signature: %w", err)
   // }
   ```
   — SAML responses not cryptographically verified; **critical security gap**

2. **SAML Logout Sign Broken** (`saml_provider.go:351`):
   ```go
   // logoutReq.Sign(p.provider.Key, p.provider.Certificate) // TODO: Fix Sign method availability
   ```
   — Logout requests not signed; session fixation risk

3. **WebSocket JWT Validation Stubbed** (`handlers_queries.go:350`): TODO "Implement WebSocket authentication"
   — Real-time connections not authenticated

4. **No audit logging for auth events** — CLAUDOM.md requires audit logs for auth, but `token_repository` is stubbed

**Impact:** SSO identity cannot be trusted. Attackers can forge SAML assertions and assume any identity.

**Fix Approach:**
1. Update gofuji SAML library to version supporting response verification
2. Implement cryptographic signature validation with fallback to assertion hash
3. Sign logout requests with private key before sending to IdP
4. Implement WebSocket auth token exchange in handler
5. Add audit log entry on all auth events (login, logout, SSO, token refresh)
6. Add rate limiting to login endpoint (5 attempts/min)
7. Test with real IdP (Okta test sandbox or similar)

**Priority:** CRITICAL — Security blocker for enterprise

---

## Database Adapters — Many Stubbed

**Issue:** 50+ database adapter implementations are TODO stubs returning errors.

**Files:**
- `backend/internal/infrastructure/repositories/postgres/alert_repository.go` (all 20+ methods are TODO)
- `backend/internal/infrastructure/database/adapters/factory.go` (Amazon/cloud adapters marked TODO)
- 40+ adapter files in `backend/internal/infrastructure/database/adapters/` (SQL, NoSQL, cloud, search, timeseries)

**Specific Examples:**
```go
// alert_repository.go:25-145 — All methods:
// TODO: Implement actual database insertion
// TODO: Implement actual database query
// TODO: Implement actual database update
return nil, fmt.Errorf("not implemented")
```

```go
// factory.go:117-137 — Cloud databases:
// TODO: Update Neptune Adapter
// TODO: Update Keyspaces Adapter
// TODO: Update Timestream Adapter
// TODO: Update Athena Adapter
// TODO: Update OpenSearch Adapter
// TODO: Update Yugabyte Adapter
```

**Impact:** Multi-database support is aspirational. Only PostgreSQL is real. If user connects MySQL/MongoDB/Redis, operations fail silently or panic.

**Fix Approach:**
1. Prioritize PostgreSQL (MVP), MySQL, MongoDB, Redis (Phase 1)
2. Implement connection pooling and query execution for each
3. Create integration tests with Docker containers for each database
4. Remove aspirational adapters from factory until implemented
5. Add health checks to detect unimplemented adapters early

**Priority:** HIGH — Core feature incomplete

---

## Repository Pattern — 30+ Methods Stubbed

**Issue:** Data access layer returns "not implemented" errors for all queries.

**Files:**
- `backend/internal/infrastructure/repositories/postgres/alert_repository.go` (22 TODO methods)
- `backend/internal/infrastructure/repositories/postgres/connection_repository.go` (6+ TODO methods)
- `backend/internal/infrastructure/repositories/postgres/query_repository.go` (10+ TODO methods)

**Impact:** Business logic services can't persist or retrieve data. Application is non-functional.

**Fix Approach:**
1. Prioritize repositories by critical path: User → Connection → Query → Alert → Audit
2. Implement using `pgx` v5 with prepared statements
3. Create integration tests in Docker PostgreSQL
4. Validate all SQL with parameterized queries

**Priority:** CRITICAL — Blocks all data flow

---

## Test Coverage Gaps

**Issue:** Large portions of code lack automated tests.

**Files:**
- `backend/cmd/server/main.go` — No tests (809 lines of initialization)
- `backend/cmd/cli/main.go` — No tests (824 lines)
- All WebSocket handlers untested
- MCP server (`queryflux-mcp-server/`) — No test files exist (empty `tests/` directory)

**Coverage Metrics (from PRODUCTION_READINESS_MATRIX):**
- Target: 95% unit, 90% integration per `SPRINTS.md`
- Actual: Unmeasured; CI does not enforce coverage

**Impact:** Regressions undetected. Critical paths (auth, query execution) not verified.

**Fix Approach:**
1. Add `go test -coverprofile=cover.out ./...` to CI with `--fail_under=95`
2. Add `npm test -- --coverage --fail_under=95` to React CI
3. Create integration test suites for WebSocket, queries, auth
4. Create E2E tests in Playwright for all user personas (5 minimum per SPRINTS.md)

**Priority:** HIGH — Blocks release gates

---

## Security Hardening — Partially Complete

**Issue:** Recent commit "Security Hardening Task 13.2" incomplete. Multiple security concerns remain.

**Files:**
- `backend/internal/infrastructure/security/pci_compliance.go` (624 lines — PCI work in progress)
- `backend/internal/infrastructure/security/zero_trust.go` (391 lines — incomplete)
- `backend/internal/services/security_service.go` (712 lines — validation only)

**Specific Problems:**
1. **No encryption at rest** for sensitive fields (passwords, API keys, connection strings)
   - `user_repository.go` stores passwords in plaintext or unsalted hashes
   - `connection_repository.go` stores database credentials unencrypted

2. **No rate limiting on public endpoints**
   - Login attempts not throttled
   - Query execution unlimited
   - API calls not metered

3. **No CORS configuration enforced**
   - `middleware_request.go` exists but not in critical paths
   - Origins not validated before WebSocket upgrade

4. **Audit logging absent for critical operations**
   - No log of query executions
   - No log of connection creations
   - No log of user deletions
   - `audit_repository.go` exists but stubbed (see above)

5. **JWT secret management weak**
   - `JWT_SECRET` accepted as short strings
   - No rotation mechanism
   - Hardcoded in some test paths

**Impact:** Unauthorized access, data breaches, compliance failures (HIPAA, SOC 2, PCI-DSS).

**Fix Approach:**
1. Encrypt password fields with `bcrypt` (cost 12+)
2. Encrypt connection credentials with AES-256 using `ENCRYPTION_KEY`
3. Implement rate limiting middleware (5 login/min, 100 query/min per user)
4. Add CORS middleware validating origin against allowlist
5. Implement audit logger for: login, logout, query execute, connection create/delete, user permission change
6. Enforce 32+ byte JWT_SECRET in production check
7. Create JWT rotation job (monthly)
8. Run `gosec ./...` in CI (currently manual only)

**Priority:** CRITICAL — Blocks production launch

---

## Dependency Vulnerabilities — Recently Fixed

**Issue:** Recent upgrades resolved 6 vulnerabilities, but ongoing maintenance needed.

**Files:**
- `package.json` — axios, react-router-dom, @modelcontextprotocol/sdk upgraded
- `queryflux-mcp-server/package.json` — vitest upgraded to clear esbuild chain

**Status (from AGENTS.md observation 4321-4326):**
- axios `1.13.2` → `1.16.1` (CRITICAL: XXE vulnerability)
- react-router-dom `7.11.0` → `7.15.1` (path normalization issues)
- @modelcontextprotocol/sdk upgraded
- vitest upgraded to v4.1.7 (esbuild vuln cleared)
- `npm audit` shows **0 vulnerabilities** currently

**Impact:** Clean now, but dependencies need continuous monitoring.

**Fix Approach:**
1. Add `npm audit` to CI with `--audit-level=moderate` (fail on moderate+)
2. Configure Dependabot for automated PRs
3. Run security audit monthly
4. Pin exact versions in production lock files

**Priority:** MEDIUM — Currently clean, need prevention

---

## CI/CD Script Broken Paths

**Issue:** Deploy scripts reference stale or missing paths.

**Files:**
- `scripts/ci-verify-paths-and-secrets.sh` — Hardcoded stale path `queryflux/` (from AGENTS.md 4313)
- `PRODUCTION_READINESS_MATRIX.md` mentions "gate blocks promotion until fixed"

**Status:** Fixed in recent commit but indicates fragile CI infrastructure.

**Impact:** CI might not catch real issues if paths are wrong.

**Fix Approach:**
1. Make path references dynamic via environment variables or discovery
2. Test CI scripts locally before commit
3. Add CI script validation to pre-commit hook

**Priority:** MEDIUM — Recently fixed but structure fragile

---

## MCP Server — No Tests

**Issue:** QueryFlux MCP server lacks test infrastructure.

**Files:**
- `queryflux-mcp-server/tests/` — Empty directory (no test files)
- `queryflux-mcp-server/package.json` — Test command: `vitest run --passWithNoTests`

**Impact:** MCP server can break silently. Claude requests may fail without error visibility.

**Fix Approach:**
1. Implement unit tests for each tool (execute_query, get_schema, nl_to_query, etc.)
2. Create fixtures for test SQL and responses
3. Mock QueryFlux backend API
4. Add integration tests with real MCP client
5. Run tests in CI with coverage requirement (90%+)

**Priority:** HIGH — Agent integration critical for product value

---

## Archive Directories — Duplicate Code Risk

**Issue:** Multiple `_archive/` directories contain abandoned but similar code.

**Files:**
- `backend/_archive/ai_service_improved.go` (1058 lines)
- `backend/_archive/application_ai_service.go` (1246 lines)
- `backend/tests/_archive/` — 50+ old test files
- `_archive/` at repo root

**Impact:** Confusion about canonical implementation. Risk of features being reimplemented multiple times. Archive consumes review effort.

**Fix Approach:**
1. Document canonical versions in README (e.g., "AI service: `backend/internal/services/ai_*` is canonical")
2. Consider archiving to separate branch (`archive/*`) if history needed
3. Delete if no reference value
4. If keeping, document why in each _archive directory's README

**Priority:** LOW — Organizational, not functional

---

## API Contract Versioning — Multiple Schemas

**Issue:** Multiple contract definitions exist without clear versioning or precedence.

**Files:**
- `src/contracts/vibecoding.ts` (242 lines) — Latest shared contract
- `docs/technical/SHARED_PRODUCT_CONTRACT.md` — Documentation of contract
- Multiple `types/api.ts` files in backend

**Status (from recent commit 4458):** Shared contract moved to `src/contracts/` with test coverage.

**Impact:** Unclear whether TypeScript contract is source of truth for Go backend. Risk of API drift.

**Fix Approach:**
1. Document contract ownership: TypeScript contract is canonical
2. Generate Go types from TypeScript using `vroom-gen` or similar
3. Add contract versioning (v1, v2, etc.)
4. Validate API calls against contract in middleware (runtime check)
5. Generate OpenAPI 3.0 from TypeScript contract

**Priority:** MEDIUM — Important once API stabilizes

---

## Readiness vs Reality Gap

**Issue:** CLAUDE.md claims 40% readiness, but critical systems are non-functional.

**From CLAUDE.md "What's Done vs What's Left":**

**Marked Done:**
- React 19 component library ✓
- Zustand store ✓
- React Router ✓
- Playwright E2E scaffold ✓
- Docker Compose ✓
- GitHub Actions CI scaffold ✓
- Supabase schema ✓

**Marked "In Progress":**
- Query execution engine (blocks MVP)
- Database drivers (blocks MVP)
- Authentication & authorization (blocks MVP)
- OpenAI/Gemini integration (nice-to-have)
- Voice feature (nice-to-have)
- Team collaboration (nice-to-have)

**Gap:** Features marked "done" (UI layer) won't function without backend implementations ("in progress").

**Fix Approach:**
1. Revise readiness metric to reflect integration points, not isolated layers
2. Define readiness by user journey: "User can connect PostgreSQL" = 0% without working connection layer
3. Update CLAUDE.md every week to track actual progress vs aspirational

**Priority:** MEDIUM — Affects planning accuracy

---

## Scaling Concerns — Single-Instance Limits

**Issue:** Backend architecture assumes single-instance deployment (no horizontal scaling).

**Files:**
- `backend/internal/infrastructure/database/lifecycle.go` (440 lines) — No distributed locking
- `backend/internal/services/team_management_service.go` (732 lines) — No session sharing
- `backend/internal/adapters/websocket/metrics_hub.go` (657 lines) — In-memory metrics

**Impact:** Application cannot scale beyond single machine. Failure of one instance = total outage.

**Fix Approach:**
1. Replace in-memory state with Redis for horizontal scaling
2. Add distributed locks for critical operations (e.g., connection lifecycle updates)
3. Implement session storage in PostgreSQL (not memory)
4. Add load balancer configuration (nginx example)
5. Document stateless deployment requirements

**Priority:** MEDIUM — Important for production reliability, not MVP-blocking

---

## Performance Optimization Deferred

**Issue:** No performance benchmarks or optimization strategy.

**Files:**
- No profiling data collected
- No query execution time targets
- No result pagination strategy specified

**Impact:** Application may be slow in production without visibility into bottlenecks.

**Fix Approach:**
1. Add database query logging with execution time
2. Implement result pagination for large datasets (>10k rows)
3. Add caching layer for schema introspection
4. Create performance test suite (Playwright with 100+ rows)
5. Set SLO targets: login <500ms, query execute <5s (user-facing), schema load <1s

**Priority:** LOW — Post-MVP concern

---

## Frontend State Management — Partial

**Issue:** Zustand store incomplete; many components use local state.

**Files:**
- `src/store/connectionStore.ts` (exists but incomplete)
- `src/hooks/useDatabase.ts` (180 lines, manages local query state)
- `src/components/QueryEditor.tsx` (280 lines, tab state in component)

**Impact:** State inconsistency across features. Undo/redo impossible. Multi-tab state management fragile.

**Fix Approach:**
1. Centralize all UI state in Zustand (connection, tabs, results, settings)
2. Implement undo/redo with Zundo middleware
3. Persist state to localStorage with hydration
4. Create state snapshots for team sharing

**Priority:** MEDIUM — Improves UX but not blocking

---

## Product Vision Churn

**Issue:** Product repositioned recently ("AI-native database workspace for vibecoders" per AGENTS.md 4392).

**Impact:** Old documentation conflicts with new vision. Features prioritized for old vision may be deprioritized.

**Files Potentially Affected:**
- `docs/strategy/QUERYFLUX_ROADMAP.md` — May be outdated
- `SPRINTS.md` — References @finsavvyai shared libraries that may not align
- Component library (137 components) may have unused features

**Fix Approach:**
1. Update all roadmaps and specifications to new vision
2. Audit component library for alignment
3. Reprioritize features list
4. Document decision rationale

**Priority:** MEDIUM — Strategic clarity needed before heavy development

---

## Summary of Blockers

**CRITICAL (MVP Blocking):**
1. Query execution engine unsafe (no real parameterized queries)
2. Database adapters stubbed (only PostgreSQL WIP)
3. Repository layer unimplemented (can't persist data)
4. SAML signature verification broken (security breach)
5. WebSocket authentication stubbed

**HIGH (Release Blocking):**
1. Test coverage unmeasured and likely insufficient
2. MCP server untested
3. File size violations violate CLAUDE.md
4. Rate limiting and encryption absent

**MEDIUM (Production Readiness):**
1. Audit logging absent
2. No horizontal scaling
3. Readiness metric misleading
4. State management incomplete

**LOW (Nice-to-Have):**
1. Archive cleanup
2. Performance optimization
3. Contract versioning

**Estimated effort to production:** 8-12 weeks at current velocity (blocking items alone 4 weeks).

---

*Concerns audit: 2026-05-23*
