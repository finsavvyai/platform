-- Sprint 40 — TokenForge workforce mode (OIDC).
-- See packages/db/src/schema/tf-workforce.ts for documentation.

CREATE TABLE IF NOT EXISTS tf_workforce_apps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  idp_type TEXT NOT NULL,
  issuer TEXT NOT NULL,
  audience TEXT NOT NULL,
  jwks_uri TEXT NOT NULL,
  token_endpoint TEXT,
  allowed_origins TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_workforce_apps_tenant ON tf_workforce_apps(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_workforce_apps_aud ON tf_workforce_apps(tenant_id, audience);
