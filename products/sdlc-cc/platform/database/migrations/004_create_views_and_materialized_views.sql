-- Migration 004: Create Views and Materialized Views
-- Version: 1.0.0
-- Description: Create optimized views for common queries and reporting
-- Dependencies: 003_create_policy_and_security_tables.sql
-- Rollback: Drop all views and materialized views
-- Tags: views,analytics,reporting

BEGIN;

-- Tenant Statistics Materialized View
CREATE MATERIALIZED VIEW tenant_statistics AS
SELECT
    t.id,
    t.name,
    t.status,
    t.subscription_tier,
    t.created_at as tenant_created_at,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active = true AND u.deleted_at IS NULL THEN u.id END) as active_users,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT CASE WHEN d.processing_status = 'completed' AND d.deleted_at IS NULL THEN d.id END) as processed_documents,
    COALESCE(SUM(d.file_size), 0) as total_storage_bytes,
    COALESCE(SUM(dc.token_count), 0) as total_tokens,
    COALESCE(SUM(tu.tokens_used), 0) as total_tokens_consumed,
    COALESCE(SUM(tu.cost_usd), 0) as total_cost_usd,
    COUNT(DISTINCT CASE WHEN d.dlp_status = 'completed' AND d.deleted_at IS NULL THEN d.id END) as dlp_scanned_documents,
    COALESCE(AVG(ds.risk_score), 0) as avg_dlp_risk_score,
    COUNT(DISTINCT p.id) as total_policies,
    COUNT(DISTINCT CASE WHEN p.is_active = true AND p.deleted_at IS NULL THEN p.id END) as active_policies,
    MAX(u.last_login) as last_user_activity,
    COUNT(DISTINCT CASE WHEN us.is_active = true AND us.expires_at > NOW() THEN us.id END) as active_sessions,
    COUNT(DISTINCT dpj.id) as pending_processing_jobs,
    COUNT(DISTINCT cr.id) as compliance_reports_generated,
    COUNT(DISTINCT CASE WHEN cr.status = 'completed' THEN cr.id END) as completed_reports
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN documents d ON t.id = d.tenant_id
LEFT JOIN document_chunks dc ON d.id = dc.document_id AND dc.deleted_at IS NULL
LEFT JOIN token_usage tu ON t.id = tu.tenant_id
LEFT JOIN dlp_scans ds ON t.id = ds.tenant_id
LEFT JOIN policies p ON t.id = p.tenant_id
LEFT JOIN user_sessions us ON t.id = us.tenant_id
LEFT JOIN document_processing_jobs dpj ON t.id = dpj.tenant_id AND dpj.status = 'pending'
LEFT JOIN compliance_reports cr ON t.id = cr.tenant_id
WHERE t.status != 'deleted' AND t.deleted_at IS NULL
GROUP BY t.id, t.name, t.status, t.subscription_tier, t.created_at;

-- Document Processing Queue View
CREATE VIEW document_processing_queue AS
SELECT
    dpj.id,
    dpj.document_id,
    dpj.tenant_id,
    dpj.job_type,
    dpj.status,
    dpj.progress,
    dpj.created_at,
    dpj.started_at,
    dpj.retry_count,
    dpj.max_retries,
    dpj.priority,
    dpj.queue_name,
    d.filename,
    d.content_type,
    d.file_size,
    t.name as tenant_name,
    u.email as created_by_email,
    -- Synthetic status string for the queue view. Cast to TEXT so the
    -- CASE doesn't pick up the document_status enum from dpj.status,
    -- which would reject 'failed_max_retries' / 'in_progress'.
    CASE
        WHEN dpj.retry_count >= dpj.max_retries THEN 'failed_max_retries'
        WHEN dpj.started_at IS NULL                THEN 'pending'
        WHEN dpj.status = 'processing'             THEN 'in_progress'
        WHEN dpj.status = 'completed'              THEN 'completed'
        ELSE dpj.status::text
    END::text as queue_status,
    CASE
        WHEN dpj.started_at IS NULL THEN EXTRACT(EPOCH FROM (NOW() - dpj.created_at))
        WHEN dpj.status = 'processing' THEN EXTRACT(EPOCH FROM (NOW() - dpj.started_at))
        ELSE NULL
    END as wait_time_seconds
FROM document_processing_jobs dpj
JOIN documents d ON dpj.document_id = d.id
JOIN tenants t ON dpj.tenant_id = t.id
JOIN users u ON d.created_by = u.id
WHERE dpj.status IN ('pending', 'processing')
ORDER BY
    dpj.priority ASC,
    dpj.retry_count ASC,
    dpj.created_at ASC;

-- User Activity Dashboard View
CREATE VIEW user_activity_dashboard AS
SELECT
    u.id,
    u.tenant_id,
    u.email,
    u.role,
    u.is_active,
    u.last_login,
    u.created_at,
    t.name as tenant_name,
    COUNT(DISTINCT d.id) as documents_uploaded,
    COUNT(DISTINCT da.id) as document_accesses,
    COUNT(DISTINCT tu.id) as token_usage_requests,
    COALESCE(SUM(tu.tokens_used), 0) as total_tokens_used,
    COALESCE(SUM(tu.cost_usd), 0) as total_cost,
    COUNT(DISTINCT us.id) as active_sessions,
    MAX(us.last_activity) as last_session_activity,
    COUNT(DISTINCT CASE WHEN da.created_at > NOW() - INTERVAL '7 days' THEN da.id END) as recent_document_accesses,
    COUNT(DISTINCT CASE WHEN tu.created_at > NOW() - INTERVAL '7 days' THEN tu.id END) as recent_token_requests,
    COUNT(DISTINCT CASE WHEN al.action IN ('create', 'update', 'delete') AND al.created_at > NOW() - INTERVAL '7 days' THEN al.id END) as recent_actions
FROM users u
JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN documents d ON u.id = d.created_by AND d.deleted_at IS NULL
LEFT JOIN document_access_log da ON u.id = da.user_id
LEFT JOIN token_usage tu ON u.id = tu.user_id
LEFT JOIN user_sessions us ON u.id = us.user_id AND us.is_active = true
LEFT JOIN audit_logs al ON u.id = al.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.tenant_id, u.email, u.role, u.is_active, u.last_login, u.created_at, t.name;

-- Token Usage Analytics View
CREATE VIEW token_usage_analytics AS
SELECT
    DATE_TRUNC('day', tu.created_at) as usage_date,
    tu.tenant_id,
    t.name as tenant_name,
    tu.provider,
    tu.model,
    COUNT(*) as request_count,
    SUM(tu.tokens_used) as total_tokens,
    SUM(tu.input_tokens) as total_input_tokens,
    SUM(tu.output_tokens) as total_output_tokens,
    SUM(tu.cost_usd) as total_cost,
    AVG(tu.processing_time_ms) as avg_processing_time_ms,
    COUNT(DISTINCT tu.user_id) as unique_users,
    COUNT(DISTINCT tu.api_key_id) as unique_api_keys,
    COUNT(CASE WHEN tu.cache_hit = true THEN 1 END) as cache_hits,
    ROUND(COUNT(CASE WHEN tu.cache_hit = true THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as cache_hit_rate_percentage
FROM token_usage tu
JOIN tenants t ON tu.tenant_id = t.id
WHERE tu.created_at >= NOW() - INTERVAL '90 days' -- Limit to recent data for performance
GROUP BY
    DATE_TRUNC('day', tu.created_at),
    tu.tenant_id,
    t.name,
    tu.provider,
    tu.model
ORDER BY usage_date DESC, total_cost DESC;

-- DLP Risk Assessment View
CREATE VIEW dlp_risk_assessment AS
SELECT
    ds.tenant_id,
    t.name as tenant_name,
    DATE_TRUNC('day', ds.created_at) as scan_date,
    ds.content_type,
    ds.action_taken,
    COUNT(*) as scan_count,
    AVG(ds.risk_score) as avg_risk_score,
    MAX(ds.risk_score) as max_risk_score,
    COUNT(CASE WHEN ds.risk_score > 0.7 THEN 1 END) as high_risk_count,
    COUNT(CASE WHEN ds.risk_score > 0.4 AND ds.risk_score <= 0.7 THEN 1 END) as medium_risk_count,
    COUNT(CASE WHEN ds.risk_score <= 0.4 THEN 1 END) as low_risk_count,
    AVG(ds.scan_duration_ms) as avg_scan_duration_ms,
    COUNT(CASE WHEN ds.review_decision IS NOT NULL THEN 1 END) as reviewed_count,
    AVG(ds.scan_confidence) as avg_confidence_score
FROM dlp_scans ds
JOIN tenants t ON ds.tenant_id = t.id
WHERE ds.created_at >= NOW() - INTERVAL '90 days'
GROUP BY
    ds.tenant_id,
    t.name,
    DATE_TRUNC('day', ds.created_at),
    ds.content_type,
    ds.action_taken
ORDER BY scan_date DESC, avg_risk_score DESC;

-- Policy Performance View
CREATE VIEW policy_performance AS
SELECT
    p.id,
    p.tenant_id,
    t.name as tenant_name,
    p.name,
    p.type,
    p.version,
    p.is_active,
    COUNT(pe.id) as total_evaluations,
    COUNT(CASE WHEN pe.decision = true THEN 1 END) as allowed_count,
    COUNT(CASE WHEN pe.decision = false THEN 1 END) as denied_count,
    ROUND(COUNT(CASE WHEN pe.decision = true THEN 1 END)::NUMERIC / NULLIF(COUNT(pe.id), 0) * 100, 2) as allow_percentage,
    AVG(pe.execution_time_ms) as avg_execution_time_ms,
    MIN(pe.execution_time_ms) as min_execution_time_ms,
    MAX(pe.execution_time_ms) as max_execution_time_ms,
    MAX(pe.created_at) as last_evaluation,
    DATE_TRUNC('day', MAX(pe.created_at)) as last_evaluation_date,
    COUNT(DISTINCT pe.user_id) as unique_users_evaluated
FROM policies p
JOIN tenants t ON p.tenant_id = t.id
LEFT JOIN policy_evaluations pe ON p.id = pe.policy_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.tenant_id, t.name, p.name, p.type, p.version, p.is_active
ORDER BY total_evaluations DESC;

-- Search Analytics View
CREATE VIEW search_analytics AS
SELECT
    DATE_TRUNC('hour', vsl.created_at) as hour_bucket,
    vsl.tenant_id,
    t.name as tenant_name,
    vsl.search_type,
    vsl.search_strategy,
    COUNT(*) as search_count,
    AVG(vsl.results_count) as avg_results_count,
    AVG(vsl.search_duration_ms) as avg_search_duration_ms,
    MIN(vsl.search_duration_ms) as min_search_duration_ms,
    MAX(vsl.search_duration_ms) as max_search_duration_ms,
    COUNT(DISTINCT vsl.user_id) as unique_users,
    COUNT(CASE WHEN vsl.search_duration_ms > 1000 THEN 1 END) as slow_searches,
    ROUND(AVG(vsl.results_count), 2) as avg_result_count,
    COUNT(CASE WHEN vsl.cache_hit = true THEN 1 END) as cached_searches,
    ROUND(COUNT(CASE WHEN vsl.cache_hit = true THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as cache_hit_percentage
FROM vector_search_logs vsl
JOIN tenants t ON vsl.tenant_id = t.id
WHERE vsl.created_at >= NOW() - INTERVAL '7 days' -- Limit to recent data
GROUP BY
    DATE_TRUNC('hour', vsl.created_at),
    vsl.tenant_id,
    t.name,
    vsl.search_type,
    vsl.search_strategy
ORDER BY hour_bucket DESC;

-- Storage Usage View
CREATE VIEW storage_usage AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(d.id) as document_count,
    COUNT(DISTINCT d.content_type) as unique_content_types,
    COALESCE(SUM(d.file_size), 0) as total_storage_bytes,
    ROUND(COALESCE(SUM(d.file_size), 0) / 1024.0 / 1024.0 / 1024.0, 2) as total_storage_gb,
    COALESCE(AVG(d.file_size), 0) as avg_document_size_bytes,
    MIN(d.file_size) as min_document_size_bytes,
    MAX(d.file_size) as max_document_size_bytes,
    COUNT(DISTINCT d.created_by) as unique_uploaders,
    COUNT(DISTINCT DATE_TRUNC('day', d.created_at)) as active_upload_days,
    MAX(d.created_at) as last_upload,
    COUNT(CASE WHEN d.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_uploads,
    COUNT(CASE WHEN d.classification = 'confidential' OR d.classification = 'restricted' THEN 1 END) as sensitive_documents
FROM tenants t
LEFT JOIN documents d ON t.id = d.tenant_id AND d.deleted_at IS NULL
WHERE t.status != 'deleted' AND t.deleted_at IS NULL
GROUP BY t.id, t.name
ORDER BY total_storage_bytes DESC;

-- Compliance Status View
CREATE VIEW compliance_status AS
SELECT
    cr.tenant_id,
    t.name as tenant_name,
    cr.report_type,
    cr.status,
    cr.report_period_start,
    cr.report_period_end,
    cr.created_at,
    cr.updated_at,
    cr.generated_by,
    cr.reviewed_by,
    cr.approved_by,
    CASE
        WHEN cr.status = 'completed' THEN 'Compliant'
        WHEN cr.status = 'failed' THEN 'Non-Compliant'
        WHEN cr.status = 'in_progress' THEN 'In Review'
        ELSE 'Pending'
    END as compliance_status,
    jsonb_array_length(cr.findings) as total_findings,
    jsonb_array_length(cr.recommendations) as total_recommendations
FROM compliance_reports cr
JOIN tenants t ON cr.tenant_id = t.id
WHERE cr.created_at >= NOW() - INTERVAL '365 days' -- Last year of reports
ORDER BY cr.report_type, cr.report_period_end DESC;

-- Quota Usage View
CREATE VIEW quota_usage AS
SELECT
    tq.tenant_id,
    t.name as tenant_name,
    tq.quota_type,
    tq.current_limit,
    tq.current_usage,
    tq.warning_threshold,
    ROUND((tq.current_usage::NUMERIC / NULLIF(tq.current_limit, 0)) * 100, 2) as usage_percentage,
    CASE
        WHEN (tq.current_usage::NUMERIC / NULLIF(tq.current_limit, 0)) * 100 >= tq.warning_threshold THEN 'warning'
        WHEN (tq.current_usage::NUMERIC / NULLIF(tq.current_limit, 0)) * 100 >= 90 THEN 'critical'
        ELSE 'normal'
    END as usage_status,
    tq.reset_frequency,
    tq.next_reset_at,
    tq.hard_limit
FROM tenant_quotas tq
JOIN tenants t ON tq.tenant_id = t.id
WHERE t.deleted_at IS NULL
ORDER BY tq.tenant_id, usage_percentage DESC;

-- Create indexes for materialized views
CREATE INDEX idx_tenant_statistics_tenant_id ON tenant_statistics(id);
CREATE INDEX idx_tenant_statistics_status ON tenant_statistics(status);
CREATE INDEX idx_tenant_statistics_subscription_tier ON tenant_statistics(subscription_tier);
CREATE INDEX idx_tenant_statistics_active_users ON tenant_statistics(active_users);

-- Create unique indexes for views
CREATE UNIQUE INDEX idx_tenant_statistics_unique ON tenant_statistics(id);

-- Refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_statistics;
END;
$$ LANGUAGE plpgsql;

-- Function to get real-time tenant metrics
CREATE OR REPLACE FUNCTION get_tenant_metrics(tenant_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tenant_id', tenant_uuid,
        'users', (SELECT COUNT(*) FROM users WHERE tenant_id = tenant_uuid AND deleted_at IS NULL),
        'active_users', (SELECT COUNT(*) FROM users WHERE tenant_id = tenant_uuid AND is_active = true AND deleted_at IS NULL),
        'documents', (SELECT COUNT(*) FROM documents WHERE tenant_id = tenant_uuid AND deleted_at IS NULL),
        'total_storage_bytes', (SELECT COALESCE(SUM(file_size), 0) FROM documents WHERE tenant_id = tenant_uuid AND deleted_at IS NULL),
        'tokens_consumed_today', (SELECT COALESCE(SUM(tokens_used), 0) FROM token_usage WHERE tenant_id = tenant_uuid AND DATE(created_at) = CURRENT_DATE),
        'cost_today', (SELECT COALESCE(SUM(cost_usd), 0) FROM token_usage WHERE tenant_id = tenant_uuid AND DATE(created_at) = CURRENT_DATE),
        'active_sessions', (SELECT COUNT(*) FROM user_sessions WHERE tenant_id = tenant_uuid AND is_active = true AND expires_at > NOW()),
        'pending_jobs', (SELECT COUNT(*) FROM document_processing_jobs WHERE tenant_id = tenant_uuid AND status = 'pending'),
        'last_updated', NOW()
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON tenant_statistics TO app_user;
GRANT SELECT ON document_processing_queue TO app_user;
GRANT SELECT ON user_activity_dashboard TO app_user;
GRANT SELECT ON token_usage_analytics TO app_user;
GRANT SELECT ON dlp_risk_assessment TO app_user;
GRANT SELECT ON policy_performance TO app_user;
GRANT SELECT ON search_analytics TO app_user;
GRANT SELECT ON storage_usage TO app_user;
GRANT SELECT ON compliance_status TO app_user;
GRANT SELECT ON quota_usage TO app_user;
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO app_user;
GRANT EXECUTE ON FUNCTION get_tenant_metrics(UUID) TO app_user;

-- Record migration
INSERT INTO schema_migrations (
    version,
    description,
    filename,
    checksum,
    rollback_script,
    dependencies,
    tags,
    metadata
) VALUES (
    '004',
    'Create Views and Materialized Views',
    '004_create_views_and_materialized_views.sql',
    md5('004_create_views_and_materialized_views.sql'),
    $rollback$
    DROP FUNCTION IF EXISTS get_tenant_metrics(UUID);
    DROP FUNCTION IF EXISTS refresh_materialized_views();
    DROP MATERIALIZED VIEW IF EXISTS tenant_statistics;
    DROP VIEW IF EXISTS quota_usage;
    DROP VIEW IF EXISTS compliance_status;
    DROP VIEW IF EXISTS storage_usage;
    DROP VIEW IF EXISTS search_analytics;
    DROP VIEW IF EXISTS policy_performance;
    DROP VIEW IF EXISTS dlp_risk_assessment;
    DROP VIEW IF EXISTS token_usage_analytics;
    DROP VIEW IF EXISTS user_activity_dashboard;
    DROP VIEW IF EXISTS document_processing_queue;
    $rollback$,
    '{003}',
    '{views,analytics,reporting}',
    '{"required": true, "performance": true}'
);

COMMIT;
