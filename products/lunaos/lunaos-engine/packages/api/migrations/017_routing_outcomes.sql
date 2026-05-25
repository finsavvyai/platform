-- Self-learning router: tracks model+agent execution outcomes
-- for intelligent routing to cheapest viable model

CREATE TABLE IF NOT EXISTS routing_outcomes (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  token_cost INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_routing_agent ON routing_outcomes(agent);
