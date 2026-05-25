# SPEC — @finsavvyai/shared-types

## Contract overview

This package is the canonical contract for cross-product wire types used by
the FinsavvyAI platform: AML scoring requests/responses, audit-event shapes,
and branded identifiers. It contains type definitions and a small number of
runtime predicates / brand constructors — no I/O, no business logic. Because
`products/*` cannot import `@finsavvyai/*` at runtime (round-2 isolation),
products mirror these shapes locally; this file is the canonical reference
they are validated against.

## Public surface

From `src/ids.ts`:

- `SubjectId`, `CaseId`, `ActorId`, `AuditId`, `EngineVersion` — branded
  `string` types. Branding is structural and zero-cost at runtime.
- `asSubjectId`, `asCaseId`, `asActorId`, `asAuditId`, `asEngineVersion` —
  constructors that validate non-empty string input.

From `src/aml.ts`:

- `Score` — number in closed interval `[0, 1]`.
- `Decision` — `"clear" | "review" | "block"`.
- `EngineName` — `"quantumbeam" | "ml_fraud"`.
- `EngineScore` — `{ engine, score, version, reason? }`.
- `ScoreRequest` — `{ subjectId, subjectHash, caseId?, payload }`.
- `ScoreResponse` — `{ auditId, decision, blendedScore, engineScores, reason }`.
- `isDecision(value)`, `isScore(value)` — type guards.

From `src/audit.ts`:

- `IsoTimestamp` — string alias documenting ISO-8601.
- `AuditEventKind` — `"aml.score" | "aml.investigate.open" | "aml.case.update"
  | "auth.login" | "auth.logout" | "admin.action"`.
- `AuditEventBase` — `{ id, ts, actorId, event, resource, decision, reason }`.
- `AmlScoreAuditEvent` — extends `AuditEventBase` with `engineVersions`,
  `scores`.
- `AuditEvent` — union of base + AML score event.
- `isAmlScoreAuditEvent(event)` — type guard.

## Stable error codes

No error class hierarchy lives here (types-only package). The constructors in
`ids.ts` throw `Error` with message `invalid <Kind>: must be non-empty string`.
Consumers must surface this as a validation failure at the boundary; do not
let it bubble unwrapped.

## Invariants

1. `subjectHash` in `ScoreRequest` is the **only** identifier that may cross
   process boundaries; raw PII is forbidden.
2. `EngineScore.reason` and `ScoreResponse.reason` MUST be stable codes, never
   user-facing strings or PII.
3. `AuditEventBase.resource` MUST be a stable identifier (case id, subject
   hash). No PII, no full emails, no Bearer tokens.
4. `AuditEventBase.reason` MUST be a stable code. Free-form text is a defect.
5. Brand constructors reject empty strings. They are the only sanctioned path
   to build a branded id; raw casts are a contract violation.
6. `Score` MUST be in `[0, 1]`. Out-of-range is a defect; clamp at the engine,
   not at the consumer.

## Test coverage gates

- `ids.ts`, `aml.ts`, `audit.ts`: **100%** lines / branches / functions for
  predicates and constructors.
- Type-only exports are exercised through compile checks in `*.test.ts`.

## Versioning policy

- Semver. Breaking changes require:
  - bump major,
  - addendum at the bottom of this file in a `## Changelog` section,
  - update each known consumer's mirror in the same PR (or open follow-up
    tracking issues).
- Adding a new optional field is a minor bump.
- Renaming or removing a field, or narrowing a union, is a breaking change.

## Known consumers

These products mirror types from this spec (no direct import):

- `products/amliq/api/decision/src/` — copies `Decision`, `Score`,
  `EngineScore`, `ScoreRequest`/`ScoreResponse` and an audit event shape into
  its local `types.ts`.
- `products/amliq/api/decision/web/src/lib/types.ts` — mirrors a subset for
  the analyst UI fixtures.
- `products/amliq/internal/shared/workers/src/billing/` — references the
  audit-event shape via a local copy.
- `products/sdlc-cc/platform/sdlc-arena/.../score.ts` — has a same-named
  `ScoreRequest` that pre-dates this spec; treat as drift until reconciled.
- `oss/finsavvy-rag/services/*` (Python) — mirrors `Decision` and the
  audit-event field list as pydantic models / dataclasses.

See `docs/quality/CANONICAL_SPEC.md` for the full inventory and drift checks.

## Cross-references

- `@finsavvyai/billing` SPEC uses `ActorId`-style branded ids in its
  entitlement / audit code paths; that package mirrors the branding pattern.
- `@finsavvyai/policy-engine` SPEC defines `Subject` as a policy target (not
  a principal); the `ActorId` brand here is closer to the principal concept.
- `@finsavvyai/ai-gateway` SPEC references `AuditEvent` for its edge audit
  emitter — gateway emits records whose shape MUST satisfy `AuditEventBase`.

## Migration path

If a future round of work carves out `@finsavvyai/shared-types` from the
isolation rule (e.g. types-only packages become importable):

1. Add the carve-out clause to `docs/architecture/ISOLATION_RULES.md`.
2. Replace product-local mirrored types with `import type` from this package
   (one PR per product; types-only imports are tree-shaken).
3. Delete the mirrored copies and update `Known consumers` above to read
   "imports directly" rather than "mirrors from".
4. Add a CI guard so future product code cannot fork a parallel definition.
