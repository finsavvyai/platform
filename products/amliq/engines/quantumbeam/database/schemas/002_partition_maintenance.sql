-- Partition Maintenance Script for QuantumBeam.io
-- Manages time-based partitions for transactions and audit tables

-- Set up pg_cron extension if not already done
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA partition_maintenance;

-- Function to create monthly partitions
CREATE OR REPLACE FUNCTION partition_maintenance.create_monthly_partitions(
    p_table_name TEXT,
    p_schema_name TEXT DEFAULT 'public',
    p_months_ahead INTEGER DEFAULT 3,
    p_include_current BOOLEAN DEFAULT TRUE
)
RETURNS TEXT AS \$\$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_partition_name TEXT;
    v_sql TEXT;
    v_i INTEGER;
    v_count INTEGER := 0;
    v_created TEXT[] := '{}';
BEGIN
    -- Validate inputs
    IF p_table_name IS NULL OR p_table_name = '' THEN
        RAISE EXCEPTION 'Table name cannot be NULL or empty';
    END IF;

    IF p_months_ahead < 0 OR p_months_ahead > 24 THEN
        RAISE EXCEPTION 'Months ahead must be between 0 and 24';
    END IF;

    -- Check if table exists and is partitioned
    SELECT relkind INTO v_sql
    FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_class.relname = p_table_name
    AND pg_namespace.nspname = p_schema_name;

    IF v_sql != 'p' THEN
        RAISE EXCEPTION 'Table %.% does not exist or is not partitioned', p_schema_name, p_table_name;
    END IF;

    -- Start from current month or next month
    v_i := CASE WHEN p_include_current THEN 0 ELSE 1 END;

    -- Create partitions
    WHILE v_i <= p_months_ahead LOOP
        v_start_date := date_trunc('month', CURRENT_DATE + interval '1 month' * v_i);
        v_end_date := v_start_date + interval '1 month';
        v_partition_name := p_table_name || '_' || to_char(v_start_date, 'YYYY_MM');

        -- Check if partition already exists
        SELECT 1 INTO v_count
        FROM pg_tables
        WHERE schemaname = p_schema_name
        AND tablename = v_partition_name;

        IF v_count = 0 THEN
            -- Create partition
            v_sql := format('CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I
                          FOR VALUES FROM (%L) TO (%L)',
                          p_schema_name, v_partition_name,
                          p_schema_name, p_table_name,
                          v_start_date, v_end_date);

            EXECUTE v_sql;
            v_created := array_append(v_created, v_partition_name);

            -- Create indexes on partition
            PERFORM partition_maintenance.create_partition_indexes(
                p_schema_name,
                p_table_name,
                v_partition_name
            );

            -- Log partition creation
            INSERT INTO partition_maintenance.partition_log (
                table_name,
                partition_name,
                operation,
                status,
                details
            ) VALUES (
                p_table_name,
                v_partition_name,
                'CREATE',
                'SUCCESS',
                json_build_object(
                    'start_date', v_start_date,
                    'end_date', v_end_date,
                    'created_at', now()
                )
            );
        END IF;

        v_i := v_i + 1;
    END LOOP;

    RETURN format('Created % partitions for table %.%',
                  array_length(v_created, 1), p_schema_name, p_table_name);
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create indexes on partitions
CREATE OR REPLACE FUNCTION partition_maintenance.create_partition_indexes(
    p_schema_name TEXT,
    p_table_name TEXT,
    p_partition_name TEXT
)
RETURNS VOID AS \$\$
BEGIN
    -- Create common indexes based on table type
    IF p_table_name = 'transactions' THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (organization_id)',
                      'idx_' || p_partition_name || '_org_id', p_schema_name, p_partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (created_at)',
                      'idx_' || p_partition_name || '_created_at', p_schema_name, p_partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (status)',
                      'idx_' || p_partition_name || '_status', p_schema_name, p_partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (fraud_risk_level)',
                      'idx_' || p_partition_name || '_fraud_risk', p_schema_name, p_partition_name);
    ELSIF p_table_name = 'audit_log' THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (timestamp)',
                      'idx_' || p_partition_name || '_timestamp', p_schema_name, p_partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (table_name)',
                      'idx_' || p_partition_name || '_table', p_schema_name, p_partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (user_id)',
                      'idx_' || p_partition_name || '_user_id', p_schema_name, p_partition_name);
    END IF;
END;
\$\$ LANGUAGE plpgsql;

-- Function to drop old partitions
CREATE OR REPLACE FUNCTION partition_maintenance.drop_old_partitions(
    p_table_name TEXT,
    p_schema_name TEXT DEFAULT 'public',
    p_keep_months INTEGER DEFAULT 12
)
RETURNS TEXT AS \$\$
DECLARE
    v_cutoff_date DATE;
    v_partition_name TEXT;
    v_count INTEGER := 0;
    v_dropped TEXT[] := '{}';
    rec RECORD;
BEGIN
    v_cutoff_date := date_trunc('month', CURRENT_DATE - interval '1 month' * p_keep_months);

    FOR rec IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = p_schema_name
        AND tablename LIKE p_table_name || '_%'
        AND tablename < p_table_name || '_' || to_char(v_cutoff_date, 'YYYY_MM')
        ORDER BY tablename
    LOOP
        -- Check partition is not the default
        IF rec.tablename NOT LIKE '%_default' AND rec.tablename NOT LIKE '%_current' THEN
            EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', p_schema_name, rec.tablename);
            v_dropped := array_append(v_dropped, rec.tablename);
            v_count := v_count + 1;

            -- Log partition drop
            INSERT INTO partition_maintenance.partition_log (
                table_name,
                partition_name,
                operation,
                status,
                details
            ) VALUES (
                p_table_name,
                rec.tablename,
                'DROP',
                'SUCCESS',
                json_build_object(
                    'dropped_at', now(),
                    'retention_months', p_keep_months
                )
            );
        END IF;
    END LOOP;

    RETURN format('Dropped % old partitions for table %.%',
                  v_count, p_schema_name, p_table_name);
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze all partitions
CREATE OR REPLACE FUNCTION partition_maintenance.analyze_partitions(
    p_table_name TEXT,
    p_schema_name TEXT DEFAULT 'public'
)
RETURNS VOID AS \$\$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = p_schema_name
        AND tablename LIKE p_table_name || '_%'
    LOOP
        EXECUTE format('ANALYZE %I.%I', p_schema_name, rec.tablename);
    END LOOP;
END;
\$\$ LANGUAGE plpgsql;

-- Function to vacuum specific partitions
CREATE OR REPLACE FUNCTION partition_maintenance.vacuum_partition(
    p_schema_name TEXT,
    p_partition_name TEXT,
    p_full BOOLEAN DEFAULT FALSE
)
RETURNS TEXT AS \$\$
BEGIN
    IF p_full THEN
        EXECUTE format('VACUUM FULL ANALYZE %I.%I', p_schema_name, p_partition_name);
        RETURN format('Full vacuum completed for partition %.%', p_schema_name, p_partition_name);
    ELSE
        EXECUTE format('VACUUM ANALYZE %I.%I', p_schema_name, p_partition_name);
        RETURN format('Vacuum completed for partition %.%', p_schema_name, p_partition_name);
    END IF;
END;
\$\$ LANGUAGE plpgsql;

-- Partition log table
CREATE TABLE IF NOT EXISTS partition_maintenance.partition_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    partition_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for partition log
CREATE INDEX IF NOT EXISTS idx_partition_log_table_name ON partition_maintenance.partition_log(table_name);
CREATE INDEX IF NOT EXISTS idx_partition_log_created_at ON partition_maintenance.partition_log(created_at);

-- Function to get partition status
CREATE OR REPLACE FUNCTION partition_maintenance.get_partition_status(
    p_table_name TEXT,
    p_schema_name TEXT DEFAULT 'public'
)
RETURNS TABLE (
    partition_name TEXT,
    start_date DATE,
    end_date DATE,
    row_count BIGINT,
    size_mb NUMERIC,
    is_default BOOLEAN
) AS \$\$
DECLARE
    rec RECORD;
BEGIN
    RETURN QUERY
    SELECT
        t.relname as partition_name,
        CASE
            WHEN pg_get_expr(c.relpartbound, c.oid) LIKE 'FOR VALUES FROM (%' THEN
                (regexp_replace(
                    pg_get_expr(c.relpartbound, c.oid),
                    '.*FOR VALUES FROM \(([^)]+)\).*',
                    '\1'
                ))::date
            ELSE NULL
        END as start_date,
        CASE
            WHEN pg_get_expr(c.relpartbound, c.oid) LIKE 'FOR VALUES FROM (%' THEN
                (regexp_replace(
                    pg_get_expr(c.relpartbound, c.oid),
                    '.*TO \(([^)]+)\).*',
                    '\1'
                ))::date
            ELSE NULL
        END as end_date,
        COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as row_count,
        ROUND(pg_total_relation_size(t.oid) / 1048576.0, 2) as size_mb,
        pg_get_expr(c.relpartbound, c.oid) LIKE 'DEFAULT' as is_default
    FROM pg_class t
    JOIN pg_inherits i ON t.oid = i.inhrelid
    JOIN pg_class p ON i.inhparent = p.oid
    JOIN pg_namespace n ON p.relnamespace = n.oid
    JOIN pg_constraint c ON t.oid = c.conrelid AND c.contype = 'p'
    LEFT JOIN pg_stat_user_tables s ON s.schemaname = n.nspname AND s.relname = t.relname
    WHERE p.relname = p_table_name
    AND n.nspname = p_schema_name
    ORDER BY start_date NULLS LAST;
END;
\$\$ LANGUAGE plpgsql;

-- Schedule regular maintenance
-- Create partitions on the 1st of each month at 00:00
SELECT cron.schedule(
    'create-transactions-partitions',
    '0 0 1 * *',
    $$SELECT partition_maintenance.create_monthly_partitions('transactions', 'public', 3)$$
);

SELECT cron.schedule(
    'create-audit-partitions',
    '0 0 1 * *',
    $$SELECT partition_maintenance.create_monthly_partitions('audit_log', 'audit', 3)$$
);

-- Drop old partitions on the 2nd of each month
SELECT cron.schedule(
    'drop-old-transactions-partitions',
    '0 2 2 * *',
    $$SELECT partition_maintenance.drop_old_partitions('transactions', 'public', 12)$$
);

SELECT cron.schedule(
    'drop-old-audit-partitions',
    '0 3 2 * *',
    $$SELECT partition_maintenance.drop_old_partitions('audit_log', 'audit', 24)$$
);

-- Analyze partitions daily at 03:00
SELECT cron.schedule(
    'analyze-partitions',
    '0 3 * * *',
    $$SELECT partition_maintenance.analyze_partitions('transactions');
    SELECT partition_maintenance.analyze_partitions('audit_log', 'audit')$$
);

-- Vacuum old partitions weekly on Sunday at 04:00
SELECT cron.schedule(
    'vacuum-old-partitions',
    '0 4 * * 0',
    $$
    DO $$
    DECLARE
        rec RECORD;
    BEGIN
        FOR rec IN SELECT partition_name FROM partition_maintenance.get_partition_status('transactions')
                  WHERE start_date < CURRENT_DATE - INTERVAL '2 months' LOOP
            PERFORM partition_maintenance.vacuum_partition('public', rec.partition_name);
        END LOOP;
    END $$;
    $$
);

-- Grant permissions to partition_maintenance schema
GRANT USAGE ON SCHEMA partition_maintenance TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA partition_maintenance TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA partition_maintenance TO postgres;

-- Grant read access to analytics users
GRANT USAGE ON SCHEMA partition_maintenance TO quantumbeam_ml;
GRANT SELECT ON partition_maintenance.partition_log TO quantumbeam_ml;
GRANT EXECUTE ON FUNCTION partition_maintenance.get_partition_status(TEXT, TEXT) TO quantumbeam_ml;

COMMIT;
