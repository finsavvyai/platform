-- Claude Agent Platform Database Initialization
-- This script sets up the database with extensions and basic configuration

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create custom types for enums (will be overridden by Prisma but kept for reference)
-- These are automatically created by Prisma migrate

-- Create indexes for performance optimization
-- These are examples of additional indexes that might be useful

-- Full-text search indexes
-- CREATE INDEX IF NOT EXISTS idx_rag_contexts_content_gin
-- ON rag_contexts USING gin(to_tsvector('english', content));

-- JSON field indexes
-- CREATE INDEX IF NOT EXISTS idx_agents_capabilities_gin
-- ON agents USING gin(capabilities);

-- Composite indexes for common queries
-- CREATE INDEX IF NOT EXISTS idx_tasks_project_status_priority
-- ON tasks(project_id, status, priority DESC);

-- Time-based partitioning for large tables (if needed)
-- This would be implemented for token_usage and audit_logs in production

-- Set up row-level security policies (optional)
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY project_access_policy ON projects
--   FOR ALL TO authenticated_user
--   USING (owner_id = current_user_id() OR id IN (
--     SELECT project_id FROM project_users WHERE user_id = current_user_id()
--   ));

-- Create database functions for common operations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create notification channels for real-time updates
-- LISTEN task_updates;
-- LISTEN agent_health_changes;
-- LISTEN token_budget_alerts;

-- Set up database statistics collection
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;

-- Configure work_mem for better query performance
-- ALTER SYSTEM SET work_mem = '256MB';

-- Create stored procedures for common operations
CREATE OR REPLACE FUNCTION get_project_agent_stats(p_project_id UUID)
RETURNS TABLE (
    agent_name VARCHAR,
    agent_type VARCHAR,
    status VARCHAR,
    task_count BIGINT,
    avg_execution_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.name,
        a.type,
        a.status,
        COUNT(t.id) as task_count,
        AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) as avg_execution_time
    FROM agents a
    LEFT JOIN tasks t ON a.id = t.agent_id
    WHERE a.project_id = p_project_id
    GROUP BY a.id, a.name, a.type, a.status
    ORDER BY task_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function for token usage analytics
CREATE OR REPLACE FUNCTION get_monthly_token_usage(p_project_id UUID, p_year INT, p_month INT)
RETURNS TABLE (
    provider VARCHAR,
    model VARCHAR,
    total_tokens BIGINT,
    total_cost NUMERIC,
    optimized_savings NUMERIC,
    task_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tu.provider,
        tu.model,
        SUM(tu.tokens) as total_tokens,
        SUM(tu.cost) as total_cost,
        COALESCE(SUM(tu.savings), 0) as optimized_savings,
        COUNT(*) as task_count
    FROM token_usage tu
    WHERE tu.project_id = p_project_id
        AND EXTRACT(YEAR FROM tu.timestamp) = p_year
        AND EXTRACT(MONTH FROM tu.timestamp) = p_month
    GROUP BY tu.provider, tu.model
    ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function for RAG context relevance scoring
CREATE OR REPLACE FUNCTION update_context_relevance_score()
RETURNS TRIGGER AS $$
BEGIN
    -- This would typically use a machine learning model
    -- For now, we'll use a simple keyword-based scoring
    NEW.relevance_score =
        CASE
            WHEN NEW.content LIKE '%architecture%' OR NEW.content LIKE '%overview%' THEN 0.95
            WHEN NEW.content LIKE '%configuration%' OR NEW.content LIKE '%example%' THEN 0.85
            WHEN NEW.content LIKE '%documentation%' OR NEW.content LIKE '%guide%' THEN 0.80
            ELSE 0.70
        END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic relevance scoring
-- CREATE TRIGGER trigger_update_relevance_score
--   BEFORE INSERT OR UPDATE ON rag_contexts
--   FOR EACH ROW EXECUTE FUNCTION update_context_relevance_score();

-- Create view for dashboard analytics
CREATE OR REPLACE VIEW project_dashboard AS
SELECT
    p.id as project_id,
    p.name as project_name,
    p.status as project_status,
    COUNT(DISTINCT a.id) as agent_count,
    COUNT(DISTINCT CASE WHEN a.status = 'RUNNING' THEN a.id END) as active_agents,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' THEN t.id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'FAILED' THEN t.id END) as failed_tasks,
    COALESCE(SUM(tu.tokens), 0) as total_tokens_used,
    COALESCE(SUM(tu.cost), 0) as total_cost,
    COALESCE(tb.monthly_limit, 0) as monthly_budget,
    COALESCE(tb.current_usage, 0) as current_usage
FROM projects p
LEFT JOIN agents a ON p.id = a.project_id
LEFT JOIN tasks t ON p.id = t.project_id
LEFT JOIN token_usage tu ON p.id = tu.project_id
    AND EXTRACT(MONTH FROM tu.timestamp) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM tu.timestamp) = EXTRACT(YEAR FROM CURRENT_DATE)
LEFT JOIN token_budgets tb ON p.id = tb.project_id
    AND tb.period_start <= CURRENT_DATE
    AND tb.period_end >= CURRENT_DATE
GROUP BY p.id, p.name, p.status, tb.monthly_limit, tb.current_usage;

-- Create view for agent performance metrics
CREATE OR REPLACE VIEW agent_performance_metrics AS
SELECT
    a.id as agent_id,
    a.name as agent_name,
    a.type as agent_type,
    a.status as agent_status,
    COUNT(t.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' THEN t.id END) as completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'FAILED' THEN t.id END) as failed_tasks,
    ROUND(
        COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' THEN t.id END)::NUMERIC /
        NULLIF(COUNT(t.id), 0) * 100, 2
    ) as success_rate,
    AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) as avg_execution_time,
    MAX(t.updated_at) as last_activity
FROM agents a
LEFT JOIN tasks t ON a.id = t.agent_id
GROUP BY a.id, a.name, a.type, a.status;

-- Create function for health check aggregation
CREATE OR REPLACE FUNCTION get_agent_health_summary(p_agent_id UUID)
RETURNS TABLE (
    status VARCHAR,
    last_check TIMESTAMP,
    cpu_usage NUMERIC,
    memory_usage NUMERIC,
    error_rate NUMERIC,
    uptime_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        hc.status,
        MAX(hc.timestamp) as last_check,
        (hc.metrics->>'cpu')::NUMERIC as cpu_usage,
        (hc.metrics->>'memory')::NUMERIC as memory_usage,
        (hc.metrics->>'errorRate')::NUMERIC as error_rate,
        (hc.metrics->>'uptime')::NUMERIC as uptime_percentage
    FROM health_checks hc
    WHERE hc.agent_id = p_agent_id
        AND hc.timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY hc.status
    ORDER BY last_check DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Set up automated cleanup procedures
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
       OR (last_accessed < CURRENT_TIMESTAMP - INTERVAL '30 days' AND is_active = false);
END;
$$ LANGUAGE plpgsql;

-- Create function to archive old token usage records
CREATE OR REPLACE FUNCTION archive_token_usage(archive_months INT DEFAULT 12)
RETURNS void AS $$
BEGIN
    -- This would move records to an archive table
    -- Implementation depends on archival requirements
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Create database user with limited permissions for API access
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'claude_api_user') THEN
--         CREATE ROLE claude_api_user WITH LOGIN PASSWORD 'secure_password_here';
--     END IF;
-- END
-- $$;

-- Grant permissions to API user
-- GRANT CONNECT ON DATABASE claude_agent TO claude_api_user;
-- GRANT USAGE ON SCHEMA public TO claude_api_user;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO claude_api_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO claude_api_user;

-- Set up row-level security policies for multi-tenancy
-- This ensures users can only access their own data
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create function to check project access
CREATE OR REPLACE FUNCTION check_project_access(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_users
        WHERE project_id = p_project_id
            AND user_id = p_user_id
            AND status = 'ACTIVE'
    ) OR EXISTS (
        SELECT 1 FROM projects
        WHERE id = p_project_id
            AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for RAG search optimization
-- These would be created by Prisma but documented here for reference
-- CREATE INDEX CONCURRENTLY idx_rag_contexts_project_active
-- ON rag_contexts(project_id, is_active) WHERE is_active = true;

-- CREATE INDEX CONCURRENTLY idx_rag_contexts_relevance_desc
-- ON rag_contexts(relevance_score DESC, created_at DESC)
-- WHERE is_active = true;

-- JSON index for agent capabilities search
-- CREATE INDEX CONCURRENTLY idx_agents_capabilities_gin
-- ON agents USING gin(capabilities);

-- Partial index for active agents only
-- CREATE INDEX CONCURRENTLY idx_agents_active_status
-- ON agents(status, updated_at) WHERE status IN ('RUNNING', 'STARTING');

-- Composite index for task queue optimization
-- CREATE INDEX CONCURRENTLY idx_tasks_queue_priority
-- ON tasks(status, priority DESC, created_at)
-- WHERE status IN ('PENDING', 'QUEUED');

-- Create trigger functions for automated timestamp updates
CREATE OR REPLACE FUNCTION set_created_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Initialize database with default data
INSERT INTO system_config (key, value, category) VALUES
('DATABASE_VERSION', '1.0.0', 'system'),
('MAX_CONNECTIONS', 100, 'performance'),
('STATEMENT_TIMEOUT', '300s', 'performance'),
('IDLE_IN_TRANSACTION_SESSION_TIMEOUT', '60000', 'performance')
ON CONFLICT (key) DO NOTHING;

-- Log database initialization
DO $$
BEGIN
    RAISE NOTICE 'Claude Agent Platform database initialized successfully';
    RAISE NOTICE 'Created extensions, functions, views, and initial configuration';
    RAISE NOTICE 'Ready for Prisma migration and seeding';
END $$;
