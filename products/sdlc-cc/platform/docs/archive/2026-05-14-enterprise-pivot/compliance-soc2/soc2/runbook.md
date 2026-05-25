# SOC 2 Evidence Pull — Quarterly Runbook

Every quarter (Jan/Apr/Jul/Oct, week 1) the engineering on-call:

1. Pulls evidence per control in `controls.yaml`.
2. Stores artifacts in S3 bucket `s3://sdlc-soc2-evidence/<YYYY-Q>/`.
3. Logs the run in `audit_logs` with `action = compliance.evidence_pull`.
4. Hands the bucket prefix to the auditor.

## Per-control procedures

### CC6.1, CC6.7, CC7.2, CC7.3 — audit log queries

Run each `query` block in `controls.yaml` against the read replica.
Save the CSV output named `<control-id>.csv`.

```bash
psql "$READ_REPLICA_URL" \
  --csv \
  -f <(yq -r '.controls[] | select(.id == "CC6.1") | .evidence.query' controls.yaml) \
  > CC6.1.csv
```

### CC6.6 — PrivateLink terraform state

```bash
terraform -chdir=deployments/production/terraform output -json privatelink_service \
  > CC6.6-privatelink.json
```

Auditor verifies `acceptance_required: true` and that the per-customer
allow list matches the SOW.

### CC6.8 — CMEK enrollment

```sql
COPY (
  SELECT id, plan, kms_key_arn IS NOT NULL AS cmek_enabled
  FROM tenants
  WHERE plan = 'enterprise'
) TO STDOUT WITH CSV HEADER;
```

Save as `CC6.8-cmek.csv`. Any enterprise row with `cmek_enabled = false`
is a finding.

### HMAC chain verification (CC7.3)

```bash
go run ./services/gateway/cmd/audit-verify --since 90d > CC7.3-chain.txt
```

The verifier walks `audit_logs` ordered by `id`, recomputes the HMAC
for each row using the previous row's signature as part of the input,
and prints `OK <count>` on success or the first row index where the
chain breaks. A break is a Type-II finding: do NOT modify the audit
table to "fix" it.

### Pull request index (CC8.1)

```bash
gh pr list --repo finsavvyai/sdlc-platform \
   --state merged \
   --json number,title,mergedAt,reviewers \
   --search 'merged:>=$(date -v -90d +%F)' \
  > CC8.1-prs.json
```

### Availability (A1.2)

Export the last 90 days of the status page incidents JSON via the
StatusPage API (or our own runbook), save as `A1.2-incidents.json`.

## What an auditor finding looks like

The auditor flags any of:

- a query in `controls.yaml` that errors or returns nothing
- a code path that has been deleted/renamed without updating
  `controls.yaml`
- an HMAC chain break (CC7.3 disqualifier — investigate immediately)
- an enterprise tenant with `cmek_enabled = false` (CC6.8 finding)
- a PR merged without review approval in the 90-day window (CC8.1)

## Lint

Pre-audit, run:

```bash
go run ./compliance/soc2/lint  # TODO — adds as a follow-up
```

The lint walks `controls.yaml` and asserts every `code_paths` entry
exists and every `evidence.query` parses as PostgreSQL. CI will block
merges that delete a referenced path without updating the catalog.
