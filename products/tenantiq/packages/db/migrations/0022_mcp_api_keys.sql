-- Long-lived API keys for the MCP endpoint. Issued from /settings/api-keys,
-- displayed once on creation, then only the SHA-256 of the key is stored.
-- Auth middleware accepts `Authorization: Bearer tiq_*` and looks up the
-- hash here.

CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  label           TEXT NOT NULL,
  key_hash        TEXT NOT NULL,
  prefix          TEXT NOT NULL,        -- first 12 chars of the plaintext, shown in the UI
  last_used_at    INTEGER,              -- epoch ms
  revoked_at      INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_keys_hash ON mcp_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_keys_org ON mcp_api_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_mcp_keys_user ON mcp_api_keys (user_id);
