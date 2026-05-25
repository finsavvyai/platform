-- Workflow run history. Stores each execution's status + result payload.

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at INTEGER,
  completed_at INTEGER,
  result TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at);
