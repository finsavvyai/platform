-- Install PostgreSQL Extensions for QuantumBeam.io
-- This script installs all required extensions for enhanced functionality

-- Create extension owner role if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'extension_owner') THEN
        CREATE ROLE extension_owner NOLOGIN;
    END IF;
END
\$\$;

-- Core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA public;

-- Statistical and array extensions
CREATE EXTENSION IF NOT EXISTS "intarray" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "hstore" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "ltree" WITH SCHEMA public;

-- Monitoring extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA public;

-- Time-based extensions (requires pg_cron)
CREATE EXTENSION IF NOT EXISTS "pg_cron" SCHEMA partition_maintenance;
COMMENT ON EXTENSION pg_cron IS 'Job scheduling for PostgreSQL';

-- Partition management extension
CREATE EXTENSION IF NOT EXISTS "pg_partman" SCHEMA partition_maintenance;
COMMENT ON EXTENSION pg_partman IS 'Partition management for PostgreSQL';

-- Fuzzy string matching
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;

-- Additional utility functions
CREATE EXTENSION IF NOT EXISTS "tablefunc" WITH SCHEMA public;

-- Check if extensions are installed
SELECT
    e.extname as extension_name,
    e.extversion as version,
    n.nspname as schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN (
    'uuid-ossp',
    'pgcrypto',
    'btree_gin',
    'btree_gist',
    'intarray',
    'hstore',
    'ltree',
    'pg_stat_statements',
    'pg_cron',
    'pg_partman',
    'fuzzystrmatch',
    'pg_trgm',
    'unaccent',
    'tablefunc'
)
ORDER BY e.extname;

-- Create custom functions for enhanced functionality

-- Function to calculate similarity ratio using trigram
CREATE OR REPLACE FUNCTION similarity_ratio(text, text)
RETURNS FLOAT AS \$\$
BEGIN
    RETURN similarity(\$1, \$2);
END;
\$\$ LANGUAGE plpgsql;

-- Function to generate secure random tokens
CREATE OR REPLACE FUNCTION generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS \$\$
DECLARE
    token TEXT;
BEGIN
    SELECT encode(gen_random_bytes(length/2), 'hex') INTO token;
    RETURN token;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash passwords securely
CREATE OR REPLACE FUNCTION hash_password(password TEXT, salt TEXT DEFAULT NULL)
RETURNS TEXT AS \$\$
DECLARE
    salted_password TEXT;
BEGIN
    IF salt IS NULL THEN
        salt := encode(gen_random_bytes(16), 'hex');
    END IF;
    salted_password := salt || password;
    RETURN 'scrypt:' || salt || ':' || encode(encrypt(salted_password::bytea, salt::bytea, 'aes'), 'hex');
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check password
CREATE OR REPLACE FUNCTION check_password(password TEXT, hashed_password TEXT)
RETURNS BOOLEAN AS \$\$
DECLARE
    salt TEXT;
    expected_hash TEXT;
BEGIN
    IF hashed_password LIKE 'scrypt:%' THEN
        salt := split_part(hashed_password, ':', 2);
        expected_hash := hash_password(password, salt);
        RETURN hashed_password = expected_hash;
    END IF;
    RETURN false;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create functions for partition management

-- Function to check if partition exists
CREATE OR REPLACE FUNCTION partition_exists(table_name TEXT, partition_name TEXT)
RETURNS BOOLEAN AS \$\$
DECLARE
    exists_flag BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = partition_name
        AND schemaname = 'public'
    ) INTO exists_flag;

    RETURN exists_flag;
END;
\$\$ LANGUAGE plpgsql;

-- Function to create daily partitions for high-traffic tables
CREATE OR REPLACE FUNCTION create_daily_partitions(table_name TEXT, days_ahead INTEGER DEFAULT 7)
RETURNS VOID AS \$\$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    FOR i IN 0..days_ahead LOOP
        start_date := CURRENT_DATE + i;
        end_date := start_date + interval '1 day';
        partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM_DD');

        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                      partition_name, table_name, start_date, end_date);

        -- Analyze after creation
        EXECUTE format('ANALYZE %I', partition_name);
    END LOOP;
END;
\$\$ LANGUAGE plpgsql;

-- Function to create weekly partitions
CREATE OR REPLACE FUNCTION create_weekly_partitions(table_name TEXT, weeks_ahead INTEGER DEFAULT 4)
RETURNS VOID AS \$\$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    FOR i IN 0..weeks_ahead LOOP
        start_date := date_trunc('week', CURRENT_DATE + interval '1 week' * i);
        end_date := start_date + interval '1 week';
        partition_name := table_name || '_' || to_char(start_date, 'YYYY_WW');

        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                      partition_name, table_name, start_date, end_date);

        -- Analyze after creation
        EXECUTE format('ANALYZE %I', partition_name);
    END LOOP;
END;
\$\$ LANGUAGE plpgsql;

-- Function to get partition size
CREATE OR REPLACE FUNCTION get_partition_size(partition_name TEXT)
RETURNS BIGINT AS \$\$
DECLARE
    size_bytes BIGINT;
BEGIN
    SELECT pg_total_relation_size(quote_ident(partition_name)) INTO size_bytes;
    RETURN size_bytes;
END;
\$\$ LANGUAGE plpgsql;

-- Function to get partition row count
CREATE OR REPLACE FUNCTION get_partition_row_count(partition_name TEXT)
RETURNS BIGINT AS \$\$
DECLARE
    row_count BIGINT;
BEGIN
    EXECUTE format('SELECT COUNT(*) FROM %I', partition_name) INTO row_count;
    RETURN row_count;
END;
\$\$ LANGUAGE plpgsql;

-- Create view for partition information
CREATE OR REPLACE VIEW partition_information AS
SELECT
    schemaname,
    tablename,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables
WHERE tablename LIKE '%_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO quantumbeam_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO quantumbeam_ml;
GRANT SELECT ON partition_information TO quantumbeam_ml;
GRANT SELECT ON partition_information TO quantumbeam_readonly;

-- Create indexes for pg_trgm if not exists
CREATE INDEX IF NOT EXISTS trgm_idx_transactions_merchant_name ON transactions
USING gin (merchant_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS trgm_idx_users_email ON users
USING gin (email gin_trgm_ops);

-- Create GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin ON transactions
USING gin (metadata jsonb_path_ops);

-- Create BRIN index for time-series data (good for partitioned tables)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_brin ON transactions
USING brin (created_at);

-- Create bloom index for multi-column queries (if available)
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'bloom') THEN
        CREATE INDEX IF NOT EXISTS idx_transactions_bloom ON transactions
        USING bloom (organization_id, status, fraud_risk_level);
    END IF;
END
\$\$;

-- Create custom aggregate for weighted average
CREATE OR REPLACE FUNCTION weighted_avg_state(state NUMERIC[], value NUMERIC, weight NUMERIC)
RETURNS NUMERIC[] AS \$\$
BEGIN
    RETURN ARRAY[state[1] + weight, state[2] + (value * weight)];
END;
\$\$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION weighted_avg_final(state NUMERIC[])
RETURNS NUMERIC AS \$\$
BEGIN
    RETURN CASE WHEN state[1] = 0 THEN NULL ELSE state[2] / state[1] END;
END;
\$\$ LANGUAGE plpgsql IMMUTABLE;

CREATE AGGREGATE weighted_avg(NUMERIC, NUMERIC) (
    SFUNC = weighted_avg_state,
    STYPE = NUMERIC[],
    FINALFUNC = weighted_avg_final,
    INITCOND = '{0,0}'
);

-- Create function for time-weighted average
CREATE OR REPLACE FUNCTION time_weighted_avg(
    value_column TEXT,
    timestamp_column TEXT,
    table_name TEXT,
    time_window INTERVAL DEFAULT '24 hours'
)
RETURNS NUMERIC AS \$\$
DECLARE
    result NUMERIC;
BEGIN
    EXECUTE format('
        SELECT weighted_avg(%I, EXTRACT(EPOCH FROM (%I - (%I - $1))))
        FROM %I
        WHERE %I >= NOW() - $1
    ', value_column, timestamp_column, timestamp_column, table_name, timestamp_column)
    INTO result
    USING time_window;

    RETURN result;
END;
\$\$ LANGUAGE plpgsql;

COMMIT;
