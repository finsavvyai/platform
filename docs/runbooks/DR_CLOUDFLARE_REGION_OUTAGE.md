# DR_CLOUDFLARE_REGION_OUTAGE

> Disaster-recovery runbook for SOC 2 A1.3. This runbook covers a
> Cloudflare regional dependency outage or a broader Cloudflare platform
> incident affecting Workers, D1, KV, R2, WAF, DNS, or Logpush.
> Last refreshed: 2026-05-26.

## Objectives

| Target | Commitment |
|---|---|
| Severity | SEV1 when public traffic or audit-chain writes are unavailable. |
| RTO | Restore the affected production surface or approved degraded mode within 4 hours. |
| RPO | No acknowledged billing or AML decision event is lost; audit-log object recovery target is 15 minutes. |
| Data priority | Audit chain, billing webhooks, tenant isolation state, route/policy config, then cached responses. |

## Activation

Declare this runbook when any of these are true:

- `HEALTH_DOWN` remains active after code rollback is attempted or ruled out.
- Cloudflare status confirms an incident affecting the deployed region,
  Workers runtime, D1, KV, R2, WAF, DNS, or Logpush.
- D1, KV, or R2 health checks fail in the `/health` dependency payload.
- Audit-chain writes fail after the service is otherwise reachable.

Incident command follows `docs/compliance/INCIDENT_RESPONSE.md`; rollback
mechanics remain in `docs/runbooks/_rollback.md`.

## Roles

| Role | Owner |
|---|---|
| Incident commander | Primary on-call for SEV1, escalated to Head of Eng if unresolved after 30 minutes. |
| Infrastructure operator | Engineer with Cloudflare account access and Wrangler production permissions. |
| Communications owner | Customer Success or CEO until Customer Success is staffed. |
| Evidence owner | Security on-call; archives timeline, commands, and postmortem. |

## Triage

1. Confirm whether a recent deploy correlates with the outage. If yes,
   execute `docs/runbooks/_rollback.md` first.
2. Check Cloudflare status and the account dashboard for Workers, D1, KV,
   R2, DNS, WAF, and Logpush incidents.
3. Capture the failing `/health` payload and the latest synthetic result.
4. Freeze risky deploys until the incident commander reopens the change
   window.

## Degraded Modes

Use the narrowest mode that restores customer commitments:

| Mode | When to use | Action |
|---|---|---|
| Read-only gateway | D1 writes degraded, Workers reachable | Disable write paths with feature flags; keep cached/read-only routes available. |
| Billing queue hold | Billing provider or D1 write path degraded | Stop state mutation, preserve raw webhook payloads, and replay idempotently after recovery. |
| AML evidence hold | Search/SAR agent dependency degraded | Return stable retryable error codes; do not produce partial SAR drafts as final output. |
| Public status-only | Public app unavailable | Publish incident status and support contact; stop nonessential deploys. |

## Data Recovery

| System | Recovery source | Procedure |
|---|---|---|
| D1 | Latest Cloudflare D1 backup | Use `wrangler d1 backup list`; restore affected rows only unless IC approves full restore. |
| KV | Audit-backed snapshots or cache rebuild | Delete poisoned keys or rebuild route/policy cache from source of truth. |
| R2 audit logs | Append-only bucket plus local replay metadata | Do not rewrite history. Mark malformed or missing window in postmortem; replay verifiers against the recovered interval. |
| Billing events | Provider webhook replay and idempotency table | Replay after write path is healthy; reject duplicates by event ID. |
| Sanctions snapshots | Last known-good pinned snapshot | Revert ingestion to pinned snapshot, then resume fresh ingestion after source health is confirmed. |

## Recovery Steps

1. Apply code rollback if deploy-correlated.
2. If the outage is provider-side, enable the relevant degraded mode.
3. Restore or replay state from the recovery source table above.
4. Run the health synthetic until it is green for 15 continuous minutes.
5. Verify audit-chain continuity for the incident window.
6. Resume deploys only after the incident commander closes the freeze.
7. Publish customer update and archive evidence in the postmortem.

## Exercise Evidence

Quarterly tabletop exercises use this scenario in Q2 per
`docs/compliance/INCIDENT_RESPONSE.md`. Each exercise must produce:

- timestamped scenario notes
- participants and assigned roles
- RTO/RPO result
- failed assumptions
- follow-up actions with owners

Archive reports in `docs/postmortems/tabletops/`.

## Validation

Run:

```bash
node tools/validate-dr-readiness.mjs
```

The validator checks that this runbook, rollback procedures, incident
response cadence, and SOC 2 A1.3 evidence stay linked.
