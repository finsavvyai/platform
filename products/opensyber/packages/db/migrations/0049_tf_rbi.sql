-- OpenSyber Sprint C3 — Remote Browser Isolation (Kasm Workspaces) tenant + session state.
-- One tenant row per customer Kasm cluster. Sessions are one row per
-- request_kasm call. Cluster provisioning lives in agent-runtime.

CREATE TABLE IF NOT EXISTS tf_rbi_tenants (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT REFERENCES organizations(id),

  tenant_name TEXT NOT NULL,
  kasm_api_url TEXT NOT NULL,
  kasm_api_key_id TEXT NOT NULL,
  api_key_secret_encrypted TEXT NOT NULL,
  default_image_id TEXT NOT NULL,
  default_workspace_id TEXT,
  session_max_seconds INTEGER NOT NULL DEFAULT 1800,

  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'paused', 'error', 'deleted')),

  active_session_count INTEGER NOT NULL DEFAULT 0,
  last_health_check_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_rbi_tenants_owner
  ON tf_rbi_tenants(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_tf_rbi_tenants_org
  ON tf_rbi_tenants(org_id);

CREATE INDEX IF NOT EXISTS idx_tf_rbi_tenants_status
  ON tf_rbi_tenants(status);

CREATE TABLE IF NOT EXISTS tf_rbi_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tf_rbi_tenants(id),
  kasm_id TEXT NOT NULL,
  user_id_external TEXT NOT NULL,
  image_id TEXT NOT NULL,
  source_url TEXT,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'error')),

  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tf_rbi_sessions_tenant
  ON tf_rbi_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tf_rbi_sessions_kasm
  ON tf_rbi_sessions(kasm_id);

CREATE INDEX IF NOT EXISTS idx_tf_rbi_sessions_status
  ON tf_rbi_sessions(status);
