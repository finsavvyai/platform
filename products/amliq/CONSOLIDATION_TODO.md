# AMLIQ Consolidation TODO

Actionable ticket list for taking the AMLIQ product from its post-round-4
state (four imported source trees side-by-side) to a single shippable
service that satisfies the design in `api/decision.md`.

Order is roughly dependency-driven. Each item is intended to be a
self-contained PR.

## P0 — Unblock compilation

- [ ] **Resolve Go module-name collision.** Today three module identities
      exist:
  - `engines/quantumbeam/` declares `module quantumbeam`
  - `engines/ml-fraud/` also declares `module quantumbeam`
  - `api/` declares `module github.com/aegis-aml/aegis`

  Action: introduce a single Go workspace (`go.work`) with three modules:
  `github.com/finsavvyai/amliq/{api,engines/quantumbeam,engines/ml-fraud}`.
  Rename go.mod identifiers, then rewrite every internal import in each
  tree. Track import-path migration with a scripted codemod, not by hand.

- [ ] **Delete or resolve aspirational imports.** Round 2 surfaced these
      `github.com/quantumbeam/*` paths that almost certainly never resolved:
  - `engines/quantumbeam/security/scripts/run-security-tests.go`
  - `engines/quantumbeam/internal/backup/providers/{fraud_detector,api_service}.go`
  - `engines/quantumbeam/internal/backup/api/backup_server.go`
  - `engines/quantumbeam/services/monitoring/cmd/monitoring-service/main.go`

- [ ] **Decide ml-fraud vs quantumbeam unification.** Round-2 evidence
      shows ml-fraud is a fork with extra audit + OIDC modules. Choose:
  (a) keep two engines (current design assumes this) **or**
  (b) merge into one engine with quantum extension.

## P1 — Build the unified decision API

- [ ] **Skeleton `cmd/amliq-api/main.go`** in `api/` that boots an HTTP
      server, registers `/v1/aml/decision` and `/health` per `decision.md`,
      and includes nothing else.

- [ ] **Engine adapter package** that exposes a Go `Scorer` interface
      (`Score(ctx, Subject, Transaction) (EngineScore, error)`) with two
      implementations: in-process call into each engine package (preferred)
      or gRPC client if engines are kept as separate processes.

- [ ] **Decision aggregator** implementing §5 of `decision.md`: parallel
      engine invocation, deadline propagation, max-score blend, partial
      handling, deterministic tie-break.

- [ ] **Replace mock data in `service.go`** with real engine calls. (Round
      2 notes flagged scoring services as stubbed mocks; rebuild against
      the new adapter.)

## P2 — Cross-package wiring

- [ ] **Auth middleware** — adopt `@finsavvyai/auth` JWT verify. Reject
      tokens without `aml:decision:write` role. Audit failures.

- [ ] **Audit emit** — wire one structured record per call using the
      round-3 sink contract (`FINSAVVY_AUDIT_SINK`, `_R2_BUCKET`,
      `_DD_API_KEY`). Block the response when audit emit fails (per
      AMLIQ CLAUDE.md).

- [ ] **Policy lookup** — call `@finsavvyai/policy-engine` for
      `clearCutoff` / `reviewCutoff` per tenant. Cache TTL ≤ 60 s.

- [ ] **Shared types alignment** — extend
      `packages/shared-types/src/aml.ts` with `Subject`, `Transaction`,
      `DecisionRequest`, `AmlDecision`, `EvidenceItem`. Do not replace
      existing types. TS strict.

## P3 — Storage + lifecycle

- [ ] **Decision history schema** — forward-only migration in
      `api/migrations/` adding `decisions` and `evidence` tables. Decisions
      carry `audit_id` (foreign key into audit sink) so an analyst can pull
      the whole evidence chain from a single id.

- [ ] **PII handling** — confirm `subjectHash` is the only identity column
      written; raw names / accounts never persisted in decisions/evidence
      tables. Add a contract test that fails if any column matches a PII
      regex.

- [ ] **Retention policy** — SOC-2-mappable: configurable per-tenant
      retention (default 7 years), purge cron, audit trail of purges.

## P4 — Observability + safety

- [ ] **Health endpoint** per round-3 mesh shape; checks for each engine,
      JWKS, audit sink, policy engine.

- [ ] **Synthetic probe** under `infrastructure/synthetics/` that scores a
      known-fixture subject every 60 s and asserts `decision == "clear"`.

- [ ] **Alert rules** under `infrastructure/alerts/`: engine timeout rate
      > 1 %, audit emit failure > 0, p95 latency > 100 ms.

- [ ] **Load test** at `tests/load/decision.js`: 1000 RPS sustained,
      assert p95 < 100 ms (decision.md §9 budget).

## P5 — Frontend + analyst surface

- [ ] Wire `products/amliq/web/` to the new `/v1/aml/decision` surface
      (today it talks to the legacy aegis routes).
- [ ] Replace local Supabase auth client with `@finsavvyai/auth`.
- [ ] Add a "decision detail" view that renders `AmlDecision.evidence[]`
      with per-engine score + version + reason.

## Source-doc consolidation

- [ ] Decompose `products/tenantiq/CLAUDE.source.md` (367 lines) and
      `products/tenantiq/README.source.md` (655 lines) into ≤200-line
      sections under `products/tenantiq/docs/` once consolidation begins
      (not blocking).
- [ ] Reconcile `products/tenantiq/apps/web/` (desktop SvelteKit) vs
      `products/tenantiq/web/` (Capacitor mobile shell). Likely outcome:
      keep both, document as two surfaces of the same product.
- [ ] Replace external `@opensyber/tokenforge` dep in
      `products/tenantiq/web/package.json` with the workspace
      `oss/tokenforge/` package once published.

## Out of scope for this list

- AMLIQ case lifecycle redesign.
- Sanctions-list refresh pipeline.
- M&A / org branding theming inside the web app.
