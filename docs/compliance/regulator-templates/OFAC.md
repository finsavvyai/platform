# OFAC Notification Template

Use when a confirmed sanctions-screening incident, sanctions-list
freshness failure, blocked-person screening defect, or sanctions data
integrity issue requires OFAC-facing notification or counsel review.

## Header

| Field | Value |
|---|---|
| Incident ID | [INC-YYYY-MM-DD-slug] |
| Reporting entity | FinsavvyAI |
| Contact | [legal/compliance contact] |
| Detection time | [UTC timestamp] |
| Notification time | [UTC timestamp] |
| Related postmortem | [path/link] |

## Incident Summary

- What happened:
- Systems affected:
- Time window:
- Current status:

## Sanctions Impact

- Sanctions source affected:
- Snapshot/version in use:
- Screening decisions potentially affected:
- Whether any match was missed, delayed, or incorrectly cleared:
- Corrective action taken:

## Data and Customer Impact

- Affected customers or tenants:
- Data categories involved:
- Data integrity impact:
- Confidentiality impact:

## Remediation

- Immediate containment:
- Snapshot rollback or re-ingestion steps:
- Customer remediation:
- Longer-term controls:

## Attachments

- Postmortem:
- Audit-chain verification:
- Sanctions snapshot evidence:
