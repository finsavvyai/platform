-- Database Functions for Common Operations
-- Migration: 20251102_002_database_functions.sql
-- Description: Create helper functions for connector management, job processing, and analytics

-- Function to create or update user profile
CREATE OR REPLACE FUNCTION public.upsert_user_profile(
  p_user_id UUID,
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_preferences JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, display_name, avatar_url, preferences
  ) VALUES (
    p_user_id, p_display_name, p_avatar_url, p_preferences
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
    preferences = COALESCE(EXCLUDED.preferences, user_profiles.preferences),
    updated_at = NOW()
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a new connector
CREATE OR REPLACE FUNCTION public.create_connector(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT DEFAULT NULL,
  p_runtime connector_runtime,
  p_auth_mode auth_mode,
  p_spec_url TEXT DEFAULT NULL,
  p_spec_content JSONB DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_is_public BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  runtime connector_runtime,
  auth_mode auth_mode,
  status connector_status,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_owner_id UUID;
  v_connector_id UUID;
BEGIN
  -- Get user profile ID
  SELECT id INTO v_owner_id
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Create connector
  INSERT INTO public.connectors (
    name, slug, description, owner_id, runtime, auth_mode,
    spec_url, spec_content, tags, is_public
  ) VALUES (
    p_name, p_slug, p_description, v_owner_id, p_runtime, p_auth_mode,
    p_spec_url, p_spec_content, p_tags, p_is_public
  )
  RETURNING id, name, slug, description, runtime, auth_mode, status, created_at INTO v_connector_id;

  RETURN QUERY SELECT * FROM public.connectors WHERE id = v_connector_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update connector and create version
CREATE OR REPLACE FUNCTION public.update_connector_version(
  p_connector_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_spec_url TEXT DEFAULT NULL,
  p_spec_content JSONB DEFAULT NULL,
  p_manifest_content JSONB DEFAULT NULL,
  p_changelog TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  version INTEGER
) AS $$
DECLARE
  v_owner_id UUID;
  v_current_version INTEGER;
  v_new_version INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Check ownership
  SELECT owner_id INTO v_owner_id
  FROM public.connectors
  WHERE id = p_connector_id;

  IF v_owner_id != (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) THEN
    RETURN QUERY SELECT false, 'Unauthorized'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Get current version
  SELECT version INTO v_current_version
  FROM public.connectors
  WHERE id = p_connector_id;

  v_new_version := v_current_version + 1;

  -- Create new version entry
  INSERT INTO public.connector_versions (
    connector_id, version, name, description, spec_url,
    spec_content, manifest_content, changelog, created_by
  ) SELECT
    id, v_new_version, COALESCE(p_name, name), COALESCE(p_description, description),
    COALESCE(p_spec_url, spec_url), p_spec_content, p_manifest_content,
    p_changelog, v_owner_id
  FROM public.connectors
  WHERE id = p_connector_id;

  -- Update main connector
  UPDATE public.connectors SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    spec_url = COALESCE(p_spec_url, spec_url),
    spec_content = COALESCE(p_spec_content, spec_content),
    manifest_content = COALESCE(p_manifest_content, manifest_content),
    version = v_new_version,
    updated_at = NOW()
  WHERE id = p_connector_id;

  RETURN QUERY SELECT true, 'Connector updated successfully'::TEXT, v_new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a generation job
CREATE OR REPLACE FUNCTION public.create_generation_job(
  p_connector_id UUID,
  p_config JSONB DEFAULT '{}',
  p_priority job_priority DEFAULT 'normal'
)
RETURNS TABLE (
  id UUID,
  status job_status,
  estimated_duration INTEGER,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_job_id UUID;
  v_owner_id UUID;
BEGIN
  -- Check connector ownership
  SELECT owner_id INTO v_owner_id
  FROM public.connectors
  WHERE id = p_connector_id;

  IF v_owner_id != (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this connector';
  END IF;

  -- Create job
  INSERT INTO public.jobs (
    connector_id, type, status, priority, config, estimated_duration
  ) VALUES (
    p_connector_id, 'generate', 'pending', p_priority, p_config, 180
  )
  RETURNING id, status, estimated_duration, created_at INTO v_job_id;

  RETURN QUERY SELECT * FROM public.jobs WHERE id = v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job status and log
CREATE OR REPLACE FUNCTION public.update_job_status(
  p_job_id UUID,
  p_status job_status,
  p_progress JSONB DEFAULT '{}',
  p_message TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_job_exists BOOLEAN;
BEGIN
  -- Check if job exists and user has access
  SELECT EXISTS(
    SELECT 1 FROM public.jobs j
    JOIN public.connectors c ON j.connector_id = c.id
    WHERE j.id = p_job_id
    AND c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  ) INTO v_job_exists;

  IF NOT v_job_exists THEN
    RETURN false;
  END IF;

  -- Update job status
  UPDATE public.jobs SET
    status = p_status,
    progress = p_progress,
    error_message = p_error_message,
    started_at = CASE WHEN p_status = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
    finished_at = CASE WHEN p_status IN ('completed', 'failed') AND finished_at IS NULL THEN NOW() ELSE finished_at END
  WHERE id = p_job_id;

  -- Log the status change
  IF p_message IS NOT NULL THEN
    INSERT INTO public.job_logs (
      job_id, level, message
    ) VALUES (
      p_job_id,
      CASE
        WHEN p_status = 'failed' THEN 'error'
        WHEN p_status = 'completed' THEN 'info'
        WHEN p_status = 'running' THEN 'info'
        ELSE 'debug'
      END,
      p_message
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage metrics
CREATE OR REPLACE FUNCTION public.record_usage_metrics(
  p_connector_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_hour INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_bytes_sent BIGINT DEFAULT NULL,
  p_bytes_received BIGINT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Verify ownership (this should be called by service role)
  SELECT owner_id INTO v_owner_id
  FROM public.connectors
  WHERE id = p_connector_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Connector not found';
  END IF;

  -- Insert or update metrics
  INSERT INTO public.usage_metrics (
    connector_id, date, hour, req_total, req_success, req_error,
    p50_ms, p95_ms, p99_ms, avg_ms, max_ms,
    bytes_sent, bytes_received
  ) VALUES (
    p_connector_id, p_date, p_hour, 1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_response_time_ms, p_response_time_ms, p_response_time_ms,
    p_response_time_ms, p_response_time_ms,
    p_bytes_sent, p_bytes_received
  )
  ON CONFLICT (connector_id, date, hour) DO UPDATE SET
    req_total = usage_metrics.req_total + 1,
    req_success = usage_metrics.req_success + CASE WHEN p_success THEN 1 ELSE 0 END,
    req_error = usage_metrics.req_error + CASE WHEN p_success THEN 0 ELSE 1 END,
    p50_ms = CASE
      WHEN p_response_time_ms IS NOT NULL THEN
        CASE WHEN usage_metrics.req_total = 1 THEN p_response_time_ms
             ELSE (usage_metrics.p50_ms * usage_metrics.req_total + p_response_time_ms) / (usage_metrics.req_total + 1)
        END
      ELSE usage_metrics.p50_ms
    END,
    p95_ms = CASE
      WHEN p_response_time_ms IS NOT NULL THEN
        GREATEST(usage_metrics.p95_ms, p_response_time_ms)
      ELSE usage_metrics.p95_ms
    END,
    p99_ms = CASE
      WHEN p_response_time_ms IS NOT NULL THEN
        GREATEST(usage_metrics.p99_ms, p_response_time_ms)
      ELSE usage_metrics.p99_ms
    END,
    avg_ms = CASE
      WHEN p_response_time_ms IS NOT NULL THEN
        CASE WHEN usage_metrics.req_total = 1 THEN p_response_time_ms
             ELSE (usage_metrics.avg_ms * usage_metrics.req_total + p_response_time_ms) / (usage_metrics.req_total + 1)
        END
      ELSE usage_metrics.avg_ms
    END,
    max_ms = GREATEST(usage_metrics.max_ms, COALESCE(p_response_time_ms, 0)),
    bytes_sent = usage_metrics.bytes_sent + COALESCE(p_bytes_sent, 0),
    bytes_received = usage_metrics.bytes_received + COALESCE(p_bytes_received, 0),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user dashboard statistics
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats()
RETURNS TABLE (
  total_connectors BIGINT,
  active_connectors BIGINT,
  draft_connectors BIGINT,
  error_connectors BIGINT,
  total_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  total_requests BIGINT,
  avg_response_time DECIMAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE 1=1) as total_connectors,
    COUNT(*) FILTER (WHERE status = 'active') as active_connectors,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_connectors,
    COUNT(*) FILTER (WHERE status = 'error') as error_connectors,
    (SELECT COUNT(*) FROM public.jobs j
     JOIN public.connectors c ON j.connector_id = c.id
     WHERE c.owner_id = up.id) as total_jobs,
    (SELECT COUNT(*) FROM public.jobs j
     JOIN public.connectors c ON j.connector_id = c.id
     WHERE c.owner_id = up.id AND j.status = 'completed') as completed_jobs,
    (SELECT COUNT(*) FROM public.jobs j
     JOIN public.connectors c ON j.connector_id = c.id
     WHERE c.owner_id = up.id AND j.status = 'failed') as failed_jobs,
    COALESCE((SELECT SUM(req_total) FROM public.usage_metrics um
              JOIN public.connectors c ON um.connector_id = c.id
              WHERE c.owner_id = up.id), 0) as total_requests,
    (SELECT AVG(avg_ms) FROM public.usage_metrics um
     JOIN public.connectors c ON um.connector_id = c.id
     WHERE c.owner_id = up.id AND um.req_total > 0) as avg_response_time,
    up.created_at
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search connectors
CREATE OR REPLACE FUNCTION public.search_connectors(
  p_search_term TEXT DEFAULT '',
  p_status connector_status DEFAULT NULL,
  p_runtime connector_runtime DEFAULT NULL,
  p_auth_mode auth_mode DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  status connector_status,
  runtime connector_runtime,
  auth_mode auth_mode,
  tool_count INTEGER,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  owner_display_name TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.status,
    c.runtime,
    c.auth_mode,
    c.tool_count,
    c.is_public,
    c.created_at,
    up.display_name as owner_display_name,
    CASE
      WHEN p_search_term = '' THEN 0
      ELSE ts_rank(to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')), plainto_tsquery('english', p_search_term))
    END as rank
  FROM public.connectors c
  JOIN public.user_profiles up ON c.owner_id = up.id
  WHERE
    (c.is_public = true OR c.owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()))
    AND (p_search_term = '' OR to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')) @@ plainto_tsquery('english', p_search_term))
    AND (p_status IS NULL OR c.status = p_status)
    AND (p_runtime IS NULL OR c.runtime = p_runtime)
    AND (p_auth_mode IS NULL OR c.auth_mode = p_auth_mode)
  ORDER BY
    CASE WHEN p_search_term != '' THEN rank ELSE 0 END DESC,
    c.updated_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key(
  p_name TEXT,
  p_permissions JSONB DEFAULT '{}',
  p_expires_days INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  key_prefix TEXT,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_user_id UUID;
  v_key_text TEXT;
  v_key_hash TEXT;
  v_key_prefix TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get user profile ID
  SELECT id INTO v_user_id
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Generate API key
  v_key_text := 'mcp_' || encode(gen_random_bytes(32), 'hex');
  v_key_hash := crypt(v_key_text, gen_salt('bf'));
  v_key_prefix := substr(v_key_text, 1, 8);

  -- Set expiration if specified
  IF p_expires_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_days || ' days')::INTERVAL;
  END IF;

  -- Insert API key
  INSERT INTO public.api_keys (
    user_id, name, key_hash, key_prefix, permissions, expires_at
  ) VALUES (
    v_user_id, p_name, v_key_hash, v_key_prefix, p_permissions, v_expires_at
  )
  RETURNING id, name, key_prefix, expires_at;

  -- Return the actual key (only shown once)
  RETURN QUERY SELECT
    api_keys.id,
    api_keys.name,
    api_keys.key_prefix,
    api_keys.expires_at
  FROM public.api_keys
  ORDER BY created_at DESC LIMIT 1;

  -- Note: The actual key v_key_text should be returned separately
  -- as it should only be shown once to the user
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key
CREATE OR REPLACE FUNCTION public.validate_api_key(
  p_key_text TEXT,
  p_required_permissions TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  user_id UUID,
  api_key_id UUID,
  is_valid BOOLEAN,
  permissions JSONB
) AS $$
DECLARE
  v_key_hash TEXT;
BEGIN
  -- Hash the provided key
  v_key_hash := p_key_text;

  RETURN QUERY
  SELECT
    up.user_id,
    ak.id as api_key_id,
    (ak.is_active AND (ak.expires_at IS NULL OR ak.expires_at > NOW())) as is_valid,
    ak.permissions
  FROM public.api_keys ak
  JOIN public.user_profiles up ON ak.user_id = up.id
  WHERE ak.key_hash = crypt(v_key_hash, ak.key_hash)
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;