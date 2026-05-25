# Coverage Map — Cross-Codebase

**Agent:** TEST-COVERAGE-MAP  
**Date:** 2026-05-25  
**Scope:** canonical workspace (`packages/*`, `infrastructure/observability`, `infrastructure/synthetics`), AMLIQ Brain TS subtrees, AMLIQ Decision API. Python agents inspected but tests not executed (M3 adjacent, per swarm rules). QueryFlux skipped (mixed jest/vitest, out of canonical scope).  
**Gate:** portfolio = ≥90% lines / ≥85% branches / ≥90% functions. **AMLIQ Investigate critical paths = 100% line + branch** (`products/amliq/CLAUDE.md` §Test matrix). **Brain auth.ts/audit.ts = 100% line + branch** with documented unreachable-branch exception on `auth.ts` (`products/amliq/brain/CLAUDE.md`).

## Summary Table (per package)

| Package | Tests | Lines % | Branch % | Funcs % | Gate (L/B/F) | Status |
|---|---:|---:|---:|---:|---|---|
| packages/auth | 116 (109+7 todo) | 99.77 | 97.11 | 100.00 | 90/85/90 | PASS |
| packages/billing | 127 | 100.00 | 97.90 | 100.00 | 90/85/90 | PASS |
| packages/telemetry | 165 | 99.70 | 96.84 | 100.00 | 90/85/90 | PASS |
| packages/ai-gateway | 179 | 99.70 | 98.10 | 100.00 | 90/85/90 | PASS |
| packages/policy-engine | 36 | 100.00 | 98.00 | 100.00 | 90/85/90 | PASS |
| packages/shared-types | 33 | 100.00 | 100.00 | 100.00 | 90/85/90 | PASS |
| infrastructure/observability | 51 | 100.00 | 98.77 | 93.94 | 90/85/90 | PASS |
| infrastructure/synthetics | 11 | n/a (no coverage cfg) | n/a | n/a | n/a | tests-pass-only |
| products/amliq/api/decision | 60 | 100.00 | 92.86 | 100.00 | 90/85/90 + **100 L+B on critical paths** | **FAIL (critical)** |
| amliq/brain (root: api/services) | 237 | 98.19 | 99.39 | 95.77 | 90/85/90 | PASS (server.ts soft miss) |
| amliq/brain/web | 22 | 100.00 | 97.22 | 100.00 | 90/85/90 | PASS |
| amliq/brain/corpus | 28 | 100.00 | 96.96 | 100.00 | 90/85/90 | PASS |
| amliq/brain/inference | 35 | 100.00 | 95.28 | 100.00 | 90/85/90 | PASS |
| amliq/brain/services/connectors (stale snapshot 23:39) | n/a | 100.00 | 93.67 | 100.00 | 90/85/90 | PASS (also covered via brain root) |
| amliq/brain/services/agents/{sar-draft,reg-change,alert-triage} (Python) | not run (M3-adjacent) | unknown | unknown | unknown | 90/100-on-audit-emit | **GAP — not measured this cycle** |

**Grand-total TS tests passing:** **1,089** across 12 measured packages (+11 synthetics = 1,100). Python agent suites enumerated (14 test files across 3 agents) but skipped this cycle.

## Critical-Path 100%-Gate Compliance (AMLIQ + Portfolio)

| Critical Path | File | Line % | Branch % | Gate | Verdict |
|---|---|---:|---:|---|---|
| AMLIQ Investigate decision aggregator | `products/amliq/api/decision/src/aggregator.ts` | 100.00 | **96.29** | 100/100 | **FAIL** (line 48 branch) |
| AMLIQ Investigate routing | `products/amliq/api/decision/src/router.ts` | 100.00 | 100.00 | 100/100 | PASS |
| AMLIQ Investigate decision blend | `products/amliq/api/decision/src/decision-service.ts` | 100.00 | **93.75** | 100/100 | **FAIL** (line 63) |
| AMLIQ Investigate engine adapter | `products/amliq/api/decision/src/engine-client.ts` | 100.00 | **90.47** | ≥95 line / ≥90 branch (per AMLIQ rule "engine adapters ≥95 line") | PASS line; branch acceptable but flag |
| AMLIQ Investigate audit emit path | (decision/api emits via aggregator; no dedicated audit.ts file) | — | — | 100/100 | **MISSING** (not implemented as a separated file with dedicated 100% gate) |
| AMLIQ Investigate auth middleware | (decision/api uses `@finsavvyai/auth` via DI — `packages/auth`) | 99.77 | 97.11 | 100/100 (AMLIQ rule) | **FAIL** (jwt-keys.ts L=95.12% B=87.50%, user-resolver.ts B=77.78%) |
| Brain auth (JWT + role gate) | `products/amliq/brain/services/api/src/auth.ts` | 100.00 | 96.96 | 100/100, docs accept unreachable defensive guard | PASS (per brain/CLAUDE.md exception) |
| Brain audit emit + tamper-chain | `products/amliq/brain/services/api/src/audit.ts` | 100.00 | 100.00 | 100/100 | PASS |
| Brain server `/health` `/v1/brain/*` | `products/amliq/brain/services/api/src/server.ts` | **78.94** | 95.83 | ≥95 line / ≥90 branch | **FAIL** (line ≥95 missed; uncovered 49-76) |
| Audit tamper-chain (telemetry) | `packages/telemetry/src/audit-tamper/chain.ts` | 100.00 | 100.00 | 100/100 (security control) | PASS |
| Audit tamper sign | `packages/telemetry/src/audit-tamper/sign.ts` | 100.00 | 93.33 | 100/100 (security control) | **FAIL** (branch) |
| Audit tamper verifier | `packages/telemetry/src/audit-tamper/verifier.ts` | 100.00 | 88.24 | 100/100 (security control) | **FAIL** (branch) |
| Billing webhook (Stripe) | `packages/billing/providers/stripe/webhook.ts` | 100.00 | 96.36 | 100/100 (payments) | **FAIL** (branch) |
| Billing webhook (LemonSqueezy) | `packages/billing/providers/lemonsqueezy/webhook.ts` | 100.00 | 100.00 | 100/100 (payments) | PASS |
| Billing charge orchestration | `packages/billing/src/orchestration/charge.ts` | 100.00 | 100.00 | 100/100 (payments) | PASS |
| Billing entitlements resolver | `packages/billing/src/entitlements.ts` | 100.00 | **75.00** | 100/100 (entitlements = permissions) | **FAIL** (branch) |
| AI-Gateway edge JWT | `packages/ai-gateway/src/edge/jwt.ts` | 97.63 | 94.23 | 100/100 (auth) | **FAIL** |
| Brain rate-limit (M3-owned, stable snapshot) | `services/api/src/rate-limit/*.ts` | 100.00 | 100.00 | 100/100 (security) | PASS |

## Below-Baseline Packages

**None below the 90/85/90 portfolio baseline.** Every measured package is above gate. All failures above are against the **stricter critical-path 100%** clause, not the portfolio floor.

**Soft misses against tighter product gates** (drag files):
- `amliq/brain/services/api/src/server.ts` — 78.94% lines drags brain-root to 98.19% (still ≥90, but misses brain's own `server.ts ≥95% line` target). Uncovered: bootstrap lines 49–76 (likely entrypoint).
- `infrastructure/observability/src/sinks/factory.ts` — function coverage 50% (one of two factory functions never exercised).

## Untested Files (no test pair, no transitive test reference)

- `packages/ai-gateway/src/worker.ts` — Cloudflare worker entrypoint, no `.test.ts` and no transitive coverage import. Likely intentional (entrypoints often excluded), but no `index.ts`/exclude entry confirms it. Confirms [[DEAD-CODE]] candidate.
- `products/amliq/brain/services/connectors/src/teams/teams-internal.ts` — no dedicated test file; coverage attributed via parent connector tests (84.84% branch in stale snapshot).
- Python agents: no coverage measured this cycle for `sar-draft`, `regulatory-change`, `alert-triage`. **All three carry critical-path obligations** (SAR drafting + regulatory-change classification + audit emit). Test files exist (14 total) but not executed by this agent.

## Test-Suite Health

- **1,089 TS tests passing** across canonical + brain + decision (zero failures observed; 7 todos in `packages/auth`).
- 11 additional synthetics probes passing.
- Coverage data freshness: most lcov reports from 2026-05-25 (today); `packages/auth/coverage` is from 2026-05-24 23:26 — should be regenerated to capture latest auth changes.
- Brain root coverage executed fresh (this run) — confirms jira/teams connector tests pass under brain root config.

## Cross-References

- [[DEAD-CODE]] — `packages/ai-gateway/src/worker.ts` is untested AND a likely orphan entrypoint. Confirm worker is wired into deploy; if not, delete (0% coverage by definition).
- [[DEPS-AUDIT]] — Python agents (`sar-draft`/`reg-change`/`alert-triage`) have **unmeasured coverage** this cycle. Any dep bump in those packages cannot be auto-merged safely until coverage runs in CI.
- [[A11Y-AUDIT]] — `websites/finsavvyai.com` has the Astro coverage exception (`test: exit 0`); a11y audit must substitute for coverage on the marketing surface.
- [[PERF-BENCHMARKS]] — hot paths recommended for benching: `aggregator.ts` (decision blend, 100% line / 96.29% branch — tested, ready to bench), `services/api/src/rate-limit/sliding-window.ts` (100/100, ready), `services/connectors/src/_lib.ts` (100/95.65, ready), `packages/ai-gateway/src/edge/handler.ts` (100/97.50, ready).

## Recommendations by Owner

### founder (release-blocking)
- **GAP-1 (CRITICAL):** `amliq/api/decision/src/aggregator.ts` is 96.29% branch but AMLIQ rules require **100% line + branch on aggregator + routing + blend**. Block AMLIQ Investigate v0.1 release until branch on line 48 is covered.
- **GAP-2 (CRITICAL):** `decision-service.ts` 93.75% branch — same rule, same block.
- **GAP-3 (CRITICAL):** `packages/billing/src/entitlements.ts` 75% branch. Entitlements = permissions = critical path under portfolio rules. Add tests before any billing release.
- **GAP-4 (CRITICAL):** AMLIQ Investigate has **no dedicated `audit.ts` file** under `api/decision/src/`. AMLIQ rule mandates a 100%-covered audit emit path. Either confirm aggregator IS the audit emit point and rename the gate, or add the missing module.
- **GAP-5 (HIGH):** `packages/telemetry/src/audit-tamper/{sign.ts,verifier.ts}` are tamper-chain security controls at 93.33% / 88.24% branch. CLAUDE.md portfolio rule treats security controls as 100%-gate. Add branch tests for HMAC failure paths.

### eng
- Cover line 48 in `aggregator.ts`, line 63 in `decision-service.ts`, lines 65/124 in `engine-client.ts`.
- Cover brain `server.ts` lines 49–76 (server bootstrap) — push from 78.94% to ≥95%.
- Cover `packages/billing/src/entitlements.ts` missing branches (3 of 12 branches uncovered).
- Cover `packages/ai-gateway/src/edge/jwt.ts` 2 missing lines + 6 missing branches.
- Cover `packages/auth/src/jwt-keys.ts` (95.12% L / 87.5% B — file is 41 lines, trivial to close).
- Cover `packages/auth/src/adapters/user-resolver.ts` branch 77.78% (file is 42 lines).
- Add explicit test for `infrastructure/observability/src/sinks/factory.ts` — currently 50% function coverage means a factory branch is dead-shipped.

### devops / CI
- **Wire Python agent coverage into CI.** `sar-draft`, `regulatory-change`, `alert-triage` have `pytest-cov` already declared in pyproject.toml but no CI gate; without it, the 90% portfolio floor is unenforced on the entire Python surface.
- Refresh `packages/auth/coverage/` (24-hr stale) so dashboards reflect today's state.
- Add `coverage-summary.json` reporter to brain-root vitest config (it currently emits `coverage-final.json` only) so this report can parse without running tests.
- Add Astro a11y substitute gate for `websites/finsavvyai.com` to compensate for the coverage exception — coordinate with [[A11Y-AUDIT]].

## Output Contract Summary

```
AGENT: TEST-COVERAGE-MAP
REPORT FILE: docs/quality/COVERAGE_MAP.md
SCOPE COVERED: packages/{auth,billing,telemetry,ai-gateway,policy-engine,shared-types},
  infrastructure/{observability,synthetics}, amliq/api/decision,
  amliq/brain (root + web + corpus + inference + connectors snapshot)
HIGH FINDINGS: 5
  - aggregator.ts 96.29% branch fails AMLIQ 100% gate (release-blocker)
  - decision-service.ts 93.75% branch fails AMLIQ 100% gate
  - entitlements.ts 75% branch (entitlements = permissions = critical)
  - audit-tamper/{sign,verifier} 93/88% branch (security controls)
  - Missing dedicated audit.ts in api/decision (AMLIQ rule violation)
MEDIUM FINDINGS: 4
  - server.ts (brain) 78.94% line vs ≥95% target
  - ai-gateway/edge/jwt.ts 97.63%/94.23% on auth path
  - auth/jwt-keys.ts + user-resolver.ts branch gaps
  - sinks/factory.ts 50% functions
LOW FINDINGS: 3
  - ai-gateway/worker.ts untested (likely intentional)
  - teams-internal.ts no dedicated test file
  - 7 todo tests in packages/auth
CROSS-REFERENCES: [[DEAD-CODE]] [[DEPS-AUDIT]] [[A11Y-AUDIT]] [[PERF-BENCHMARKS]]
RECOMMENDATIONS BY OWNER:
  founder: 5 release-blocker tickets (GAP-1..5 above)
  eng:    7 close-the-gap tickets on specific files/lines
  devops: 4 CI/tooling tickets (Python coverage, refresh stale, summary reporter, a11y gate)
```
