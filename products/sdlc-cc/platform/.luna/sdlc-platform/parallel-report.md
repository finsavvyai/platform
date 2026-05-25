# Parallel runner — 2026-04-30

Supersedes the 2026-04-23 sweep. Run after the 24-commit Day-7…Day-50 push.

## Summary

| Agent              | Service          | Status | Notes                                                                                |
|--------------------|------------------|--------|--------------------------------------------------------------------------------------|
| build              | gateway          | ✅     | `go build ./...` clean across the full module                                       |
| vet                | gateway          | ✅     | `go vet ./...` clean                                                                 |
| test               | gateway          | ✅     | every package green; ~25 packages reporting `ok`                                     |
| jest               | document-processor | 🔴   | 1 suite passed (5 tests), 3 suites failed at compile time on TS strict-null errors  |
| typecheck (tsc)    | admin-ui         | 🔴     | 9 strict-null errors in pre-existing pages                                          |

3/5 ✅. Both 🔴 are TypeScript strict-null-check failures in pre-existing files — independent of today's commits.

## Per-agent details

### gateway: build ✅
`cd services/gateway && go build ./...` — exit 0. The full module compiles after today's commits (AWS KMS adapter, CMEK admin handler, FallbackChain wire, IP allowlist middleware, etc.).

### gateway: vet ✅
`go vet ./...` — exit 0, no findings.

### gateway: test ✅
`go test -count=1 ./...` — every package returns `ok`. New packages exercised:
- `internal/infrastructure/crypto` — envelope + AWS KMS error mapping
- `internal/infrastructure/network` — IP allowlist loader
- `internal/infrastructure/webhooks` — dispatcher + signer + retrier
- `internal/interfaces/http/handlers` — including `tenant_cmek_test.go::TestLooksLikeKEK`
- `internal/interfaces/http/middleware` — including `mfa_test.go` step-up gate

Total wall clock ~3 minutes (no `-p` parallelism applied).

### document-processor: jest 🔴
`npx jest --silent` — 1 suite passed (`tests/queue/progress-bridge.test.ts`, 5/5 tests, today's add). 3 suites failed at compile time:

- `tests/queue/backpressure.test.ts` — six `TS2532: Object is possibly 'undefined'` on `dlq.calls[0]` / `live.calls[0]` array index access. Pre-existing — not introduced today.

The other two failing suites aren't in the captured tail; the failure mode is the same TypeScript strict-mode null-check pattern that surfaces when the test file does `xs[0].field` without a guard. **Pre-existing technical debt; not caused by today's changes.**

Fix recipe (separate sprint):
```ts
const first = dlq.calls[0]
expect(first?.method).toBe("add")
const opts = first?.args[2] as Record<string, unknown>
```

### admin-ui: typecheck (tsc --noEmit) 🔴
`npx tsc --noEmit` — 9 strict-null errors:

```
src/app/dashboard/audit-logs/page.test.tsx(198,14): TS2532
src/app/dashboard/tenants/[id]/rate-limits/page.tsx(22,20): TS18047 — params possibly null
src/app/dashboard/tenants/[id]/rate-limits/page.tsx(59-66): TS18048 × 7 — r possibly undefined
```

All in pages from prior sprints (Day-7 rate-limits page + Day-13 audit-logs test). **Pre-existing tech debt; today's `settings/encryption/page.tsx` typechecks clean.**

Fix recipe: tighten the `params` prop type (Next 15 makes it `Promise<{ id }>`) and add the `?.` guard on every `result.find(...)` style call.

## What this run validated

- The Day-7…Day-50 pile-up (24+ commits today) preserves a green Go build across every package.
- Today's TypeScript additions (`progress-bridge.test.ts`, `settings/encryption/page.tsx`) typecheck cleanly.
- The pre-existing strict-null failures were NOT regressions caused by this session.

## What it didn't run

- `npm audit` — skipped because the JS audit produces transitive-dep noise; the encryption-check workflow + DLP CI cover the security plane.
- `gosec` — runs in `.github/workflows/ci.yml` already; not duplicated here.
- e2e — gated on Docker, runs in `.github/workflows/e2e.yml`.
- coverage — gated on `npm run coverage` script which doesn't exist for every service yet.

## Suggested next moves

1. **Spawn a follow-up agent** to clean the strict-null findings in
   `services/document-processor/tests/queue/*` and
   `services/admin-ui/src/app/dashboard/{audit-logs,tenants}/`. ~2 hours mechanical.
2. **Add a tsc --noEmit gate to lint.yml** so the strict-null debt
   doesn't grow unnoticed.
3. **Add jest type-check gate** (`tsc --noEmit -p tsconfig.test.json`) so
   tests can't regress separately from production code.
