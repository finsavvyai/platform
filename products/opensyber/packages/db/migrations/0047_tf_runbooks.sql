-- Sprint E3 — runbook engine state.
-- Runbook *definitions* live in skills/runbooks/*.json (versioned with code).
-- This migration only persists *runs* and per-step execution logs so
-- operators can audit, replay, and debug incident response.

CREATE TABLE IF NOT EXISTS tf_runbook_runs (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL,

  trigger_alert_id TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'manual',

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  started_at TEXT,
  completed_at TEXT,

  current_step_index INTEGER NOT NULL DEFAULT 0,

  owner_user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT REFERENCES organizations(id),

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_runs_status
  ON tf_runbook_runs(status);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_runs_started_at
  ON tf_runbook_runs(started_at);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_runs_runbook_id
  ON tf_runbook_runs(runbook_id);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_runs_owner
  ON tf_runbook_runs(owner_user_id);

CREATE TABLE IF NOT EXISTS tf_runbook_step_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES tf_runbook_runs(id),

  step_index INTEGER NOT NULL,
  action TEXT NOT NULL,

  input_json TEXT,
  output_json TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped')),

  started_at TEXT,
  completed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_step_logs_run_id
  ON tf_runbook_step_logs(run_id);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_step_logs_status
  ON tf_runbook_step_logs(status);

CREATE INDEX IF NOT EXISTS idx_tf_runbook_step_logs_started_at
  ON tf_runbook_step_logs(started_at);
