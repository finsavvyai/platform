-- SSO Connections table for per-org SAML/OIDC identity provider configuration
CREATE TABLE IF NOT EXISTS sso_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,          -- 'saml' | 'oidc'
  display_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  issuer_url TEXT,
  client_id TEXT,
  metadata_url TEXT,
  certificate TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',  -- 'active' | 'inactive'
  jit_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sso_org ON sso_connections(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_domain ON sso_connections(org_id, domain);
