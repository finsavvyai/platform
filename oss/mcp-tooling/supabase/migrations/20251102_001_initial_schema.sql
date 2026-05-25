-- MCPOverflow Initial Database Schema
-- Migration: 20251102_001_initial_schema.sql
-- Description: Create initial database schema with core tables, indexes, and RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE connector_status AS ENUM ('draft', 'active', 'error');
CREATE TYPE connector_runtime AS ENUM ('worker-ts', 'worker-go', 'download-only');
CREATE TYPE auth_mode AS ENUM ('api_key', 'oauth_client', 'oauth_code', 'jwt', 'none');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE job_type AS ENUM ('generate', 'deploy', 'test');
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_sign_in_at TIMESTAMPTZ,

  CONSTRAINT user_profiles_display_name_length CHECK (length(display_name) <= 100),
  CONSTRAINT user_preferences_structure CHECK (
    jsonb_typeof(preferences) = 'object'
  )
);

-- Create connectors table
CREATE TABLE public.connectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1 NOT NULL,
  status connector_status DEFAULT 'draft' NOT NULL,
  runtime connector_runtime NOT NULL,
  auth_mode auth_mode NOT NULL,

  -- Specification details
  spec_url TEXT,
  spec_content JSONB,
  spec_summary JSONB,

  -- Generated content
  manifest_content JSONB,
  tool_count INTEGER DEFAULT 0,

  -- Build & deployment
  build_artifact_key TEXT,
  deployed_worker_name TEXT,
  deployment_config JSONB DEFAULT '{}',

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false NOT NULL,
  download_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT connectors_name_length CHECK (length(name) <= 100),
  CONSTRAINT connectors_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT connectors_description_length CHECK (length(description) <= 500),
  CONSTRAINT connectors_version_positive CHECK (version > 0),
  CONSTRAINT connectors_tags_count CHECK (array_length(tags, 1) <= 10),
  CONSTRAINT connectors_tool_count_non_negative CHECK (tool_count >= 0),
  CONSTRAINT connectors_download_count_non_negative CHECK (download_count >= 0),
  CONSTRAINT connectors_unique_slug_per_user UNIQUE (owner_id, slug)
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  type job_type NOT NULL DEFAULT 'generate',
  status job_status DEFAULT 'pending' NOT NULL,
  priority job_priority DEFAULT 'normal' NOT NULL,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  estimated_duration INTEGER, -- in seconds

  -- Progress & Results
  progress JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Configuration
  config JSONB DEFAULT '{}',
  dependencies UUID[] DEFAULT '{}',

  CONSTRAINT jobs_retry_count_non_negative CHECK (retry_count >= 0),
  CONSTRAINT jobs_estimated_duration_positive CHECK (estimated_duration IS NULL OR estimated_duration > 0),
  CONSTRAINT jobs_progress_structure CHECK (jsonb_typeof(progress) = 'object')
);

-- Create job_logs table for detailed logging
CREATE TABLE public.job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  CONSTRAINT job_logs_message_length CHECK (length(message) <= 10000)
);

-- Create usage_metrics table
CREATE TABLE public.usage_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER CHECK (hour >= 0 AND hour <= 23),

  -- Request metrics
  req_total INTEGER DEFAULT 0,
  req_success INTEGER DEFAULT 0,
  req_error INTEGER DEFAULT 0,
  req_rate_limited INTEGER DEFAULT 0,

  -- Performance metrics
  p50_ms INTEGER DEFAULT 0,
  p95_ms INTEGER DEFAULT 0,
  p99_ms INTEGER DEFAULT 0,
  avg_ms INTEGER DEFAULT 0,
  max_ms INTEGER DEFAULT 0,

  -- Data metrics
  bytes_sent BIGINT DEFAULT 0,
  bytes_received BIGINT DEFAULT 0,

  -- Error analysis
  error_4xx INTEGER DEFAULT 0,
  error_5xx INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT usage_metrics_metrics_non_negative CHECK (
    req_total >= 0 AND req_success >= 0 AND req_error >= 0 AND req_rate_limited >= 0 AND
    p50_ms >= 0 AND p95_ms >= 0 AND p99_ms >= 0 AND avg_ms >= 0 AND max_ms >= 0 AND
    bytes_sent >= 0 AND bytes_received >= 0 AND
    error_4xx >= 0 AND error_5xx >= 0 AND timeout_count >= 0
  ),
  CONSTRAINT usage_metrics_success_total_consistency CHECK (req_success <= req_total),
  CONSTRAINT usage_metrics_error_total_consistency CHECK (req_error <= req_total),
  CONSTRAINT usage_metrics_unique_connector_date_hour UNIQUE (connector_id, date, hour)
);

-- Create connector_versions table for version management
CREATE TABLE public.connector_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Version content
  name TEXT NOT NULL,
  description TEXT,
  spec_url TEXT,
  spec_content JSONB,
  manifest_content JSONB,
  build_artifact_key TEXT,

  -- Version metadata
  changelog TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID NOT NULL REFERENCES public.user_profiles(user_id),

  CONSTRAINT connector_versions_name_length CHECK (length(name) <= 100),
  CONSTRAINT connector_versions_description_length CHECK (length(description) <= 500),
  CONSTRAINT connector_versions_unique_connector_version UNIQUE (connector_id, version)
);

-- Create api_keys table for API key management
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 characters for identification
  permissions JSONB DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT api_keys_name_length CHECK (length(name) <= 100),
  CONSTRAINT api_keys_key_hash_not_empty CHECK (length(key_hash) > 0),
  CONSTRAINT api_keys_key_prefix_format CHECK (key_prefix ~ '^[a-zA-Z0-9]{8}$')
);

-- Create indexes for performance

-- User profiles indexes
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at);

-- Connectors indexes
CREATE INDEX idx_connectors_owner_id ON public.connectors(owner_id);
CREATE INDEX idx_connectors_status ON public.connectors(status);
CREATE INDEX idx_connectors_runtime ON public.connectors(runtime);
CREATE INDEX idx_connectors_auth_mode ON public.connectors(auth_mode);
CREATE INDEX idx_connectors_created_at ON public.connectors(created_at);
CREATE INDEX idx_connectors_updated_at ON public.connectors(updated_at);
CREATE INDEX idx_connectors_is_public ON public.connectors(is_public);
CREATE INDEX idx_connectors_tags ON public.connectors USING GIN(tags);
CREATE INDEX idx_connectors_name_search ON public.connectors USING gin(to_tsvector('english', name));

-- Jobs indexes
CREATE INDEX idx_jobs_connector_id ON public.jobs(connector_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_type ON public.jobs(type);
CREATE INDEX idx_jobs_priority ON public.jobs(priority);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at);
CREATE INDEX idx_jobs_type_status ON public.jobs(type, status);

-- Job logs indexes
CREATE INDEX idx_job_logs_job_id ON public.job_logs(job_id);
CREATE INDEX idx_job_logs_timestamp ON public.job_logs(timestamp);
CREATE INDEX idx_job_logs_level ON public.job_logs(level);

-- Usage metrics indexes
CREATE INDEX idx_usage_metrics_connector_id ON public.usage_metrics(connector_id);
CREATE INDEX idx_usage_metrics_date ON public.usage_metrics(date);
CREATE INDEX idx_usage_metrics_date_hour ON public.usage_metrics(date, hour);
CREATE INDEX idx_usage_metrics_connector_date ON public.usage_metrics(connector_id, date);

-- Connector versions indexes
CREATE INDEX idx_connector_versions_connector_id ON public.connector_versions(connector_id);
CREATE INDEX idx_connector_versions_is_active ON public.connector_versions(is_active);

-- API keys indexes
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_key_is_active ON public.api_keys(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_connectors_updated_at
  BEFORE UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_usage_metrics_updated_at
  BEFORE UPDATE ON public.usage_metrics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for connectors
CREATE POLICY "Users can view own connectors" ON public.connectors
  FOR SELECT USING (owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view public connectors" ON public.connectors
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own connectors" ON public.connectors
  FOR INSERT WITH CHECK (
    owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own connectors" ON public.connectors
  FOR UPDATE USING (
    owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own connectors" ON public.connectors
  FOR DELETE USING (
    owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for jobs
CREATE POLICY "Users can view jobs for own connectors" ON public.jobs
  FOR SELECT USING (
    connector_id IN (
      SELECT id FROM public.connectors
      WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert jobs for own connectors" ON public.jobs
  FOR INSERT WITH CHECK (
    connector_id IN (
      SELECT id FROM public.connectors
      WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update jobs for own connectors" ON public.jobs
  FOR UPDATE USING (
    connector_id IN (
      SELECT id FROM public.connectors
      WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for job_logs (inherits from jobs)
CREATE POLICY "Users can view logs for own jobs" ON public.job_logs
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE connector_id IN (
        SELECT id FROM public.connectors
        WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
      )
    )
  );

-- RLS Policies for usage_metrics
CREATE POLICY "Users can view metrics for own connectors" ON public.usage_metrics
  FOR SELECT USING (
    connector_id IN (
      SELECT id FROM public.connectors
      WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "System can insert usage metrics" ON public.usage_metrics
  FOR INSERT WITH CHECK (true); -- Allow system/service role to insert metrics

-- RLS Policies for connector_versions
CREATE POLICY "Users can view versions for own connectors" ON public.connector_versions
  FOR SELECT USING (
    connector_id IN (
      SELECT id FROM public.connectors
      WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert versions for own connectors" ON public.connector_versions
  FOR INSERT WITH CHECK (
    connector_id IN (
      SELECT id FROM public.connectors
      WHERE owner_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for api_keys
CREATE POLICY "Users can view own API keys" ON public.api_keys
  FOR SELECT USING (user_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own API keys" ON public.api_keys
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own API keys" ON public.api_keys
  FOR UPDATE USING (user_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own API keys" ON public.api_keys
  FOR DELETE USING (user_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Allow service role to bypass RLS (for system operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;