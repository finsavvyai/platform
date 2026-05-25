-- User Lifecycle Automation tables
CREATE TABLE IF NOT EXISTS lifecycle_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'offboard',
  steps TEXT NOT NULL DEFAULT '[]',
  requires_approval INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lifecycle_executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_user_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  steps_completed INTEGER NOT NULL DEFAULT 0,
  steps_total INTEGER NOT NULL DEFAULT 0,
  step_results TEXT NOT NULL DEFAULT '[]',
  initiated_by TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_templates_tenant ON lifecycle_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_executions_tenant ON lifecycle_executions(tenant_id, started_at DESC);
