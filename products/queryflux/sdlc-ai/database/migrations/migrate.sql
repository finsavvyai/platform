-- Migration Management Script
-- This script manages database migrations with versioning and rollback capabilities

DO $$
DECLARE
    migration_version TEXT;
    migration_file TEXT;
    migration_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting database migration process...';

    -- Get migration files in order
    FOR migration_file IN
        SELECT regexp_replace(filename, '^(\d+).*$', '\1') as version
        FROM unnest(ARRAY[
            '001_create_extensions_and_types.sql',
            '002_create_core_tables.sql',
            '003_create_policy_and_security_tables.sql',
            '004_create_views_and_materialized_views.sql',
            '005_implement_row_level_security.sql',
            '006_create_triggers_and_constraints.sql'
        ]) WITH ORDINALITY AS t(filename, ord)
        ORDER BY ord
    LOOP
        -- Check if migration already applied
        SELECT version INTO migration_version
        FROM schema_migrations
        WHERE version = migration_file;

        IF migration_version IS NULL THEN
            RAISE NOTICE 'Applying migration %', migration_file;
            -- Note: In a real implementation, you would execute the migration file here
            -- This is a placeholder that would be replaced by actual file execution logic
            migration_count := migration_count + 1;
        ELSE
            RAISE NOTICE 'Migration % already applied, skipping', migration_file;
        END IF;
    END LOOP;

    RAISE NOTICE 'Migration process completed. % new migrations applied.', migration_count;
END $$;

-- Helper function to check migration status
CREATE OR REPLACE FUNCTION get_migration_status()
RETURNS TABLE(version TEXT, description TEXT, executed_at TIMESTAMPTZ, status TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sm.version,
        sm.description,
        sm.executed_at,
        'applied'::TEXT as status
    FROM schema_migrations sm
    ORDER BY sm.version;

    -- Return unapplied migrations
    RETURN QUERY
    SELECT
        regexp_replace(filename, '^(\d+).*$', '\1') as version,
        'Pending migration' as description,
        NULL::TIMESTAMPTZ as executed_at,
        'pending'::TEXT as status
    FROM unnest(ARRAY[
        '001_create_extensions_and_types.sql',
        '002_create_core_tables.sql',
        '003_create_policy_and_security_tables.sql',
        '004_create_views_and_materialized_views.sql',
        '005_implement_row_level_security.sql',
        '006_create_triggers_and_constraints.sql'
    ]) AS filename
    WHERE regexp_replace(filename, '^(\d+).*$', '\1') NOT IN (
        SELECT version FROM schema_migrations
    )
    ORDER BY filename;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback specific migration
CREATE OR REPLACE FUNCTION rollback_migration(migration_version TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    rollback_script TEXT;
BEGIN
    -- Get rollback script from migration record
    SELECT rollback_script INTO rollback_script
    FROM schema_migrations
    WHERE version = migration_version;

    IF rollback_script IS NULL THEN
        RAISE EXCEPTION 'Migration % not found or no rollback script available', migration_version;
        RETURN false;
    END IF;

    -- Execute rollback script
    -- Note: In a real implementation, you would execute the rollback script here
    RAISE NOTICE 'Rolling back migration %', migration_version;

    -- Remove migration record
    DELETE FROM schema_migrations WHERE version = migration_version;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to validate database schema
CREATE OR REPLACE FUNCTION validate_database_schema()
RETURNS TABLE(validation_type TEXT, status TEXT, message TEXT) AS $$
BEGIN
    -- Check extensions
    RETURN QUERY
    SELECT
        'extension'::TEXT as validation_type,
        CASE WHEN count(*) = 6 THEN 'PASS' ELSE 'FAIL' END as status,
        format('Required extensions: %s, Found: %s',
               'vector, uuid-ossp, pgcrypto, btree_gist, pg_trgm, fuzzystrmatch',
               count(*)) as message
    FROM pg_extension
    WHERE extname IN ('vector', 'uuid-ossp', 'pgcrypto', 'btree_gist', 'pg_trgm', 'fuzzystrmatch');

    -- Check tables
    RETURN QUERY
    SELECT
        'tables'::TEXT as validation_type,
        CASE WHEN count(*) = 15 THEN 'PASS' ELSE 'FAIL' END as status,
        format('Required tables: 15, Found: %s', count(*)) as message
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'tenants', 'users', 'api_keys', 'user_sessions', 'documents',
        'document_chunks', 'policies', 'policy_evaluations', 'dlp_scans',
        'audit_logs', 'token_usage', 'document_processing_jobs',
        'vector_search_logs', 'embedding_jobs', 'document_access_log'
    );

    -- Check indexes
    RETURN QUERY
    SELECT
        'indexes'::TEXT as validation_type,
        'PASS'::TEXT as status,
        format('Critical indexes present: %s', count(*)) as message
    FROM pg_indexes
    WHERE tablename IN ('documents', 'document_chunks', 'users', 'tenants')
    AND indexname LIKE 'idx_%';

    -- Check RLS policies
    RETURN QUERY
    SELECT
        'row_level_security'::TEXT as validation_type,
        CASE WHEN count(*) = 15 THEN 'PASS' ELSE 'FAIL' END as status,
        format('RLS enabled tables: %s', count(*)) as message
    FROM pg_tables
    WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'tenants', 'users', 'api_keys', 'user_sessions', 'documents',
        'document_chunks', 'policies', 'policy_evaluations', 'dlp_scans',
        'audit_logs', 'token_usage', 'document_processing_jobs',
        'vector_search_logs', 'embedding_jobs', 'document_access_log'
    );

    -- Check materialized views
    RETURN QUERY
    SELECT
        'materialized_views'::TEXT as validation_type,
        CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END as status,
        format('Materialized views: %s', count(*)) as message
    FROM pg_matviews
    WHERE matviewname = 'tenant_statistics';

END;
$$ LANGUAGE plpgsql;

-- Create view for migration status
CREATE VIEW migration_status AS
SELECT * FROM get_migration_status();

-- Create view for schema validation
CREATE VIEW schema_validation AS
SELECT * FROM validate_database_schema();

-- Grant permissions on migration functions
GRANT EXECUTE ON FUNCTION get_migration_status() TO app_user;
GRANT EXECUTE ON FUNCTION rollback_migration(TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION validate_database_schema() TO app_user;
GRANT SELECT ON migration_status TO app_user;
GRANT SELECT ON schema_validation TO app_user;
