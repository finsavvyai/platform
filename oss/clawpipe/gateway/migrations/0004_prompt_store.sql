-- Prompt store + versioning. Pattern from Helicone/Portkey/LiteLLM.
-- Stores prompt templates with {{variable}} placeholders, server-expanded
-- at call time so callers pass only prompt_id + vars.

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template TEXT NOT NULL,
  system TEXT,
  model TEXT,
  variables TEXT,              -- JSON array of required variable names
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  UNIQUE (prompt_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id, version DESC);
