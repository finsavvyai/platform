# AMLIQ Unified Decision API — Design (no code)

Status: **design only**. Round 4 produces this spec; implementation is a
later ticket (see `products/amliq/CONSOLIDATION_TODO.md`).

Authority: `finsavvyai_consolidation_plan_addendum.md` §1, round-4
conventions §"AMLIQ consolidation", round-1 audit-log shape, round-3 mesh
health contract.

## 1. Surface

```
POST /v1/aml/decision      → run subject + transaction, return AmlDecision
POST /v1/aml/investigate   → open multi-evidence case
GET  /v1/aml/cases/{id}    → case state + evidence
GET  /v1/aml/audit/{id}    → immutable audit record for any decision
GET  /health               → mesh health shape
```

Only `/v1/aml/decision` is in scope for this design doc. The others remain
on the existing aegis surface until a separate design pass.

## 2. Input

```ts
// from @finsavvyai/shared-types/aml
interface DecisionRequest {
  subject:      Subject;          // identity under evaluation
  transaction:  Transaction;      // event triggering the decision
  context?:     DecisionContext;  // tenant, channel, risk policy id, etc.
}
```

- `Subject` and `Transaction` are extended (not replaced) under
  `packages/shared-types/src/aml.ts`. The existing `ScoreRequest`/
  `ScoreResponse` types remain for backwards compatibility with the engines'
  current "fraud score" semantics; new clients use `AmlDecision`.
- All PII fields on `Subject` are server-side hashed at the boundary;
  engines only ever see `subjectHash` + non-PII attributes.
- Strict input validation at the boundary (Zod or equivalent). Engines
  receive sanitised structs.

## 3. AuthN / AuthZ

- JWT bearer required (`@finsavvyai/auth` — round 1 hardened token verify).
- 100 % coverage on the verify path is already enforced upstream.
- Role gate: `aml:decision:write`. Constant-time HMAC comparison wherever
  pre-shared keys are used (round-1 convention).
- Default deny. Unrecognised roles → 403, audit-logged.

## 4. Engine routing

| Condition | QuantumBeam | ml-fraud | Rationale |
|---|---|---|---|
| `transaction.amount < context.lowRiskCeiling` | yes | no | QB-only for fast-path low-value flows (< 50 ms budget) |
| `transaction.channel ∈ {wire, crypto}` | yes | yes | Both engines — quantum pattern detection + classical ML cross-check |
| `subject.riskTier == "high"` | yes | yes | Both — max-score wins on aggregation |
| `transaction.requiresExplainability` | no | yes | ml-fraud surfaces feature attributions; QB is opaque |
| QB engine `degraded` (per `/health`) | no | yes | Fail-safe to ml-fraud |
| ml-fraud `degraded` | yes | no | QB alone, decision flagged `partial=true` |

Both engines run **in parallel** when both are selected (Go goroutines /
context.WithTimeout per engine). Per-engine budget = 80 ms wall (with the
50 ms QB target untouched on its hot path).

## 5. Decision aggregation

```
blended = max(engineScores)         // max wins; never average
decision = blended < clearCutoff  ? "clear"
         : blended < reviewCutoff ? "review"
         : "block"
```

- `clearCutoff` and `reviewCutoff` are policy-driven (per tenant), pulled
  from `@finsavvyai/policy-engine`. Default `0.30` / `0.70`.
- Explanations from each engine are concatenated in `evidence[]`, never
  merged into a single opaque string. Each entry carries `{engine, version,
  reason, score}` so provenance is preserved.
- If only one engine returned (the other timed out or was skipped),
  `partial=true` and the aggregator must NOT promote a `clear` decision to
  `block` purely on the available engine — it returns `review` instead
  unless an explicit policy says otherwise.
- Tie-break: identical scores → engine order is `quantumbeam` first,
  `ml-fraud` second (deterministic for replay).

## 6. Output

```ts
// from @finsavvyai/shared-types/aml
interface AmlDecision {
  auditId:      AuditId;
  decision:     "clear" | "review" | "block";
  blendedScore: Score;            // 0..1
  evidence:     EvidenceItem[];   // one per engine that ran
  partial:      boolean;
  policyVersion: string;
  ts:           string;           // ISO-8601
}

interface EvidenceItem {
  engine:  EngineName;            // "quantumbeam" | "ml_fraud"
  version: EngineVersion;
  score:   Score;
  reason:  string;                // stable code, no PII
  latencyMs: number;
}
```

## 7. Audit-log emit (mandatory)

Every call to `/v1/aml/decision` MUST emit exactly **one** audit record
per round-1 shape, with the AMLIQ extensions in `meta`:

```json
{
  "ts":        "<ISO-8601>",
  "actor_id":  "<jwt sub or api-key id>",
  "event":     "aml.decision",
  "resource":  "<subjectHash>:<transactionId>",
  "decision":  "clear|review|block",
  "reason":    "<stable code, no PII>",
  "meta": {
    "engines":      { "quantumbeam": { "score": 0.42, "version": "<sha>" },
                       "ml_fraud":    { "score": 0.71, "version": "<sha>" } },
    "blendedScore": 0.71,
    "partial":      false,
    "policyVersion": "tenantA-v3",
    "latencyMs":    37
  }
}
```

Sink follows round-3 env-var convention: `FINSAVVY_AUDIT_SINK`,
`FINSAVVY_AUDIT_R2_BUCKET`, `FINSAVVY_AUDIT_DD_API_KEY`. Audit emit failure
**blocks** the response; decisions without a written audit record are not
served (release-blocking per AMLIQ CLAUDE.md).

## 8. Health endpoint

Per round-3 mesh:

```json
{ "status": "ok|degraded|down",
  "version": "<sha>",
  "uptime_s": 1234,
  "checks": [
    { "name": "engine.quantumbeam", "status": "ok|degraded|down" },
    { "name": "engine.ml_fraud",    "status": "ok|degraded|down" },
    { "name": "auth.jwks",          "status": "ok|degraded|down" },
    { "name": "audit.sink",         "status": "ok|degraded|down" } ] }
```

Engine routing in §4 consults the most recent `/health` snapshot.

## 9. Performance budget

- p50 < 50 ms (single-engine fast path)
- p95 < 100 ms (both engines + audit emit + policy lookup)
- p99 < 250 ms (cold cache, fresh policy)
- QB-only path retains its <50 ms upstream target untouched.
- Per-engine timeout 80 ms; aggregator timeout 90 ms; total request budget
  100 ms before deadline-exceeded is returned to client with `partial=true`
  audit record.

## 10. Failure modes (documented, not silent)

| Mode | Behaviour | Audit `reason` |
|---|---|---|
| Both engines timeout | 503 + audit | `engines_timeout` |
| One engine timeout (other ok) | 200 + `partial=true` | `engine_partial` |
| Audit sink down | 503 (do **not** serve) | n/a (not emitted) |
| Auth invalid | 401 + audit | `auth_invalid` |
| Policy unavailable | 503 (do **not** fall back to defaults silently) | `policy_unavailable` |

## 11. Out of scope (this design)

- Case lifecycle (`/v1/aml/cases/*`).
- Sanctions-list refresh (separate cron + signed-URL design).
- Analyst console wiring (lives in `products/amliq/web/`).
- DB schema for `decisions` / `evidence` storage — see CONSOLIDATION_TODO.
