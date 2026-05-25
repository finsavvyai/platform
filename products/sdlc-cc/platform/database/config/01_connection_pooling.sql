-- Database Connection Pooling and Performance Configuration
-- This file contains optimized settings for PostgreSQL connection pooling and performance

-- Connection pool configuration
-- These settings should be adjusted based on your specific requirements and hardware

-- Memory and performance settings
-- Adjust based on available server memory (recommended: 25% of total RAM for shared_buffers)
-- shared_buffers = 256MB  -- To be set in postgresql.conf
-- effective_cache_size = 1GB  -- To be set in postgresql.conf
-- work_mem = 4MB  -- To be set in postgresql.conf
-- maintenance_work_mem = 64MB  -- To be set in postgresql.conf

-- Connection settings
-- max_connections = 100  -- To be set in postgresql.conf
-- superuser_reserved_connections = 3  -- To be set in postgresql.conf

-- Create connection pool monitoring view
CREATE OR REPLACE VIEW connection_pool_status AS
SELECT
    'active_connections' as metric,
    count(*) as value,
    'Number of currently active connections' as description
FROM pg_stat_activity
WHERE state = 'active'

UNION ALL

SELECT
    'total_connections' as metric,
    count(*) as value,
    'Total number of connections' as description
FROM pg_stat_activity

UNION ALL

SELECT
    'idle_connections' as metric,
    count(*) as value,
    'Number of idle connections' as description
FROM pg_stat_activity
WHERE state = 'idle'

UNION ALL

SELECT
    'waiting_connections' as metric,
    count(*) as value,
    'Number of connections waiting for locks' as description
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'

UNION ALL

SELECT
    'long_running_queries' as metric,
    count(*) as value,
    'Number of queries running longer than 5 minutes' as description
FROM pg_stat_activity
WHERE state = 'active'
AND query_start < NOW() - INTERVAL '5 minutes'
AND query NOT LIKE '%pg_stat_activity%';

-- Connection pool performance metrics
CREATE OR REPLACE VIEW connection_pool_metrics AS
SELECT
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted,
    stats_reset as statistics_reset_time,
    ROUND(
        (blks_hit::NUMERIC / NULLIF(blks_hit + blks_read, 0)) * 100, 2
    ) as cache_hit_ratio_percentage
FROM pg_stat_database
WHERE datname NOT IN ('template0', 'template1', 'postgres');

-- Slow query identification
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    application_name,
    client_addr,
    backend_start,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
AND state = 'active'
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Lock monitoring
CREATE OR REPLACE VIEW lock_monitoring AS
SELECT
    pg_class.relname AS table_name,
    pg_locks.locktype,
    pg_locks.mode,
    pg_locks.granted,
    pg_stat_activity.query,
    pg_stat_activity.pid,
    pg_stat_activity.backend_start,
    pg_stat_activity.usename,
    now() - pg_stat_activity.query_start AS query_duration
FROM pg_locks
JOIN pg_class ON pg_locks.relation = pg_class.oid
JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
WHERE NOT pg_locks.granted
ORDER BY query_duration;

-- Table bloat analysis (helps identify tables that need vacuuming)
CREATE OR REPLACE VIEW table_bloat_analysis AS
SELECT
    schemaname,
    tablename,
    ROUND(
        (
            CASE
                WHEN otta = 0 THEN 0.0
                ELSE sml.relpages / otta::NUMERIC
            END - 1
        ) * 100
    ) AS percentage_bloat,
    ROUND(
        (
            CASE
                WHEN otta = 0 THEN 0.0
                ELSE sml.relpages / otta::NUMERIC
            END - 1
        ) * otta * (
            SELECT current_setting('block_size')::NUMERIC
        )
    ) AS bytes_bloat,
    sml.relpages AS pages,
    otta AS estimated_pages_needed
FROM (
    SELECT
        schemaname,
        tablename,
        cc.reltuples,
        cc.relpages,
        COALESCE(
            (
                SELECT
                    SUM(
                        CASE
                            WHEN atttypid = 20 THEN 8
                            WHEN atttypid = 21 THEN 2
                            WHEN atttypid = 23 THEN 4
                            WHEN atttypid = 700 THEN 4
                            WHEN atttypid = 701 THEN 8
                            WHEN atttypid = 16 THEN 1
                            WHEN atttypid = 17 THEN 1
                            WHEN atttypid = 1043 THEN
                                CASE
                                    WHEN atttypmod = -1 THEN 0
                                    ELSE (((atttypmod - 4)::NUMERIC + 8) / 8)::INTEGER
                                END
                            WHEN atttypid = 25 THEN
                                CASE
                                    WHEN atttypmod = -1 THEN 0
                                    ELSE atttypmod - 4
                                END
                            WHEN atttypid = 114 THEN 32
                            WHEN atttypid = 3802 THEN
                                CASE
                                    WHEN atttypmod = -1 THEN 0
                                    ELSE atttypmod - 4
                                END
                            ELSE 0
                        END
                    ) + 24
                FROM pg_attribute a
                WHERE a.attrelid = cc.oid
                AND a.attnum > 0
                AND NOT a.attisdropped
            ),
            0
        ) AS header_size
    FROM pg_class cc
    JOIN pg_namespace nn ON cc.relnamespace = nn.oid
    WHERE relkind = 'r'
) AS sml
JOIN (
    SELECT
        schemaname,
        tablename,
        ((cc.reltuples * (
            COALESCE(
                (
                    SELECT
                        SUM(
                            CASE
                                WHEN atttypid = 20 THEN 8
                                WHEN atttypid = 21 THEN 2
                                WHEN atttypid = 23 THEN 4
                                WHEN atttypid = 700 THEN 4
                                WHEN atttypid = 701 THEN 8
                                WHEN atttypid = 16 THEN 1
                                WHEN atttypid = 17 THEN 1
                                WHEN atttypid = 1043 THEN
                                    CASE
                                        WHEN atttypmod = -1 THEN 0
                                        ELSE (((atttypmod - 4)::NUMERIC + 8) / 8)::INTEGER
                                    END
                                WHEN atttypid = 25 THEN
                                    CASE
                                        WHEN atttypmod = -1 THEN 0
                                        ELSE atttypmod - 4
                                    END
                                WHEN atttypid = 114 THEN 32
                                WHEN atttypid = 3802 THEN
                                    CASE
                                        WHEN atttypmod = -1 THEN 0
                                        ELSE atttypmod - 4
                                    END
                                ELSE 0
                            END
                        ) + 24
                    FROM pg_attribute a
                    WHERE a.attrelid = cc.oid
                    AND a.attnum > 0
                    AND NOT a.attisdropped
                ),
                0
            )
        )) / (
            SELECT current_setting('block_size')::NUMERIC
        ) AS otta
    FROM pg_class cc
    JOIN pg_namespace nn ON cc.relnamespace = nn.oid
    WHERE relkind = 'r'
) AS otta
ON sml.schemaname = otta.schemaname
AND sml.tablename = otta.tablename
WHERE sml.schemaname NOT IN ('information_schema', 'pg_catalog')
AND sml.tablename NOT LIKE 'pg_%'
ORDER BY percentage_bloat DESC;

-- Index usage analysis
CREATE OR REPLACE VIEW index_usage_analysis AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'Never Used'
        WHEN idx_scan < 10 THEN 'Rarely Used'
        WHEN idx_scan < 100 THEN 'Moderately Used'
        ELSE 'Frequently Used'
    END as usage_level
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Query performance monitoring function
CREATE OR REPLACE FUNCTION get_query_performance_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'slow_queries', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'pid', pid,
                    'duration_seconds', EXTRACT(EPOCH FROM (now() - query_start)),
                    'query', query,
                    'application_name', application_name,
                    'client_addr', client_addr
                )
            )
            FROM pg_stat_activity
            WHERE state = 'active'
            AND query_start < NOW() - INTERVAL '5 seconds'
            AND query NOT LIKE '%pg_stat_activity%'
        ),
        'lock_waits', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'pid', pid,
                    'table_name', relname,
                    'lock_type', locktype,
                    'mode', mode,
                    'wait_duration', EXTRACT(EPOCH FROM (now() - query_start))
                )
            )
            FROM pg_locks
            JOIN pg_class ON pg_locks.relation = pg_class.oid
            JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
            WHERE NOT pg_locks.granted
        ),
        'connection_stats', (
            SELECT jsonb_build_object(
                'total_connections', count(*),
                'active_connections', count(*) FILTER (WHERE state = 'active'),
                'idle_connections', count(*) FILTER (WHERE state = 'idle'),
                'waiting_connections', count(*) FILTER (WHERE wait_event_type = 'Lock')
            )
            FROM pg_stat_activity
        ),
        'cache_hit_ratio', (
            SELECT ROUND(
                (sum(heap_blks_hit)::NUMERIC / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100, 2
            )
            FROM pg_statio_user_tables
        ),
        'timestamp', NOW()
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatic vacuum and analyze configuration
CREATE OR REPLACE FUNCTION configure_autovacuum()
RETURNS void AS $$
BEGIN
    -- These settings should be configured in postgresql.conf, but included here for reference
    -- ALTER SYSTEM SET autovacuum = on;
    -- ALTER SYSTEM SET autovacuum_max_workers = 3;
    -- ALTER SYSTEM SET autovacuum_naptime = '1min';
    -- ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
    -- ALTER SYSTEM SET autovacuum_analyze_threshold = 50;
    -- ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.2;
    -- ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.1;
    -- ALTER SYSTEM SET autovacuum_freeze_max_age = 200000000;
    -- ALTER SYSTEM SET autovacuum_multixact_freeze_max_age = 400000000;
    -- ALTER SYSTEM SET autovacuum_vacuum_cost_delay = '20ms';
    -- ALTER SYSTEM SET autovacuum_vacuum_cost_limit = 200;

    -- Configure specific table autovacuum settings
    ALTER TABLE audit_logs SET (
        autovacuum_vacuum_threshold = 1000,
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_threshold = 500,
        autovacuum_analyze_scale_factor = 0.05
    );

    ALTER TABLE token_usage SET (
        autovacuum_vacuum_threshold = 500,
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_threshold = 250,
        autovacuum_analyze_scale_factor = 0.05
    );

    ALTER TABLE vector_search_logs SET (
        autovacuum_vacuum_threshold = 1000,
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_threshold = 500,
        autovacuum_analyze_scale_factor = 0.05
    );

    ALTER TABLE document_processing_jobs SET (
        autovacuum_vacuum_threshold = 100,
        autovacuum_vacuum_scale_factor = 0.2,
        autovacuum_analyze_threshold = 50,
        autovacuum_analyze_scale_factor = 0.1
    );

    ALTER TABLE document_chunks SET (
        autovacuum_vacuum_threshold = 1000,
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_threshold = 500,
        autovacuum_analyze_scale_factor = 0.05
    );
END;
$$ LANGUAGE plpgsql;

-- Function to kill long-running queries
CREATE OR REPLACE FUNCTION kill_long_running_queries(max_duration_seconds INTEGER DEFAULT 300)
RETURNS INTEGER AS $$
DECLARE
    killed_count INTEGER := 0;
    query_record RECORD;
BEGIN
    FOR query_record IN
        SELECT pid
        FROM pg_stat_activity
        WHERE state = 'active'
        AND query_start < NOW() - INTERVAL '1 second' * max_duration_seconds
        AND query NOT LIKE '%pg_stat_activity%'
        AND usename != current_user
    LOOP
        EXECUTE 'SELECT pg_terminate_backend(' || query_record.pid || ')';
        killed_count := killed_count + 1;
    END LOOP;

    RETURN killed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on monitoring functions and views
GRANT SELECT ON connection_pool_status TO app_user;
GRANT SELECT ON connection_pool_metrics TO app_user;
GRANT SELECT ON slow_queries TO app_user;
GRANT SELECT ON lock_monitoring TO app_user;
GRANT SELECT ON table_bloat_analysis TO app_user;
GRANT SELECT ON index_usage_analysis TO app_user;
GRANT EXECUTE ON FUNCTION get_query_performance_stats() TO app_user;
GRANT EXECUTE ON FUNCTION kill_long_running_queries(INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION configure_autovacuum() TO app_user;

-- Create function to optimize tables (run periodically)
CREATE OR REPLACE FUNCTION optimize_database_tables()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    table_count INTEGER := 0;
    index_count INTEGER := 0;
BEGIN
    -- Analyze all tables to update statistics
    FOR table_count IN 1..100 LOOP  -- Prevent infinite loop
        BEGIN
            -- Find a table that needs analyzing
            PERFORM 1 FROM pg_stat_user_tables WHERE last_analyze IS NULL OR last_analyze < NOW() - INTERVAL '1 day' LIMIT 1;
            IF NOT FOUND THEN EXIT;
            END IF;

            EXECUTE 'ANALYZE ' || quote_ident(schemaname) || '.' || quote_ident(tablename)
            FROM pg_stat_user_tables
            WHERE last_analyze IS NULL OR last_analyze < NOW() - INTERVAL '1 day'
            LIMIT 1;

            table_count := table_count + 1;
        EXCEPTION WHEN OTHERS THEN
            EXIT;
        END;
    END LOOP;

    -- Rebuild indexes that need maintenance
    FOR index_count IN 1..100 LOOP  -- Prevent infinite loop
        BEGIN
            PERFORM 1 FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname NOT IN ('pg_catalog', 'information_schema') LIMIT 1;
            IF NOT FOUND THEN EXIT;
            END IF;

            EXECUTE 'REINDEX INDEX CONCURRENTLY ' || quote_ident(schemaname) || '.' || quote_ident(indexname)
            FROM pg_stat_user_indexes
            WHERE idx_scan = 0 AND schemaname NOT IN ('pg_catalog', 'information_schema')
            LIMIT 1;

            index_count := index_count + 1;
        EXCEPTION WHEN OTHERS THEN
            EXIT;
        END;
    END LOOP;

    result := jsonb_build_object(
        'tables_analyzed', table_count,
        'indexes_rebuilt', index_count,
        'timestamp', NOW()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION optimize_database_tables() TO app_user;

-- Sample connection pool configuration for pgBouncer
-- This would typically go in a separate pgbouncer.ini file:
/*
[databases]
sdlc = host=localhost port=5432 dbname=sdlc

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = postgres
stats_users = stats, postgres

# Connection pool settings
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 50
max_user_connections = 50

# Timeouts
server_reset_query = DISCARD ALL
server_check_delay = 30
server_check_query = select 1
server_lifetime = 3600
server_idle_timeout = 600

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
*/
