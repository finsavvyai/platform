-- 023_document_envelope.sql
-- BEAT-PLAN S3.1 follow-up — per-document encryption envelope.
--
-- Adds two columns + supporting index:
--   documents.envelope JSONB  — wire format from crypto.Envelope
--   documents.kek_arn  TEXT   — convenience copy for audit queries
--
-- The repo's Create / Get path encrypts the document body with the
-- tenant's customer-managed KEK (tenants.kms_key_arn from migration
-- 020) and stores the envelope here. Plaintext `content` continues
-- to back the full-text search index until the FTS path is migrated
-- to a DLP-sanitized summary column (separate migration).

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS envelope JSONB NULL,
    ADD COLUMN IF NOT EXISTS kek_arn  TEXT  NULL;

-- Partial index so the encrypted-doc selector (used by the SOC2
-- evidence query for CC6.8) is fast even on a mostly-unencrypted
-- corpus.
CREATE INDEX IF NOT EXISTS idx_documents_kek_arn_present
    ON documents ((kek_arn IS NOT NULL))
    WHERE kek_arn IS NOT NULL;

COMMENT ON COLUMN documents.envelope IS
    'crypto.Envelope JSON: {kek_arn, wrapped_dek, nonce, ciphertext}. NULL means the doc body is stored as plaintext (legacy / non-CMEK tenants).';
COMMENT ON COLUMN documents.kek_arn IS
    'Convenience copy of envelope->>kek_arn for audit queries. Stays in sync via the repo write path; do NOT update directly.';
