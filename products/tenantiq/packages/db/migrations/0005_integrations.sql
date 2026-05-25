-- PSA/RMM Integration tables for ConnectWise, Datto Autotask, Kaseya BMS

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  config_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TEXT,
  sync_interval_minutes INTEGER DEFAULT 60,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

CREATE TABLE IF NOT EXISTS integration_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  remote_name TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(integration_id, entity_type, local_id)
);

CREATE INDEX IF NOT EXISTS idx_int_mappings_integration ON integration_mappings(integration_id);
