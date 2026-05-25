-- CP-021: Add prompts versioning tables + quality scores to schema.
-- prompts/prompt_versions were in 0004_prompt_store.sql without DEFAULT on id — this syncs schema.sql.

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  system TEXT,
  model TEXT,
  variables TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  UNIQUE(prompt_id, version)
);

CREATE TABLE IF NOT EXISTS quality_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  request_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompts_project ON prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_quality_project ON quality_scores(project_id, created_at);
