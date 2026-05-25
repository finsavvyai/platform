-- MCPOverflow D1 Database Schema
-- SQLite-compatible schema for Cloudflare D1
-- Migrated from PostgreSQL/Supabase

-- Users table (populated from Cloudflare Access JWT)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  preferences TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_sign_in_at TEXT,
  
  CHECK (length(display_name) <= 100),
  CHECK (json_valid(preferences))
);

-- Connectors table
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1 NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  runtime TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  
  -- Specification details
  spec_url TEXT,
  spec_content TEXT,
  spec_summary TEXT,
  
  -- Generated content
  manifest_content TEXT,
  tool_count INTEGER DEFAULT 0,
  
  -- Build & deployment
  build_artifact_key TEXT,
  deployed_worker_name TEXT,
  deployment_config TEXT DEFAULT '{}',
  
  -- Metadata
  tags TEXT DEFAULT '[]',
  is_public INTEGER DEFAULT 0 NOT NULL,
  download_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  CHECK (status IN ('draft', 'active', 'error')),
  CHECK (runtime IN ('worker-ts', 'worker-go', 'download-only')),
  CHECK (auth_mode IN ('api_key', 'oauth_client', 'oauth_code', 'jwt', 'none')),
  CHECK (length(name) <= 100),
  CHECK (length(description) <= 500),
  CHECK (version > 0),
  CHECK (tool_count >= 0),
  CHECK (download_count >= 0),
  UNIQUE (owner_id, slug)
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'generate' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  priority TEXT DEFAULT 'normal' NOT NULL,
  
  -- Timing
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  estimated_duration INTEGER,
  
  -- Progress & Results
  progress TEXT DEFAULT '{}',
  result TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Configuration
  config TEXT DEFAULT '{}',
  dependencies TEXT DEFAULT '[]',
  
  CHECK (type IN ('generate', 'deploy', 'test')),
  CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  CHECK (retry_count >= 0),
  CHECK (estimated_duration IS NULL OR estimated_duration > 0)
);

-- Job logs table
CREATE TABLE IF NOT EXISTS job_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  timestamp TEXT DEFAULT (datetime('now')),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  
  CHECK (level IN ('debug', 'info', 'warn', 'error')),
  CHECK (length(message) <= 10000)
);

-- Usage metrics table
CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  hour INTEGER,
  
  -- Request metrics
  req_total INTEGER DEFAULT 0,
  req_success INTEGER DEFAULT 0,
  req_error INTEGER DEFAULT 0,
  req_rate_limited INTEGER DEFAULT 0,
  
  -- Performance metrics (milliseconds)
  p50_ms INTEGER DEFAULT 0,
  p95_ms INTEGER DEFAULT 0,
  p99_ms INTEGER DEFAULT 0,
  avg_ms INTEGER DEFAULT 0,
  max_ms INTEGER DEFAULT 0,
  
  -- Data metrics
  bytes_sent INTEGER DEFAULT 0,
  bytes_received INTEGER DEFAULT 0,
  
  -- Error analysis
  error_4xx INTEGER DEFAULT 0,
  error_5xx INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  CHECK (hour IS NULL OR (hour >= 0 AND hour <= 23)),
  CHECK (req_total >= 0 AND req_success >= 0 AND req_error >= 0),
  CHECK (req_success <= req_total),
  CHECK (req_error <= req_total),
  UNIQUE (connector_id, date, hour)
);

-- Connector versions table
CREATE TABLE IF NOT EXISTS connector_versions (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  
  -- Version content
  name TEXT NOT NULL,
  description TEXT,
  spec_url TEXT,
  spec_content TEXT,
  manifest_content TEXT,
  build_artifact_key TEXT,
  
  -- Version metadata
  changelog TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT NOT NULL REFERENCES users(id),
  
  CHECK (length(name) <= 100),
  CHECK (length(description) <= 500),
  UNIQUE (connector_id, version)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT DEFAULT '{}',
  last_used_at TEXT,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  
  CHECK (length(name) <= 100),
  CHECK (length(key_hash) > 0),
  CHECK (length(key_prefix) = 8)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connectors_owner_id ON connectors(owner_id);
CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status);
CREATE INDEX IF NOT EXISTS idx_connectors_is_public ON connectors(is_public);
CREATE INDEX IF NOT EXISTS idx_connectors_created_at ON connectors(created_at);

CREATE INDEX IF NOT EXISTS idx_jobs_connector_id ON jobs(connector_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_timestamp ON job_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_connector_id ON usage_metrics(connector_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_date ON usage_metrics(date);

CREATE INDEX IF NOT EXISTS idx_connector_versions_connector_id ON connector_versions(connector_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
