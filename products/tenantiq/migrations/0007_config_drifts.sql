-- Config drift detection tables
ALTER TABLE config_snapshots ADD COLUMN baseline INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS config_drifts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  baseline_id TEXT NOT NULL,
  category TEXT NOT NULL,
  path TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  acknowledged INTEGER NOT NULL DEFAULT 0,
  detected_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_drifts_tenant ON config_drifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_drifts_snapshot ON config_drifts(snapshot_id);
