# CANONICAL_SPEC

Founder decision (2026-05-26 quality review, option C): four canonical
packages with zero monorepo consumers — `@finsavvyai/shared-types`,
`@finsavvyai/billing`, `@finsavvyai/policy-engine`,
`@finsavvyai/ai-gateway` — are KEPT and reframed as **spec packages**
(canonical contract + reference implementation). They are not archived,
and they remain unimported by `products/*` per the round-2 isolation rule.
Products mirror types and error codes from these packages; drift is
reviewed against the spec.

## Why the isolation rule forces this pattern

Round-2 isolation: `products/*` MUST NOT import from `@finsavvyai/*` at
runtime. Each product is a self-contained deployable artefact; cross-tree
runtime coupling reintroduces the "platform repo" failure mode the
isolation rule was added to prevent. Consequence: shared *contracts* still
need a single source of truth even when shared *code* cannot cross the
boundary. The spec-package pattern resolves the tension by treating these
four packages as the **specification**, with mirrored copies in products
as the **deployment artefacts**.

## Summary table

| Spec package | Consumers (mirror, not import) | Spec coverage |
|---|---|---|
| `@finsavvyai/shared-types` | `products/amliq/api/decision/{src,web}/`, `products/amliq/internal/shared/workers/src/billing/`, `products/sdlc-cc/platform/sdlc-arena/.../score.ts`, `oss/finsavvy-rag/services/*` (Python pydantic mirrors) | `aml.ts`, `audit.ts`, `ids.ts` — 100% for predicates and brand constructors |
| `@finsavvyai/billing` | `products/amliq/internal/shared/workers/src/billing/` (+ tests), `products/queryflux/sdlc-ai/services/admin-ui/.../policy.service.ts` (parallel codes) | Critical paths 100%: webhook verifiers, money math, invoice totals, entitlements, idempotency enforcement |
| `@finsavvyai/policy-engine` | `products/queryflux/sdlc-ai/services/admin-ui/.../policy.service.ts`, `.../policy-management.service.ts`, `.../rego-editor.tsx`, `.../visual-policy-builder.tsx`, `products/sdlc-cc/platform/implementations/ddd-bounded-contexts/` | `evaluatePolicy`, `combine`, `RuleEngine`, `evaluateRule`, `validateRule` — 100% |
| `@finsavvyai/ai-gateway` | `products/amliq/brain/services/api/src/` (AuthClaims, Audit* mirrors), `products/amliq/api/decision/src/server.ts` (AuthClaims), `products/amliq/brain/services/api/src/rate-limit/` (M3) | Round-1: 100%. Edge layer: 99.5% lines / 96.8% branches / 100% functions. 178 tests |

## The "spec package" pattern

A spec package is:

1. **A typed contract.** Public exports define wire shapes, error codes,
   and invariants. The `SPEC.md` is the authoritative description.
2. **A reference implementation.** Real code that compiles, runs, and is
   tested. Products may copy this implementation verbatim or adapt it.
3. **Unimported by products at runtime.** No `@finsavvyai/*` runtime
   imports from `products/*` (round-2 rule). Test files in this repo and
   non-product packages (`packages/*`, `oss/*` where allowed) may import
   freely.
4. **The drift baseline.** Any product-local divergence from the spec is
   reviewed in PR. The spec wins unless a product opens an explicit ADR
   to fork.

What it is NOT:

- Not a runtime dependency. Do not add it to a product's
  `dependencies` / `devDependencies` for the purpose of consumption — the
  isolation rule forbids it.
- Not a documentation-only package. The code must work; the tests must
  pass; coverage gates apply.
- Not frozen. Spec packages evolve (semver). When the spec moves, the
  mirrors in products must follow (per-package known-consumer list above).

## Using this in code review

When a PR touches a product file that contains a mirrored type or error
code, the reviewer must answer:

1. **Did the spec change?** Diff the affected mirror against the spec's
   `SPEC.md` "Public surface" and "Stable error codes" sections.
2. **If the spec changed**, is the PR the per-product follow-up landing
   the mirror update? If so, link the spec's PR/commit.
3. **If the spec did NOT change**, does the PR drift from the spec? If
   yes:
   - require an inline `// MIRROR: <spec>` comment with a deviation
     reason, OR
   - reject the drift and align with the spec, OR
   - open an ADR to formally fork the mirror.
4. **Either way**, ensure the mirror's error-code strings still match
   the spec's stable codes. Switching on `code` is the contract;
   silently renaming a code breaks downstream consumers.

PR checklist (paste into PR template):

```
[ ] If this PR touches a mirrored type/code, I confirmed alignment with
    the spec package SPEC.md.
[ ] If this PR introduces drift, I added a MIRROR comment with rationale
    or opened an ADR.
[ ] Stable error codes (billing.*, policy.*, AI_GATEWAY_*) are unchanged.
```

## Optional future tooling

A drift-detection CI job would close the manual-review gap. Sketch:

- Step 1: enumerate exports from each spec package's `src/index.ts` and
  collect `(symbol, file, structural shape)` triples.
- Step 2: walk each known consumer (paths listed in `Known consumers`
  per `SPEC.md`) and parse same-named symbols' structural shape.
- Step 3: diff shapes; report mismatches as warnings. Fail on
  error-code-string mismatches (those are part of the contract).
- Step 4: write a `docs/quality/SPEC_DRIFT.md` report each CI run, mirror
  of `DEAD_CODE_SCAN.md` cadence.

Implementation note: `ts-morph` or the TypeScript compiler API can extract
type shapes; for error codes a simple regex on the constant string
literals in each `errors.ts` is sufficient. This is not implemented today;
the `DEAD_CODE_SCAN.md` recommendation to add `ts-prune`/`knip` is a
prerequisite step in the same tooling layer.

## Cross-references

- `docs/quality/DEAD_CODE_SCAN.md` §5 — original recommendation that
  surfaced the "0 consumers" finding and asked the founder to decide.
- `docs/quality/DEPS_AUDIT.md` — these packages' devDeps surface; spec
  status does not change the dependency hygiene gates.
- `docs/quality/COVERAGE_MAP.md` — coverage gates referenced from each
  `SPEC.md` are enforced by the same CI matrix as products.

## Maintenance contract

- Owner: platform-shared (founder + on-call platform engineer).
- Cadence: spec packages reviewed alongside each milestone audit.
- Change protocol: spec changes land first in the spec package, then in a
  per-consumer follow-up PR set. The first PR's description must list
  every consumer touched.
- Versioning: semver, see each `SPEC.md` "Versioning policy" section.
- Deprecation: removing a spec package requires (a) an ADR, (b) removing
  it from this table, and (c) confirming no mirrored consumer relies on
  its error-code strings.
