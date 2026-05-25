-- T1.5: named baselines for config snapshots.
-- Adds a label column alongside the existing is_baseline flag so a tenant
-- can name their baseline (e.g., "post-soc2-2026-q1"). Drift detection
-- prefers the active baseline (is_baseline = 1) over the latest snapshot.

ALTER TABLE config_snapshots ADD COLUMN baseline_label TEXT;

CREATE INDEX IF NOT EXISTS idx_config_snapshots_baseline
  ON config_snapshots (tenant_id, is_baseline);
