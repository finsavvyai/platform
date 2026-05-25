/*
  # MCPoverflow Database Schema

  ## Overview
  Creates the core tables for the MCPoverflow platform - a system for generating
  MCP (Model Context Protocol) connectors from API specifications.

  ## New Tables

  ### `connectors`
  Stores metadata about generated MCP connectors
  - `id` (uuid, primary key) - unique connector identifier
  - `name` (text) - human-readable connector name
  - `owner_id` (text) - user/org identifier
  - `version` (integer) - current version number
  - `status` (text) - lifecycle state: draft|active|error
  - `runtime` (text) - target runtime: worker-ts|worker-go|download-only
  - `build_artifact_key` (text) - storage path to generated ZIP bundle
  - `deployed_worker_name` (text, nullable) - Cloudflare Worker name if deployed
  - `auth_mode` (text) - authentication type: api_key|oauth_client|oauth_code|jwt|none
  - `spec_url` (text, nullable) - URL to original API spec
  - `spec_content` (jsonb, nullable) - parsed API specification
  - `manifest_content` (jsonb, nullable) - generated MCP manifest
  - `created_at` (timestamptz) - creation timestamp
  - `updated_at` (timestamptz) - last modification timestamp

  ### `jobs`
  Tracks asynchronous generation jobs
  - `id` (uuid, primary key) - unique job identifier
  - `connector_id` (uuid) - reference to connector being generated
  - `status` (text) - job state: pending|running|completed|failed
  - `started_at` (timestamptz, nullable) - when job started processing
  - `finished_at` (timestamptz, nullable) - when job completed
  - `logs` (jsonb) - array of log entries
  - `error_message` (text, nullable) - error details if failed
  - `created_at` (timestamptz) - job creation timestamp

  ### `usage_metrics`
  Aggregated usage statistics per connector
  - `id` (uuid, primary key) - unique metric record identifier
  - `connector_id` (uuid) - reference to connector
  - `date` (date) - metrics date (YYYY-MM-DD)
  - `req_total` (integer) - total requests
  - `err_total` (integer) - total errors
  - `p50_ms` (integer) - 50th percentile latency
  - `p95_ms` (integer) - 95th percentile latency
  - `p99_ms` (integer) - 99th percentile latency
  - `created_at` (timestamptz) - record creation timestamp
  - `updated_at` (timestamptz) - last update timestamp

  ## Security
  - RLS enabled on all tables
  - Public read access for demonstration (MVP)
  - Insert/update/delete restricted to authenticated users
  - Production deployment should add proper ownership checks

  ## Indexes
  - `connectors`: index on owner_id for efficient user queries
  - `jobs`: index on connector_id for lookup
  - `usage_metrics`: composite index on (connector_id, date) for time-series queries
*/

-- Create connectors table
CREATE TABLE IF NOT EXISTS connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id text NOT NULL DEFAULT 'anonymous',
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'error')),
  runtime text NOT NULL DEFAULT 'worker-ts' CHECK (runtime IN ('worker-ts', 'worker-go', 'download-only')),
  build_artifact_key text,
  deployed_worker_name text,
  auth_mode text NOT NULL DEFAULT 'none' CHECK (auth_mode IN ('api_key', 'oauth_client', 'oauth_code', 'jwt', 'none')),
  spec_url text,
  spec_content jsonb,
  manifest_content jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create usage_metrics table
CREATE TABLE IF NOT EXISTS usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  date date NOT NULL,
  req_total integer NOT NULL DEFAULT 0,
  err_total integer NOT NULL DEFAULT 0,
  p50_ms integer NOT NULL DEFAULT 0,
  p95_ms integer NOT NULL DEFAULT 0,
  p99_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connector_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_connectors_owner ON connectors(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_connector ON jobs(connector_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_connector_date ON usage_metrics(connector_id, date);

-- Enable Row Level Security
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connectors
CREATE POLICY "Anyone can view connectors"
  ON connectors FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert connectors"
  ON connectors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update connectors"
  ON connectors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete connectors"
  ON connectors FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for jobs
CREATE POLICY "Anyone can view jobs"
  ON jobs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for usage_metrics
CREATE POLICY "Anyone can view metrics"
  ON usage_metrics FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert metrics"
  ON usage_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update metrics"
  ON usage_metrics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);