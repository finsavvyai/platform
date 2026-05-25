-- Per-tenant API keys for direct B2B customers (POST api.sdlc.cc/v1/messages
-- with Authorization: Bearer sk_sdlc_*). Plaintext is shown ONCE on
-- issuance; we store only the SHA-256 hash + a 12-char prefix that
-- the operator UI uses to disambiguate revocation.
--
-- Lookup is hash-keyed (UNIQUE INDEX) so verification is one indexed
-- read per request. last_used_at is best-effort; the auth middleware
-- updates it asynchronously so the verification path never blocks
-- on a write.

CREATE TABLE IF NOT EXISTS api_keys (
  id            BIGSERIAL    PRIMARY KEY,
  tenant_id     TEXT         NOT NULL,
  label         TEXT         NOT NULL DEFAULT '',
  key_hash      TEXT         NOT NULL,
  prefix        TEXT         NOT NULL,             -- "sk_sdlc_xxxxxx" (12 chars), shown in UI
  scopes        TEXT[]       NOT NULL DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by    TEXT         NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash   ON api_keys (key_hash);
CREATE INDEX        IF NOT EXISTS idx_api_keys_tenant ON api_keys (tenant_id);
CREATE INDEX        IF NOT EXISTS idx_api_keys_active ON api_keys (revoked_at) WHERE revoked_at IS NULL;
