/*
  # Auto-API Generator System

  1. New Tables
    - `api_endpoints`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `project_id` (uuid, references projects)
      - `connection_id` (uuid, references connections)
      - `name` (text, endpoint name)
      - `description` (text)
      - `endpoint_type` (text, 'rest' or 'graphql')
      - `tables` (jsonb, array of table names)
      - `operations` (jsonb, enabled CRUD operations)
      - `generated_code` (text, the generated code)
      - `deployment_status` (text, 'draft', 'deploying', 'deployed', 'failed')
      - `deployment_url` (text, the live endpoint URL)
      - `deployment_platform` (text, 'netlify', 'render', 'railway', 'docker')
      - `deployment_config` (jsonb, platform-specific config)
      - `auth_enabled` (boolean, whether auth is required)
      - `rate_limit` (integer, requests per minute)
      - `is_public` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `deployed_at` (timestamptz)

    - `api_endpoint_logs`
      - `id` (uuid, primary key)
      - `endpoint_id` (uuid, references api_endpoints)
      - `request_method` (text)
      - `request_path` (text)
      - `status_code` (integer)
      - `response_time_ms` (integer)
      - `error_message` (text)
      - `created_at` (timestamptz)

    - `cloud_deployments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `platform` (text, 'netlify', 'render', 'railway')
      - `api_key_encrypted` (text, encrypted API key)
      - `account_email` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own endpoints
    - Public endpoints visible to all
*/

-- API Endpoints table
CREATE TABLE IF NOT EXISTS api_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  endpoint_type text DEFAULT 'rest' CHECK (endpoint_type IN ('rest', 'graphql')),
  tables jsonb DEFAULT '[]'::jsonb,
  operations jsonb DEFAULT '{"create": true, "read": true, "update": true, "delete": true}'::jsonb,
  generated_code text,
  deployment_status text DEFAULT 'draft' CHECK (deployment_status IN ('draft', 'deploying', 'deployed', 'failed')),
  deployment_url text,
  deployment_platform text CHECK (deployment_platform IN ('netlify', 'render', 'railway', 'docker', 'supabase_edge')),
  deployment_config jsonb DEFAULT '{}'::jsonb,
  auth_enabled boolean DEFAULT true,
  rate_limit integer DEFAULT 100,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deployed_at timestamptz
);

ALTER TABLE api_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own endpoints"
  ON api_endpoints
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own endpoints"
  ON api_endpoints
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own endpoints"
  ON api_endpoints
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own endpoints"
  ON api_endpoints
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- API Endpoint Logs table
CREATE TABLE IF NOT EXISTS api_endpoint_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES api_endpoints(id) ON DELETE CASCADE,
  request_method text NOT NULL,
  request_path text NOT NULL,
  status_code integer,
  response_time_ms integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_endpoint_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own endpoint logs"
  ON api_endpoint_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_endpoints
      WHERE api_endpoints.id = api_endpoint_logs.endpoint_id
      AND api_endpoints.user_id = auth.uid()
    )
  );

-- Cloud Deployments table
CREATE TABLE IF NOT EXISTS cloud_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('netlify', 'render', 'railway', 'vercel')),
  api_key_encrypted text NOT NULL,
  account_email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE cloud_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deployments"
  ON cloud_deployments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deployments"
  ON cloud_deployments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deployments"
  ON cloud_deployments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deployments"
  ON cloud_deployments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_endpoints_user_id ON api_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_project_id ON api_endpoints(project_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_connection_id ON api_endpoints(connection_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_status ON api_endpoints(deployment_status);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_logs_endpoint_id ON api_endpoint_logs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_logs_created_at ON api_endpoint_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_cloud_deployments_user_id ON cloud_deployments(user_id);
