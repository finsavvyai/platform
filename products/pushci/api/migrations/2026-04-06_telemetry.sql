CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  email_hash TEXT,
  name TEXT,
  stacks_json TEXT,
  os TEXT,
  arch TEXT,
  cli_version TEXT,
  repo_hash TEXT,
  event_ts TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event ON telemetry_events(event);
CREATE INDEX IF NOT EXISTS idx_telemetry_email ON telemetry_events(email_hash);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry_events(event_ts);
