-- Database Triggers and Additional Constraints
-- Migration: 20251102_004_triggers_constraints.sql
-- Description: Create triggers for data integrity and additional constraints

-- Function to validate connector slug uniqueness
CREATE OR REPLACE FUNCTION public.validate_connector_slug()
RETURNS TRIGGER AS $$
DECLARE
  v_slug_conflict BOOLEAN;
BEGIN
  -- Check if slug already exists for this user
  SELECT EXISTS(
    SELECT 1 FROM public.connectors
    WHERE owner_id = NEW.owner_id
      AND slug = NEW.slug
      AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) INTO v_slug_conflict;

  IF v_slug_conflict THEN
    RAISE EXCEPTION 'Connector slug "%" already exists for this user', NEW.slug;
  END IF;

  -- Ensure slug is in proper format (lowercase, alphanumeric, hyphens)
  IF NEW.slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'Connector slug must contain only lowercase letters, numbers, and hyphens';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for connector slug validation
CREATE TRIGGER validate_connector_slug_trigger
  BEFORE INSERT OR UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.validate_connector_slug();

-- Function to maintain connector tool count
CREATE OR REPLACE FUNCTION public.update_tool_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update tool count based on manifest content
  IF NEW.manifest_content IS NOT NULL THEN
    NEW.tool_count = COALESCE(
      (NEW.manifest_content->'tools'->>0 IS NOT NULL)::INTEGER +
      CASE
        WHEN jsonb_typeof(NEW.manifest_content->'tools') = 'array' THEN
          jsonb_array_length(NEW.manifest_content->'tools')
        ELSE 0
      END,
      0
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for tool count update
CREATE TRIGGER update_tool_count_trigger
  BEFORE INSERT OR UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_tool_count();

-- Function to log job status changes
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_status_change TEXT;
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    v_status_change := format('Job status changed from %s to %s', OLD.status, NEW.status);

    INSERT INTO public.job_logs (
      job_id, level, message, metadata
    ) VALUES (
      NEW.id,
      CASE
        WHEN NEW.status = 'failed' THEN 'error'
        WHEN NEW.status = 'completed' THEN 'info'
        WHEN NEW.status = 'running' THEN 'info'
        ELSE 'debug'
      END,
      v_status_change,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changed_by', current_setting('request.jwt.claims', true)::json->>'->>'sub'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for job status logging
CREATE TRIGGER log_job_status_change_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_job_status_change();

-- Function to increment download count
CREATE OR REPLACE FUNCTION public.increment_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.connectors
  SET download_count = download_count + 1,
      updated_at = NOW()
  WHERE id = NEW.connector_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This trigger would be set up on a download tracking table if we had one

-- Function to validate JSON schema structures
CREATE OR REPLACE FUNCTION public.validate_json_schemas()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate spec_content structure
  IF NEW.spec_content IS NOT NULL THEN
    -- Basic OpenAPI structure validation
    IF NOT (NEW.spec_content ? 'openapi' OR NEW.spec_content ? 'swagger') THEN
      RAISE EXCEPTION 'Invalid OpenAPI specification: missing version field';
    END IF;

    IF NOT (NEW.spec_content ? 'paths') THEN
      RAISE EXCEPTION 'Invalid OpenAPI specification: missing paths field';
    END IF;
  END IF;

  -- Validate manifest_content structure
  IF NEW.manifest_content IS NOT NULL THEN
    IF NOT (NEW.manifest_content ? 'name') THEN
      RAISE EXCEPTION 'Invalid MCP manifest: missing name field';
    END IF;

    IF NOT (NEW.manifest_content ? 'version') THEN
      RAISE EXCEPTION 'Invalid MCP manifest: missing version field';
    END IF;

    IF NOT (NEW.manifest_content ? 'tools') THEN
      RAISE EXCEPTION 'Invalid MCP manifest: missing tools field';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for JSON schema validation
CREATE TRIGGER validate_json_schemas_trigger
  BEFORE INSERT OR UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.validate_json_schemas();

-- Function to prevent deletion of connectors with active deployments
CREATE OR REPLACE FUNCTION public.prevent_connector_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_active_deployments INTEGER;
BEGIN
  -- Check if connector has active deployments or running jobs
  SELECT COUNT(*) INTO v_active_deployments
  FROM public.jobs
  WHERE connector_id = OLD.id
    AND status IN ('pending', 'running');

  IF v_active_deployments > 0 THEN
    RAISE EXCEPTION 'Cannot delete connector with % active job(s)', v_active_deployments;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for preventing connector deletion
CREATE TRIGGER prevent_connector_deletion_trigger
  BEFORE DELETE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_connector_deletion();

-- Function to maintain user activity counts
CREATE OR REPLACE FUNCTION public.update_user_activity_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called by various triggers to update denormalized counts
  -- For now, it's a placeholder for future implementation

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Additional constraints for data integrity

-- Ensure spec_summary has required fields when spec_content exists
ALTER TABLE public.connectors
  ADD CONSTRAINT spec_summary_structure
  CHECK (
    (spec_content IS NULL) OR
    (spec_summary IS NOT NULL AND
     jsonb_typeof(spec_summary) = 'object' AND
     spec_summary ? 'title' AND
     spec_summary ? 'version' AND
     spec_summary ? 'endpoints' AND
     spec_summary ? 'auth_mode')
  );

-- Ensure deployment_config has valid structure
ALTER TABLE public.connectors
  ADD CONSTRAINT deployment_config_structure
  CHECK (
    jsonb_typeof(deployment_config) = 'object' AND
    (deployment_config ? 'environment_variables' IS NULL OR
     jsonb_typeof(deployment_config->'environment_variables') = 'object')
  );

-- Ensure progress JSON has required fields
ALTER TABLE public.jobs
  ADD CONSTRAINT progress_structure
  CHECK (
    jsonb_typeof(progress) = 'object' AND
    progress ? 'stage' AND
    jsonb_typeof(progress->'stage') = 'text' AND
    progress ? 'percentage' AND
    (progress->'percentage' >= 0 AND progress->'percentage' <= 100)
  );

-- Ensure job config has valid structure
ALTER TABLE public.jobs
  ADD CONSTRAINT job_config_structure
  CHECK (
    jsonb_typeof(config) = 'object' AND
    (config ? 'generation_options' IS NULL OR
     jsonb_typeof(config->'generation_options') = 'object')
  );

-- Add constraints for user preferences
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_preferences_theme
  CHECK (
    preferences->>'theme' IN ('light', 'dark', 'system')
  );

-- Add check for email notifications preference
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_preferences_notifications
  CHECK (
    (preferences->'notifications' IS NULL) OR
    jsonb_typeof(preferences->'notifications') = 'object'
  );

-- Create index for frequently queried JSON fields
CREATE INDEX idx_connectors_spec_summary_title ON public.connectors
  USING GIN ((spec_summary->>'title') gin_trgm_ops);

CREATE INDEX idx_connectors_spec_summary_auth_mode ON public.connectors
  USING GIN ((spec_summary->>'auth_mode') gin_trgm_ops);

CREATE INDEX idx_jobs_progress_stage ON public.jobs
  USING GIN ((progress->>'stage') gin_trgm_ops);

-- Function to clean up old job logs (retention policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_job_logs(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  deleted_records BIGINT,
  retention_date TIMESTAMPTZ
) AS $$
DECLARE
  v_deleted_count BIGINT;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- Delete old job logs, but keep logs for completed jobs for longer
  DELETE FROM public.job_logs
  WHERE timestamp < v_cutoff_date
    AND job_id NOT IN (
      SELECT id FROM public.jobs
      WHERE status = 'completed'
        AND finished_at >= v_cutoff_date
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY
  SELECT v_deleted_count, v_cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive old completed jobs
CREATE OR REPLACE FUNCTION public.archive_old_jobs(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  archived_records BIGINT,
  retention_date TIMESTAMPTZ
) AS $$
DECLARE
  v_archived_count BIGINT;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- This would move old completed jobs to an archive table
  -- For now, just count what would be archived

  SELECT COUNT(*) INTO v_archived_count
  FROM public.jobs
  WHERE status = 'completed'
    AND finished_at < v_cutoff_date;

  RETURN QUERY
  SELECT v_archived_count, v_cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit log table for sensitive operations
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON public.audit_log
  FOR INSERT WITH CHECK (current_setting('role', true) = 'service_role');

-- Users can only see their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

-- Create index for audit log queries
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- Function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_operation(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_log (
    user_id, action, table_name, record_id, old_values, new_values,
    ip_address, user_agent
  ) VALUES (
    auth.uid(),
    p_action,
    p_table_name,
    p_record_id,
    p_old_values,
    p_new_values,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log connector deletions
CREATE TRIGGER log_connector_deletion
  AFTER DELETE ON public.connectors
  FOR EACH ROW EXECUTE PROCEDURE public.log_sensitive_operation(
    'connectors',
    OLD.id,
    'DELETE',
    jsonb_build_object(
      'name', OLD.name,
      'status', OLD.status,
      'owner_id', OLD.owner_id
    ),
    NULL
  );

-- Trigger to log profile updates
CREATE TRIGGER log_profile_update
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name
        OR OLD.avatar_url IS DISTINCT FROM NEW.avatar_url
        OR OLD.preferences IS DISTINCT FROM NEW.preferences)
  EXECUTE PROCEDURE public.log_sensitive_operation(
    'user_profiles',
    OLD.id,
    'UPDATE',
    jsonb_build_object(
      'display_name', OLD.display_name,
      'avatar_url', OLD.avatar_url,
      'preferences', OLD.preferences
    ),
    jsonb_build_object(
      'display_name', NEW.display_name,
      'avatar_url', NEW.avatar_url,
      'preferences', NEW.preferences
    )
  );