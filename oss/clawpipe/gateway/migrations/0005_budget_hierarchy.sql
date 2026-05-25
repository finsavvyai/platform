-- Budget hierarchy: org -> team -> user -> key -> model. Pre-call walks the
-- chain and fails fast on the first exhausted node. Ported from LiteLLM.

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  name TEXT NOT NULL,
  budget_usd REAL,           -- NULL = unlimited
  budget_window_days INTEGER DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  budget_usd REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS key_budgets (
  id TEXT PRIMARY KEY,
  api_key_hash TEXT NOT NULL UNIQUE,
  team_id TEXT,
  user_id TEXT,
  budget_usd REAL,
  budget_window_days INTEGER DEFAULT 30,
  model_budgets TEXT,        -- JSON: { "gpt-4o": 50.0, "claude-opus-4-7": 20.0 }
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_key_budgets_team ON key_budgets(team_id);
CREATE INDEX IF NOT EXISTS idx_key_budgets_user ON key_budgets(user_id);
