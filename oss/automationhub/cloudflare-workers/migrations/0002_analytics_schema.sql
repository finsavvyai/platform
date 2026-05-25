-- UPM.Plus AutomationHub - Analytics Schema
-- Migration: 0002_analytics_schema
-- Created: November 7, 2024

-- Analytics events table (for backup and detailed analysis)
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    properties TEXT, -- JSON object
    value REAL DEFAULT 0,
    duration INTEGER DEFAULT 0,
    status_code INTEGER,
    user_type TEXT,
    user_agent TEXT,
    ip_address TEXT,
    country TEXT,
    colo TEXT,
    timestamp REAL NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Daily analytics summary table
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    total_events INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    avg_session_duration REAL DEFAULT 0,
    total_value REAL DEFAULT 0,
    top_events TEXT, -- JSON array
    geographic_distribution TEXT, -- JSON object
    error_rate REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    tags TEXT, -- JSON object
    timestamp REAL NOT NULL,
    created_at TEXT NOT NULL
);

-- User activity tracking table
CREATE TABLE IF NOT EXISTS user_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data TEXT, -- JSON object
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    duration INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workflow performance table
CREATE TABLE IF NOT EXISTS workflow_performance (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    execution_id TEXT,
    total_duration INTEGER DEFAULT 0,
    step_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_step_duration REAL DEFAULT 0,
    input_size INTEGER DEFAULT 0,
    output_size INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE SET NULL
);

-- Agent performance table
CREATE TABLE IF NOT EXISTS agent_performance (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    task_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_execution_time REAL DEFAULT 0,
    total_execution_time INTEGER DEFAULT 0,
    last_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Error tracking table
CREATE TABLE IF NOT EXISTS error_tracking (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    user_id TEXT,
    session_id TEXT,
    context TEXT, -- JSON object
    severity TEXT DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warn', 'error', 'fatal')),
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Feature usage tracking table
CREATE TABLE IF NOT EXISTS feature_usage (
    id TEXT PRIMARY KEY,
    feature_name TEXT NOT NULL,
    user_id TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    properties TEXT, -- JSON object
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_country ON analytics_events(country);
CREATE INDEX IF NOT EXISTS idx_analytics_events_colo ON analytics_events(colo);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary(date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_created_at ON analytics_daily_summary(created_at);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_session_id ON user_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_performance_workflow_id ON workflow_performance(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_created_at ON workflow_performance(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_updated_at ON agent_performance(updated_at);

CREATE INDEX IF NOT EXISTS idx_error_tracking_error_type ON error_tracking(error_type);
CREATE INDEX IF NOT EXISTS idx_error_tracking_severity ON error_tracking(severity);
CREATE INDEX IF NOT EXISTS idx_error_tracking_created_at ON error_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_error_tracking_resolved_at ON error_tracking(resolved_at);

CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_name ON feature_usage(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_last_used_at ON feature_usage(last_used_at);
CREATE INDEX IF NOT EXISTS idx_feature_usage_updated_at ON feature_usage(updated_at);

-- Create views for common analytics queries
CREATE VIEW IF NOT EXISTS v_user_summary AS
SELECT
    u.id,
    u.email,
    u.name,
    u.plan,
    u.status,
    COUNT(DISTINCT ua.session_id) as total_sessions,
    COUNT(ua.id) as total_activities,
    MAX(ua.created_at) as last_activity,
    AVG(ua.duration) as avg_activity_duration
FROM users u
LEFT JOIN user_activity ua ON u.id = ua.user_id
WHERE ua.created_at >= datetime('now', '-30 days')
GROUP BY u.id, u.email, u.name, u.plan, u.status;

CREATE VIEW IF NOT EXISTS v_workflow_summary AS
SELECT
    w.id,
    w.name,
    w.creator_id,
    w.status,
    COUNT(we.id) as total_executions,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    AVG(wp.total_duration) as avg_duration,
    MAX(we.created_at) as last_execution
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
LEFT JOIN workflow_performance wp ON w.id = wp.workflow_id
GROUP BY w.id, w.name, w.creator_id, w.status;

CREATE VIEW IF NOT EXISTS v_agent_summary AS
SELECT
    a.id,
    a.name,
    a.type,
    a.status,
    ap.task_count,
    ap.success_count,
    ap.error_count,
    ap.avg_execution_time,
    ap.last_run_at,
    ROUND((CAST(ap.success_count AS REAL) / NULLIF(ap.task_count, 0)) * 100, 2) as success_rate
FROM agents a
LEFT JOIN agent_performance ap ON a.id = ap.agent_id;

-- Create triggers for automatic updates

-- Update agent performance when tasks are completed
CREATE TRIGGER IF NOT EXISTS update_agent_performance
AFTER UPDATE ON tasks
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    INSERT OR REPLACE INTO agent_performance (
        id,
        agent_id,
        task_count,
        success_count,
        error_count,
        avg_execution_time,
        total_execution_time,
        last_run_at,
        created_at,
        updated_at
    )
    SELECT
        'agent-perf-' || NEW.agent_id,
        NEW.agent_id,
        IFNULL(
            (SELECT COUNT(*) FROM tasks WHERE agent_id = NEW.agent_id AND status = 'completed'),
            0
        ),
        IFNULL(
            (SELECT COUNT(*) FROM tasks WHERE agent_id = NEW.agent_id AND status = 'completed'),
            0
        ),
        IFNULL(
            (SELECT COUNT(*) FROM tasks WHERE agent_id = NEW.agent_id AND status = 'failed'),
            0
        ),
        IFNULL(
            (SELECT AVG(execution_time) FROM tasks WHERE agent_id = NEW.agent_id AND status = 'completed'),
            0
        ),
        IFNULL(
            (SELECT SUM(execution_time) FROM tasks WHERE agent_id = NEW.agent_id AND status = 'completed'),
            0
        ),
        NEW.completed_at,
        datetime('now'),
        datetime('now')
    WHERE agent_id = NEW.agent_id;
END;

-- Update workflow performance when executions are completed
CREATE TRIGGER IF NOT EXISTS update_workflow_performance
AFTER UPDATE ON workflow_executions
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    INSERT OR REPLACE INTO workflow_performance (
        id,
        workflow_id,
        execution_id,
        total_duration,
        step_count,
        success_count,
        error_count,
        avg_step_duration,
        created_at
    )
    SELECT
        'workflow-perf-' || NEW.workflow_id || '-' || NEW.id,
        NEW.workflow_id,
        NEW.id,
        (
            SELECT JULIANDAY(NEW.completed_at) - JULIANDAY(NEW.started_at) * 86400000
        ),
        (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = NEW.workflow_id),
        (SELECT COUNT(*) FROM tasks WHERE workflow_id = NEW.workflow_id AND status = 'completed'),
        (SELECT COUNT(*) FROM tasks WHERE workflow_id = NEW.workflow_id AND status = 'failed'),
        (
            SELECT AVG(execution_time)
            FROM tasks
            WHERE workflow_id = NEW.workflow_id AND status = 'completed'
        ),
        datetime('now')
    WHERE workflow_id = NEW.workflow_id;
END;

-- Insert sample analytics data
INSERT OR IGNORE INTO analytics_daily_summary (
    id,
    date,
    total_events,
    unique_users,
    unique_sessions,
    avg_session_duration,
    total_value,
    top_events,
    geographic_distribution,
    error_rate,
    created_at,
    updated_at
) VALUES
(
    'summary-' || date('now'),
    date('now'),
    0,
    0,
    0,
    0,
    0,
    '[]',
    '{}',
    0,
    datetime('now'),
    datetime('now')
);