# Phase 1 — Honest status (Days 6-19)

> **Why this file exists.** A previous session claimed Phase 1 was
> tagged complete. It is not. This document is the ground-truth state
> after a fresh inspection on 2026-04-26 plus the partial work done in
> the cleanup pass.
>
> **Status legend**
> - **REAL** — code, tests, and CI wiring all present and verified.
> - **PARTIAL** — code present, but at least one of: not wired into
>   the router, no tests run, no CI gate, or a downstream component
>   missing.
> - **SCAFFOLD** — file exists with the right shape but is not yet
>   load-bearing (e.g. handler not mounted on the router).
> - **SKIPPED** — explicitly not done by the agent. See Day 15.

---

## Day 6 — Redis-backed rate limiter

**Status: PARTIAL**

- `services/gateway/internal/infrastructure/ratelimit/redis_limiter.go`
  exists with `redis_limiter_test.go` and a sliding-window helper.
- `services/gateway/internal/infrastructure/ratelimit/config_repo.go`
  reads from the `rate_limits` table created by migration 008.
- **Gap:** integration test against a real Redis testcontainer not
  reviewed in this pass. Benchmark of <2ms p99 added latency was not
  re-measured.

To call REAL: re-run `go test -tags=integration ./tests/integration/rate_limit_test.go`
on a host with Docker, capture the p99 number, and link it here.

---

## Day 7 — Rate-limits admin handler + UI

**Status: SCAFFOLD**

- Handler: `services/gateway/internal/interfaces/http/handlers/admin_rate_limits.go` (181 LOC)
- Handler test: `admin_rate_limits_test.go` (188 LOC) — uses an
  in-memory mock store.
- Admin UI page: `services/admin-ui/src/app/dashboard/tenants/[id]/rate-limits/page.tsx` (182 LOC)
- Repo: `services/gateway/internal/infrastructure/ratelimit/admin_repo.go`
  with `admin_repo_test.go`.

**Gaps that block REAL:**
1. `ListRateLimits` / `PutRateLimits` are **not mounted** in
   `services/gateway/cmd/server/router.go` — `grep` finds zero
   references outside the handler + its test.
2. RBAC permission strings (`admin:rate_limit:read|write`) are
   declared in the handler doc-comment but not enforced — the
   middleware chain has no permission gate yet.
3. The audit-write call in `PutRateLimits` swallows errors
   (`_ = deps.Audit.Append(...)`); for a critical-path admin action
   this should fail closed.

---

## Day 8 — Gateway↔RAG E2E test

**Status: PARTIAL**

- `services/gateway/tests/e2e/rag_roundtrip_test.go` (208 LOC) — gated
  by `//go:build e2e`. Has the happy-path test plus
  `TestRAGEmptyCorpus` regression.
- `deployments/docker-compose.e2e.yml` (90 LOC) wires postgres,
  redis, gateway, rag, document-processor.
- `.github/workflows/e2e.yml` brings the stack up and runs the e2e
  Go test on PRs touching the relevant paths.

**Gap:** never been executed end-to-end against a built gateway
image — the gateway Dockerfile context referenced by the compose
file (`../services/gateway/Dockerfile`) was not verified. First green
run is still pending.

---

## Day 9 — API key rotation + device fingerprint

**Status: not in scope of this cleanup pass.**

Files exist under `services/gateway/internal/infrastructure/token_rotation/`
and `internal/infrastructure/fingerprint/`. Treat as PARTIAL until
verified separately.

---

## Day 10 — WebSocket realtime broker

**Status: not in scope of this cleanup pass.**

`services/realtime/src/services/progress-broadcaster.ts` exists. Treat
as PARTIAL until subscribed by document-processor (see Day 11).

---

## Day 11 — Document-processor progress emitter

**Status: PARTIAL**

- `services/document-processor/app/queue/progress-emitter.ts` (101 LOC)
- New: `services/document-processor/tests/queue/progress-emitter.test.ts`
  with a hand-rolled FakeRedis (no `ioredis-mock` dep was available).
  Asserts channel format, sequenced stage events, percent clamping,
  failure publishing, and that publish errors are swallowed.

**Gap:** the emitter is not yet hooked into the BullMQ processor.
`grep -r "ProgressEmitter" services/document-processor/app | grep -v
queue/` returns nothing — the publisher exists, the call sites do not.

---

## Day 12 — audit.go split + migration 009

**Status: REAL (refactor) / PARTIAL (migration runtime)**

The 597-LOC `services/gateway/internal/infrastructure/repositories/audit.go`
was split into:

- `audit_repo.go` (147 LOC) — types + ctor + Create + scan + table bootstrap
- `audit_query.go` (192 LOC) — GetByTenant / GetByUser / GetByAction / GetByResource
- `audit_stats.go` (114 LOC) — GetAuditStats + helpers
- `audit_writer.go` (120 LOC) — CleanupOldLogs / ExportAuditLogs / CreateAuditRetentionPolicy

`audit.go` is reduced to a 6-line package marker so an old build
referencing the path still compiles.

> **Spec deviation:** Day 12 asked for a 3-file split (repo / query /
> writer). Honest LOC math forced a 4th file (`audit_stats.go`) — the
> read-side queries plus the stats aggregations together overran the
> 200-LOC cap. Documented in the file header.

`database/migrations/009_audit_log_immutable.sql` adds the HMAC
`signature` column, the `(tenant_id, created_at DESC)` index, REVOKEs
`UPDATE`/`DELETE` from the `sdlc_app` role, and installs trigger
guards. **Not executed** against any database in this pass; treat as
schema-as-code only until a CI run applies it.

---

## Day 13 — Audit query API + UI

**Status: SCAFFOLD**

- Handler: `services/gateway/internal/interfaces/http/handlers/admin_audit.go` (169 LOC)
  with `admin_audit_test.go` (137 LOC). Filters: actor_id, action,
  from, to, tenant_id, cursor, limit. Streams CSV when
  `Accept: text/csv` is sent.
- New admin UI:
  - `services/admin-ui/src/app/dashboard/audit-logs/page.tsx` (181 LOC)
  - `services/admin-ui/src/app/dashboard/audit-logs/filter-bar.tsx` (106 LOC)

**Gaps (same shape as Day 7):**
1. `QueryAuditLogs` is **not mounted** on the router.
2. Permission `admin:audit:read` is documented but not enforced.
3. The handler holds an `AuditLogReader` interface; no production
   adapter exists yet — the legacy `auditLogRepository` returns
   `*models.AuditLog`, not the new `AuditRow` shape.

---

## Day 14 — Document-processor DLQ + backpressure

**Status: PARTIAL**

- `services/document-processor/app/queue/backpressure.ts` (107 LOC)
  now reads `DEFAULT_CONCURRENCY` / `MAX_MEMORY_MB` / `MAX_INFLIGHT`
  from env and exposes `applyBackpressureConfig(queue)`.
- New: `services/document-processor/app/queue/dlq.ts` (110 LOC)
  separates the DLQ implementation from the policy, plus the
  `replayJob` and `listDLQ` helpers the spec asked for.
- Tests:
  - `tests/queue/backpressure.test.ts` (existing) — re-pointed to
    import `BullMQDLQ` from `dlq.ts`.
  - `tests/queue/dlq.test.ts` (new, 90 LOC) — adds coverage for
    `replayJob`, `listDLQ`, and the `dlqQueueName` constant.

**Gap:** `applyBackpressureConfig` is best-effort — BullMQ's
`setGlobalConcurrency` is feature-detected, not enforced. No call
site in the document-processor pipeline yet invokes it.

---

## Day 15 — golangci-lint baseline

**Status: SKIPPED**

The agent could not run `golangci-lint`. See
`services/gateway/LINT_STATUS.md` for the explicit follow-up.

---

## Days 16-19

Out of scope for this pass. Treat existing `STATUS.md` / `SPRINTS.md`
claims as unverified until each is audited the same way.

---

## Day 20 — Phase-1 tag

**Not created.** Several items above are SCAFFOLD or PARTIAL; cutting
a tag would lock in the dishonest claim the previous session made.
Re-evaluate after Days 6, 7, 8, 9, 10, 11, 13, and 15 each move to REAL.
