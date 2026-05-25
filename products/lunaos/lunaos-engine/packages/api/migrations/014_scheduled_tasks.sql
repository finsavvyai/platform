-- 014_scheduled_tasks.sql
-- Supports Phase 3: Scheduled and Event-Driven Agents

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain_name TEXT NOT NULL,
    chain_def TEXT, -- Optional custom chain definition JSON
    context TEXT, -- Default input context for scheduled runs
    cron_schedule TEXT NOT NULL, -- e.g. "0 9 * * *"
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_active ON scheduled_tasks(is_active);
