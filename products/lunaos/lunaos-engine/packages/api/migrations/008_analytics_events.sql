-- Analytics events table for anonymous usage telemetry
-- Data is aggregated — user_hash is a truncated SHA-256 (no reversible PII)
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,           -- execution_start, execution_complete, execution_error, signup, api_key_created
    agent TEXT,                          -- code-review, testing-validation, etc.
    provider TEXT,                       -- anthropic, deepseek, openai, etc.
    model TEXT,                          -- claude-sonnet-4-20250514, deepseek-chat, etc.
    duration_ms INTEGER,                 -- execution duration in milliseconds
    input_tokens INTEGER,                -- estimated input token count
    output_tokens INTEGER,               -- estimated output token count
    error_type TEXT,                      -- error classification (if event_type = execution_error)
    user_hash TEXT,                       -- truncated SHA-256 of user ID (anonymous)
    tier TEXT,                           -- free, pro, team
    source TEXT,                         -- cli, api, dashboard, github-action
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common aggregation queries
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_agent ON analytics_events(agent, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_hash ON analytics_events(user_hash, created_at);
