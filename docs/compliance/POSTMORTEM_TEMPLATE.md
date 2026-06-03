# Postmortem Template

> Use for every SEV1 and any customer-visible SEV2 longer than 15 minutes.
> Draft due within 48 hours of resolution. Retain final reports for 7 years.

## Header

| Field | Value |
|---|---|
| Incident ID | [INC-YYYY-MM-DD-slug] |
| Severity | [SEV1/SEV2] |
| Started at | [UTC timestamp] |
| Detected at | [UTC timestamp] |
| Resolved at | [UTC timestamp] |
| Incident commander | [name] |
| Primary responder | [name] |
| Communications owner | [name] |
| Customer-visible | [yes/no] |
| Regulatory review required | [yes/no] |

## Summary

Write a short factual description of what happened, who was affected, and
which commitments were missed.

## Impact

| Area | Detail |
|---|---|
| Affected surfaces | [services/routes/products] |
| Affected tenants | [count or list] |
| Data integrity impact | [none/describe] |
| Security impact | [none/describe] |
| Availability impact | [duration and symptoms] |
| Financial impact | [none/describe] |

## Timeline

Use UTC timestamps.

| Time | Event |
|---|---|
| [HH:MM] | [event] |

## Detection

- Alert or report that detected the issue:
- Why detection worked or failed:
- Time from impact start to detection:

## Response

- Mitigation used:
- Runbooks used:
- Rollback or degraded mode used:
- Customer/regulator notifications sent:

## Contributing Factors

Describe system, process, tooling, or documentation factors. Keep this
blameless and factual.

## What Worked

- [item]

## What Did Not Work

- [item]

## Action Items

| Action | Owner | Due date | Tracking link | Status |
|---|---|---|---|---|
| [action] | [owner] | [YYYY-MM-DD] | [link] | open |

## Evidence Package

- Pager alert:
- War-room export:
- Status-page history:
- Relevant deploys:
- Audit-chain verification:
- Customer/regulator messages:

## Approval

| Reviewer | Role | Date |
|---|---|---|
| [name] | Incident commander | [YYYY-MM-DD] |
| [name] | Security/on-call owner | [YYYY-MM-DD] |
