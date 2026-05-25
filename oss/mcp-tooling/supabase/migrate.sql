-- Database Migration Runner
-- Usage: psql -f migrate.sql
-- Description: Run all pending migrations in order

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  execution_time_ms INTEGER
);

-- Enable RLS on migrations table
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Only service role can manage migrations
CREATE POLICY "Service role can manage migrations" ON public.schema_migrations
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- Function to get file checksum
CREATE OR REPLACE FUNCTION public.get_file_checksum(p_content TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(sha256(p_content::bytea), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to run migration
CREATE OR REPLACE FUNCTION public.run_migration(
  p_filename TEXT,
  p_content TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  execution_time_ms INTEGER
) AS $$
DECLARE
  v_checksum TEXT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_execution_time INTEGER;
  v_already_executed BOOLEAN;
BEGIN
  v_checksum := public.get_file_checksum(p_content);
  v_start_time := clock_timestamp();

  -- Check if migration already executed
  SELECT EXISTS(
    SELECT 1 FROM public.schema_migrations
    WHERE filename = p_filename AND checksum = v_checksum
  ) INTO v_already_executed;

  IF v_already_executed THEN
    RETURN QUERY
    SELECT true, 'Migration already executed', 0;
    RETURN;
  END IF;

  -- Execute the migration content
  BEGIN
    EXECUTE p_content;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT false, 'Migration failed: ' || SQLERRM, 0;
    RETURN;
  END;

  v_end_time := clock_timestamp();
  v_execution_time := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));

  -- Record the migration
  INSERT INTO public.schema_migrations (
    filename, checksum, execution_time_ms
  ) VALUES (
    p_filename, v_checksum, v_execution_time
  );

  RETURN QUERY
  SELECT true, 'Migration executed successfully', v_execution_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration files to execute
\echo Starting database migrations...

-- Migration 1: Initial Schema
\echo Executing migration: 20251102_001_initial_schema.sql
\ir 20251102_001_initial_schema.sql

-- Migration 2: Database Functions
\echo Executing migration: 20251102_002_database_functions.sql
\ir 20251102_002_database_functions.sql

-- Migration 3: Analytics Functions
\echo Executing migration: 20251102_003_analytics_functions.sql
\ir 20251102_003_analytics_functions.sql

-- Migration 4: Triggers and Constraints
\echo Executing migration: 20251102_004_triggers_constraints.sql
\ir 20251102_004_triggers_constraints.sql

\echo All migrations completed successfully!