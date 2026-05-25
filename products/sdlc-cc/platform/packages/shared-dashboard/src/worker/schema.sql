-- Unified Dashboard Database Schema
-- Cloudflare D1 Database

-- Users table
CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT, -- For email/password auth (optional)
  role TEXT DEFAULT 'user', -- 'admin', 'user', 'viewer'
  permissions TEXT, -- JSON array of permissions
  organization_id TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_org (organization_id)
);

-- Organizations table
CREATE TABLE IF NOT EXISTS dashboard_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  max_users INTEGER DEFAULT 5,
  settings TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slug (slug)
);

-- Dashboard activity log
CREATE TABLE IF NOT EXISTS dashboard_activity (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'deployment', 'alert', 'user_action', 'system_event'
  description TEXT NOT NULL,
  user_id TEXT,
  metadata TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_created (product_id, created_at),
  INDEX idx_created (created_at)
);

-- Dashboard notifications
CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  product_id TEXT,
  user_id TEXT,
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
);

-- Product configuration
CREATE TABLE IF NOT EXISTS dashboard_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'maintenance'
  api_endpoint TEXT,
  dashboard_url TEXT,
  category TEXT, -- 'fintech', 'devx', 'data-intelligence', 'consumer'
  deployment_status TEXT, -- 'deployed', 'staging', 'development'
  health_check_url TEXT,
  metadata TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_status (status)
);

-- User preferences
CREATE TABLE IF NOT EXISTS dashboard_user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'dark', -- 'light', 'dark', 'auto'
  default_view TEXT DEFAULT 'overview', -- 'overview', 'products', 'analytics'
  favorite_products TEXT, -- JSON array of product IDs
  notification_settings TEXT, -- JSON blob
  dashboard_layout TEXT, -- JSON blob for customizable layout
  timezone TEXT DEFAULT 'UTC',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Metrics snapshots (for historical data)
CREATE TABLE IF NOT EXISTS dashboard_metrics_snapshots (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  total_requests INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  response_time REAL DEFAULT 0,
  uptime REAL DEFAULT 0,
  error_rate REAL DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_timestamp (product_id, timestamp),
  INDEX idx_timestamp (timestamp)
);

-- Alerts and incidents
CREATE TABLE IF NOT EXISTS dashboard_alerts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'downtime', 'high_error_rate', 'slow_response', 'security'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open', -- 'open', 'acknowledged', 'resolved'
  assigned_to TEXT,
  resolved_at DATETIME,
  metadata TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_status (product_id, status),
  INDEX idx_severity (severity),
  INDEX idx_created (created_at)
);

-- Dashboard sessions (for analytics)
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  duration_seconds INTEGER,
  pages_viewed INTEGER DEFAULT 0,
  actions_performed INTEGER DEFAULT 0,
  user_agent TEXT,
  ip_address TEXT,
  INDEX idx_user_start (user_id, session_start)
);

-- API keys for dashboard integrations
CREATE TABLE IF NOT EXISTS dashboard_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT, -- JSON array of permissions
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_active (user_id, is_active)
);

-- Insert default products
INSERT OR IGNORE INTO dashboard_products (id, name, display_name, description, category, deployment_status) VALUES
  ('pipewarden', 'pipewarden', 'PipeWarden', 'API Gateway & Security Platform', 'fintech', 'deployed'),
  ('quantumbeam', 'quantumbeam', 'QuantumBeam', 'Fraud Detection & AI Platform', 'fintech', 'deployed'),
  ('mcpoverflow', 'mcpoverflow', 'MCPOverflow', 'MCP Connector Generation Platform', 'devx', 'deployed'),
  ('qestro', 'qestro', 'Qestro', 'Test Orchestration & QA Platform', 'devx', 'deployed'),
  ('sdlc', 'sdlc', 'SDLC.ai', 'Secure Data Learning Platform', 'data-intelligence', 'deployed'),
  ('queryflux', 'queryflux', 'QueryFlux', 'Cross-Platform Database Management', 'data-intelligence', 'deployed'),
  ('upm', 'upm', 'UPM', 'Universal Package Manager', 'devx', 'development'),
  ('yallabye', 'yallabye', 'YallaBye', 'Travel Booking Platform', 'consumer', 'development'),
  ('fintech-enterprise', 'fintech-enterprise', 'Fintech Enterprise', 'Unified Billing & Fraud Detection', 'fintech', 'development'),
  ('querylens', 'querylens', 'QueryLens', 'AI-Powered Query Analytics', 'data-intelligence', 'development');

-- Insert sample notifications
INSERT OR IGNORE INTO dashboard_notifications (id, type, title, message, severity, product_id) VALUES
  ('notif-1', 'success', 'Deployment Successful', 'PipeWarden v2.1.0 deployed successfully', 'low', 'pipewarden'),
  ('notif-2', 'info', 'New Feature Available', 'MCPOverflow now supports 100+ API connectors', 'low', 'mcpoverflow'),
  ('notif-3', 'warning', 'High Traffic Alert', 'Qestro experiencing 150% above normal traffic', 'medium', 'qestro');
