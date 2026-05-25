-- Migration 0011: Agent activity log for VSCode extension cloud sync
-- Stores per-user, per-session AI agent activity events synced from the extension

CREATE TABLE IF NOT EXISTS agent_activity (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  session_id  TEXT NOT NULL,
  agent       TEXT NOT NULL,
  type        TEXT NOT NULL,           -- 'file_read' | 'bash_exec'
  risk        TEXT NOT NULL,           -- 'critical' | 'high' | 'medium' | 'low'
  path        TEXT,
  summary     TEXT NOT NULL,
  secrets_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_user    ON agent_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_risk    ON agent_activity(user_id, risk);
CREATE INDEX IF NOT EXISTS idx_agent_activity_session ON agent_activity(session_id);
