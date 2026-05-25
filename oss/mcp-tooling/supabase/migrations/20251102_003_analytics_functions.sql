-- Analytics and Monitoring Functions
-- Migration: 20251102_003_analytics_functions.sql
-- Description: Create functions for analytics, monitoring, and data aggregation

-- Function to get connector usage analytics
CREATE OR REPLACE FUNCTION public.get_connector_analytics(
  p_connector_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  total_requests BIGINT,
  success_requests BIGINT,
  error_requests BIGINT,
  error_rate DECIMAL,
  avg_response_time DECIMAL,
  p95_response_time INTEGER,
  p99_response_time INTEGER,
  total_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.date,
    SUM(um.req_total) as total_requests,
    SUM(um.req_success) as success_requests,
    SUM(um.req_error) as error_requests,
    CASE
      WHEN SUM(um.req_total) > 0 THEN
        ROUND((SUM(um.req_error)::DECIMAL / SUM(um.req_total)) * 100, 2)
      ELSE 0
    END as error_rate,
    ROUND(AVG(um.avg_ms), 2) as avg_response_time,
    MAX(um.p95_ms) as p95_response_time,
    MAX(um.p99_ms) as p99_response_time,
    SUM(um.bytes_sent + um.bytes_received) as total_bytes
  FROM public.usage_metrics um
  WHERE um.connector_id = p_connector_id
    AND um.date BETWEEN p_start_date AND p_end_date
  GROUP BY um.date
  ORDER BY um.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top performing connectors
CREATE OR REPLACE FUNCTION public.get_top_connectors(
  p_limit INTEGER DEFAULT 10,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  connector_id UUID,
  connector_name TEXT,
  owner_display_name TEXT,
  total_requests BIGINT,
  avg_response_time DECIMAL,
  error_rate DECIMAL,
  success_rate DECIMAL,
  uptime_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH connector_stats AS (
    SELECT
      c.id as connector_id,
      c.name as connector_name,
      up.display_name as owner_display_name,
      COALESCE(SUM(um.req_total), 0) as total_requests,
      COALESCE(AVG(um.avg_ms), 0) as avg_response_time,
      COALESCE(SUM(um.req_error), 0) as total_errors
    FROM public.connectors c
    JOIN public.user_profiles up ON c.owner_id = up.id
    LEFT JOIN public.usage_metrics um ON c.id = um.connector_id
      AND um.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    WHERE c.is_public = true OR c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    GROUP BY c.id, c.name, up.display_name
  )
  SELECT
    cs.connector_id,
    cs.connector_name,
    cs.owner_display_name,
    cs.total_requests,
    cs.avg_response_time,
    CASE
      WHEN cs.total_requests > 0 THEN
        ROUND((cs.total_errors::DECIMAL / cs.total_requests) * 100, 2)
      ELSE 0
    END as error_rate,
    CASE
      WHEN cs.total_requests > 0 THEN
        ROUND(((cs.total_requests - cs.total_errors)::DECIMAL / cs.total_requests) * 100, 2)
      ELSE 0
    END as success_rate,
    CASE
      WHEN cs.total_requests > 0 THEN
        ROUND(((cs.total_requests - cs.total_errors)::DECIMAL / cs.total_requests) * 100, 2)
      ELSE 0
    END as uptime_percentage
  FROM connector_stats cs
  WHERE cs.total_requests > 0
  ORDER BY cs.total_requests DESC, cs.avg_response_time ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily usage aggregation
CREATE OR REPLACE FUNCTION public.get_daily_usage_aggregation(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  total_requests BIGINT,
  unique_connectors BIGINT,
  total_errors BIGINT,
  avg_response_time DECIMAL,
  total_bytes_transferred BIGINT,
  top_connectors JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT
      um.date,
      SUM(um.req_total) as total_requests,
      COUNT(DISTINCT um.connector_id) as unique_connectors,
      SUM(um.req_error) as total_errors,
      AVG(um.avg_ms) as avg_response_time,
      SUM(um.bytes_sent + um.bytes_received) as total_bytes
    FROM public.usage_metrics um
    WHERE um.date = p_date
    GROUP BY um.date
  ),
  top_connectors AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'connector_id', um.connector_id,
          'connector_name', c.name,
          'requests', um.req_total,
          'avg_response_time', um.avg_ms
        ) ORDER BY um.req_total DESC
      ) as top_connectors
    FROM public.usage_metrics um
    JOIN public.connectors c ON um.connector_id = c.id
    WHERE um.date = p_date
      AND um.req_total > 0
    ORDER BY um.req_total DESC
    LIMIT 5
  )
  SELECT
    ds.date,
    ds.total_requests,
    ds.unique_connectors,
    ds.total_errors,
    ROUND(ds.avg_response_time, 2) as avg_response_time,
    ds.total_bytes,
    tc.top_connectors
  FROM daily_stats ds
  CROSS JOIN top_connectors tc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get job performance metrics
CREATE OR REPLACE FUNCTION public.get_job_performance_metrics(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  job_type job_type,
  total_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  success_rate DECIMAL,
  avg_duration_seconds DECIMAL,
  avg_retry_count DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.type as job_type,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE j.status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE j.status = 'failed') as failed_jobs,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE j.status = 'completed'))::DECIMAL / COUNT(*) * 100, 2)
      ELSE 0
    END as success_rate,
    ROUND(AVG(EXTRACT(EPOCH FROM (j.finished_at - j.started_at))), 2) as avg_duration_seconds,
    ROUND(AVG(j.retry_count), 2) as avg_retry_count
  FROM public.jobs j
  JOIN public.connectors c ON j.connector_id = c.id
  WHERE j.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  GROUP BY j.type
  ORDER BY total_jobs DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system health metrics
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS TABLE (
  metric_name TEXT,
  metric_value BIGINT,
  metric_status TEXT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  -- Total connectors
  RETURN QUERY
  SELECT
    'total_connectors'::TEXT as metric_name,
    COUNT(*) as metric_value,
    CASE
      WHEN COUNT(*) < 1000 THEN 'healthy'
      WHEN COUNT(*) < 10000 THEN 'warning'
      ELSE 'critical'
    END as metric_status,
    MAX(updated_at) as last_updated
  FROM public.connectors;

  -- Active connectors
  RETURN QUERY
  SELECT
    'active_connectors'::TEXT as metric_name,
    COUNT(*) FILTER (WHERE status = 'active') as metric_value,
    'info' as metric_status,
    MAX(updated_at) as last_updated
  FROM public.connectors;

  -- Failed jobs in last 24 hours
  RETURN QUERY
  SELECT
    'failed_jobs_24h'::TEXT as metric_name,
    COUNT(*) as metric_value,
    CASE
      WHEN COUNT(*) = 0 THEN 'healthy'
      WHEN COUNT(*) < 10 THEN 'warning'
      ELSE 'critical'
    END as metric_status,
    MAX(created_at) as last_updated
  FROM public.jobs
  WHERE status = 'failed'
    AND created_at >= NOW() - INTERVAL '24 hours';

  -- Requests in last hour
  RETURN QUERY
  SELECT
    'requests_last_hour'::TEXT as metric_name,
    COALESCE(SUM(req_total), 0) as metric_value,
    'info' as metric_status,
    MAX(updated_at) as last_updated
  FROM public.usage_metrics
  WHERE date = CURRENT_DATE
    AND hour = EXTRACT(HOUR FROM NOW());

  -- Average response time
  RETURN QUERY
  SELECT
    'avg_response_time_ms'::TEXT as metric_name,
    ROUND(AVG(avg_ms))::BIGINT as metric_value,
    CASE
      WHEN AVG(avg_ms) < 200 THEN 'healthy'
      WHEN AVG(avg_ms) < 1000 THEN 'warning'
      ELSE 'critical'
    END as metric_status,
    MAX(updated_at) as last_updated
  FROM public.usage_metrics
  WHERE date = CURRENT_DATE
    AND req_total > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old usage metrics (retention policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  deleted_records BIGINT,
  retention_date DATE
) AS $$
DECLARE
  v_deleted_count BIGINT;
  v_cutoff_date DATE;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_retention_days;

  -- Delete old usage metrics
  DELETE FROM public.usage_metrics
  WHERE date < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY
  SELECT v_deleted_count, v_cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user activity summary
CREATE OR REPLACE FUNCTION public.get_user_activity_summary(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  activity_date DATE,
  connectors_created BIGINT,
  jobs_completed BIGINT,
  jobs_failed BIGINT,
  total_requests BIGINT,
  unique_connectors_used BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1 || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as activity_date
  ),
  connector_activity AS (
    SELECT
      DATE(c.created_at) as activity_date,
      COUNT(*) as connectors_created
    FROM public.connectors c
    WHERE c.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    GROUP BY DATE(c.created_at)
  ),
  job_activity AS (
    SELECT
      DATE(j.created_at) as activity_date,
      COUNT(*) FILTER (WHERE j.status = 'completed') as jobs_completed,
      COUNT(*) FILTER (WHERE j.status = 'failed') as jobs_failed
    FROM public.jobs j
    JOIN public.connectors c ON j.connector_id = c.id
    WHERE j.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    GROUP BY DATE(j.created_at)
  ),
  usage_activity AS (
    SELECT
      um.date as activity_date,
      SUM(um.req_total) as total_requests,
      COUNT(DISTINCT um.connector_id) as unique_connectors_used
    FROM public.usage_metrics um
    JOIN public.connectors c ON um.connector_id = c.id
    WHERE um.date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
      AND c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    GROUP BY um.date
  )
  SELECT
    ds.activity_date,
    COALESCE(ca.connectors_created, 0) as connectors_created,
    COALESCE(ja.jobs_completed, 0) as jobs_completed,
    COALESCE(ja.jobs_failed, 0) as jobs_failed,
    COALESCE(ua.total_requests, 0) as total_requests,
    COALESCE(ua.unique_connectors_used, 0) as unique_connectors_used
  FROM date_series ds
  LEFT JOIN connector_activity ca ON ds.activity_date = ca.activity_date
  LEFT JOIN job_activity ja ON ds.activity_date = ja.activity_date
  LEFT JOIN usage_activity ua ON ds.activity_date = ua.activity_date
  ORDER BY ds.activity_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to estimate generation job duration
CREATE OR REPLACE FUNCTION public.estimate_job_duration(
  p_spec_size_bytes INTEGER,
  p_complexity_score INTEGER DEFAULT 1,
  p_target_runtime connector_runtime
)
RETURNS INTEGER AS $$
DECLARE
  v_base_duration INTEGER;
  v_size_multiplier DECIMAL;
  v_complexity_multiplier DECIMAL;
  v_runtime_multiplier DECIMAL;
BEGIN
  -- Base duration in seconds
  v_base_duration := 30;

  -- Calculate multipliers
  v_size_multiplier := CASE
    WHEN p_spec_size_bytes < 1024 THEN 0.5 -- Small spec
    WHEN p_spec_size_bytes < 10240 THEN 1.0 -- Medium spec
    WHEN p_spec_size_bytes < 102400 THEN 2.0 -- Large spec
    ELSE 4.0 -- Very large spec
  END;

  v_complexity_multiplier := CASE
    WHEN p_complexity_score = 1 THEN 1.0 -- Simple
    WHEN p_complexity_score = 2 THEN 1.5 -- Medium
    WHEN p_complexity_score = 3 THEN 2.5 -- Complex
    ELSE 4.0 -- Very complex
  END;

  v_runtime_multiplier := CASE
    WHEN p_target_runtime = 'worker-ts' THEN 1.0
    WHEN p_target_runtime = 'worker-go' THEN 0.8 -- Go is typically faster
    WHEN p_target_runtime = 'download-only' THEN 0.1 -- No generation needed
    ELSE 1.0
  END;

  -- Calculate estimated duration
  RETURN CEIL(v_base_duration * v_size_multiplier * v_complexity_multiplier * v_runtime_multiplier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a materialized view for connector statistics
CREATE MATERIALIZED VIEW public.connector_stats_mv AS
SELECT
  c.id as connector_id,
  c.name as connector_name,
  c.status,
  c.runtime,
  c.auth_mode,
  c.is_public,
  c.tool_count,
  c.created_at,
  c.updated_at,
  up.display_name as owner_name,
  COALESCE(latest_metrics.total_requests_24h, 0) as requests_24h,
  COALESCE(latest_metrics.avg_response_time_24h, 0) as avg_response_time_24h,
  COALESCE(latest_metrics.error_rate_24h, 0) as error_rate_24h,
  COALESCE(job_metrics.total_jobs, 0) as total_jobs,
  COALESCE(job_metrics.success_rate, 0) as job_success_rate
FROM public.connectors c
JOIN public.user_profiles up ON c.owner_id = up.id
LEFT JOIN (
  SELECT
    um.connector_id,
    SUM(um.req_total) as total_requests_24h,
    AVG(um.avg_ms) as avg_response_time_24h,
    CASE
      WHEN SUM(um.req_total) > 0 THEN
        ROUND((SUM(um.req_error)::DECIMAL / SUM(um.req_total)) * 100, 2)
      ELSE 0
    END as error_rate_24h
  FROM public.usage_metrics um
  WHERE um.date >= CURRENT_DATE - INTERVAL '1 day'
    OR (um.date = CURRENT_DATE AND um.hour >= EXTRACT(HOUR FROM NOW()))
  GROUP BY um.connector_id
) latest_metrics ON c.id = latest_metrics.connector_id
LEFT JOIN (
  SELECT
    j.connector_id,
    COUNT(*) as total_jobs,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE j.status = 'completed'))::DECIMAL / COUNT(*) * 100, 2)
      ELSE 0
    END as success_rate
  FROM public.jobs j
  GROUP BY j.connector_id
) job_metrics ON c.id = job_metrics.connector_id;

-- Create index on the materialized view
CREATE INDEX idx_connector_stats_mv_connector_id ON public.connector_stats_mv(connector_id);
CREATE INDEX idx_connector_stats_mv_status ON public.connector_stats_mv(status);
CREATE INDEX idx_connector_stats_mv_runtime ON public.connector_stats_mv(runtime);
CREATE INDEX idx_connector_stats_mv_is_public ON public.connector_stats_mv(is_public);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_connector_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.connector_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the materialized view
GRANT SELECT ON public.connector_stats_mv TO authenticated;
GRANT SELECT ON public.connector_stats_mv TO anon;