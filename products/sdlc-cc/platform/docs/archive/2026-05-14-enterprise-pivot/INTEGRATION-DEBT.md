# Integration Debt — honest audit

> **REPO STATUS (2026-05-14):** Active — `services/gateway` here is
> the live sdlc.cc backend. The earlier "code consolidated into aegis,
> ship from `aegis/cmd/sdlc-api`" banner was aspirational: `aegis/`
> contains the AMLIQ binary set (`cmd/api`, `cmd/agent`, `cmd/worker`,
> screening tools) and has no `sdlc-api` binary. All Phase 1/2
> primitives referenced below resolve to files in this repo. See
> [PIVOT-DECISION.md](PIVOT-DECISION.md) for the dual-SKU model and
> [SUNSET.md](../SUNSET.md) for the corrected status.

Last updated: 2026-05-14 (re-audit against migrations.yml + LS webhook + SSO ACS code).

I shipped a lot of primitives across Days 6-55 (~5K LOC, ~75 tests).
The unit tests pass and pushci is green. **That's not the same as
working software.** This file lists every primitive that exists and
states whether it is actually wired into the runtime path.

Categories used:
- ✅ **integrated** — runs in the actual request path or background process
- 🟡 **primitive only** — package + tests committed, no caller invokes it
- 🔴 **scaffold/blocked** — placeholder body or external-creds blocker

## ✅ Watcher-flagged migration version conflict — fixed 2026-05-01

The no-bluff watcher found that two SQL files in
`services/gateway/internal/infrastructure/migrations/migrations/` shared
the numeric prefix `015`:

- `015_dlp_tenant_policy.sql` (Day 34 — DLP policy table)
- `015_idp_config.sql` (Day 24 — per-tenant SSO IdP config)

The migration runner (`migrator.go`) keys its `schema_migrations` table on
`version INTEGER PRIMARY KEY`, where `version` is parsed from the filename
prefix. Once version 15 is applied (DLP table), `PendingMigrations()` sees
it as applied and skips the second file silently. The `idp_configs` table
would never be created in any environment where migrations run in order.

Fix: renamed `015_idp_config.sql` → `017_idp_config.sql` (next available
slot after `016_domain_verifications.sql`). Also added `validateMigrations`
to `migrator.go` that returns an error on duplicate version numbers at load
time, preventing the same silent-skip failure from recurring. Three behavior
tests in `migrator_test.go` prove detection, acceptance, and empty-slice
safety.

Day 24 remains 🟡 (ACS route mounting still pending per A1), but the
migration is now ordered correctly so the `idp_configs` table will exist
once migrations are applied.

## ✅ Watcher-flagged build drift — fixed 2026-05-01

The no-bluff watcher's first run flagged a build drift on
HEAD `6d27b1a`: `services/gateway` failed to compile because
`//go:embed ui/dist/*` in `swagger.go` referenced a directory whose
contents were excluded by the top-level `dist/` rule in `.gitignore`.
Local checkouts that had run a swagger build saw it work; fresh
checkouts (including the watcher's own runtime) did not.

Root cause: the dist tree was generated and present locally on every
developer's machine, but never committed. The embed pattern at
package compile time silently consumed whatever local artifact was
present, and CI caches masked the gap.

Fix: force-tracked
`services/gateway/internal/interfaces/http/swagger/ui/dist/index.html`
and `openapi.yaml` via `git add -f` so the embed pattern resolves on
fresh clones. The `dist/` rule in `.gitignore` stays generic — the
two specific files are tracked despite the rule.

This is exactly the kind of drift the no-bluff watcher exists to
catch. The pattern of "feature compiles on my machine but not on a
fresh checkout" is how primitives become drift. The watcher caught
the very first such case within an hour of being scheduled.

## Phase 1 audit (Days 6-20)

| Day | Primitive | Status | What's missing for ✅ |
| --- | --- | --- | --- |
| 6 | `internal/infrastructure/ratelimit` Redis sliding window | ✅ | `chain.go` step 8 mounts `TierRateLimiter.Middleware()` via `ChainDeps.RateLimiter`. ConfigRepo + AdminRepo wired through `wiring.go::initSecuritySuite`. p99 benchmark still pending. |
| 7 | Admin endpoints + admin-ui rate-limits page | ✅ | `cmd/server/router.go` now passes real `ratelimit.AdminRepo` via `SecuritySuite.RateLimitAdmin`; RBAC `admin:rate_limit:{read,write}` enforced. (842190e, 2026-04-29) |
| 8 | E2E test in `services/gateway/tests/e2e` | ✅ | `.github/workflows/e2e.yml` brings up `deployments/docker-compose.e2e.yml` on every PR + push to main; gateway↔RAG roundtrip job runs against real builds. (2026-05-14 re-audit) |
| 9 | API key Rotator + Sweeper | ✅ | Rotate + revoke at `/v1/api-keys/{id}/{rotate,revoke}` with RBAC. Sweeper started from `cmd/server/wiring.go` on 5-min interval; revokes keys past their grace window. Admin UI is incremental polish. |
| 10 | Fingerprint Enforcer | ✅ | `chain.go` step 6a runs `fingerprint.Middleware` in extract-only mode so signals land in `context.Context`; gateway uses JWT not sessions, so hard enforce stays with `cmd/auth-server` (already does it on session refresh). |
| 11 | Progress emitter (DP) + broadcaster (realtime) | ✅ | DP-side bridge wires QueueManager -> Redis pub/sub. Realtime `index.ts` now subscribes via `ProgressBroadcaster` + `TenantClientRegistry` and fans out to WS clients filtered by tenant (2026-04-30 sweep). |
| 12 | HMAC audit Writer | ✅ | `AppendCritical` now fires at every admin mutation: api_key.rotate, api_key.revoke, tenant.cmek.update, policy.create/update/delete, domain.register/verify/delete, scim.user.create/replace/patch/delete. Wired via `AuditAppender` on `APIKeyRotateDeps`, `TenantCMEKDeps`, `Dependencies`, and `scim.AuditHook`. 7 behavior tests in `audit_critical_test.go` + `scim/audit_test.go` prove rows land and fail-closed on appender error. Migration 009 still pending CI apply. (2026-05-01) |
| 13 | Audit query API | ✅ | `/admin/audit-logs` wires the real `PgxReader` via `auditLogReaderAdapter`. RBAC `admin:audit:read` enforced. (842190e, 2026-04-29) |
| 14 | BullMQ backpressure + DLQ classes | ✅ | `queue-manager.ts` now reads env-driven `policyFromEnv()` and applies `attempts`, `backoff[0]`, and per-queue concurrency from the policy. Bull v3 stays in place; full BullMQ v5 migration deferred. |
| 15 | golangci-lint new-finding gate | ✅ | works as committed (only blocks new findings) |
| 16 | DR runbook + scripts | 🟡 | `.github/workflows/dr-drill.yml` schedules weekly cron + uses real `aws ssm send-command` against `tag:role,Values=postgres-staging`. Execution depends on `PG_BACKUP_AWS_*` + `SLACK_DR_WEBHOOK` secrets being live; restore proof from a real run not yet captured. (2026-05-14 re-audit) |
| 17 | DR runbooks (redis/s3/secrets) | 🔴 | doc only |
| 18 | Rego SyntaxValidator | ✅ | `handlers/policies.go` validates Rego on POST/PUT, returning 400 + every joined `*policy.SyntaxError` so the admin UI can highlight every diagnostic at once (8b7549a, BEAT-PLAN S2.2, 2026-04-29). |
| 19 | k6 load test scripts | 🟡 | `.github/workflows/load-test.yml` + `load-test-baseline.yml` shipped; default `K6_TARGET_URL=https://api.sdlc.cc`. Manual-trigger only (workflow_dispatch) — no scheduled run, no captured baseline. (2026-05-14 re-audit) |
| 20 | "Phase 1 sign-off" | (was incorrect) | n/a |

**Phase 1 reality** (post-2026-05-14 re-audit): 11 ✅, 2 🟡, 1 🔴. Day 8 docker E2E confirmed live in CI. Days 16/19 workflows shipped — execution captured proof still pending. Day 17 (redis/s3/secrets runbooks) is doc-only and the lone outright 🔴.

## Phase 2 audit (Days 21-55)

| Day | Primitive | Status | What's missing for ✅ |
| --- | --- | --- | --- |
| 21 | RBAC `Evaluator` + migration 010 | ✅ | `infrastructure/rbac/PgxLoader` wired through `cmd/server/wiring.go::initSecuritySuite`. Canonical `database/migrations/010_rbac.sql` applies in `.github/workflows/migrations.yml`; verification step asserts `roles/role_permissions/user_roles` tables exist. (2026-05-14 re-audit) |
| 22 | `RequirePermission` middleware | ✅ | Every mutating endpoint gated: `tenants/users/rag/files/domains/usage/dlp/vector/documents/policies/api_keys` (commit 528d2c9, 2026-04-29). |
| 23 | SCIM `ParseFilter` | ✅ | `mountSCIM` now picks `scim.NewPgxStore` + `scim.NewPgxGroupStore` when a pgxpool is wired (else MemStore fallback for dev). Migration 024 ships the schema. Live Okta compliance run still pending. |
| 24 | SSO `SAMLConfig` + MFA helper | 🟡 | SAML real via `crewjam/saml`. MFA challenge HTTP middleware + POST /v1/auth/mfa/verify wired. Migration 026 adds `tenant_saml_config`; `sso.PgxLoader` reads it. ACS route mounting still pending — needs SP keypair + IdP config plumbed through chain. |
| 25 | Domain `Verifier` | ✅ | `dv.NewPgxStore` (migration 025) is wired through `Dependencies.DomainStore`; SSO auto-redirect handler mounted at GET `/api/v1/sso/start?email=...` returns 302 when the email's domain is verified for some tenant (2026-04-30 sweep). |
| 26 | IP `AllowList` + migration 011 | ✅ | `chain.go` step 7a runs `ipAllowListMiddleware` against `tenants.network_mode='private_only'` + `ip_allowlists` CIDRs (commit f61b1ed). Canonical migration 021 added (now gated by `migrations.yml`). |
| 27 | Private-link runbook | ✅ | Producer + consumer Terraform modules at `deployments/terraform/modules/privatelink/` with README + acceptance flow (9490f0c, BEAT-PLAN S3.3, 2026-04-29). |
| 28 | spend `Tracker` + migration 012 | ✅ | `infrastructure/spend/{sink,pricing,usage}.go` ship Postgres-backed Sink + Pricing + UsageReader. `cmd/server/llm_wiring.go` constructs the Tracker and `/v1/chat` calls `Tracker.Record` after every response. `services/gateway/internal/infrastructure/migrations/migrations/012_spend_events.sql` applies via `migrations.yml`'s explicit gateway-internal include list. (2026-05-14 re-audit) |
| 29 | spend `Check` (limits verdict) | ✅ | `internal/app/handlers/llm/chat.go::preCheckSpend` calls `domain/spend.Check` and returns RFC-7807 402 before the upstream call when the tenant hard cap is hit. Unit-tested via httptest. Migration 012 applies in `migrations.yml` (see Day 28). (2026-05-14 re-audit) |
| 30 | analytics dashboard | ✅ | `infrastructure/analytics/PgxStore` aggregates `spend_events` per tenant for Overview + Timeseries. Mounted at `/admin/analytics/{overview,timeseries}` (commit 34e5142, 2026-04-30). UI page already in admin-ui. |
| 31 | Stripe invoicing (Pilot/Enterprise) + LemonSqueezy webhook entry point | 🟡 | Stripe: `infrastructure/billing/{invoice,discount,cron,pdf_generator,stripe_uploader}.go` shipped (commit 41cd43d, 2026-04-30) with 95.3% line coverage. Live Stripe API keys + Connect onboarding still required. LemonSqueezy: migration 018 adds `tenant_billing` + `billing_events` tables; `infrastructure/billing/lemonsqueezy/{signature,webhook}.go` implement HMAC-SHA256 verify + shared-store product-id filter; `POST /webhooks/lemonsqueezy` mounted in `mountUnauthenticatedSurfaces` + `publicPaths()` (Bucket D phase-1, no-bluff watcher, 2026-05-01). Remaining Bucket D work: `client.go` CreateCheckout + subscription lifecycle handlers (`handlers.go`) + plan-enforcement hook in chain.go + LS API keys. |
| 32 | Compliance API handlers | ✅ | `compliance.Mount` now wires `infcompliance.NewPgxReaders` from `wiring.go::initSecuritySuite` (RBAC snapshot + retention + DLP-event readers). Stubs only fire when the DB is unavailable in dev. |
| 33 | retention `Sweeper` + migration 013 | ✅ | `wiring.go::initSecuritySuite` calls `infretention.Wire` which starts the 24h ticker that purges rows past their per-tenant retention window. Survives transient DB errors via the slog warning path. |
| 34 | DLP `Detector` | ✅ | Inbound middleware wired at chain step 8a. `infrastructure/middleware/PgxPolicyLookup` reads per-tenant action from `tenant_dlp_policy`. Canonical `database/migrations/019_tenant_dlp_policy.sql` creates the table in `migrations.yml`; verification step asserts it exists. (2026-05-14 re-audit) |
| 35 | DLP outbound | ✅ | `Outbound()` mounted at chain step 12a (before Compress so gzip cannot mask PII). Chain integration test in `chain_dlp_test.go` proves redaction happens before the body leaves the chain. `tenant_dlp_policy` table backing applies in CI per Day 34. (2026-05-14 re-audit) |
| 36 | encryption-at-rest doc | ✅ | `.github/workflows/encryption-check.yml` parses `deployments/encryption-manifest.json` against runtime config; `scripts/encryption_check.go` is the binary it runs (b8ef751, 2026-04-29). CMEK envelope encryption layer + tenants.kms_key_arn migration also shipped (88f97ee, BEAT-PLAN S3.1). |
| 37 | TLS hardening | 🔴 | Not started |
| 38 | Webhook signer/verifier | ✅ | `auditAppenderAdapter.Append` now fires `WebhookDispatcher.Dispatch` (fire-and-forget) on every critical admin mutation; subscribers register against event types like `rate_limit.update` (2026-04-30 sweep). |
| 39 | Connector framework | ✅ | `mountConnectorOAuth` constructs `connectors.NewRegistry()` and registers 6 connectors (Zendesk, ServiceNow, HubSpot, Google Workspace, Slack, GitHub) at boot. |
| 40-47 | 10 connector stubs | 🟡 | Per-vendor scaffolds tracked (d31ad24); google_workspace + slack + github registered in `mountConnectorOAuth` with AuthorizeURL builders (c28c009, BEAT-PLAN S2.3+S2.4, 2026-04-29). End-to-end (consent → indexed) still requires real OAuth apps registered with each vendor — see follow-up routine `trig_0191DCVP65ZzJyXdKGoFCjyS` firing 2026-05-13. |
| 48 | Marketplace UI page | ✅ | `GET /admin/connectors` mounted in `mountConnectorOAuth` returns the registered connector catalog as `{data: [...]}`. Admin UI Connectors page consumes it. |
| 49 | LLM `Provider` interface + `FallbackChain` | ✅ | `initLLMSuite` env-sweeps Anthropic + OpenAI + Bedrock + Vertex + Azure. With ≥2 providers it wraps them in `infllm.NewFallbackChain` (primary first, others as secondaries). 2026-04-30 sweep added the missing OpenAI env-sweep. |
| 50 | Routing `Decide` classifier | ✅ | `chatHandlerOrNotImplemented` passes `routing.NewDefaultPolicy()` into the LLM chat handler's `Deps.RoutingPolicy`, so every `/v1/chat` request routes through the classifier before the upstream call. |
| 51 | Codex code-action agent | 🔴 | Not started |
| 52 | RAG `fit_to_context` | ✅ | `/context/assemble` endpoint now post-processes the assembly with `fit_to_context(target_tokens=request.max_tokens)` whenever the assembled context exceeds the requested budget (2026-04-30 sweep). |
| 53 | projects + members migration 016 | ✅ | RBAC gates landed: `ProjectsDeps.RBAC` field + `gate()` helper wrap every route with `RequirePermission` (`projects:read` / `projects:write` / `projects:delete`). `mountProjects` in `router.go` passes `buildRBAC(app)` so the live evaluator enforces permissions. Migration 031 seeds the three permissions onto admin/owner/member roles. 4 behavior tests in `projects_rbac_test.go` prove 403 on deny and 201/200/204 on allow, posting through the real Chi router. Admin-ui page deferred (external, non-blocking). (A3 closeout via no-bluff watcher, 2026-05-01) |
| 54 | session_recordings capture hook | ✅ | `captureRecording` fires in `Chat()` after `recordSpend`; `LLMSuite.Recorder` wired via `stdlib.OpenDBFromPool` in `llm_wiring.go`; `GET /admin/recordings/{session_id}` mounted with RBAC. 3 behavior tests in `recording_test.go` prove rows are written when enabled, zero when disabled, and no panic when recorder is nil. (A4 closeout via no-bluff watcher, 2026-05-01) |
| 55 | "Phase 2 sign-off" | (was incorrect) | n/a |

**Phase 2 reality** (post-2026-05-14 re-audit): 22 ✅, 3 🟡, 2 🔴. The five 🟡 items blocked on "migration X unrun in CI" (21, 28, 29, 34, 35) all flip to ✅ now that `.github/workflows/migrations.yml` applies the canonical `database/migrations/*.sql` set plus the gateway-internal 011/012/013, with a verification step that fails the job if any of the 11 required tables are missing. Remaining 🟡: Day 24 (SSO ACS handler still a `TODO` stub returning empty SSOURL — `internal/interfaces/http/handlers/sso_redirect.go:31`), Day 31 (LS lifecycle handlers explicitly deferred to "next iteration" — `webhook.go:78-81`), Days 40-47 (env-sweep wired; per-vendor OAuth app registrations still pending). 🔴: Day 37 (TLS hardening) + Day 51 (Codex agent).

## Bucket E audit (ClawPipe adapter)

| Item | Primitive | Status | Evidence |
| --- | --- | --- | --- |
| Bucket E | ClawPipe `infllm.Provider` adapter + `initLLMSuite` env sweep | ✅ | `internal/infrastructure/llm/clawpipe.go` implements `Name/Generate/Embed`; `cmd/server/llm_wiring.go` sweeps `CLAWPIPE_API_KEY` and prepends ClawPipe to the provider list so it is primary in the fallback chain when configured. 6 behavior tests in `clawpipe_test.go` cover: request shape, Bearer header, X-Project-Id header, JSON unmarshal, 502→Transient, and end-to-end fallback chain advance to Anthropic secondary. (Bucket E closeout via no-bluff watcher, 2026-05-01) |

## What this means for "use it this week"

The clean code surface and migrations are useful — they shorten the
integration work. But to actually run the platform with new features,
the integration-priority work below has to ship.

## Top 5 integration commits to make the platform actually do something

These are ordered by user-visible impact per hour of work:

1. **Wire RBAC + rate-limit + audit middleware into chain.go**
   (Days 6, 12, 21-22 integration)
   - Chain order: ... → Auth → Tenant → **RateLimit** → Validate → **Audit** → Policy → ...
   - Every audit-relevant handler gets a `RequirePermission` wrap.
   - Apply migrations 007, 009, 010 against staging.
   - Write 1 integration test per primitive that proves wiring (real
     Redis + real Postgres via testcontainers).

2. **Ship one real LLM provider adapter (Anthropic)**
   (Day 49 integration)
   - Implement `internal/infrastructure/llm/anthropic` against the
     Anthropic Go SDK using `ANTHROPIC_API_KEY`.
   - Wire into `cmd/server/main.go` as the only provider for now.
   - Replace the existing claw_store RAG path's hard-coded model call.
   - Recorded HTTP fixture test so CI doesn't need the live API.

3. **Wire spend tracking on every LLM call**
   (Days 28-29 integration)
   - In the new Anthropic adapter's `Generate`, after success, call
     `spend.Tracker.Record`.
   - Apply migration 012; seed model_pricing for the Anthropic models
     in use.
   - Middleware that consults `spend.Check` returns 402 on hard cap.

4. **Wire DLP on inbound prompt path**
   (Day 34 integration)
   - HTTP middleware after Auth/Tenant, before the RAG handler.
   - Reads tenant DLP policy (mask | redact | block) from a small
     migration we add now.
   - Audit every detection.

5. **Ship the Google Workspace connector**
   (Day 40 integration)
   - Real OAuth round-trip + Drive list/fetch.
   - `/admin/connectors` API the marketplace UI already expects.
   - One real customer can self-onboard a Drive corpus.

After those five, the platform actually does something the previous
version didn't, and "use it this week" becomes a real conversation.

## What I will NOT do again

- Push `phase-N-complete` tags without walking each Done-when bullet.
- Round "tests pass" up to "feature works."
- Treat 35 days of scaffolds as 35 days of progress.
