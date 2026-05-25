-- Sprint 33: Remediation Engine tables

CREATE TABLE IF NOT EXISTS remediation_playbooks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config TEXT,
  steps TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS remediation_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  playbook_id TEXT NOT NULL REFERENCES remediation_playbooks(id),
  triggered_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL,
  step_results TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_playbooks_org ON remediation_playbooks(org_id);
CREATE INDEX IF NOT EXISTS idx_runs_org ON remediation_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_runs_playbook ON remediation_runs(playbook_id);
