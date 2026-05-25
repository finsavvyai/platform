-- Database Migration Rollback
-- Usage: psql -f rollback.sql <migration_id>
-- Description: Rollback specific migration

-- Function to rollback migration
CREATE OR REPLACE FUNCTION public.rollback_migration(
  p_filename TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_migration_exists BOOLEAN;
BEGIN
  -- Check if migration exists
  SELECT EXISTS(
    SELECT 1 FROM public.schema_migrations
    WHERE filename = p_filename
  ) INTO v_migration_exists;

  IF NOT v_migration_exists THEN
    RETURN QUERY
    SELECT false, 'Migration not found: ' || p_filename;
    RETURN;
  END IF;

  -- Remove migration record (actual rollback would be migration-specific)
  DELETE FROM public.schema_migrations
  WHERE filename = p_filename;

  RETURN QUERY
  SELECT true, 'Migration rolled back: ' || p_filename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rollback scripts for specific migrations
-- Note: These would be migration-specific rollback logic

-- Rollback for 20251102_004_triggers_constraints.sql
CREATE OR REPLACE FUNCTION public.rollback_20251102_004_triggers_constraints()
RETURNS VOID AS $$
BEGIN
  -- Drop triggers
  DROP TRIGGER IF EXISTS log_connector_deletion_trigger ON public.connectors;
  DROP TRIGGER IF EXISTS log_profile_update_trigger ON public.user_profiles;
  DROP TRIGGER IF EXISTS validate_connector_slug_trigger ON public.connectors;
  DROP TRIGGER IF EXISTS update_tool_count_trigger ON public.connectors;
  DROP TRIGGER IF EXISTS log_job_status_change_trigger ON public.jobs;
  DROP TRIGGER IF EXISTS prevent_connector_deletion_trigger ON public.connectors;

  -- Drop functions
  DROP FUNCTION IF EXISTS public.validate_connector_slug();
  DROP FUNCTION IF EXISTS public.update_tool_count();
  DROP FUNCTION IF EXISTS public.log_job_status_change();
  DROP FUNCTION IF EXISTS public.prevent_connector_deletion();
  DROP FUNCTION IF EXISTS public.cleanup_old_job_logs(INTEGER);
  DROP FUNCTION IF EXISTS public.archive_old_jobs(INTEGER);
  DROP FUNCTION IF EXISTS public.log_sensitive_operation(TEXT, UUID, TEXT, JSONB, JSONB);

  -- Drop constraints
  ALTER TABLE public.connectors DROP CONSTRAINT IF EXISTS spec_summary_structure;
  ALTER TABLE public.connectors DROP CONSTRAINT IF EXISTS deployment_config_structure;
  ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS progress_structure;
  ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS job_config_structure;
  ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_preferences_theme;
  ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_preferences_notifications;

  -- Drop indexes
  DROP INDEX IF EXISTS idx_connectors_spec_summary_title;
  DROP INDEX IF EXISTS idx_connectors_spec_summary_auth_mode;
  DROP INDEX IF EXISTS idx_jobs_progress_stage;
  DROP INDEX IF EXISTS idx_audit_log_user_id;
  DROP INDEX IF EXISTS idx_audit_log_table_name;
  DROP INDEX IF EXISTS idx_audit_log_created_at;
  DROP INDEX IF EXISTS idx_audit_log_action;

  -- Drop audit log table
  DROP TABLE IF EXISTS public.audit_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rollback for 20251102_003_analytics_functions.sql
CREATE OR REPLACE FUNCTION public.rollback_20251102_003_analytics_functions()
RETURNS VOID AS $$
BEGIN
  -- Drop materialized view
  DROP MATERIALIZED VIEW IF EXISTS public.connector_stats_mv;

  -- Drop functions
  DROP FUNCTION IF EXISTS public.get_connector_analytics(UUID, DATE, DATE);
  DROP FUNCTION IF EXISTS public.get_top_connectors(INTEGER, INTEGER);
  DROP FUNCTION IF EXISTS public.get_daily_usage_aggregation(DATE);
  DROP FUNCTION IF EXISTS public.get_job_performance_metrics(INTEGER);
  DROP FUNCTION IF EXISTS public.get_system_health_metrics();
  DROP FUNCTION IF EXISTS public.cleanup_old_metrics(INTEGER);
  DROP FUNCTION IF EXISTS public.get_user_activity_summary(INTEGER);
  DROP FUNCTION IF EXISTS public.estimate_job_duration(INTEGER, INTEGER, connector_runtime);
  DROP FUNCTION IF EXISTS public.refresh_connector_stats();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rollback for 20251102_002_database_functions.sql
CREATE OR REPLACE FUNCTION public.rollback_20251102_002_database_functions()
RETURNS VOID AS $$
BEGIN
  -- Drop functions
  DROP FUNCTION IF EXISTS public.upsert_user_profile(UUID, TEXT, TEXT, JSONB);
  DROP FUNCTION IF EXISTS public.create_connector(TEXT, TEXT, TEXT, connector_runtime, auth_mode, TEXT, JSONB, TEXT[], BOOLEAN);
  DROP FUNCTION IF EXISTS public.update_connector_version(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT);
  DROP FUNCTION IF EXISTS public.create_generation_job(UUID, JSONB, job_priority);
  DROP FUNCTION IF EXISTS public.update_job_status(UUID, job_status, JSONB, TEXT, TEXT);
  DROP FUNCTION IF EXISTS public.record_usage_metrics(UUID, DATE, INTEGER, BOOLEAN, INTEGER, BIGINT, BIGINT);
  DROP FUNCTION IF EXISTS public.get_user_dashboard_stats();
  DROP FUNCTION IF EXISTS public.search_connectors(TEXT, connector_status, connector_runtime, auth_mode, INTEGER, INTEGER);
  DROP FUNCTION IF EXISTS public.generate_api_key(TEXT, JSONB, INTEGER);
  DROP FUNCTION IF EXISTS public.validate_api_key(TEXT, TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rollback for 20251102_001_initial_schema.sql
CREATE OR REPLACE FUNCTION public.rollback_20251102_001_initial_schema()
RETURNS VOID AS $$
BEGIN
  -- Drop tables in reverse order of creation
  DROP TABLE IF EXISTS public.api_keys CASCADE;
  DROP TABLE IF EXISTS public.connector_versions CASCADE;
  DROP TABLE IF EXISTS public.usage_metrics CASCADE;
  DROP TABLE IF EXISTS public.job_logs CASCADE;
  DROP TABLE IF EXISTS public.jobs CASCADE;
  DROP TABLE IF EXISTS public.connectors CASCADE;
  DROP TABLE IF EXISTS public.user_profiles CASCADE;

  -- Drop custom types
  DROP TYPE IF EXISTS job_priority;
  DROP TYPE IF EXISTS job_type;
  DROP TYPE IF EXISTS job_status;
  DROP TYPE IF EXISTS auth_mode;
  DROP TYPE IF EXISTS connector_runtime;
  DROP TYPE IF EXISTS connector_status;

  -- Drop functions
  DROP FUNCTION IF EXISTS public.handle_updated_at();

  -- Drop extensions
  DROP EXTENSION IF EXISTS "pgcrypto";
  DROP EXTENSION IF EXISTS "uuid-ossp";
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example usage:
-- SELECT public.rollback_20251102_004_triggers_constraints();
-- DELETE FROM public.schema_migrations WHERE filename = '20251102_004_triggers_constraints.sql';