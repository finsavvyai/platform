# Object Storage (S3) — Disaster Recovery

**RPO:** ≤ 60 seconds — cross-region replication latency.
**RTO:** ≤ 15 minutes — DNS failover to the secondary region.

The platform stores three categories of objects in S3, each in its
own bucket so failure scope and lifecycle policy can differ:

| Bucket | Workload | Versioning | Object Lock | Cross-region |
| --- | --- | --- | --- | --- |
| `sdlc-documents-prod` | Customer uploads | enabled | governance, 7y | yes (eu-central-1) |
| `sdlc-pg-backups-prod` | pgBackRest dumps | enabled | governance, 90d | yes |
| `sdlc-redis-snapshots-prod` | Redis RDB+AOF | enabled | governance, 30d | yes |

## Cross-region replication

Each bucket has SSE-KMS at rest with a tenant-region-pinned KMS key.
Replication writes to the EU mirror with a different KMS key in
that region — so a key compromise in one region doesn't expose the
mirror.

CRR runs continuously; the SLA is "≤60s replication lag at p99".
We monitor it via `aws s3api get-bucket-replication` plus a
canary object the platform writes every minute and reads back from
the mirror.

## Failure modes

### Single object lost (mis-delete in app code)

Versioning is enabled — restore via:

```bash
aws s3api list-object-versions --bucket sdlc-documents-prod --prefix "tenant-x/doc-y"
aws s3api delete-object --bucket sdlc-documents-prod --key "tenant-x/doc-y" --version-id <delete-marker-id>
```

The Object Lock governance retention prevents permanent deletion
within the window — a "delete" is just a delete-marker that can be
removed.

### Whole-bucket loss (region outage)

DNS failover. The platform reads `OBJECT_STORAGE_BUCKET` from env;
the secondary region's deploy uses `sdlc-documents-prod-eu`.

```bash
# Update Route53 weighted record to send traffic to EU
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE \
  --change-batch file://deployments/dns/failover-eu.json
```

After failover the EU bucket becomes the primary; when the original
region recovers, replication runs in reverse to catch up the
formerly-primary, then we plan a cutback during a maintenance window.

### Key compromise (KMS)

Disable the compromised key via:

```bash
aws kms disable-key --key-id $COMPROMISED_KEY_ID
```

This makes objects encrypted with that key unreadable. Pivot to the
secondary-region key — replicated copies are encrypted with a
different key and remain accessible. The retention runbook
(`dr-secrets.md`) covers the key-rotation path.

## Quarterly exercise

- [ ] Write a canary object to the primary bucket, read from EU within 5 min.
- [ ] Trigger a single-object restore via versioning.
- [ ] Run the failover DNS change in staging, verify uploads succeed.
- [ ] Roll back the DNS change; confirm replication catches up.

## Drill log

See `docs/runbooks/rto-rpo-drill-log.md`.
