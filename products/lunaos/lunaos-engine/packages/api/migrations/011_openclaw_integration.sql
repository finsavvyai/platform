-- 011_openclaw_integration.sql
-- OpenClaw native integration — tracks gateways, sessions, skill executions

-- Registered OpenClaw Gateways (persisted from KV for analytics & management)
CREATE TABLE IF NOT EXISTS openclaw_gateways (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    gateway_url TEXT NOT NULL,
    label TEXT DEFAULT 'Default Gateway',
    status TEXT DEFAULT 'active',          -- active, inactive, error
    last_connected_at TEXT,
    last_health_check TEXT,
    health_status TEXT DEFAULT 'unknown',  -- healthy, degraded, unhealthy, unknown
    metadata TEXT,                         -- JSON: version, capabilities, etc.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OpenClaw Sessions — tracks sub-agent sessions spawned on remote gateways
CREATE TABLE IF NOT EXISTS openclaw_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    gateway_id TEXT NOT NULL,
    session_key TEXT,
    run_id TEXT,
    agent TEXT NOT NULL,
    agent_name TEXT,
    status TEXT DEFAULT 'spawned',         -- spawned, running, completed, failed, timeout
    task_summary TEXT,
    result_summary TEXT,
    message_count INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gateway_id) REFERENCES openclaw_gateways(id) ON DELETE CASCADE
);

-- OpenClaw Skill Executions — tracks which skills (tools) are invoked
CREATE TABLE IF NOT EXISTS openclaw_skill_executions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    skill_name TEXT NOT NULL,              -- luna_run, luna_chain, luna_search, luna_index
    agent_slug TEXT,                       -- e.g., code-review, 365-security
    provider TEXT DEFAULT 'deepseek',
    input_length INTEGER DEFAULT 0,
    output_length INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',       -- completed, failed, timeout
    error TEXT,
    source TEXT DEFAULT 'api',             -- api, plugin, gateway, cli
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performant queries
CREATE INDEX IF NOT EXISTS idx_oc_gateways_user ON openclaw_gateways(user_id);
CREATE INDEX IF NOT EXISTS idx_oc_gateways_status ON openclaw_gateways(status);

CREATE INDEX IF NOT EXISTS idx_oc_sessions_user ON openclaw_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oc_sessions_gateway ON openclaw_sessions(gateway_id);
CREATE INDEX IF NOT EXISTS idx_oc_sessions_status ON openclaw_sessions(status);
CREATE INDEX IF NOT EXISTS idx_oc_sessions_agent ON openclaw_sessions(agent);
CREATE INDEX IF NOT EXISTS idx_oc_sessions_created ON openclaw_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_oc_skills_user ON openclaw_skill_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_oc_skills_name ON openclaw_skill_executions(skill_name);
CREATE INDEX IF NOT EXISTS idx_oc_skills_agent ON openclaw_skill_executions(agent_slug);
CREATE INDEX IF NOT EXISTS idx_oc_skills_created ON openclaw_skill_executions(created_at);
