# Quarterly access review — template

Version: 1.0 (2026-04-29).
Owner: security lead. Required by SOC 2 CC6.2 / CC6.3 and by §17 of
the Israeli Privacy Protection Regulations (Data Security) 5777-2017
for High-tier databases. Frequency: every calendar quarter.

This document is the script the reviewer follows. The output is a
filled-in copy committed under `docs/compliance/reviews/YYYY-Qn-
access-review.md` and signed off by both the security lead and the
engineering lead. Review evidence is what an auditor inspects.

## 1. Scope

| System | Users | Owner |
|---|---|---|
| Production Postgres | DB users in `pg_roles` | platform engineering |
| Application JWT issuer | rows in `users` | security lead |
| Per-tenant API keys | rows in `api_keys` | each tenant admin |
| GitHub repository | members of the GitHub org | engineering lead |
| Cloud console (when prod is live) | IAM users | platform engineering |

## 2. Inputs (run before the review meeting)

```sql
-- 2.1 active human accounts
SELECT id, email, role, provider, last_login_at, created_at
  FROM users
 WHERE deleted_at IS NULL
 ORDER BY last_login_at NULLS FIRST;

-- 2.2 tenant API keys still active
SELECT id, tenant_id, key_prefix, last_used_at, created_at
  FROM api_keys
 WHERE revoked_at IS NULL
 ORDER BY last_used_at NULLS FIRST;

-- 2.3 admin / owner role bearers
SELECT email, role
  FROM users
 WHERE role IN ('admin','owner') AND deleted_at IS NULL;

-- 2.4 audit-trail summary of role changes since last review
SELECT created_at, action, details
  FROM audit_entries
 WHERE action LIKE 'role_%' OR action LIKE 'access_%'
   AND created_at > NOW() - INTERVAL '3 months';
```

For each list, attach the row count and the dump filename to the
review record.

## 3. Per-row decision matrix

For every active human account and every active API key:

| If… | Then… |
|---|---|
| user has not logged in for ≥ 90 days | flag for de-provisioning |
| user changed role since last review and the change was not signed-off in the audit trail | open a ticket, do not proceed until reconciled |
| API key has not been used in ≥ 60 days | flag for revocation |
| API key was created > 12 months ago and has never been rotated | flag for rotation |
| GitHub member is no longer on the engineering team | remove |
| any account belongs to a sub-processor that is no longer engaged | remove + update sub-processor directory |

## 4. Output

A new file at `docs/compliance/reviews/YYYY-Qn-access-review.md`
containing:

1. Date, reviewer name, attendees
2. SQL row counts at review time
3. List of every flag raised (per §3)
4. Action taken per flag (with audit-trail row IDs)
5. Sign-off block:

```text
Security lead:    [name]   [date]   [signature]
Engineering lead: [name]   [date]   [signature]
```

## 5. Cadence and ownership

- Q1: 31-March
- Q2: 30-June
- Q3: 30-September
- Q4: 31-December

The security lead schedules the meeting, runs the queries, and
commits the output file. The engineering lead reviews and counter-
signs. If a quarter is missed, the next review must reconcile two
quarters of changes and the gap must itself be logged as an audit
entry (`action='access_review_missed'`).

## 6. Auditor verification

An external auditor verifies this control by:

1. Opening `docs/compliance/reviews/` in this repo.
2. Counting one file per past quarter since the cadence began.
3. Spot-checking that flagged users / keys in each file actually
   appear de-provisioned in the corresponding `audit_entries` row.
4. Confirming both signatures are present.
