-- OpenSyber outbound webhook integrations
-- Stores per-org configuration for dispatching tenantiq alerts to an OpenSyber
-- receiver endpoint with HMAC-SHA256 signed payloads.

CREATE TABLE IF NOT EXISTS tf_opensyber_integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  opensyber_url TEXT NOT NULL,
  secret_encrypted TEXT NOT NULL,
  connection_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tf_opensyber_org ON tf_opensyber_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_tf_opensyber_status ON tf_opensyber_integrations(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_opensyber_org_conn
  ON tf_opensyber_integrations(org_id, connection_name);
