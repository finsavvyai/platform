-- 013_chain_executions.sql
-- Supports Phase 3: Advanced Workflows (HITL & Persistent Chains)

CREATE TABLE IF NOT EXISTS chain_executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running', -- running, paused, completed, failed, waiting_for_approval
    current_node_index INTEGER NOT NULL DEFAULT 0,
    nodes_config TEXT NOT NULL, -- JSON array of node definitions 
    context TEXT, -- JSON state passed between nodes
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chain_executions_user ON chain_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_chain_executions_status ON chain_executions(status);
