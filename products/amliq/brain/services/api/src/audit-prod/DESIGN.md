# Production Audit Wiring — Design

Week 7 Stream A — Part C. Composes the tamper-evident emitter
(`@finsavvyai/telemetry/audit-tamper` — round-2 carve-out import) with a
per-tenant D1-backed chain HEAD store and an R2 sink, scoped per tenant.

## Decision

Use `createTamperEvidentEmitter` from `@finsavvyai/telemetry` with:

| Concern        | Production                                 | Development                  |
| -------------- | ------------------------------------------ | ---------------------------- |
| Signed sink    | Cloudflare R2 (one object per record)      | `console.log` JSON line      |
| Chain state    | Cloudflare D1 (`audit_chain_state` table)  | In-memory                    |
| Signer         | HMAC-SHA256 from injected key              | HMAC-SHA256 (test fixture)   |
| Failure logging| Datadog event API (round-3 env-var)        | `console.error`              |

The signer is **injected** (DI) — Brain never bundles signing material. Key
rotation is handled by the host wiring layer (Worker secrets) outside this
module.

## Per-tenant chain HEAD

Each tenant has an independent chain. State is persisted in a shared D1
table:

```sql
CREATE TABLE IF NOT EXISTS audit_chain_state (
  tenant_id   TEXT PRIMARY KEY,
  last_hash   TEXT NOT NULL,
  sequence_id INTEGER NOT NULL,
  updated_ms  INTEGER NOT NULL
);
```

- Primary key on `tenant_id` enforces single-row-per-tenant.
- `last_hash` is genesis (`"0" * 64`) for a tenant with no records yet —
  the row is created lazily on first emit.
- All reads/writes parameterise `tenant_id` via the D1 statement binding
  API. No string concatenation. The tenant_id is also regex-validated
  against `^[a-z0-9_-]{3,64}$` BEFORE the binding call as a defence in
  depth (refuse early, do not trust JWT alone).

## Failure modes

1. **D1 read fails on boot.** Treat as genesis (`null` HEAD). Emitter
   starts a fresh chain segment. On next successful boot, reconciler (out
   of scope of this module) reads the R2 sink and rebuilds D1 state.
2. **D1 write fails after a successful sink emit.** The signed record is
   already in R2. D1 is eventually consistent — next boot's reconciler
   catches up. Emitter logs via `onError` (DI) but DOES NOT throw —
   audit-emit "succeeded" from the request perspective.
3. **Sink (R2) write fails.** Falls through to `BrainAuditEmitter`'s
   primary→fallback path (out of scope here; handled in `audit.ts`).
   Request returns `503 audit_emit_failed` per AMLIQ rule.

## Backups

R2 daily snapshot of the `audit_chain_state` table is taken by a separate
Worker cron (out of scope of this module). Retention: 90 days. Restore
path: copy snapshot row into D1, re-validate chain segment against R2
sink, then resume.

## Concurrency

Within a single Worker invocation the emitter is single-instance and
sequential. Across invocations, D1 writes are last-write-wins. The
sequence_id monotonicity is enforced by the in-memory emitter only; D1 is
the canonical source on cold start. Two concurrent boots are tolerated
(both will read the same HEAD then race to write) because:

- The sink (R2) is append-only with content-addressable keys
  (`audit/<tenant>/<sequence>-<hash>.json`).
- D1 last-write-wins means at most one boot's sequence_id is persisted;
  the other's records still land in R2 with the SAME prev_hash and
  different `sequence_id`, which the verifier detects as a `sequence_gap`
  → triggers reconciliation.

This is acceptable for v1 (low cross-region contention) and is documented
as a known limitation for the M3 reliability milestone.

## Types

- `D1Client` — narrow interface (`prepare(sql).bind(...).first()` /
  `.run()`). Avoids depending on `@cloudflare/workers-types` at type-import
  level. Real binding is structurally assignable.
- `D1ChainStateStore` — implements `ChainStateStore` from
  `@finsavvyai/telemetry/audit-tamper`. One instance per (D1 binding,
  tenant_id) pair.
- `createProductionAuditEmitter` — factory composing all of the above,
  returning a `TamperEvidentEmitter` instance scoped to ONE tenant.

## SQL injection posture

- All SQL uses parameter binding (`?` placeholders) — zero string
  concatenation of user input.
- `tenant_id` is validated against `TENANT_ID_REGEX` at the boundary AND
  before each binding call. Validation failure throws — production code
  paths refuse to silently proceed with an unknown tenant.
- No identifiers (table/column names) are derived from user input.

## Out of scope

- The R2 sink implementation itself (HTTP PUT to R2 binding) — owned by
  the deployment manifest. This module exposes a `signedSink` slot in
  options; the factory wires the caller's sink in unchanged.
- D1 schema migration (single CREATE IF NOT EXISTS lives in deploy).
- Reconciler job (cron Worker).
- Datadog event emission for audit failures (handled by the host
  `onError` callback).
