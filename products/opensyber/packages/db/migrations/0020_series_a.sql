-- Sprint 34: Series A Exit tables

CREATE TABLE IF NOT EXISTS multi_cloud_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  config TEXT NOT NULL,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS soc2_evidence (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  tsc TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  artifact_url TEXT,
  collected_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'current'
);

CREATE INDEX IF NOT EXISTS idx_multi_cloud_org ON multi_cloud_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_soc2_evidence_org ON soc2_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_soc2_evidence_control ON soc2_evidence(control_id);
