<!-- cspell:words tenantiq miniflare scubagear monkey365 cli-microsoft365 workers-sdk vitest-pool-workers MITRE -->

# This-Session Plan — Truth-pass + Safe Schema Lifts

Date: 2026-04-27. Scope: only items I can verifiably finish in one session with no-bluff guardrails.

## In scope (will complete this session)

### A. Phase 0 — CLAUDE.md truth pass

- A1. Fix `tenantiq/CLAUDE.md:181` "80%+ Coverage" → align with portfolio rule (≥90% line / ≥85% branch). **DONE this turn.**
- A2. Fix `tenantiq/CLAUDE.md:185` "use miniflare" claim → accurate description of current state. **DONE this turn.**
- Verify: `grep "miniflare\|80%" tenantiq/CLAUDE.md` returns the corrected line.

### B. cspell hygiene on .luna reports

- B1. `.luna/tenantiq/no-bluf-report.md` — drop "drizzle" duplicate; keep needed words.
- B2. `.luna/tenantiq/drill-report.md` — already updated; verify no diagnostics remain.
- Verify: re-read each file; ensure cspell directive lists every project noun used.

### C. Schema-only Phase 6 lifts

These are **types/env additions** with no behavior change. They open the door for later phases without faking completion of those phases.

- C1. `apps/api/src/lib/cis/control-definitions.ts` — extend `CisControl` type with optional `frameworks?: { nist?: string[]; attack?: string[] }`. **No controls populated.** Comment links to `.luna/tenantiq/leverage/ScubaGear/integration-plan.md`.
- C2. `apps/api/src/lib/graph-client.ts` — read optional `MS_GRAPH_CLOUD` env var. Default `Public`. Map to existing endpoints. If unset, behavior unchanged. No tenants-table column added yet (that's Phase 6 proper).
- Verify: `npx tsc --noEmit -p apps/api/tsconfig.json` clean. Existing tests still pass.

## Out of scope this session (would create bluffs if attempted)

| Phase | Why deferred |
|---|---|
| 1 — Federated SSO | 1.5 weeks of code; needs Okta + Entra IdP test envs; touches auth-critical paths. |
| 2 — YAML config-as-code | New table + UI + scanner integration; 3–5 days. |
| 3 — Close 40–60 CIS gap | Need to clone Monkey365, enumerate checks, port logic with license review. |
| 4 — vitest-pool-workers migration | Risks breaking the existing test suite; needs incremental migration over multiple sessions. |
| 5 — Drift detection | New tables, cron, lib, UI; 5–7 days. |
| 6 (data side) — National-cloud column on `tenants` + MITRE/NIST data | Migrations + data entry; planned in C1/C2 only as type/env hooks. |

The roadmap at `.luna/tenantiq/leverage/adoption-roadmap.md` remains the source of truth for the bigger phases. Each gets its own session with `/gsd:plan-phase` or equivalent.

## No-bluff guardrails for this session

- Every claim "X file changed" → verified with `grep`/`Read` after.
- Every "tests pass" → only after running `npx tsc --noEmit` and reading the output.
- Effort claims kept to "schema-only" or "config-only" where applicable; no claim of feature-complete.
- A separate `/ll-no-bluf` audit at end of session to verify the work.

## Acceptance

- A done — CLAUDE.md grep shows truthful coverage + test setup lines.
- B done — re-read of both .luna reports has no cspell diagnostics flagged.
- C done — `tsc --noEmit` clean for `apps/api`; new `frameworks?` field optional, no existing control rows touched; `MS_GRAPH_CLOUD` env path tested with the default branch (Public).
- A `/ll-no-bluf` rerun on this session's edits returns 0 critical/high.
