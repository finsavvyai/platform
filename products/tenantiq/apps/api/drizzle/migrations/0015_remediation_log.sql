-- Remediation action audit. Captures each attempt to auto-fix a control,
-- including before/after state snapshots so users can roll back if needed.

CREATE TABLE IF NOT EXISTS remediation_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_resource TEXT,
  before_state TEXT,
  after_state TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  executed_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_remediation_tenant ON remediation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_status ON remediation_log(status);
CREATE INDEX IF NOT EXISTS idx_remediation_executed ON remediation_log(executed_at);
CREATE INDEX IF NOT EXISTS idx_remediation_tenant_executed ON remediation_log(tenant_id, executed_at);
