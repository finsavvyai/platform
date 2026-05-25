-- Migration 027 — per-tenant LLM provider credentials (BYOK).
-- Claude Team A3 closeout: customers bring their own Anthropic key
-- so they don't double-pay (they already pay Anthropic directly).
--
-- The plaintext API key never lands in the row. Ciphertext is
-- AES-256-GCM-sealed with a platform-wide BYOK_ENCRYPTION_KEY env
-- var; the nonce is stored alongside. CMEK envelope encryption is
-- a separate hardening pass — out of scope for this migration.
--
-- One row per (tenant_id, provider) pair. UNIQUE constraint forces
-- the admin endpoint to UPSERT on rotation rather than appending.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_provider_credentials (
    tenant_id    UUID NOT NULL,
    provider     TEXT NOT NULL,
    ciphertext   BYTEA NOT NULL,
    nonce        BYTEA NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_provider_credentials_provider
    ON tenant_provider_credentials (provider);

COMMIT;
