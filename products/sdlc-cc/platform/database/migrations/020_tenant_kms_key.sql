-- 020_tenant_kms_key.sql
-- BEAT-PLAN S3.1 — CMEK envelope encryption.
--
-- Adds the customer-supplied KEK identifier to tenants. The crypto
-- envelope layer (services/gateway/internal/infrastructure/crypto/
-- envelope.go) reads this column at write/read time:
--   - Encrypt(): wraps the per-row DEK against tenants.kms_key_arn
--   - Decrypt(): unwraps via the same ARN; KEK revoke -> ErrRevoked
--
-- Format is deliberately TEXT (not constrained to AWS) so we can add
-- GCP / Azure ARN-equivalents without a schema change. NULL means the
-- tenant uses the platform-managed KEK.

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS kms_key_arn TEXT NULL;

-- Helpful when the admin UI lists which tenants have CMEK enabled.
CREATE INDEX IF NOT EXISTS idx_tenants_kms_key_arn_present
    ON tenants ((kms_key_arn IS NOT NULL))
    WHERE kms_key_arn IS NOT NULL;

COMMENT ON COLUMN tenants.kms_key_arn IS
    'Customer-supplied KEK identifier (AWS KMS ARN, GCP resource name, or Azure Key Vault URL). NULL = platform-managed key.';
