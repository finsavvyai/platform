# crypto package — production status

| File | Status | Notes |
|------|--------|-------|
| `envelope.go` | REAL | KMSClient interface + AES-GCM DEK + ErrRevoked contract. Test covers revoke path. |
| `aws_kms.go` | REAL | aws-sdk-go-v2 backed adapter. Maps AWS error codes -> ErrRevoked for AccessDenied / NotFound / Disabled / InvalidState / KeyUnavailable. |
| `document.go` | REAL helper, NOT yet called by the document repo | `DocumentEncryptor` wraps `Encryptor` with the tenants.kms_key_arn lookup. The document repo write path still stores plaintext — see "remaining" below. |

## Remaining S3.1 work for full fintech-PII coverage

The envelope + adapter + tenant resolver are real. What's left:

1. **document repo write path** — `services/gateway/internal/infrastructure/database/repository/documents.go` currently stores `content` plaintext. Migration 023 added `documents.envelope JSONB` and `documents.kek_arn TEXT`. The `Create` path needs to:
   - call `DocumentEncryptor.EncryptForTenant(ctx, tenantID, plaintext)`
   - when env != nil, set `envelope = env`, `kek_arn = env.KEKARN`, blank out `content`
   - when env == nil (non-CMEK tenant), store `content` as today
2. **document repo read path** — `Get`/`GetByID` need to detect non-NULL `envelope` and call `DocumentEncryptor.Decrypt`. Returns 503 on `ErrRevoked` so the customer sees a hard "you no longer own the data" rather than empty content.
3. **FTS impact** — documents.content powers the GORM full-text-search index (see documents.go `to_tsvector('english', content)`). Encrypting `content` breaks search. Two viable paths:
   - Add `searchable_summary TEXT` column populated by DLP-sanitized excerpts; FTS index moves to that column. Encrypted body stays opaque.
   - Move FTS to the embeddings/vector index entirely (semantic search instead of keyword). Larger change, better PII posture.
3. **document-processor TS counterpart** — `services/document-processor/src/encryption.ts` per BEAT-PLAN S3.1. Needs to encrypt before writing to PG, decrypt on retrieval. Symmetric with the Go side.
4. **Admin UI for KEK ARN entry** — separate task.
5. **Destructive integration test** — exists for the layer (`envelope_test.go::TestRevokedKEKReturnsErrRevoked`). Repeat at the repo-level once Create/Get are wired.

Effort estimate for the remaining repo wiring: ~3 person-days for the Go side + 1 for TS. The FTS migration is the architectural choice that drives the timeline, not the encryption code itself.

## Why this layering exists

A previous version of S3.1 attempted to encrypt + still serve full-text
search by dual-storing plaintext alongside ciphertext. That was a
silent regression — it shipped CMEK in name but PII still sat in
clear in `content`. This layer is intentionally the encryption-only
piece; the FTS migration is a separate explicit decision so we can't
regress the same way again.
