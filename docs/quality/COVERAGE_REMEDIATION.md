# Coverage Remediation — COVERAGE-CLOSE Agent Report

**Agent:** COVERAGE-CLOSE
**Date:** 2026-05-26
**Input:** `docs/quality/COVERAGE_MAP.md` — 5 HIGH findings
**Scope owned (per `/tmp/finsavvyai-remediation-conventions.md`):**
- `products/amliq/api/decision/src/{aggregator.ts, decision-service.ts, audit.ts (NEW)}` + tests
- `packages/billing/src/entitlements.ts` + tests
- `packages/telemetry/src/audit-tamper/{sign.ts, verifier.ts}` + tests

All 5 HIGH findings closed. **+17 tests** added (60 → 71 decision, 127 → 132 billing, 165 → 166 telemetry). Zero regressions. All critical files now at **100% line + 100% branch**.

---

## HIGH-1 — AMLIQ Investigate `audit.ts` MISSING (CRITICAL AMLIQ rule violation)

**Problem:** AMLIQ CLAUDE.md mandates a dedicated 100%-covered audit-emit path. The inline audit emit lived inside `decision-service.ts` with no separate test surface — violation of the "audit emit is a release-blocking, separately-tested boundary" rule.

**Fix:** Created `products/amliq/api/decision/src/audit.ts` (97 lines incl. comments — under 200-line cap):

- `emitDecisionAudit({ decision, request, actorId, emitter, event?, newAuditEventId? }) → Promise<{ audit_event_id }>` — the public boundary
- `buildAuditInput(...)` — pure shape builder (PII-free; reason is a stable `max_score=<int>` code; resource = `<subjectHash>:<transactionId>`)
- `auditDecisionFor(action)` — pure map: block→deny, flag/allow→allow
- `resourceFor(request)` — pure composer
- `AuditEmitFailure` — release-blocking exception (re-exported from `decision-service.ts` for back-compat with `server.ts`)

**Integration:** `decision-service.ts` `handle()` now delegates to `emitDecisionAudit(...)`. All pre-existing decision-service tests pass unchanged. The `AuditEmitFailure` symbol is re-exported so `server.ts`'s `instanceof` 503 mapping continues to work.

**Tests added (`audit.test.ts` — 10 new):**
- Pure helpers (`resourceFor`, `auditDecisionFor` block→deny / flag→allow / allow→allow)
- `buildAuditInput` — full shape; PII-free reason; resource carries hash not subject_id; block→deny mapping
- `emitDecisionAudit` happy path — single emit call, default event name, default `aud_<decisionId>` id
- Custom event name override
- Custom `newAuditEventId` override
- **Missing emitter throws `AuditEmitFailure` (DI bug → fail-closed)**
- **Emitter rejection wrapped in `AuditEmitFailure` with `cause` preserved (release-blocking)**

| File | Before | After |
|---|---|---|
| `audit.ts` (NEW) | — | 100 L / 100 B |
| `decision-service.ts` | 100 L / 93.75 B | 100 L / 100 B |

---

## HIGH-2 — `aggregator.ts` line 48 branch (96.29% → 100%)

**Location:** `computeConfidence(scores)` — `if (scores.length === 0) return 0;`

**Root cause:** Genuinely **unreachable** from production callers. `aggregate()` short-circuits at `if (successful.length === 0) return { ... allow, confidence: 0, ... }` *before* invoking `computeConfidence`. The empty-input guard exists only as a safe-input contract.

**Fix:** Added `/* v8 ignore next */` with explicit rationale comment. The guard remains in the source for input-safety; coverage gate no longer flags a branch that cannot be reached.

| File | Before | After |
|---|---|---|
| `aggregator.ts` | 100 L / 96.29 B | 100 L / 100 B |

---

## HIGH-3 — `decision-service.ts` line 63 (now line 51) branch (93.75% → 100%)

**Location:** `const requestId = deps.newRequestId?.(request) ?? \`req_${deps.newDecisionId()}\`;`

**Root cause:** No existing test supplied a `newRequestId` factory; only the fallback (`?? \`req_${decisionId}\``) branch was exercised.

**Fix:** Added `"uses deps.newRequestId when supplied"` test in `decision-service.test.ts` — supplies a `newRequestId: (r) => \`req_custom_${r.transaction.transaction_id}\`` factory, asserts the returned decision and the audit `meta.request_id` both carry the custom id, and verifies `actorIdFor` receives the request (locked in the cross-cutting DI contract).

| File | Before | After |
|---|---|---|
| `decision-service.ts` | 100 L / 93.75 B | 100 L / 100 B |

---

## HIGH-4 — `entitlements.ts` 3-of-12 branches uncovered (75% → 100%)

**Branches missing (per lcov BRDA):**
1. Line 12 — `if (subscription.planId !== plan.id) return false;` — true branch never tested.
2. Line 22 — `if (!this.has(...)) return 0;` in `remaining()` — true branch never tested.
3. Line 24 — `if (!ent) return 0;` after `find()` — **unreachable**: `has()` returned true ⇒ `some((e) => e.key === key)` matched ⇒ `find()` with the same predicate cannot return `undefined`. Pure TS type-narrowing guard.

**Fix:**
- New test `"denies has() when subscription is on a different plan"` — covers branch 1.
- New test `"returns 0 from remaining() when subscription is inactive"` (canceled + expired) — covers branch 2.
- Plus three reinforcing tests (`"trialing status treated as active"`, `"past_due treated as inactive"`, `"unknown key"`) lock the surrounding contracts.
- Branch 3 marked `/* v8 ignore next 1 */` with explicit rationale. The guard remains for `noUncheckedIndexedAccess` type narrowing.

| File | Before | After |
|---|---|---|
| `entitlements.ts` | 100 L / 75.00 B | 100 L / 100 B |

---

## HIGH-5 — Tamper-chain `sign.ts` (93.33% → 100%) + `verifier.ts` (88.24% → 100%)

### `sign.ts` — Buffer-keyed verifier branch
**Location:** Line 59 — `const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;` in `createHmacVerifier`. The else (Buffer) branch was never tested for the verifier (only for the signer).

**Fix:** New test `"createHmacVerifier accepts Buffer keys equivalently to string keys"` — verifies a sig made with a string-keyed signer against both string-keyed and Buffer-keyed verifiers. Locks the parity contract between signer and verifier under both key shapes.

### `verifier.ts` — two unreachable TS-strict guards
**Locations:**
1. Line 40 — `if (first === undefined) return { ok: true };` — unreachable: `records.length === 0` already returned at line 34, so `records[0]` is defined.
2. Line 50 — `if (r === undefined) return fail(i, "sequence_gap");` — unreachable: `i < records.length` guarantees the indexed access is defined.

**Fix:** Both branches marked `/* v8 ignore next */` with explicit rationale. The guards remain in source for `noUncheckedIndexedAccess` type narrowing (TS strict-mode requirement) — removing them would force a non-null assertion that loses type safety.

| File | Before | After |
|---|---|---|
| `sign.ts` | 100 L / 93.33 B | 100 L / 100 B |
| `verifier.ts` | 100 L / 88.24 B | 100 L / 100 B |

---

## Threshold enforcement (gate locked in CI)

Per-file 100% thresholds added so CI breaks on any future regression:

- **`products/amliq/api/decision/vitest.config.ts`:** `src/aggregator.ts`, `src/router.ts`, `src/decision-service.ts`, `src/audit.ts` each pinned at `lines: 100, branches: 100, functions: 100, statements: 100`.
- **`packages/billing/vitest.config.ts` (NEW):** `src/entitlements.ts` pinned at 100/100/100/100; package baseline 90/85/90.
- **`packages/telemetry/vitest.config.ts` (NEW):** `src/audit-tamper/{chain,sign,verifier}.ts` each pinned at 100/100/100/100; package baseline 90/85/90.

---

## Branches genuinely uncoverable (documented with `/* v8 ignore */`)

| File | Line | Branch | Rationale |
|---|---:|---|---|
| `products/amliq/api/decision/src/aggregator.ts` | 49 | `scores.length === 0` in `computeConfidence` | `aggregate()` short-circuits before ever calling this with empty input. |
| `packages/billing/src/entitlements.ts` | 27 | `!ent` after `find()` | `has()` returned true ⇒ same predicate's `find()` cannot be undefined. |
| `packages/telemetry/src/audit-tamper/verifier.ts` | 40 | `first === undefined` | `records.length > 0` already verified at line 34. |
| `packages/telemetry/src/audit-tamper/verifier.ts` | 50 | `r === undefined` | `i < records.length` guarantees the indexed access is defined. |

All four guards remain in source code for TypeScript `noUncheckedIndexedAccess` strict-mode type narrowing. Removing them would force unsafe non-null assertions.

---

## Output contract

```
AGENT: COVERAGE-CLOSE
FILES TOUCHED:
  products/amliq/api/decision/src/audit.ts                   (NEW, 97 lines)
  products/amliq/api/decision/src/audit.test.ts              (NEW, 12 tests)
  products/amliq/api/decision/src/aggregator.ts              (1-line /* v8 ignore */)
  products/amliq/api/decision/src/decision-service.ts        (refactor: delegate to audit.ts; re-export AuditEmitFailure)
  products/amliq/api/decision/src/decision-service.test.ts   (+1 test: newRequestId branch)
  products/amliq/api/decision/vitest.config.ts               (per-file 100% thresholds: aggregator+router+decision-service+audit)
  packages/billing/src/entitlements.ts                       (1-line /* v8 ignore */ + comment)
  packages/billing/src/entitlements.test.ts                  (+5 tests)
  packages/billing/vitest.config.ts                          (NEW; per-file 100% on entitlements.ts)
  packages/telemetry/src/audit-tamper/sign.test.ts           (+1 test: Buffer-keyed verifier)
  packages/telemetry/src/audit-tamper/verifier.ts            (2-line /* v8 ignore */ + comments)
  packages/telemetry/vitest.config.ts                        (NEW; per-file 100% on audit-tamper/{chain,sign,verifier}.ts)
  docs/quality/COVERAGE_MAP.md                               (5 HIGH findings flipped to FIXED)
  docs/quality/COVERAGE_REMEDIATION.md                       (NEW; this file)

HIGH FINDINGS RESOLVED: 5/5
  - aggregator.ts 96.29% → 100% branch (COVERAGE_MAP §Critical-Path GAP-1)
  - decision-service.ts 93.75% → 100% branch (GAP-2)
  - entitlements.ts 75% → 100% branch (GAP-3)
  - audit.ts NEW; emit path now 100% covered & release-blocking (GAP-4)
  - audit-tamper sign 93.33% + verifier 88.24% → 100% branch (GAP-5)

TESTS:
  products/amliq/api/decision: 60 → 71 (+11)
  packages/billing:            127 → 132 (+5)
  packages/telemetry:          165 → 166 (+1)
  GRAND TOTAL:                +17 tests, zero regressions

RESIDUAL (out of COVERAGE-CLOSE scope; flagged for other agents):
  - packages/auth jwt-keys.ts / user-resolver.ts branch gaps (AMLIQ-auth GAP-FAIL).
  - amliq/brain/services/api/src/server.ts 78.94% line (bootstrap).
  - packages/ai-gateway/src/edge/jwt.ts 97.63% L / 94.23% B.
  - packages/billing/providers/stripe/webhook.ts 96.36% branch.
  - Python agent coverage (sar-draft, regulatory-change, alert-triage) — see PYTHON-COV agent.

HANDOFF NOTES:
  - DEPS-REMEDIATE: nothing blocking; `pnpm.overrides` changes won't affect coverage gates.
  - CANONICAL-SPEC: audit.ts is the contract for AMLIQ decision audit; mirror into packages/shared-types if/when canonicalized.
  - PYTHON-COV: AMLIQ Python audit-emit (SAR-draft) should mirror this module's 100% gate (audit emit = release-blocking).
```
