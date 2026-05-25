# Incident Response Plan

> **Authoritative.** Mirrors the SEV ladder + escalation in
> `docs/runbooks/_oncall.md`. Where the two disagree, this file wins
> for SOC 2 audit purposes and the runbook is updated. Last refreshed:
> 2026-05-25.
>
> AICPA mapping: CC7.3 (evaluation of security events), CC7.4 (incident
> response), CC7.5 (recovery from incidents).

## Severity definitions

| SEV | Customer impact | Examples | Ack SLA | Active response SLA | Postmortem? |
|---|---|---|---|---|---|
| **SEV1** | Total or major outage; data integrity at risk; security breach; cross-tenant leak | `HEALTH_DOWN`, `GATEWAY_ROUTE_FAIL`, `WEBHOOK_REPLAY_DETECTED`, `STRIPE_WEBHOOK_SIG_FAIL`, `LEMONSQUEEZY_WEBHOOK_SIG_FAIL`, audit-chain-HEAD-divergence | **5 min, 24x7** | **1 hour** (responder hands-on within) | Yes — within 48h |
| **SEV2** | Degraded experience for many users; recoverable; potential SEV1 if untreated | `GATEWAY_ERROR_RATE`, `GATEWAY_LATENCY_P95`, `AUTH_JWT_SPIKE`, `TOKEN_SPEND_BUDGET`, `POLICY_DENY_SPIKE`, `AMLIQ_DECISION_FAIL`, `WORKER_CPU_LIMIT` | 15 min business hours; 30 min off-hours | 4 hours | Only if customer-visible >15 min |
| **SEV3** | Minor degradation; single-tenant impact; precursor signals | `RATE_LIMIT_SPIKE` | 1 hour | Next business day | No, unless repeats within 30 days |
| **SEV4** | No customer impact; internal hygiene | Cron lag, dashboard noise | Next business day | Next sprint | No |

**Note on the SOC 2 audit ask for "24h SLA":** AICPA does not prescribe
a specific SLA; the **SEV1 24h notification target** in this plan
refers to **customer + regulator notification window** (see "Notification
matrix" below), not the internal ack SLA, which is 5 minutes.

## Activation criteria

An incident is **declared** when one of the following is true:

- A SEV1 alert fires AND the on-call confirms it's not a false positive.
- A customer-reported issue is confirmed reproducible at scale.
- A security event (`WEBHOOK_REPLAY_DETECTED`, `STRIPE_WEBHOOK_SIG_FAIL`,
  unauthorized auth-event spike, cross-tenant access trace) is observed.

Declaration is by the on-call engineer; promotion/demotion across SEV
levels by the incident commander.

## Response phases

1. **Acknowledge** (SLA per table above) — on-call posts ack in
   `#status-finsavvy`; pager silence is not ack.
2. **Triage** — identify blast radius, name an incident commander (IC)
   for SEV1.
3. **Mitigate** — execute the relevant runbook
   (`docs/runbooks/<ALERT_ID>.md`); prefer rollback over forward-fix for
   SEV1 (`docs/runbooks/_rollback.md`).
4. **Communicate** — status-page update for SEV1 always; for SEV2 if
   customer-visible >15 min; internal updates every 15 min during active
   SEV1.
5. **Resolve** — declare resolved only after synthetic green for 15 min
   continuously.
6. **Post-incident** — write postmortem; track action items.

## Notification matrix

| Audience | Channel | SEV1 timing | SEV2 timing |
|---|---|---|---|
| Internal on-call | PagerDuty + `#status-finsavvy` | Immediate | Immediate |
| Engineering leadership (CTO, Head of Eng) | Slack DM + war-room channel | Within 15 min of declaration | If escalated by IC |
| Customer Success | `#cs-incidents` | Within 30 min of declaration | If customer-visible |
| Affected customers | Email + status-page | Within **24h** of declaration (regulator-aligned) | Status-page update only if customer-visible |
| Regulators (FinCEN, OFAC contact, EU DPA when EU live) | Per-jurisdiction template in `docs/compliance/regulator-templates/` (TBD before EU launch) | Within the regulator's mandated window (typically 72h GDPR; 24h some FI regulators) | n/a |
| Public (status page, blog post) | https://status.finsavvy.ai | Within 24h for confirmed customer-visible SEV1 | n/a |

## Postmortem requirements

- **Authored within 48h** of SEV1 resolution; SEV2 if customer-visible
  >15 min.
- **Blameless** tone — critique systems, not humans.
- **Template:** copy `docs/compliance/POSTMORTEM_TEMPLATE.md` (TBD;
  follows Google SRE structure: timeline / impact / detection /
  response / contributing factors / what worked / what didn't / action
  items with owners + due dates).
- **Action items** tracked in the engineering backlog; status reviewed
  weekly in the on-call sync until closed.

## Retention

- **Postmortems retained 7 years** in `docs/postmortems/` (matches SOC 2
  audit window + downstream regulator expectations).
- **Audit-chain records retained 7 years** in R2 (`finsavvy-audit-production`).
- **Pager / Slack archives retained per vendor default**; export to
  cold storage before vendor purge cutoff (PagerDuty default: 30 days
  active, 24 months archive).

## Tabletop exercise cadence

- **Quarterly.** Q1: cross-tenant data leak. Q2: Cloudflare regional
  outage. Q3: signing-key compromise. Q4: SAR-agent hallucination filed
  in production (drill on `human_review_required` invariant).
- Each tabletop produces a report archived in `docs/postmortems/tabletops/`.
- Findings feed back into `RISK_REGISTER.md` at the quarterly review.

## SOC 2 evidence package per incident

For Type 2 (post-Type 1) every SEV1 produces:

1. PagerDuty alert with ack timestamp.
2. War-room Slack transcript export.
3. Status-page update history.
4. Postmortem with action-item links to the engineering backlog.
5. Audit-chain replay covering the incident window (`packages/telemetry/src/audit-tamper/verifier.ts`).

## Cross-references

- On-call escalation ladder: `docs/runbooks/_oncall.md`
- Rollback procedures: `docs/runbooks/_rollback.md`
- Per-alert runbooks: `docs/runbooks/<ALERT_ID>.md`
- Risk register: `docs/compliance/RISK_REGISTER.md`
- SOC 2 control mapping: `docs/compliance/SOC2_READINESS.md`
