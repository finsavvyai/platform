-- Add health tracking columns to integration_connections
-- Tables may not exist yet if integration feature hasn't been deployed.
-- Create them if missing, then add columns.

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  instance_id TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  config TEXT,
  error_count INTEGER DEFAULT 0,
  last_error_at TEXT,
  last_error_message TEXT,
  avg_latency_ms INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integration_events (
  id TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES integration_connections(id),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
