-- Views and Materialized Views
-- Optimized read access for common queries and reporting

-- Tenant Statistics Materialized View
CREATE MATERIALIZED VIEW tenant_statistics AS
SELECT
    t.id,
    t.name,
    t.status,
    t.subscription_tier,
    t.created_at as tenant_created_at,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active = true THEN u.id END) as active_users,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT CASE WHEN d.processing_status = 'completed' THEN d.id END) as processed_documents,
    COALESCE(SUM(d.file_size), 0) as total_storage_bytes,
    COALESCE(SUM(dc.token_count), 0) as total_tokens,
    COALESCE(SUM(tu.tokens_used), 0) as total_tokens_consumed,
    COALESCE(SUM(tu.cost_usd), 0) as total_cost_usd,
    COUNT(DISTINCT CASE WHEN d.dlp_status = 'completed' THEN d.id END) as dlp_scanned_documents,
    COALESCE(AVG(ds.risk_score), 0) as avg_dlp_risk_score,
    COUNT(DISTINCT p.id) as active_policies,
    COUNT(DISTINCT CASE WHEN p.is_active = true THEN p.id END) as active_enabled_policies,
    MAX(u.last_login) as last_user_activity,
    COUNT(DISTINCT CASE WHEN us.is_active = true AND us.expires_at > NOW() THEN us.id END) as active_sessions
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN documents d ON t.id = d.tenant_id
LEFT JOIN document_chunks dc ON d.id = dc.document_id
LEFT JOIN token_usage tu ON t.id = tu.tenant_id
LEFT JOIN dlp_scans ds ON t.id = ds.tenant_id
LEFT JOIN policies p ON t.id = p.tenant_id
LEFT JOIN user_sessions us ON t.id = us.tenant_id
WHERE t.status != 'deleted'
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
    d.filename,
    d.content_type,
    d.file_size,
    t.name as tenant_name,
    u.email as created_by_email,
    CASE
        WHEN dpj.retry_count >= dpj.max_retries THEN 'failed_max_retries'
        WHEN dpj.started_at IS NULL THEN 'pending'
        WHEN dpj.status = 'processing' THEN 'in_progress'
        WHEN dpj.status = 'completed' THEN 'completed'
        ELSE dpj.status
    END as queue_status,
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
    COUNT(DISTINCT CASE WHEN tu.created_at > NOW() - INTERVAL '7 days' THEN tu.id END) as recent_token_requests
FROM users u
JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN documents d ON u.id = d.created_by
LEFT JOIN document_access_log da ON u.id = da.user_id
LEFT JOIN token_usage tu ON u.id = tu.user_id
LEFT JOIN user_sessions us ON u.id = us.user_id AND us.is_active = true
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
    COUNT(DISTINCT tu.api_key_id) as unique_api_keys
FROM token_usage tu
JOIN tenants t ON tu.tenant_id = t.id
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
    COUNT(CASE WHEN ds.review_decision IS NOT NULL THEN 1 END) as reviewed_count
FROM dlp_scans ds
JOIN tenants t ON ds.tenant_id = t.id
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
    DATE_TRUNC('day', pe.created_at) as last_evaluation_date
FROM policies p
JOIN tenants t ON p.tenant_id = t.id
LEFT JOIN policy_evaluations pe ON p.id = pe.policy_id
GROUP BY p.id, p.tenant_id, t.name, p.name, p.type, p.version, p.is_active
ORDER BY total_evaluations DESC;

-- Search Analytics View
CREATE VIEW search_analytics AS
SELECT
    DATE_TRUNC('hour', vsl.created_at) as hour_bucket,
    vsl.tenant_id,
    t.name as tenant_name,
    vsl.search_type,
    COUNT(*) as search_count,
    AVG(vsl.results_count) as avg_results_count,
    AVG(vsl.search_duration_ms) as avg_search_duration_ms,
    MIN(vsl.search_duration_ms) as min_search_duration_ms,
    MAX(vsl.search_duration_ms) as max_search_duration_ms,
    COUNT(DISTINCT vsl.user_id) as unique_users,
    COUNT(CASE WHEN vsl.search_duration_ms > 1000 THEN 1 END) as slow_searches,
    ROUND(AVG(vsl.results_count), 2) as avg_result_count
FROM vector_search_logs vsl
JOIN tenants t ON vsl.tenant_id = t.id
GROUP BY
    DATE_TRUNC('hour', vsl.created_at),
    vsl.tenant_id,
    t.name,
    vsl.search_type
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
    COUNT(CASE WHEN d.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_uploads
FROM tenants t
LEFT JOIN documents d ON t.id = d.tenant_id
WHERE t.status != 'deleted'
GROUP BY t.id, t.name
ORDER BY total_storage_bytes DESC;

-- Create indexes for materialized views
CREATE INDEX idx_tenant_statistics_tenant_id ON tenant_statistics(id);
CREATE INDEX idx_tenant_statistics_status ON tenant_statistics(status);
CREATE INDEX idx_tenant_statistics_subscription_tier ON tenant_statistics(subscription_tier);

-- Create unique indexes for views
CREATE UNIQUE INDEX idx_tenant_statistics_unique ON tenant_statistics(id);

-- Refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_statistics;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON tenant_statistics TO app_user;
GRANT SELECT ON document_processing_queue TO app_user;
GRANT SELECT ON user_activity_dashboard TO app_user;
GRANT SELECT ON token_usage_analytics TO app_user;
GRANT SELECT ON dlp_risk_assessment TO app_user;
GRANT SELECT ON policy_performance TO app_user;
GRANT SELECT ON search_analytics TO app_user;
GRANT SELECT ON storage_usage TO app_user;
