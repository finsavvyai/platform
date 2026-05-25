-- Migration 020: audit_events table for Enterprise audit log.
CREATE TABLE IF NOT EXISTS audit_events (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  actor_user_id   TEXT,
  action          TEXT NOT NULL,
  target          TEXT,
  metadata        TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_events(action);
