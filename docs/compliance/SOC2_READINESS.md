# SOC 2 Type 1 — Readiness Package

> **Status:** Pre-audit. Auditor selection in progress; pen-test firm TBD.
> Last refreshed: 2026-05-25. Owner: Security on-call rotation.

Maps FinsavvyAI controls to the AICPA Trust Services Criteria (2017 with
2022 points-of-focus revisions). Evidence locations are repo paths so a
Type 1 audit-firm walkthrough can be executed from this document alone.

## Legend

- **implemented** — control is in production code with passing tests.
- **partial** — control exists but coverage / hardening is incomplete.
- **gap** — committed, not yet in code.
- **deferred-with-rationale** — explicit waiver pending a triggering event.

## Common Criteria (CC) — Security

| # | Criterion | Control | Evidence | Status |
|---|---|---|---|---|
| CC1.1 | Control environment / integrity & ethics | Portfolio CLAUDE rules + per-repo CODEOWNERS | `/Users/shaharsolomon/dev/projects/CLAUDE.md`; `.github/CODEOWNERS` | implemented |
| CC2.1 | Communication of policies | Engineering rules versioned in repo; runbooks for every alert | `docs/runbooks/_oncall.md`; `infrastructure/alerts/rules.yaml` | implemented |
| CC3.1 | Risk assessment | Enterprise risk register reviewed quarterly | `docs/compliance/RISK_REGISTER.md` | implemented |
| CC4.1 | Monitoring activities | Synthetic probes + 13 alert rules + audit-tamper chain | `infrastructure/synthetics/`; `infrastructure/alerts/rules.yaml`; `packages/telemetry/src/audit-tamper/` | implemented |
| CC5.1 | Control activities | CI required-checks gate every merge | `.github/workflows/ci.yml` | implemented |
| CC6.1 | Logical access controls | JWT alg-pinned verifier + role-gated routes + tenant middleware | `packages/auth/src/jwt.ts`; `products/amliq/brain/services/api/src/auth.ts`; `products/amliq/brain/services/api/src/tenant/middleware.ts` | implemented |
| CC6.2 | New-user provisioning | Tenant claim issued via auth provider; revocation via JWT jti deny-list | `packages/auth/src/jwt.ts`; (deny-list TBD) | partial |
| CC6.3 | Authorisation changes | Role grants audit-logged via `aml.decision.role_grant` | `products/amliq/api/` audit emits per `products/amliq/CLAUDE.md` SOC 2 mapping | implemented |
| CC6.6 | Encryption in transit | Cloudflare Workers TLS termination; HSTS at edge | `infrastructure/cloudflare/`; Wrangler routes config | implemented |
| CC6.7 | Restrict information transmission | Audit `reason` is a stable code; no PII in transit logs | `products/amliq/CLAUDE.md` "PII-free reasons" + tested in `products/amliq/brain/services/api/src/audit.test.ts` | implemented |
| CC6.8 | Detection of unauthorised software | Dependency vuln scan + secret scan in CI | `.github/workflows/ci.yml` (audit + secret-scan jobs) | implemented |
| CC7.1 | System monitoring infrastructure | Tamper-evident audit chain with cryptographic head per tenant | `packages/telemetry/src/audit-tamper/chain.ts`; `products/amliq/brain/services/api/src/audit-prod/state-store.ts` | implemented |
| CC7.2 | Anomaly detection | 13 alert rules; rate-limit rejection metric → `RATE_LIMIT_SPIKE` SEV3 | `infrastructure/alerts/rules.yaml`; `products/amliq/brain/services/api/src/rate-limit/middleware.ts` (emits `brain.rate_limit.rejected` audit) | implemented |
| CC7.3 | Evaluation of security events | On-call escalation ladder; SEV1 ack in 5 min | `docs/runbooks/_oncall.md`; `docs/compliance/INCIDENT_RESPONSE.md` | implemented |
| CC7.4 | Incident response | Runbooks per alert; postmortem template; 7-year retention | `docs/runbooks/`; `docs/compliance/INCIDENT_RESPONSE.md` | implemented |
| CC7.5 | Recovery from incidents | Rollback runbook + canary 5→50→100% deploy gate | `docs/runbooks/_rollback.md`; `.github/workflows/deploy-prod.yml` | implemented |
| CC8.1 | Change management | PR review + CI required-checks + canary deploy + forward-only D1 | `docs/compliance/CHANGE_MANAGEMENT.md`; `.github/workflows/ci.yml` | implemented |
| CC9.1 | Risk mitigation (ongoing) | Quarterly risk-register review documented in commit history | `docs/compliance/RISK_REGISTER.md` | implemented |
| CC9.2 | Vendor risk management | Critical vendors (Cloudflare, LemonSqueezy, OFAC list source) tracked in register | `docs/compliance/RISK_REGISTER.md` (vendor rows) | partial |

## Availability (A)

| # | Criterion | Control | Evidence | Status |
|---|---|---|---|---|
| A1.1 | Capacity / availability commitments | SLO targets: 99.9% gateway; p95 latency <500ms | `docs/observability.md`; alert rules `GATEWAY_LATENCY_P95` | implemented |
| A1.2 | Capacity planning | Forecast cadence + headroom monitor | n/a — pre-revenue; no production load to forecast against | deferred-with-rationale |
| A1.3 | Recovery from disruption | Rollback runbook + DR plan | `docs/runbooks/_rollback.md`; DR multi-region pending | partial |

## Confidentiality (C)

| # | Criterion | Control | Evidence | Status |
|---|---|---|---|---|
| C1.1 | Confidential data identified | Tenant data + PII subject IDs flagged at boundary | `products/amliq/CLAUDE.md` PII handling section | implemented |
| C1.2 | Confidential data protected | PII hashed at boundary; audit reasons PII-free; per-tenant chain HEAD in D1 | `products/amliq/brain/services/api/src/audit-prod/state-store.ts` (tenant-scoped SQL); `products/amliq/CLAUDE.md` C1.2 row | implemented |

## Processing Integrity (PI)

| # | Criterion | Control | Evidence | Status |
|---|---|---|---|---|
| PI1.1 | Data integrity through processing | SHA-256 hash chain per tenant; signed records to R2 | `packages/telemetry/src/audit-tamper/chain.ts`; `packages/telemetry/src/audit-tamper/sign.ts`; `products/amliq/brain/services/api/src/audit-prod/factory.ts` | implemented |
| PI1.2 | System inputs complete & accurate | Zod validation at brain API boundary (search + tenant claims) | `products/amliq/brain/services/api/src/tenant/types.ts` (regex); `products/amliq/brain/services/api/src/search/` validators | partial |

## Privacy (P) — applicability narrow (B2B; no consumer PII)

| # | Criterion | Control | Evidence | Status |
|---|---|---|---|---|
| P4.2 | Personal information retention | Default 7y retention; tenant-policy override | `products/amliq/CLAUDE.md` C1.4 row; purge cron pending | partial |
| P9.1 | Monitoring & enforcement | Audit retention exercised on staging before any production deploy | `products/amliq/CLAUDE.md` release checklist | implemented |

## Summary

- **22 criteria** covered.
- **17 implemented**, **4 partial**, **0 gap**, **1 deferred-with-rationale**.
- All "partial" items have a tracked issue and a target date in the
  pre-audit milestone (`docs/compliance/SECURITY_HARDENING.md` "next
  steps before audit").
- Audit firm walkthrough sequence: CC6 → CC7 → PI1 → CC8 → CC1-5 → A/C/P.
