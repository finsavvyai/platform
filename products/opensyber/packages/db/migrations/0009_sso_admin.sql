-- ============================================================================
-- Migration 0009: SSO, Admin Panel, and Audit Enhancements
-- ============================================================================

-- SSO Configurations (one per organization)
CREATE TABLE sso_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc')),
  -- SAML fields
  entity_id TEXT,
  sso_url TEXT,
  certificate TEXT,
  -- OIDC fields
  oidc_client_id TEXT,
  oidc_client_secret_encrypted TEXT,
  oidc_issuer TEXT,
  -- Shared config
  auto_provision INTEGER NOT NULL DEFAULT 0,
  default_role TEXT NOT NULL DEFAULT 'viewer',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_sso_configs_org ON sso_configs(org_id);

-- Add admin and suspension flags to users
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0;

-- Add actor tracking to audit log
ALTER TABLE audit_log ADD COLUMN actor_id TEXT;
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
