# Enterprise Risk Register

> **Cadence:** Reviewed quarterly by Head of Eng + Security on-call.
> **Last reviewed:** 2026-05-25. **Next review:** 2026-08-25.
>
> Mirrors AICPA CC3.1 (risk assessment) + CC9.1 (risk mitigation) +
> CC9.2 (vendor risk management). Per-product technical risks live in
> their own product `CLAUDE.md` files; this register tracks
> enterprise-grade risks that cross product boundaries or threaten the
> business itself.

## Rating scale

- **Likelihood:** L (rare, <1/yr) · M (plausible, 1-3/yr) · H (likely, >3/yr)
- **Impact:** L (single-team annoyance) · M (revenue dip / customer churn) · H (Series A risk / regulator action / data breach)
- **Residual rating** = post-mitigation rating: Low / Med / High.

## Active risks

| # | Risk | Category | Likelihood | Impact | Mitigations | Residual | Owner | Review |
|---|---|---|---|---|---|---|---|---|
| 1 | Third-party sanctions feed disruption (OFAC, EU, UN, UK source down or schema change) | vendor | M | H | Multi-source ingestion; pinned snapshot rollback; staleness alert with 24h budget; `AMLIQ_DECISION_FAIL` runbook | Med | Head of Eng | 2026-08-25 |
| 2 | Founder bus-factor — single-point-of-knowledge in auth/audit critical paths | personnel | M | H | CODEOWNERS distributed; CLAUDE.md captures intent; runbooks for every alert; pairing on critical-path PRs | Med | CEO | 2026-08-25 |
| 3 | Data residency / EU expansion blocked by US-only Cloudflare R2 + D1 placement | regulatory | M | M | EU R2 + D1 jurisdiction toggle scoped; per-tenant region claim contract in `TenantContext`; DPO engagement required before EU launch | Med | Head of Eng | 2026-08-25 |
| 4 | Single-region single-point-of-failure (Cloudflare global outage takes down all surface) | availability | L | H | Cloudflare's multi-pop architecture; rollback runbook; Cloudflare disruption DR plan with RTO/RPO and degraded modes (`docs/runbooks/DR_CLOUDFLARE_REGION_OUTAGE.md`) | Med | Security on-call | 2026-08-25 |
| 5 | SAR draft hallucination harms partner trust — agent files inaccurate SAR | data | M | H | `human_review_required: true` default on every agent output (mesh §7); 100% test coverage on "never auto-files"; partner contracts state-draft-only | Low | SAR-AGENT owner | 2026-08-25 |
| 6 | Supply-chain dep compromise (npm package backdoor) | security | M | H | Critical/High dep-vuln blocks release (portfolio rule); secret-scan + SAST on every PR; lockfile pinned; `pnpm audit` in CI | Med | Security on-call | 2026-08-25 |
| 7 | Signing key / seed phrase compromise — audit chain signatures forged | security | L | H | Keys in platform secret store; per-environment isolation; rotation policy quarterly; HMAC constant-time compare (`packages/billing/src/providers/lemonsqueezy/webhook.ts` pattern) | Low | Security on-call | 2026-08-25 |
| 8 | Cross-tenant data leak via brain API or audit chain | data | L | H | `TENANT_ID_REGEX` boundary validation; 100% line+branch coverage on tenant middleware (`products/amliq/brain/services/api/src/tenant/middleware.ts`); per-tenant D1 chain HEAD (`products/amliq/brain/services/api/src/audit-prod/state-store.ts`); SQL fully parameterised | Low | Brain owner | 2026-08-25 |
| 9 | Audit chain HEAD divergence between primary D1 and signed R2 sink | data | L | H | `peekSaveError` drains save errors after every emit; chain replay test in CI; SEV1 divergence runbook (`docs/runbooks/AUDIT_CHAIN_HEAD_DIVERGENCE.md`); 7-year R2 retention as source-of-truth backstop | Med | Brain owner | 2026-08-25 |
| 10 | SOC 2 audit slippage past Series A close — investors require attestation | regulatory | M | H | Pre-audit hardening checklist (`docs/compliance/SECURITY_HARDENING.md`); auditor selection in flight; readiness package complete (this dir); Type 2 evidence window starts immediately post-Type 1 | Med | CEO | 2026-08-25 |

## Closed / accepted risks (audit trail)

> None yet — register established 2026-05-25.

## Acceptance criteria

A risk may be **accepted** (no mitigation pursued) only if all three hold:

1. Residual impact ≤ M.
2. CEO sign-off recorded in this file with rationale.
3. Re-evaluation date set ≤ 12 months out.

A risk is **closed** when the underlying threat is structurally eliminated
(not merely reduced); closed rows move to the audit trail above with the
closing PR linked.

## Review cadence

- **Quarterly:** full register walked by Head of Eng + Security on-call.
- **Triggered:** any SEV1 incident triggers a register diff before the
  postmortem closes (per `INCIDENT_RESPONSE.md`).
- **Annually:** category headers reviewed for new categories (e.g. AI
  agent autonomy, model-supply-chain) — currently all 10 risks fit the
  existing six categories.

## Cross-references

- SOC 2 control mapping: `docs/compliance/SOC2_READINESS.md`
- Security hardening checklist: `docs/compliance/SECURITY_HARDENING.md`
- Incident response: `docs/compliance/INCIDENT_RESPONSE.md`
- Change management: `docs/compliance/CHANGE_MANAGEMENT.md`
