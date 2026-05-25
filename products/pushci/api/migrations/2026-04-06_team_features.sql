-- Runner minute usage tracking
CREATE TABLE IF NOT EXISTS cloud_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_sub TEXT NOT NULL,
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  minutes REAL NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cloud_usage_user ON cloud_usage(user_sub, recorded_at);
CREATE INDEX IF NOT EXISTS idx_cloud_usage_project ON cloud_usage(project_id, recorded_at);
