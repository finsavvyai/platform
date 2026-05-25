-- v1.7.0 skill marketplace social layer.
-- Comments (threaded), upvotes (idempotent toggle), usage events (telemetry opt-in).

CREATE TABLE IF NOT EXISTS skill_comments (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  author_sub TEXT NOT NULL,
  author_login TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  parent_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_skill_comments_skill
  ON skill_comments(skill_id, created_at DESC);

CREATE TABLE IF NOT EXISTS skill_upvotes (
  skill_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (skill_id, user_sub)
);

CREATE TABLE IF NOT EXISTS skill_usage_events (
  skill_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  invocation_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skill_usage_skill
  ON skill_usage_events(skill_id, invocation_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_usage_user
  ON skill_usage_events(user_sub, invocation_at DESC);
