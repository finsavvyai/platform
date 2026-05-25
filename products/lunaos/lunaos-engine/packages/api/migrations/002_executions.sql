-- 002_executions.sql
-- Agent execution history for tracking runs, costs, and performance

CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'deepseek',
    model TEXT NOT NULL DEFAULT 'deepseek-chat',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    output_length INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    rag_sources INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_executions_user_id ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent ON executions(agent);
CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at);
CREATE INDEX IF NOT EXISTS idx_executions_user_agent ON executions(user_id, agent);
