-- Chain Execution Tracking
-- Stores chain execution history per user

CREATE TABLE IF NOT EXISTS chain_executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain_name TEXT NOT NULL,
    chain_def TEXT,             -- JSON chain definition used
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, partial, failed
    duration_ms INTEGER,
    node_results TEXT,          -- JSON array of node-level results
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_chain_executions_user ON chain_executions(user_id, created_at);
