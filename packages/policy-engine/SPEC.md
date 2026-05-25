# SPEC — @finsavvyai/policy-engine

## Contract overview

This package is the canonical contract for authorization policies and
PR-check rules across the FinsavvyAI portfolio. It carries two layers:
(1) a legacy PR-check engine (`RuleEngine`, `FileSizeRule`, `SecretScanRule`)
inherited from PipeWarden, and (2) a small ABAC-style authorization
evaluator (`evaluatePolicy`, `combine`) with a deterministic
first-matching-statement-wins algorithm and safe-default-deny. Because
`products/*` cannot import `@finsavvyai/*` at runtime (round-2 isolation),
products mirror these shapes locally; this spec is the source of truth.

## Public surface

From `src/types.ts` (legacy PR-check layer):

- `Severity` — `"info" | "low" | "medium" | "high" | "critical"`.
- `PolicyContext` — `{ repo, ref, actor, files, metadata }`.
- `PolicyViolation` — `{ ruleId, severity, message, file? }`.
- `LegacyDecision` — `"allow" | "warn" | "deny"`.
- `PolicyResult` — `{ decision, violations }`.
- `PolicyRule` interface (`id`, `severity`, `evaluate(ctx)`).
- `PolicyEngine` interface (`evaluate(ctx) -> PolicyResult`).

From `src/types.ts` (authorization layer):

- `Effect` — `"ALLOW" | "DENY"`.
- `Subject` — `{ id, roles, attributes }` (POLICY TARGET, not principal).
- `Resource` — `{ type, id, attributes }`.
- `Action` — string.
- `EvaluationContext` — `{ branch?, protectedBranches?, filePaths?,
  riskScore?, reviewers?, attributes? }`.
- Rule DSL: `FilePathMatchesRule`, `BranchProtectedRule`,
  `RiskScoreAboveRule`, `RequiresReviewFromRule`; union `Rule`.
- `PolicyStatement` — `{ id, effect, actions, resourceTypes, rules }`.
- `Policy` — `{ id, version, statements }`.
- `Decision` — `{ effect, policyId, statementId?, reason }`.
- `PolicyError` — Error with stable `code`.

From `src/engine.ts`:

- `RuleEngine` class — legacy PR-check engine.
- `evaluatePolicy(policy, subject, resource, action, ctx) -> Decision`.
- `combine(decisions[]) -> Decision`.
- `PolicyEngine` type re-export (legacy shape alias).

From `src/rules.ts`:

- `FileSizeRule` — id `portfolio/file-size-200`, severity `high`.
- `SecretScanRule` — id `portfolio/no-secrets`, severity `critical`.

From `src/rulePredicates.ts`:

- `evaluateRule(rule, ctx) -> boolean`.
- `validateRule(rule) -> void` (throws `PolicyError` on malformed rule).

## Stable error codes

Carried on `PolicyError.code`:

- `policy.malformed` — top-level policy is not an object.
- `policy.missing_id` — policy id missing or empty.
- `policy.missing_version` — policy version missing or empty.
- `policy.statements_invalid` — `statements` is not an array.
- `policy.statement.invalid_effect` — effect is neither `ALLOW` nor `DENY`.
- `policy.statement.invalid_shape` — missing `actions[]` / `resourceTypes[]`.
- `policy.statement.invalid_rules` — `rules` is not an array.
- (additional codes from `validateRule` for malformed rule entries).

## Decision matrix (legacy PR-check)

| Severity         | Decision |
|------------------|----------|
| info, low        | allow    |
| medium           | warn     |
| high, critical   | deny     |

## Invariants

1. **Safe default deny.** `evaluatePolicy` returns `DENY` when no statement
   matches. Consumers MUST NOT default to allow on `undefined`.
2. **First-matching-statement wins.** Statement order in `Policy.statements`
   is authoritative. Reordering statements is a behavior change.
3. **`combine` is DENY-trumps-ALLOW.** Empty input returns DENY.
4. **`Decision.reason` is a stable string** — used in audit traces. Do not
   inline user-facing copy here; localize at the UI layer.
5. **`validateRule` runs before evaluation.** Malformed rules throw
   `PolicyError`; the evaluator never silently skips a malformed rule.
6. **Severity escalation is monotonic.** `worstDecision` cannot downgrade
   `deny` to `warn`.
7. **`Subject` here is a POLICY TARGET**, not an authenticated principal.
   Principals come from `@finsavvyai/auth`; do not conflate.

## Test coverage gates

- `engine.ts` `evaluatePolicy`, `combine`, `RuleEngine.evaluate`: **100%**
  lines / branches / functions. Policy decisions are a critical path.
- `rulePredicates.ts` `evaluateRule`, `validateRule`: **100%**.
- `rules.ts` `FileSizeRule`, `SecretScanRule`: ≥90% lines, ≥85% branches.

## Versioning policy

- Semver.
- Breaking changes: renaming or removing an error code, changing the
  decision algorithm (statement order, combiner precedence), narrowing
  `Effect`, removing a `Rule` DSL variant, changing `Severity` → `Decision`
  mapping.
- All breaking changes require:
  - major bump,
  - addendum in this file's `## Changelog`,
  - PRs against each known consumer to update mirrors.
- Adding a new `Rule` DSL variant, a new `PolicyRule` implementation, or a
  new error code is a minor bump.

## Known consumers

These code paths mirror types or rule shapes from this spec (no direct
import):

- `products/amliq/api/decision/` — has its own decision flow that copies
  the `Effect` / `Decision` concept (semantically distinct: AML decision is
  `clear|review|block`, policy decision is `ALLOW|DENY`).
- `products/queryflux/sdlc-ai/services/admin-ui/.../policy.service.ts`,
  `.../policy-management.service.ts` — QueryFlux's admin UI re-implements
  the `Policy` / `PolicyStatement` shape and DSL for visual editing.
- `products/queryflux/sdlc-ai/services/admin-ui/.../rego-editor.tsx`,
  `.../visual-policy-builder.tsx` — UI surfaces that bind to a copy of the
  Rule DSL; drift candidates given those files are >1000 LOC.
- `products/sdlc-cc/platform/implementations/ddd-bounded-contexts/` —
  references authorization policy shapes in DDD context docs.

See `docs/quality/CANONICAL_SPEC.md` for the full inventory and drift checks.

## Cross-references

- `@finsavvyai/shared-types` SPEC defines `ActorId` — the principal-level id
  that maps to `Subject.id` here when policy is evaluated for a user.
- `@finsavvyai/auth` is the canonical home for principal / claims; this
  package's `Subject` is intentionally a policy target, not a principal.
- `@finsavvyai/ai-gateway` SPEC references `RoutePolicy` (a different policy
  concept — provider routing constraints). Do not conflate with `Policy`.

## Migration path

If a future round carves out `@finsavvyai/policy-engine` from the isolation
rule:

1. Add the carve-out clause to `docs/architecture/ISOLATION_RULES.md`,
   scoped to types + pure evaluator (no rule loading from disk).
2. Replace product-local `Policy` / `PolicyStatement` mirrors with
   `import type` from this package; QueryFlux admin UI is the largest
   surface and should land last.
3. Keep product-specific `PolicyRule` implementations in the product (they
   close over product context). The DSL shapes (`Rule` union) move to this
   package as the single source.
4. Add a CI guard that forbids product-local re-declarations of
   `evaluatePolicy` / `combine`.
