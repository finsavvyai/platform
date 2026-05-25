-- Migration 0002: billing usage tracking
-- Applied: 2026-04-12

CREATE TABLE IF NOT EXISTS usage_daily (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_project ON usage_daily(project_id, date);
