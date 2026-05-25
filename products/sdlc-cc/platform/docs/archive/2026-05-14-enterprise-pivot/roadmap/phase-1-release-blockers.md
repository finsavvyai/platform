# Phase 1 — Close Release Blockers (Days 6-20)

Goal: end Phase 1 with the platform handling real traffic — rate limiting
on Redis, gateway↔RAG E2E tests passing, audit logs end-to-end, API key
rotation, WebSocket progress, DR playbook drafted.

---

### Day 6 — Redis-backed rate limiter (per tenant, per route)

**Goal:** replace in-memory rate limiter with Redis sliding-window.
Survives restart, scales horizontally.

**Files:**
- `services/gateway/internal/domain/services/rate_limiter.go`
- `services/gateway/internal/infrastructure/ratelimit/redis_limiter.go`
- `services/gateway/internal/interfaces/http/middleware/rate_limit.go`

**Steps:**
1. Define `RateLimiter` interface with `Allow(ctx, tenantID, route, weight) (allowed bool, retryAfter time.Duration, err error)`.
2. Implement Redis sliding-window via Lua script (atomic `INCR` + `EXPIRE`).
3. Per-tenant config table `rate_limits` with `tenant_id`, `route_pattern`, `requests_per_minute`, `burst`. Migration `007_rate_limits.sql`.
4. Middleware reads tenant from context, route from chi router, dispatches.
5. Emit `429 Too Many Requests` with `Retry-After` and `X-RateLimit-*` headers.

**Tests:** unit test the Lua script via `miniredis`; integration test with real Redis container hits 100 reqs in 60s, 101st returns 429.

**Verify:**
```bash
go test ./internal/domain/services/... ./internal/infrastructure/ratelimit/...
go test -tags=integration ./tests/integration/rate_limit_test.go
```

**Done when:** integration test green; benchmark shows <2ms p99 added latency.

**Prompt:**
> Replace the in-memory rate limiter in `services/gateway/internal/domain/services/rate_limiter.go` with a Redis sliding-window implementation. Add a `rate_limits` table (migration 007) keyed by `tenant_id` + `route_pattern`. Use a Lua script for atomic INCR+EXPIRE. Middleware emits 429 with Retry-After. Add unit tests via `miniredis` and an integration test against a real Redis testcontainer. Benchmark p99 added latency must stay under 2ms.

---

### Day 7 — Rate limiter per-tenant config UI + admin API

**Goal:** admins can set rate limits per tenant in the admin UI.

**Files:** `services/admin-ui/src/app/dashboard/tenants/[id]/rate-limits/page.tsx`, gateway handler `internal/interfaces/http/handlers/admin_rate_limits.go`, OpenAPI spec entries.

**Steps:** add CRUD endpoints `GET/PUT /admin/tenants/{id}/rate-limits`. UI form: route pattern + RPM + burst. Validate route patterns match chi syntax. Audit log every change.

**Tests:** API key with `admin:rate_limit:write` permission can update; without, 403. UI shows current limits and a save button. Save persists via API and re-renders.

**Verify:**
```bash
go test ./internal/interfaces/http/handlers/admin_rate_limits_test.go
cd services/admin-ui && npm test -- rate-limits
```

**Done when:** admin can set a tenant's `/v1/rag/query` to 10 RPM, see it enforced in <30 seconds, and audit log records the change.

**Prompt:**
> Add per-tenant rate-limit admin to sdlc-platform. Gateway: CRUD endpoints `GET/PUT /admin/tenants/{id}/rate-limits` returning current rules and persisting changes to the `rate_limits` table built on Day 6. OpenAPI spec entries for both endpoints. Admin-ui: a `/dashboard/tenants/[id]/rate-limits/page.tsx` form with route-pattern + RPM + burst fields, validated against chi syntax. Audit log every change. Permission gate: `admin:rate_limit:write`.

---

### Day 8 — Gateway↔RAG E2E integration test

**Goal:** docker-compose-driven test that uploads a doc, runs a RAG query, asserts response shape and latency.

**Files:** `tests/e2e/rag_roundtrip_test.go`, `deployments/docker-compose.e2e.yml`, `.github/workflows/e2e.yml`.

**Steps:**
1. Compose stack: postgres+pgvector, redis, gateway, rag, document-processor.
2. Test uploads PDF via `POST /v1/documents`, polls processing status, runs `POST /v1/rag/query`, asserts answer cites the doc.
3. Add latency budget assertion: end-to-end <5s on a 10-page PDF.

**Tests:** the test itself + a regression for empty corpus (RAG returns "no relevant context").

**Verify:**
```bash
docker compose -f deployments/docker-compose.e2e.yml up -d --wait
go test ./tests/e2e/rag_roundtrip_test.go -timeout 5m
```

**Done when:** E2E test passes on CI in under 8 minutes.

**Prompt:**
> Build a gateway↔RAG E2E integration test for sdlc-platform. Create `deployments/docker-compose.e2e.yml` that brings up postgres+pgvector, redis, gateway, rag, and document-processor. Add `tests/e2e/rag_roundtrip_test.go` that uploads a 10-page PDF via `POST /v1/documents`, polls until processing completes, runs `POST /v1/rag/query`, and asserts the answer references the uploaded doc within 5s end-to-end. Add a regression case for empty corpus. Wire `.github/workflows/e2e.yml` to run the test on every PR.

---

### Day 9 — API key rotation lifecycle

**Goal:** API keys have explicit rotation endpoints, automatic expiry, and a UI to manage.

**Files:** `services/gateway/internal/infrastructure/auth/api_key_rotation.go`, migration `008_api_key_rotation.sql`, `services/admin-ui/src/app/dashboard/api-keys/`.

**Steps:**
1. Schema additions: `expires_at`, `rotated_from_key_id`, `rotation_grace_period_seconds`.
2. Endpoint `POST /v1/api-keys/{id}/rotate` issues new key, marks old key as rotating with grace window (default 24h).
3. Background job `api_key_expiry_sweeper` revokes expired/rotated keys.
4. UI: list keys, "Rotate" button, copy new key once, show revocation timeline.
5. Audit log every issue/rotate/revoke.

**Tests:** rotation issues a new key; both keys work during grace window; old key rejected after grace expires; sweeper runs idempotently.

**Verify:**
```bash
go test ./internal/infrastructure/auth/... -run ApiKeyRotation
cd services/admin-ui && npm test -- api-keys
```

**Done when:** an API key can be rotated end-to-end via the UI and the old key returns 401 after the grace window.

**Prompt:**
> Implement API key rotation in sdlc-platform. Add `expires_at`, `rotated_from_key_id`, and `rotation_grace_period_seconds` columns via migration 008. Add `POST /v1/api-keys/{id}/rotate` endpoint that issues a new key and marks the old as rotating. Background job revokes expired keys. Admin-ui: list/rotate/revoke flow. Audit log every state change. Tests must cover: new key valid, old key valid during grace, old key 401 after grace, sweeper idempotent.

---

### Day 10 — Device fingerprint enforcement on auth

**Goal:** auth requests carry a device fingerprint; sudden fingerprint change triggers re-auth.

**Files:** `services/gateway/internal/infrastructure/fingerprint/`, `services/admin-ui/src/auth/fingerprint.ts`.

**Steps:** SDK collects fingerprint (UA + canvas hash + WebGL); gateway stores per-session, compares on each request, demands MFA on mismatch above similarity threshold (configurable per tenant).

**Tests:** matching fingerprint passes; mismatched returns 401 + `Re-authentication-Required` header; thresholds tunable per tenant.

**Verify:** `go test ./internal/infrastructure/fingerprint/...`; manual UI test: log in, change UA, expect re-auth prompt.

**Done when:** mismatched fingerprint forces re-auth; tenant admins can tune sensitivity 0-100.

**Prompt:**
> Add device fingerprint enforcement to sdlc-platform. Frontend collects UA + canvas + WebGL hash; gateway stores per session, compares per request, demands re-auth on mismatch above a tenant-configurable similarity threshold. Add admin UI control to tune the threshold (0-100, default 80). Tests must cover: match passes, near-match passes, far-mismatch forces re-auth.

---

### Day 11 — WebSocket real-time document processing progress

**Goal:** uploading a doc emits `processing.progress` WebSocket events to the user's session.

**Files:** `services/realtime/`, `services/document-processor/src/queue/progress_emitter.ts`, `services/admin-ui/src/components/documents/upload-progress.tsx`.

**Steps:** worker emits progress events to Redis pub/sub; realtime service subscribes and broadcasts to authenticated WS clients filtered by tenant. UI shows live progress bar.

**Tests:** upload doc, assert at least 3 progress events received, final `complete` event includes document ID. Disconnect handling: backpressure does not OOM.

**Verify:** `cd services/realtime && npm test`; manual test: upload PDF in admin UI, watch progress.

**Done when:** UI shows progress smoothly, no missed events on a 100MB file.

**Prompt:**
> Wire end-to-end real-time progress for document uploads in sdlc-platform. Document-processor publishes `processing.progress` events to Redis pub/sub; the realtime service subscribes and broadcasts to authenticated WebSocket clients filtered by tenant. Admin-ui shows a progress bar updated live. Tests: at least 3 progress events per upload, `complete` event with doc ID, no event loss on a 100MB file. Backpressure must not OOM.

---

### Day 12 — Audit log end-to-end (write path)

**Goal:** every auth event, admin action, and sensitive-data mutation lands in a tamper-evident audit log table.

**Files:** `services/gateway/internal/infrastructure/repositories/audit.go` (already 597 LOC — split into ≤200 LOC per file), migration `009_audit_log_immutable.sql`, middleware `audit_writer.go`.

**Steps:**
1. Split the 597-LOC `audit.go` into `audit_repo.go`, `audit_query.go`, `audit_writer.go` (200-LOC cap each).
2. Add `audit_logs` table with columns: id (UUID), tenant_id, actor_id, actor_type, action, target_type, target_id, before, after, ip, user_agent, created_at, signature (HMAC-SHA256 over row).
3. Trigger or app-layer enforcement: rows are append-only (REVOKE UPDATE/DELETE).
4. Middleware `audit_writer.go` captures every request matching an action whitelist (auth/admin/data-write) and writes asynchronously via a buffered channel.
5. Critical-path actions (auth, payment, key rotation, policy change, retention change) write synchronously and fail closed.

**Tests:** every documented sensitive action produces an audit row; deleting a row via SQL fails (RBAC enforced); HMAC verifies on read.

**Verify:** `go test -tags=integration ./tests/integration/audit_test.go`.

**Done when:** all critical-path actions have audit coverage, table is append-only, signatures verify.

**Prompt:**
> Refactor `services/gateway/internal/infrastructure/repositories/audit.go` (currently 597 LOC) into ≤200-LOC files: `audit_repo.go`, `audit_query.go`, `audit_writer.go`. Add migration 009: `audit_logs` table with HMAC-SHA256 signature column, append-only enforcement (REVOKE UPDATE/DELETE on the table for the app role). Middleware `audit_writer.go` captures auth/admin/data-write actions; critical-path writes are synchronous and fail closed. Tests must cover every documented sensitive action plus tamper detection.

---

### Day 13 — Audit log query API + admin UI

**Goal:** admins can query audit logs with filters (actor, action, time range, tenant) via API and UI.

**Files:** gateway `internal/interfaces/http/handlers/admin_audit.go`, `services/admin-ui/src/app/dashboard/audit-logs/page.tsx`.

**Steps:** add `GET /admin/audit-logs?actor_id=&action=&from=&to=&tenant_id=` with cursor pagination. UI: filterable table, export CSV button, retention notice. Permission gate: `admin:audit:read` (must be SOC officer role). Performance: index `(tenant_id, created_at DESC)`.

**Tests:** API filters work; pagination is stable; CSV export streams (no full-table load); permission gate enforced.

**Verify:** `go test ./internal/interfaces/http/handlers/admin_audit_test.go`; `cd services/admin-ui && npm test -- audit-logs`.

**Done when:** SOC officer can query and export audit logs covering 30 days in <5s.

**Prompt:**
> Add audit log query API and admin UI to sdlc-platform. Gateway `GET /admin/audit-logs` with filters (actor_id, action, from, to, tenant_id) and cursor pagination. CSV export streams without loading the full table. Admin-ui page at `/dashboard/audit-logs` with filterable table and export. Permission gate `admin:audit:read`. Index on `(tenant_id, created_at DESC)`. Performance target: 30-day query <5s.

---

### Day 14 — Document processor backpressure + DLQ

**Goal:** doc processor survives a flood (1000 uploads in 60s) without OOM or queue corruption; failed jobs land in a dead-letter queue with retry policy.

**Files:** `services/document-processor/src/queue/{backpressure.ts,dlq.ts}`, redis BullMQ config.

**Steps:** configure max-concurrency, max-memory-per-worker, exponential-backoff retry (5x, 30s/2m/10m/1h/4h). DLQ moves jobs after 5 failures. Admin-ui DLQ inspection page.

**Tests:** flood test injects 1000 uploads; no OOM; failed jobs land in DLQ; manual replay works.

**Verify:**
```bash
cd services/document-processor && npm run test:load
```

**Done when:** flood test passes; DLQ replay works.

**Prompt:**
> Add backpressure and dead-letter queue to sdlc-platform document-processor. Configure BullMQ with max-concurrency, max-memory-per-worker, exponential-backoff retry (30s/2m/10m/1h/4h). After 5 failures, move job to DLQ. Add an admin-ui page to inspect and replay DLQ jobs. Load test: 1000 uploads in 60s must not OOM and must drain cleanly.

---

### Day 15 — golangci-lint triage to 0

**Goal:** the gateway has 0 golangci-lint findings on `main`.

**Files:** anywhere golangci-lint flags. Prior audit: 157 findings.

**Steps:**
1. `cd services/gateway && golangci-lint run ./... > /tmp/lint.txt`
2. Group by linter (gocritic, gosec, errcheck, staticcheck...). Fix or justifiably suppress with `//nolint:linter // reason` (no bare `//nolint`).
3. Add `--max-same-issues=0` to fail on any new finding.
4. CI gate: PR fails on any new finding (use `golangci-lint run --new-from-rev=origin/main`).

**Tests:** baseline measured at 0; injecting one new finding fails CI.

**Verify:**
```bash
cd services/gateway && golangci-lint run ./...
gh workflow run ci.yml
```

**Done when:** golangci-lint exit 0 in CI.

**Prompt:**
> The sdlc-platform gateway has 157 golangci-lint findings. Triage to 0 by either fixing the underlying issue or suppressing with `//nolint:LINTER // justification` (never bare `//nolint`). Add `--max-same-issues=0` to the lint config. Add a `--new-from-rev=origin/main` CI gate so future PRs cannot introduce new findings. Do NOT lower the linter set to make findings disappear.

---

### Day 16 — Disaster recovery playbook (Postgres + pgvector)

**Goal:** documented and rehearsed backup/restore for postgres + pgvector with RPO ≤15min, RTO ≤1h.

**Files:** `docs/runbooks/dr-postgres.md`, `deployments/scripts/{backup.sh,restore.sh}`, `.github/workflows/dr-drill.yml`.

**Steps:** WAL-G or pgBackRest config; backup every 15 min to S3-compatible storage with object lock; restore script runs in staging weekly; verify pgvector extension + RLS post-restore.

**Tests:** automated DR drill in staging weekly; on-call dashboard shows last successful drill timestamp.

**Verify:**
```bash
bash deployments/scripts/backup.sh
bash deployments/scripts/restore.sh staging
```

**Done when:** staging restore from a 15-min-old backup completes in <1h, all data verified.

**Prompt:**
> Write a Postgres+pgvector disaster recovery playbook for sdlc-platform. Use WAL-G or pgBackRest with 15-minute backup cadence to object-locked S3-compatible storage. Add `deployments/scripts/backup.sh` and `restore.sh`. Document RPO 15 min, RTO 1 hour. Add `.github/workflows/dr-drill.yml` that runs a weekly staging restore drill and posts the result to Slack. Verify pgvector and RLS work post-restore.

---

### Day 17 — DR playbook for Redis, S3, secrets

**Goal:** rotation + restore documented for Redis (cache + queue), object storage, and secrets.

**Files:** `docs/runbooks/{dr-redis.md, dr-s3.md, dr-secrets.md}`.

**Steps:** Redis: cluster failover + AOF backup; S3: cross-region replication for processed docs; secrets: rotation runbook + emergency revocation. All three include a tested rehearsal command.

**Tests:** quarterly rehearsal calendar invite; runbook diff-checked against script.

**Done when:** all three runbooks exist with passing rehearsal.

**Prompt:**
> Add three DR runbooks to sdlc-platform under `docs/runbooks/`: Redis (cache+queue) cluster failover + AOF backup, S3 cross-region replication for processed docs, and secrets rotation + emergency revocation. Each runbook ends with a tested rehearsal command. Wire a quarterly rehearsal reminder.

---

### Day 18 — OPA policy syntax validator on policy create/update

**Goal:** invalid OPA policies cannot be saved.

**Files:** `services/gateway/internal/policy/syntax_validator.go`, `services/admin-ui/src/app/dashboard/policies/`.

**Steps:** before persisting, parse policy via `opa parse`; reject with file:line error; UI shows inline error. Snapshot test policies stored in repo.

**Tests:** valid Rego saves; invalid Rego rejected with location; UI surfaces error inline.

**Verify:** `go test ./internal/policy/syntax_validator_test.go`.

**Done when:** invalid Rego is rejected at save time with a useful error.

**Prompt:**
> Add OPA policy syntax validation to sdlc-platform. Before persisting any Rego policy, parse it via the OPA Go library and reject invalid input with a file:line error. Admin-ui shows the error inline next to the policy editor. Snapshot test the validation against a curated set of valid + invalid policies in `services/gateway/internal/policy/testdata/`.

---

### Day 19 — Performance baseline (k6 load test on RAG path)

**Goal:** measure today's p50/p95/p99 latency at 100 / 1k / 10k concurrent users.

**Files:** `tests/load/{rag-query.js, document-upload.js}`, `.github/workflows/load-test.yml`.

**Steps:** k6 scripts hitting gateway RAG + upload endpoints. Run on staging. Record results to `docs/performance/baseline.md`. Set SLO targets: p95 query <2s, p95 upload <30s for 50MB doc.

**Tests:** the k6 scripts themselves + a regression check.

**Verify:**
```bash
k6 run tests/load/rag-query.js
```

**Done when:** baseline published; SLO targets documented.

**Prompt:**
> Establish a performance baseline for sdlc-platform. Write k6 scripts for the RAG query path and the document upload path. Run on staging at 100, 1k, and 10k concurrent users; record p50/p95/p99 in `docs/performance/baseline.md`. Set SLO targets: p95 query <2s, p95 upload <30s for a 50MB doc. Wire a CI workflow that runs the smaller load test on every PR and the full one nightly.

---

### Day 20 — Phase 1 sign-off and metrics review

**Goal:** confirm every Phase 1 release blocker is closed; tag `phase-1-complete`.

**Steps:** review each Day 6-19 deliverable against the success criteria. Update `docs/PRODUCTION-READINESS.md` to reflect new state. Tag main `phase-1-complete` only when all checks pass.

**Done when:** the readiness doc reflects new percentage (estimated 50%+) and the tag is on main.

**Prompt:**
> Review every Phase 1 deliverable against the success criteria in `docs/roadmap/phase-1-release-blockers.md`. Update `docs/PRODUCTION-READINESS.md` with the new state and percentage. Tag `phase-1-complete` only when all 14 days' criteria are met. If any are missing, list them and stop.

---

End of Phase 1. Tag: `phase-1-complete`. Estimated readiness: 50%.
