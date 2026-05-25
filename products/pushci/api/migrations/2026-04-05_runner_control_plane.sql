CREATE TABLE IF NOT EXISTS runner_registration_tokens (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_sub TEXT NOT NULL,
  created_by_login TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runners (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  labels_json TEXT NOT NULL DEFAULT '[]',
  os TEXT NOT NULL,
  arch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  ip TEXT,
  version TEXT,
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  project_id TEXT NOT NULL,
  runner_id TEXT,
  kind TEXT NOT NULL DEFAULT 'ci',
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  environment TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  steps_json TEXT NOT NULL DEFAULT '[]',
  labels_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runner_registration_tokens_project
  ON runner_registration_tokens(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runners_project_status
  ON runners(project_id, status, last_heartbeat DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_project_status
  ON jobs(project_id, status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_jobs_run
  ON jobs(run_id, created_at ASC);
