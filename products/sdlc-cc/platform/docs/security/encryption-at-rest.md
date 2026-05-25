# Encryption at Rest — Audit & Evidence

Day 36 of the production-ready roadmap. Each storage layer below has
encryption at rest with documented key management + rotation cadence.
Verification commands at the end of each section let an auditor (or
the CI workflow at `.github/workflows/encryption-check.yml`) re-prove
the claim from a clean shell.

## Storage layers

| Store | Mechanism | Key management | Rotation |
| --- | --- | --- | --- |
| Postgres (primary + replica) | RDS storage encryption (KMS) or LUKS for self-host | AWS KMS / Cloud KMS / Vault Transit | annual + on compromise |
| pgvector embeddings | Rides on Postgres TDE — same key | inherited | inherited |
| Redis (cache + queue) | RDB AES-256 at boot, AOF same key | Vault KV per cluster | quarterly |
| S3 buckets | SSE-KMS, region-pinned key per bucket | AWS KMS, separate key per region | yearly + on compromise |
| Vault (secrets) | Auto-unseal via cloud KMS | Cloud KMS unseal key + Shamir recovery shares | shares rotated annually |
| Object storage (PII / PHI) | Field-level AES-256 wrapped by tenant DEK | Tenant DEK ⇐ customer KMS (EKM) | per-customer policy |

---

### Postgres (primary + replica)

Production runs on AWS RDS with `StorageEncrypted=true` against a
customer-managed KMS key. Self-hosted deployments are documented to
use LUKS on the data volume; the gateway refuses to start against an
unencrypted Postgres in production mode (see
`internal/infrastructure/database/database.go`).

**Verification command:**

```bash
aws rds describe-db-instances \
  --query 'DBInstances[].{ID:DBInstanceIdentifier,Encrypted:StorageEncrypted,KMSKeyId:KmsKeyId}' \
  --output table
```

Every row must show `Encrypted=True`.

---

### Redis (cache + queue)

Redis persists via RDB snapshots; the snapshot file is written to an
encrypted EBS volume. AOF (append-only file) writes to the same
encrypted volume. We do not rely on Redis-internal encryption (it has
none) — the protection is at the disk layer. RDB key rotation happens
quarterly via a leader-failover + new-volume swap.

**Verification command (volume-level):**

```bash
aws ec2 describe-volumes \
  --filters Name=tag:Service,Values=redis \
  --query 'Volumes[].{ID:VolumeId,Encrypted:Encrypted,KMSKeyId:KmsKeyId}' \
  --output table
```

---

### S3 / object storage

Every bucket has a `ServerSideEncryptionConfiguration` with SSE-KMS,
using a region-pinned customer-managed key. Cross-region replicas use
a DIFFERENT KMS key so a single-region key compromise cannot cross-
decrypt the mirror. Keys rotate every 90 days (KMS automatic
rotation).

**Verification command:**

```bash
for b in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  aws s3api get-bucket-encryption --bucket "$b" \
    --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault' \
    --output json 2>/dev/null \
    || echo "$b: NO ENCRYPTION CONFIGURED"
done
```

Every bucket must return JSON with `SSEAlgorithm=aws:kms` (NOT `AES256`,
which would mean SSE-S3 instead of SSE-KMS).

---

### Vault / secrets manager

Vault is auto-unsealed via AWS KMS. Recovery is gated by Shamir
shares (3-of-5) held by separate operators across two geographies, so
the loss of any single share is recoverable. HSM-backed where the
deployment region offers CloudHSM.

**Verification command:**

```bash
vault status -format=json | jq '{sealed: .sealed, type: .seal_type, version: .version}'
```

Expect `{"sealed": false, "type": "awskms", ...}`.

---

### Per-tenant DEK (PII / PHI columns)

Field-level AES-256-GCM wraps PII / PHI columns. The DEK comes from
the tenant's customer KMS via the EKM (External Key Management)
integration shipping in Day 58-59. Until EKM is GA, tenants opting in
get a platform-managed DEK rotated yearly.

**Verification command (no plaintext leaks):**

```bash
psql -c "SELECT pg_typeof(ssn_encrypted), length(ssn_encrypted) FROM tenants_pii LIMIT 1;"
```

Expect `bytea` — never `text`.

---

## CI check

`.github/workflows/encryption-check.yml` runs nightly + on every
Terraform PR. It executes `scripts/encryption_check.go` against the
manifest at `deployments/encryption-manifest.json`. The job FAILS
CLOSED:

- Missing manifest = CI failure (no silent allow).
- Any S3 bucket in the manifest without `ServerSideEncryptionConfiguration` = CI failure.
- Any Postgres in the manifest with `storage_encrypted=false` = CI failure.

Real AWS calls are SCAFFOLD (the verification harness expects creds in
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`); in CI without creds
the job runs against the manifest's `expected_state` only.

---

## Customer FAQ

> "What if AWS is compromised?" — every bucket replicates to a
> different region with a DIFFERENT KMS key. The same compromise
> wouldn't cross-decrypt the mirror.

> "What's our recovery posture if Vault loses the unseal key?" — three
> Shamir recovery shares held by separate operators across two
> geographies. Two shares unseal Vault; if any one is lost the other
> two still work.

> "Do you have a SOC2 control mapping?" — see
> `docs/compliance/soc2-control-matrix.md`. Encryption at rest =
> CC6.1, CC6.7.
