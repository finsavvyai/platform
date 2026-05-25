-- Performance Optimization Indexes
-- Migration: 0008_performance_indexes.sql
-- Purpose: Add performance indexes to optimize query response times

-- Users table performance indexes
CREATE INDEX IF NOT EXISTS idx_users_tier_created_at ON users(tier, created_at);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status_trial ON users(subscription_status, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_composite_lookup ON users(user_id, email, api_key);

-- Conversations table performance indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_session_messages ON conversations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_session ON conversations(user_id, session_id);

-- Usage stats table performance indexes
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_date_type ON usage_stats(user_id, date, query_type);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date_tier ON usage_stats(date, user_tier);
CREATE INDEX IF NOT EXISTS idx_usage_stats_composite_analytics ON usage_stats(user_id, date, query_type, success);

-- Team audit log performance indexes
CREATE INDEX IF NOT EXISTS idx_team_audit_team_action_date ON team_audit_log(team_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_user_date ON team_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_composite_search ON team_audit_log(team_id, action, target_id, created_at DESC);

-- Team members performance indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_status_role ON team_members(team_id, status, role);
CREATE INDEX IF NOT EXISTS idx_team_members_user_status ON team_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_invited_date ON team_members(invited_at DESC);

-- Team projects performance indexes
CREATE INDEX IF NOT EXISTS idx_team_projects_team_activity ON team_projects(team_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_team_projects_language_created ON team_projects(language, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_projects_indexed_activity ON team_projects(indexed_at, last_activity DESC);

-- Team settings performance indexes
CREATE INDEX IF NOT EXISTS idx_team_settings_storage_limit ON team_settings(storage_limit_mb);
CREATE INDEX IF NOT EXISTS idx_team_settings_sharing_flags ON team_settings(rag_sharing, codebase_sharing);

-- Shared workspace tables performance indexes
CREATE INDEX IF NOT EXISTS idx_team_knowledge_team_category ON team_knowledge(team_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_knowledge_team_type ON team_knowledge(team_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_knowledge_fulltext_tags ON team_knowledge(team_id, tags); -- Assuming FTS is available

CREATE INDEX IF NOT EXISTS idx_workspace_search_history_team_user ON workspace_search_history(team_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_search_history_query ON workspace_search_history(query, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collab_sessions_team_status ON collaboration_sessions(team_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_participants ON collaboration_sessions(team_id, participant_ids); -- For JSON array searches

-- Analytics tables performance indexes
CREATE INDEX IF NOT EXISTS idx_search_history_user_date ON search_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_team_query ON search_history(team_id, query, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_response_time ON search_history(response_time, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_team_name_date ON performance_metrics(team_id, metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_date ON performance_metrics(metric_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_team_date ON usage_snapshots(team_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_date_type ON usage_snapshots(snapshot_date, snapshot_type);

-- License tables performance indexes
CREATE INDEX IF NOT EXISTS idx_licenses_user_status ON licenses(user_id, status);
CREATE INDEX IF NOT EXISTS idx_licenses_tier_expires ON licenses(tier, expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_user_created ON licenses(user_id, created_at DESC);

-- Error tracking performance indexes
CREATE INDEX IF NOT EXISTS idx_error_tracking_team_date ON error_tracking(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_tracking_error_code ON error_tracking(error_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_tracking_severity_date ON error_tracking(severity, created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_subscription_composite ON users(tier, subscription_status, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_team_member_composite ON team_members(team_id, status, role, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_composite ON conversations(user_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_composite ON team_audit_log(team_id, action, DATE(created_at) DESC);

-- Triggers for maintaining performance data
CREATE TRIGGER IF NOT EXISTS update_team_project_activity
AFTER UPDATE ON team_projects
WHEN NEW.last_activity > OLD.last_activity
BEGIN
    UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.team_id;
END;

CREATE TRIGGER IF NOT EXISTS maintain_audit_log_size
AFTER INSERT ON team_audit_log
WHEN (SELECT COUNT(*) FROM team_audit_log WHERE team_id = NEW.team_id) > 10000
BEGIN
    DELETE FROM team_audit_log
    WHERE team_id = NEW.team_id
    AND created_at < datetime('now', '-90 days')
    AND id NOT IN (
        SELECT id FROM team_audit_log
        WHERE team_id = NEW.team_id
        ORDER BY created_at DESC
        LIMIT 5000
    );
END;

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS performance_stats (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    table_name TEXT,
    query_type TEXT,
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance stats
CREATE INDEX IF NOT EXISTS idx_performance_stats_metric_date ON performance_stats(metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_stats_table_time ON performance_stats(table_name, execution_time_ms);

-- View for slow queries analysis
CREATE VIEW IF NOT EXISTS slow_queries_analysis AS
SELECT
    table_name,
    query_type,
    AVG(execution_time_ms) as avg_execution_time,
    MAX(execution_time_ms) as max_execution_time,
    COUNT(*) as execution_count,
    SUM(CASE WHEN execution_time_ms > 100 THEN 1 ELSE 0 END) as slow_query_count
FROM performance_stats
WHERE created_at > datetime('now', '-24 hours')
GROUP BY table_name, query_type
HAVING avg_execution_time > 50
ORDER BY avg_execution_time DESC;

-- View for cache hit rate analysis
CREATE VIEW IF NOT EXISTS cache_performance_analysis AS
SELECT
    table_name,
    query_type,
    COUNT(*) as total_queries,
    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
    ROUND(
        (SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) * 100.0) / COUNT(*),
        2
    ) as cache_hit_rate_percent
FROM performance_stats
WHERE created_at > datetime('now', '-24 hours')
GROUP BY table_name, query_type
ORDER BY cache_hit_rate_percent ASC;

-- Create indexes for full-text search (if supported)
-- Note: These would need FTS5 support in D1, which may not be available
-- Including for future optimization

-- Trigger to automatically log slow queries
CREATE TRIGGER IF NOT EXISTS log_slow_query
AFTER SELECT ON database -- This is conceptual - actual implementation varies
WHEN (execution_time_ms > 50)
BEGIN
    INSERT INTO performance_stats (
        id, metric_name, table_name, query_type, execution_time_ms, cache_hit
    ) VALUES (
        hex(randomblob(16)),
        'slow_query',
        'table_name',
        'SELECT',
        execution_time_ms,
        FALSE
    );
END;

-- Database optimization settings
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;

-- Analyze tables to update query planner statistics
ANALYZE users;
ANALYZE conversations;
ANALYZE usage_stats;
ANALYZE teams;
ANALYZE team_members;
ANALYZE team_audit_log;
ANALYZE team_projects;
ANALYZE team_settings;
ANALYZE licenses;
ANALYZE team_knowledge;
ANALYZE workspace_search_history;
ANALYZE collaboration_sessions;
ANALYZE search_history;
ANALYZE performance_metrics;
ANALYZE usage_snapshots;
ANALYZE error_tracking;