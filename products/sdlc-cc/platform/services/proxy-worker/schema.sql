-- SDLC.ai Proxy Worker - D1 Database Schema

-- Usage logs table
CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    api_key_id TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    timestamp INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_timestamp ON usage_logs(timestamp);
CREATE INDEX idx_usage_api_key_id ON usage_logs(api_key_id);

-- API keys metadata (for dashboard queries)
-- Actual keys stored in KV for fast lookup
CREATE TABLE IF NOT EXISTS api_keys_metadata (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'active',
    project_id TEXT,
    adapter TEXT,
    allowed_models TEXT,
    tool_policy TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    last_used_at DATETIME,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0
);

CREATE INDEX idx_api_keys_user_id ON api_keys_metadata(user_id);
CREATE INDEX idx_api_keys_status ON api_keys_metadata(status);
CREATE INDEX idx_api_keys_project_id ON api_keys_metadata(project_id);
CREATE INDEX idx_api_keys_adapter ON api_keys_metadata(adapter);

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

CREATE INDEX idx_agent_runs_session_id ON agent_runs(session_id);
CREATE INDEX idx_agent_runs_tenant_id ON agent_runs(tenant_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
