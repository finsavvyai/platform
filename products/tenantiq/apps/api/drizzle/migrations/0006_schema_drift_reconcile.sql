-- 0006_schema_drift_reconcile.sql
-- Adds the 10 tables that exist in packages/db/src/schema-d1.ts but were never
-- materialised in prod D1. CREATE TABLE IF NOT EXISTS is idempotent so running
-- this against a freshly-migrated DB is a no-op.

CREATE TABLE IF NOT EXISTS sso_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  issuer_url TEXT,
  client_id TEXT,
  metadata_url TEXT,
  certificate TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  jit_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sso_org ON sso_connections(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_domain ON sso_connections(org_id, domain);

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
CREATE INDEX IF NOT EXISTS idx_copilot_assessments_org ON copilot_assessments(org_id);

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

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_org ON sync_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant ON sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

CREATE TABLE IF NOT EXISTS platform_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,
  value REAL NOT NULL,
  metadata TEXT,
  recorded_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_type ON platform_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_recorded ON platform_metrics(recorded_at);

CREATE TABLE IF NOT EXISTS drift_suppression_rules (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  category TEXT NOT NULL,
  path_pattern TEXT NOT NULL,
  reason TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drift_suppression_tenant ON drift_suppression_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drift_suppression_org ON drift_suppression_rules(org_id);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  config_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TEXT,
  sync_interval_minutes INTEGER DEFAULT 60,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

CREATE TABLE IF NOT EXISTS integration_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  remote_name TEXT,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_int_mappings_integration ON integration_mappings(integration_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_int_mappings_unique ON integration_mappings(integration_id, entity_type, local_id);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  contact_email TEXT NOT NULL,
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partners_org ON partners(org_id);

CREATE TABLE IF NOT EXISTS org_branding (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#2563eb',
  secondary_color TEXT NOT NULL DEFAULT '#7c3aed',
  company_name TEXT NOT NULL DEFAULT '',
  custom_domain TEXT,
  email_from_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_branding_org ON org_branding(org_id);
