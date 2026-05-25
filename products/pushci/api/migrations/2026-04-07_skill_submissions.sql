-- Community skill submissions
CREATE TABLE IF NOT EXISTS skill_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_login TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  steps_json TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  repo_url TEXT,
  status TEXT DEFAULT 'pending',
  reviewer_id TEXT,
  review_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_skill_sub_user ON skill_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_sub_status ON skill_submissions(status);

-- Structured pipeline logs
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  job_id TEXT,
  level TEXT DEFAULT 'info',
  source TEXT DEFAULT 'runner',
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plog_run ON pipeline_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_plog_level ON pipeline_logs(run_id, level);
CREATE INDEX IF NOT EXISTS idx_plog_ts ON pipeline_logs(timestamp);
