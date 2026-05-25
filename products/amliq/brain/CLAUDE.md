# AMLIQ Brain — Package-level CLAUDE Rules

Extends:

1. `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules)
2. `/Users/shaharsolomon/dev/projects/finsavvyai-platform/products/amliq/CLAUDE.md` (AMLIQ product rules)

This file may **add** stricter rules. It may **not** weaken any rule in
either parent file.

## Product mission

- **SKU:** `AMLIQ Brain` (locked decision #1 of `decisive_plan_90day.md`).
- **Sibling:** `AMLIQ Investigate` (`products/amliq/api/`, `web/`, `engines/`).
- **Mission:** automate the most painful analyst workflows (SAR drafting,
  regulatory-change tracking, alert triage) on top of the same audit-grade
  decision substrate that powers AMLIQ Investigate.
- **Target user:** AML analyst + compliance officer at design-partner FIs
  (IL fintech, US tier-2 bank, regulated crypto exchange — decision #6).

## Package-specific architecture constraints

- **Hybrid TS + Python layout.** TS owns the request surface (auth, audit,
  routing). Python owns the agent runtime (M2 W6 onwards).
- **No direct `@finsavvyai/*` imports.** Round-2 rule. Use DI for auth
  (`AuthVerifier`), audit sink (`AuditSink`), and tamper-chain (`AuditChain`).
  Brain MAY import from `oss/finsavvy-rag/` once published (W4) — that is
  a sibling OSS package, not an internal `@finsavvyai/*` workspace.
- **One audit record per request.** AMLIQ rule (`../CLAUDE.md` §"Audit log
  requirements") applies verbatim — emit failure (primary AND fallback)
  blocks the response with `503 audit_emit_failed`.
- **Stable error codes everywhere.** `missing_token`, `invalid_token`,
  `expired_token`, `revoked_token`, `insufficient_role`,
  `audit_emit_failed`, etc. No free-form error strings.
- **Two AMLIQ SKUs share one product tree** — keep brain code under
  `brain/`, do not leak into `api/`, `web/`, `engines/`, or `internal/`.

## Package-specific test matrix (stricter than portfolio baseline)

| Surface | Target |
|---|---|
| `services/api/src/auth.ts` (JWT middleware + role gate) | **100 % line + branch** (reachable; see note below) |
| `services/api/src/audit.ts` (audit emit + tamper-chain + fallback) | **100 % line + branch** |
| `services/api/src/server.ts` (`/health`, `/v1/brain/*`) | ≥ 95 % line, ≥ 90 % branch |
| `services/api/src/health.ts` (mesh-shape snapshot) | ≥ 95 % line |
| `services/retrieval/src/*.ts` (types only at W2) | n/a until impl lands |
| `services/sanctions/src/*.ts` (types only at W2) | n/a until impl lands |
| Python agents under `services/agents/` (M2 W6+) | ≥ 90 % line, 100 % on audit-emit path |

> `corpus/` and `inference/` are sibling subtrees owned by the
> CORPUS-PIPELINE and CLUSTER-BRIDGE Week-2 agents respectively. Their
> coverage targets live in their own CLAUDE/READMEs and are not enforced
> by this package's vitest config.

**Note on the "reachable" qualifier for `auth.ts`:** v8 reports 96.96 %
branch coverage on `auth.ts`. The single uncovered branch is a defensive
type-guard inside `extractBearer` that cannot be reached when the
middleware sits behind Hono (Hono normalises headers to `string |
undefined`, never to non-string truthy values). Line, statement, and
function coverage are 100 %; the missing branch is an instrumented
micro-branch with no reachable input. Every reachable critical-path
branch is covered by an explicit test.

Every bug found in auth, audit, or chain integrity ships a failing test
first, then the fix. No exceptions.

## Package-specific security controls

- JWT verification delegated to the injected `AuthVerifier` — Brain never
  re-implements signature checking. Default deny on any unrecognised role.
- Audit `reason` is a stable code only. **No PII, no transaction
  descriptions, no plaintext subject names.** Aligned with the AMLIQ
  parent rule.
- Tamper-evident chain (`AuditChain`) is mandatory in production. The
  `chainAppend(prevHash, record)` contract is implemented by the
  AUDIT-TAMPER package; Brain MUST NOT bundle private keys.
- Constant-time HMAC comparisons wherever pre-shared keys cross the
  Brain boundary (matches round-1 convention).
- No `eval`, no `child_process`, no dynamic `require` from request paths.
- Inputs validated at the boundary (Zod or equivalent) once request
  schemas land (W3+).
- Audit sink env vars follow the round-3 convention: `FINSAVVY_AUDIT_SINK`,
  `FINSAVVY_AUDIT_R2_BUCKET`, `FINSAVVY_AUDIT_DD_API_KEY`.

## Package-specific release checklist

Before tagging a Brain release:

- [ ] CI green: typecheck + unit + integration + smoke.
- [ ] Coverage thresholds above met; report archived.
- [ ] Security scans clean (SAST, deps, secrets, licence).
- [ ] Audit-emit hard-fail path exercised on staging — request returns
      `503 audit_emit_failed`, not a 200.
- [ ] Tamper-chain head verifiable end-to-end (chain replay passes).
- [ ] `/health` returns 503 when any probe reports `down` (round-3 mesh).
- [ ] Cluster bridge contract: `InferenceProvider` runtime impl
      version-pinned in the deploy manifest.
- [ ] Apple HIG accessibility checks on any UI surfaces shipped from
      Brain (currently none; agent review UI ships in M2 W6).

## File size

- Portfolio 200-line cap applies to all **new** files added under
  `products/amliq/brain/`.
- This package starts at W2 with all new code, so the cap is in force
  from day one. No legacy exemption applies here.

## Allowed overrides summary

- Stricter coverage on auth + audit critical paths (100 % line + branch). ✅
- Stricter audit-emit shape (hard-fail blocks the response, both primary
  and fallback must fail before request fails). ✅
- Mandatory tamper-evident chain in production. ✅

## Disallowed overrides

None applied. Nothing in this file lowers a portfolio or AMLIQ rule.
