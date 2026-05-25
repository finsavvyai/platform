# Change Management Policy

> Authoritative for SOC 2 CC8.1 (change management).
> Last refreshed: 2026-05-25.

## Scope

All production code, infrastructure-as-code, and configuration changes
flow through this policy. Documentation-only changes (no behaviour
impact) follow the same review path but skip canary deploys.

## PR review requirements

Every PR merging to `main` MUST satisfy:

1. **CODEOWNERS approval** — at least one CODEOWNER for every modified
   path approves. CODEOWNERS file lives at the repo root and is
   reviewed quarterly alongside the risk register.
2. **At least one human reviewer approval** — self-merge prohibited
   except for the `dependabot` and `renovate` bots on lockfile updates
   that pass all CI checks.
3. **All CI required-checks green** — see "Required CI checks" below.
4. **No `TODO` / `FIXME` in release branches without a linked tracked
   issue** — portfolio CLAUDE rule.
5. **No skipped tests** without a linked ADR or tracked issue.

### Required CI checks (`.github/workflows/ci.yml`)

| Check | Purpose | Blocks merge? |
|---|---|---|
| `typecheck` | TS strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` enforced | Yes |
| `test` | Unit + integration tests across all packages | Yes |
| `coverage` | Lines ≥90%, branches ≥85%; 100% on critical paths (auth, audit, rate-limit decision, tenant middleware) | Yes |
| `audit` | `pnpm audit` for Critical/High vulnerabilities | Yes (Critical/High blocks per AMLIQ rule) |
| `secret-scan` | Detects secret-shaped strings in diff | Yes |
| `sast` | Static analysis on TS + Go + Python | Yes |
| `license` | Disallowed-license check on deps | Yes |
| `lint` | ESLint + ruff + golangci-lint | Yes |

## Production deploy gating

Pipeline lives in `.github/workflows/deploy-prod.yml` and follows a
canary rollout:

1. **5% canary** — deploy to 5% of production traffic. Wait 10 min.
2. **Health gate** — synthetic probes + alert rules must be green.
   Auto-rollback if any of: `HEALTH_DOWN`, `GATEWAY_ROUTE_FAIL`,
   `GATEWAY_ERROR_RATE`, `GATEWAY_LATENCY_P95` fires.
3. **50% rollout** — promote to 50%. Wait 15 min. Re-check gate.
4. **100% rollout** — promote to 100% only if both prior gates passed.
5. **Post-deploy** — 30 min observation window before the deploy is
   considered settled; auto-rollback remains armed.

Manual override (skip canary) requires:

- SEV1 incident declared.
- Incident commander written approval in the war-room channel.
- Auto-rollback armed regardless.

## Rollback procedures

- **First-line:** `wrangler rollback <VERSION_ID> --env production` per
  worker. Documented in `docs/runbooks/_rollback.md`.
- **Audit-chain implication:** rollbacks do NOT rewrite history; the
  audit chain stays append-only and the new deploy continues from the
  prior HEAD. This is by design (PI1.1 data integrity).
- **D1 schema rollback:** **NOT permitted.** Migrations are
  forward-only (per Brain Month 3 conventions). Backward-compatible
  data fix-ups are deployed as a separate forward migration with a
  paired ADR.

## Schema migration rules

- **Forward-only** for D1 — round-3 conventions.
- **Backward-compatible across at least one prior worker version** —
  enables canary rollback without schema rollback.
- **Every migration accompanied by:**
  - A test that asserts the new schema works AND a test that asserts
    the prior worker code still reads correctly.
  - An entry in the deploy manifest with the migration ID.
- **Tenant chain HEAD migrations specifically** must execute the
  re-prime check (`D1ChainStateStore.prime`) on every connection after
  migration to guarantee no chain divergence.

## Emergency change process

- **Trigger:** SEV1 incident requiring code change to mitigate.
- **Skip allowed:** human reviewer approval (one IC sign-off suffices)
  and canary stage gates (deploy direct to 100%).
- **Cannot skip:** typecheck, tests, audit, secret-scan, SAST.
- **Required follow-up:** within 48h, a "follow-up PR" formalises the
  change with full review path; this PR is non-functional but creates
  the SOC 2 audit trail.

## Configuration changes

- Cloudflare Workers secret store changes: tracked via Wrangler CLI
  with structured commit messages (`secret: rotate <name>`).
- Environment variable changes: visible in `wrangler.toml` diff or
  inferred from secret rotation audit.
- Alert rule changes: every edit to `infrastructure/alerts/rules.yaml`
  triggers a Datadog JSON regeneration (per the file header convention).

## Audit trail

- **Git history** is the source of truth for code changes.
- **Cloudflare deployment log** is the source of truth for production
  rollouts.
- **Audit chain** (per-tenant in D1, signed in R2) is the source of
  truth for runtime decision history.

## Cross-references

- Portfolio CLAUDE rules: `/Users/shaharsolomon/dev/projects/CLAUDE.md`
- AMLIQ release checklist: `products/amliq/CLAUDE.md`
- Brain release checklist: `products/amliq/brain/CLAUDE.md`
- Rollback runbook: `docs/runbooks/_rollback.md`
- On-call escalation: `docs/runbooks/_oncall.md`
- Incident response: `docs/compliance/INCIDENT_RESPONSE.md`
