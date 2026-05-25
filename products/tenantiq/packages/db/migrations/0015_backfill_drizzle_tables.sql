-- Backfill migration: tables that were defined only in packages/db/src/schema-d1.ts
-- and reached production via drizzle-kit but never got a proper migration file.
--
-- This caused 0010_add_compound_indexes.sql and 0014_drift_attribution.sql to
-- fail when applied to a fresh local D1, because their target tables didn't
-- exist. `IF NOT EXISTS` makes this migration safe to apply on production
-- (where these tables already exist) and idempotent on local re-runs.
--
-- Scope: tables actively referenced by the drift-detection + snapshot path.
-- Other Drizzle-only tables (workflows, alerts, tokenforge_*, ai_conversations,
-- etc.) are NOT covered here — separate backfill needed if local dev hits them.

CREATE TABLE IF NOT EXISTS config_snapshots (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	label TEXT NOT NULL DEFAULT '',
	snapshot_type TEXT NOT NULL DEFAULT 'manual',
	category_count INTEGER NOT NULL DEFAULT 0,
	object_count INTEGER NOT NULL DEFAULT 0,
	error_count INTEGER NOT NULL DEFAULT 0,
	baseline INTEGER DEFAULT 0,
	created_by TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_snapshots_tenant ON config_snapshots(tenant_id);

-- config_drifts: backfill without the attribution columns. Migration 0014
-- ALTERs them in afterwards. Keeping concerns separate so re-running on a
-- partially-migrated environment doesn't trip duplicate-column errors.
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
	acknowledged INTEGER DEFAULT 0,
	detected_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_drifts_tenant ON config_drifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_drifts_snapshot ON config_drifts(snapshot_id);

CREATE TABLE IF NOT EXISTS copilot_assessments (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	overall_score INTEGER NOT NULL,
	category_scores TEXT NOT NULL,
	recommendations TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	started_at TEXT NOT NULL,
	completed_at TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_copilot_assessments_tenant ON copilot_assessments(tenant_id);

CREATE TABLE IF NOT EXISTS storage_analytics (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	scan_type TEXT NOT NULL,
	data TEXT,
	total_used_gb REAL DEFAULT 0,
	total_allocated_gb REAL DEFAULT 0,
	top_consumers TEXT,
	recommendations TEXT,
	scanned_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storage_analytics_tenant ON storage_analytics(tenant_id);
