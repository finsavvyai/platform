-- Config Snapshot & Restore tables
CREATE TABLE IF NOT EXISTS config_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  snapshot_type TEXT NOT NULL DEFAULT 'manual',
  category_count INTEGER NOT NULL DEFAULT 0,
  object_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_snapshots_tenant ON config_snapshots(tenant_id, created_at DESC);
