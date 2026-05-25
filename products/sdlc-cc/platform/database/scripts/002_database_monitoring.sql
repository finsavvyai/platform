-- Database Monitoring and Health Check Script
-- Comprehensive monitoring setup for database health and performance

BEGIN;

-- Database health check function
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    value NUMERIC,
    threshold NUMERIC,
    message TEXT
) AS $$
DECLARE
    total_connections INTEGER;
    active_connections INTEGER;
    idle_connections INTEGER;
    db_size BIGINT;
    cache_hit_ratio NUMERIC;
    index_usage_ratio NUMERIC;
    deadlocks_count BIGINT;
    slow_queries_count BIGINT;
BEGIN
    -- Connection health check
    SELECT count(*) INTO total_connections
    FROM pg_stat_activity;

    SELECT count(*) INTO active_connections
    FROM pg_stat_activity WHERE state = 'active';

    SELECT count(*) INTO idle_connections
    FROM pg_stat_activity WHERE state = 'idle';

    RETURN QUERY SELECT
        'total_connections'::TEXT,
        CASE WHEN total_connections < 100 THEN 'HEALTHY' ELSE 'WARNING' END,
        total_connections::NUMERIC,
        100::NUMERIC,
        format('Total database connections: %s', total_connections)::TEXT;

    RETURN QUERY SELECT
        'active_connections'::TEXT,
        CASE WHEN active_connections < 50 THEN 'HEALTHY' ELSE 'WARNING' END,
        active_connections::NUMERIC,
        50::NUMERIC,
        format('Active connections: %s', active_connections)::TEXT;

    -- Database size check
    SELECT pg_database_size(current_database()) INTO db_size;

    RETURN QUERY SELECT
        'database_size_gb'::TEXT,
        'HEALTHY'::TEXT,
        ROUND(db_size / 1024.0 / 1024.0 / 1024.0, 2),
        1000::NUMERIC,
        format('Database size: %s GB', ROUND(db_size / 1024.0 / 1024.0 / 1024.0, 2))::TEXT;

    -- Cache hit ratio
    SELECT ROUND(sum(heap_blks_hit)::NUMERIC / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100, 2) INTO cache_hit_ratio
    FROM pg_statio_user_tables;

    RETURN QUERY SELECT
        'cache_hit_ratio'::TEXT,
        CASE WHEN cache_hit_ratio > 95 THEN 'HEALTHY' WHEN cache_hit_ratio > 90 THEN 'WARNING' ELSE 'CRITICAL' END,
        cache_hit_ratio,
        95::NUMERIC,
        format('Buffer cache hit ratio: %s%%', cache_hit_ratio)::TEXT;

    -- Index usage ratio
    SELECT ROUND(sum(idx_scan)::NUMERIC / NULLIF(sum(idx_scan + seq_scan), 0) * 100, 2) INTO index_usage_ratio
    FROM pg_stat_user_tables;

    RETURN QUERY SELECT
        'index_usage_ratio'::TEXT,
        CASE WHEN index_usage_ratio > 90 THEN 'HEALTHY' WHEN index_usage_ratio > 75 THEN 'WARNING' ELSE 'CRITICAL' END,
        index_usage_ratio,
        90::NUMERIC,
        format('Index usage ratio: %s%%', index_usage_ratio)::TEXT;

    -- Deadlocks check
    SELECT count(*) INTO deadlocks_count
    FROM pg_stat_database_deadlocks
    WHERE datname = current_database()
    AND query_start > NOW() - INTERVAL '1 hour';

    RETURN QUERY SELECT
        'deadlocks_last_hour'::TEXT,
        CASE WHEN deadlocks_count = 0 THEN 'HEALTHY' WHEN deadlocks_count < 5 THEN 'WARNING' ELSE 'CRITICAL' END,
        deadlocks_count::NUMERIC,
        0::NUMERIC,
        format('Deadlocks in last hour: %s', deadlocks_count)::TEXT;

    -- Slow queries check
    SELECT count(*) INTO slow_queries_count
    FROM pg_stat_statements
    WHERE mean_time > 1000; -- queries taking more than 1 second

    RETURN QUERY SELECT
        'slow_queries_count'::TEXT,
        CASE WHEN slow_queries_count = 0 THEN 'HEALTHY' WHEN slow_queries_count < 10 THEN 'WARNING' ELSE 'CRITICAL' END,
        slow_queries_count::NUMERIC,
        0::NUMERIC,
        format('Slow queries (>1s): %s', slow_queries_count)::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance metrics collection function
CREATE OR REPLACE FUNCTION collect_performance_metrics()
RETURNS TABLE(
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT,
    collected_at TIMESTAMPTZ
) AS $$
DECLARE
    cpu_usage NUMERIC;
    memory_usage NUMERIC;
    disk_io_rate NUMERIC;
    network_io_rate NUMERIC;
BEGIN
    -- CPU usage (placeholder - would need system monitoring in production)
    RETURN QUERY SELECT
        'cpu_usage_percentage'::TEXT,
        0::NUMERIC, -- Would integrate with system monitoring
        '%'::TEXT,
        NOW()::TIMESTAMPTZ;

    -- Memory usage
    SELECT pg_size_pretty(pg_database_size(current_database())) INTO memory_usage; -- This is actually DB size

    RETURN QUERY SELECT
        'database_size_gb'::TEXT,
        ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0 / 1024.0, 2)::NUMERIC,
        'GB'::TEXT,
        NOW()::TIMESTAMPTZ;

    -- Transaction rate
    RETURN QUERY SELECT
        'transactions_per_second'::TEXT,
        (SELECT xact_commit + xact_rollback FROM pg_stat_database WHERE datname = current_database())::NUMERIC / 60,
        'tx/s'::TEXT,
        NOW()::TIMESTAMPTZ;

    -- Tuple operations
    RETURN QUERY SELECT
        'tuples_returned_per_second'::TEXT,
        (SELECT tup_returned FROM pg_stat_database WHERE datname = current_database())::NUMERIC / 60,
        'tuples/s'::TEXT,
        NOW()::TIMESTAMPTZ;

    RETURN QUERY SELECT
        'tuples_fetched_per_second'::TEXT,
        (SELECT tup_fetched FROM pg_stat_database WHERE datname = current_database())::NUMERIC / 60,
        'tuples/s'::TEXT,
        NOW()::TIMESTAMPTZ;

    -- Lock wait time
    RETURN QUERY SELECT
        'lock_wait_time_ms'::TEXT,
        COALESCE(AVG(EXTRACT(EPOCH FROM (query_start - least(query_start, lockwait_start))) * 1000), 0)::NUMERIC,
        'ms'::TEXT,
        NOW()::TIMESTAMPTZ
    FROM pg_locks
    WHERE granted = false
    AND mode != 'AccessShareLock';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table-specific health checks
CREATE OR REPLACE FUNCTION table_health_check(table_name TEXT)
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    table_size_gb NUMERIC,
    index_size_gb NUMERIC,
    bloat_percentage NUMERIC,
    last_vacuum TIMESTAMPTZ,
    last_analyze TIMESTAMPTZ,
    health_score NUMERIC
) AS $$
DECLARE
    total_size BIGINT;
    index_size BIGINT;
    table_bloat NUMERIC;
    days_since_vacuum INTEGER;
    days_since_analyze INTEGER;
    health_score_val NUMERIC := 100;
BEGIN
    -- Get table statistics
    EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;

    SELECT pg_total_relation_size(table_name::regclass) INTO total_size;
    SELECT pg_indexes_size(table_name::regclass) INTO index_size;

    -- Estimate bloat (simplified)
    SELECT CASE
        WHEN row_count > 1000 THEN
            GREATEST(0, LEAST(30,
                (pg_total_relation_size(table_name::regclass) -
                 (row_count * (SELECT avg(avg_width) FROM pg_stats WHERE tablename = table_name)))::NUMERIC /
                pg_total_relation_size(table_name::regclass) * 100
            ))
        ELSE 0
    END INTO table_bloat;

    -- Get maintenance timestamps
    SELECT EXTRACT(EPOCH FROM (NOW() - COALESCE(last_vacuum, '1970-01-01'::TIMESTAMPTZ))) / 86400 INTO days_since_vacuum
    FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = table_name;

    SELECT EXTRACT(EPOCH FROM (NOW() - COALESCE(last_analyze, '1970-01-01'::TIMESTAMPTZ))) / 86400 INTO days_since_analyze
    FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = table_name;

    -- Calculate health score
    IF table_bloat > 20 THEN health_score := health_score - 20;
    ELSIF table_bloat > 10 THEN health_score := health_score - 10;
    END IF;

    IF days_since_vacuum > 30 THEN health_score := health_score - 15;
    ELSIF days_since_vacuum > 7 THEN health_score := health_score - 5;
    END IF;

    IF days_since_analyze > 30 THEN health_score := health_score - 15;
    ELSIF days_since_analyze > 7 THEN health_score := health_score - 5;
    END IF;

    RETURN QUERY SELECT
        table_name::TEXT,
        row_count,
        ROUND(total_size / 1024.0 / 1024.0 / 1024.0, 2)::NUMERIC,
        ROUND(index_size / 1024.0 / 1024.0 / 1024.0, 2)::NUMERIC,
        table_bloat::NUMERIC,
        (SELECT last_vacuum FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = table_name)::TIMESTAMPTZ,
        (SELECT last_analyze FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = table_name)::TIMESTAMPTZ,
        GREATEST(0, health_score)::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Connection pooling monitoring
CREATE OR REPLACE FUNCTION connection_pool_health()
RETURNS TABLE(
    pool_name TEXT,
    active_connections INTEGER,
    idle_connections INTEGER,
    waiting_connections INTEGER,
    max_connections INTEGER,
    utilization_percentage NUMERIC
) AS $$
BEGIN
    -- Simulate connection pool monitoring
    -- In production, this would integrate with actual pooler (PgBouncer, etc.)
    RETURN QUERY SELECT
        'main_pool'::TEXT,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::INTEGER,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle')::INTEGER,
        0::INTEGER, -- Would get from pooler
        200::INTEGER, -- Max configured connections
        ROUND(
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::NUMERIC / 200 * 100,
            2
        )::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automated maintenance function
CREATE OR REPLACE FUNCTION automated_maintenance()
RETURNS TABLE(
    maintenance_action TEXT,
    status TEXT,
    duration_ms INTEGER,
    message TEXT
) AS $$
DECLARE
    start_time TIMESTAMPTZ := NOW();
    vacuum_result TEXT;
    analyze_result TEXT;
    reindex_result TEXT;
BEGIN
    -- VACUUM ANALYZE on high-traffic tables
    FOR table_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('audit_logs', 'token_usage', 'vector_search_logs', 'document_access_log')
    LOOP
        BEGIN
            EXECUTE format('VACUUM ANALYZE %I', table_name);
            RETURN QUERY SELECT
                format('VACUUM ANALYZE %s', table_name)::TEXT,
                'SUCCESS'::TEXT,
                EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000::INTEGER,
                format('Completed VACUUM ANALYZE on %s', table_name)::TEXT;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT
                format('VACUUM ANALYZE %s', table_name)::TEXT,
                'ERROR'::TEXT,
                EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000::INTEGER,
                format('Error during VACUUM ANALYZE on %s: %s', table_name, SQLERRM)::TEXT;
        END;
    END LOOP;

    -- Refresh materialized views
    BEGIN
        PERFORM refresh_materialized_views();
        RETURN QUERY SELECT
            'REFRESH_MATERIALIZED_VIEWS'::TEXT,
            'SUCCESS'::TEXT,
            EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000::INTEGER,
            'Refreshed all materialized views'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'REFRESH_MATERIALIZED_VIEWS'::TEXT,
            'ERROR'::TEXT,
            EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000::INTEGER,
            format('Error refreshing materialized views: %s', SQLERRM)::TEXT;
    END;

    -- Update table statistics
    FOR table_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('document_chunks', 'documents', 'users', 'tenants')
    LOOP
        BEGIN
            EXECUTE format('ANALYZE %I', table_name);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Continue with other tables if one fails
        END;
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create monitoring views
CREATE VIEW database_health_dashboard AS
SELECT * FROM database_health_check();

CREATE VIEW performance_metrics AS
SELECT * FROM collect_performance_metrics();

CREATE VIEW connection_pool_status AS
SELECT * FROM connection_pool_health();

CREATE VIEW maintenance_log AS
SELECT * FROM automated_maintenance();

-- Table health dashboard
CREATE VIEW tables_health_summary AS
SELECT
    table_health_check(tablename).*
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY table_name;

-- Function to get top resource consuming queries
CREATE OR REPLACE FUNCTION get_top_resource_queries(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
    query TEXT,
    calls BIGINT,
    total_time_ms NUMERIC,
    avg_time_ms NUMERIC,
    rows_returned BIGINT,
    shared_blks_hit BIGINT,
    shared_blks_read BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        LEFT(pg_stat_statements.query, 200) as query,
        pg_stat_statements.calls,
        ROUND(pg_stat_statements.total_time * 1000, 2) as total_time_ms,
        ROUND(pg_stat_statements.mean_time * 1000, 2) as avg_time_ms,
        pg_stat_statements.rows,
        pg_stat_statements.shared_blks_hit,
        pg_stat_statements.shared_blks_read
    FROM pg_stat_statements
    ORDER BY pg_stat_statements.total_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION database_health_check() TO app_user;
GRANT EXECUTE ON FUNCTION collect_performance_metrics() TO app_user;
GRANT EXECUTE ON FUNCTION table_health_check(TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION connection_pool_health() TO app_user;
GRANT EXECUTE ON FUNCTION automated_maintenance() TO app_user;
GRANT EXECUTE ON FUNCTION get_top_resource_queries(INTEGER) TO app_user;

GRANT SELECT ON database_health_dashboard TO app_user;
GRANT SELECT ON performance_metrics TO app_user;
GRANT SELECT ON connection_pool_status TO app_user;
GRANT SELECT ON maintenance_log TO app_user;
GRANT SELECT ON tables_health_summary TO app_user;

COMMIT;
