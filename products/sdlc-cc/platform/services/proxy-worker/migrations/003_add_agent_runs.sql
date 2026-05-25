-- Migration: Add hosted agent run tracking

CREATE TABLE IF NOT EXISTS agent_runs (
    run_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    api_key_id TEXT NOT NULL,
    adapter TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    goal TEXT NOT NULL,
    summary TEXT,
    result_json TEXT,
    error_json TEXT,
    usage_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_session_id ON agent_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_id ON agent_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
