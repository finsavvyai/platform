# On-call — FinsavvyAI

> Operational reference. Provider IDs and private dashboard URLs are stored
> in the production secrets manager, not in Git.

## Rotation Policy

| Role | Cadence | Handoff time | Coverage |
|---|---|---|---|
| Primary on-call | Weekly, Mon 10:00 local | Mon 10:00 | 24x7 pager-bearer |
| Secondary on-call | Weekly, Mon 10:00 local | Mon 10:00 | Backup if primary doesn't ack in 5 min |
| Security on-call | Weekly | Mon 10:00 | Engaged for any SEV1 with security tag |
| Incident commander | Spawned per SEV1 | n/a | Senior eng; runs the incident, not the hands-on fix |

PagerDuty schedule ID is injected into alert tooling from
`PAGERDUTY_SCHEDULE_ID` in the production secrets manager.

## Escalation ladder

1. **Pager fires** → primary on-call has **5 minutes** to ack.
2. **No ack in 5 min** → secondary paged automatically.
3. **No ack in 10 min** → engineering manager paged.
4. **SEV1 declared** → CTO + Head of Eng auto-notified; incident commander
   appointed.
5. **External-comms threshold (SEV1 >30 min OR customer-visible data loss)**
   → Head of Customer Success + Marketing get the bat-signal for status-page
   update.

## Communication Channels

| Purpose | Channel | Who reads |
|---|---|---|
| Active incident war room | `#inc-<date>-<slug>` (slack) | IC + responders |
| Status updates (internal) | `#status-finsavvy` | Whole eng + leadership |
| Status updates (external) | https://status.finsavvy.ai | Customers |
| Security incidents | `#security-incidents` (slack, private) | Security on-call + IC |
| Post-incident | `#postmortems` | Whole eng |

## SEV definitions

| SEV | Customer impact | Examples | Time to ack | Postmortem? |
|---|---|---|---|---|
| **SEV1** | Total or major outage; data integrity at risk; security breach | `HEALTH_DOWN`, `GATEWAY_ROUTE_FAIL`, `WEBHOOK_REPLAY_DETECTED`, `STRIPE_WEBHOOK_SIG_FAIL`, `LEMONSQUEEZY_WEBHOOK_SIG_FAIL` | 5 min, 24x7 | Yes — within 48h |
| **SEV2** | Degraded experience for many users; recoverable; potential SEV1 if untreated | `GATEWAY_ERROR_RATE`, `GATEWAY_LATENCY_P95`, `AUTH_JWT_SPIKE`, `TOKEN_SPEND_BUDGET`, `POLICY_DENY_SPIKE`, `AMLIQ_DECISION_FAIL`, `WORKER_CPU_LIMIT` | 15 min, business hours; 30 min off-hours | Only if customer-visible >15 min |
| **SEV3** | Minor degradation; single tenant impact; precursor signals | `RATE_LIMIT_SPIKE` | 1 hour | No, unless repeats |
| **SEV4** | No customer impact; internal hygiene | Cron lag, dashboard noise | Next business day | No |

## During an incident — IC checklist

1. **Declare:** post `INCIDENT DECLARED <SEV>` in `#status-finsavvy`.
2. **Spawn:** create `#inc-<date>-<slug>` war room.
3. **Assign:** name the hands-on responder; you do NOT type commands.
4. **Communicate:** post status update every 15 min, even if no change.
5. **Status page:** update https://status.finsavvy.ai if customers will
   notice (SEV1 always; SEV2 if >15 min).
6. **Resolve:** when synthetic green for 15 min, declare resolved in war
   room and `#status-finsavvy`.
7. **Schedule postmortem** before closing the war room (link in calendar).

## Postmortem requirements

For every SEV1 and any SEV2 that crossed the customer-visible threshold:

- **Within 48h:** draft posted to `#postmortems`.
- **Required sections:** timeline, contributing factors (not "root cause"),
  what worked, what didn't, action items (each with owner + due date).
- **Blameless tone.** Critique systems, not humans.
- **Action items tracked** in the engineering backlog; reviewed weekly until
  done.

## Quick links

- Rollback procedures: `docs/runbooks/_rollback.md`
- Alert rules source: `infrastructure/alerts/rules.yaml`
- Synthetic probes: `infrastructure/synthetics/probes/`
- Audit log destination: R2 bucket `finsavvy-audit-production`
- Cloudflare dashboard: https://dash.cloudflare.com; account ID is stored
  in the production secrets manager as `CF_ACCOUNT_ID`.
