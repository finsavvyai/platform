-- Unified Dashboard Database Schema (Fixed for D1)
-- Cloudflare D1 Database

-- Users table
CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  permissions TEXT,
  organization_id TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON dashboard_users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON dashboard_users(organization_id);

-- Organizations table
CREATE TABLE IF NOT EXISTS dashboard_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free',
  max_users INTEGER DEFAULT 5,
  settings TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug ON dashboard_organizations(slug);

-- Dashboard activity log
CREATE TABLE IF NOT EXISTS dashboard_activity (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_product_created ON dashboard_activity(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_created ON dashboard_activity(created_at);

-- Dashboard notifications
CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  product_id TEXT,
  user_id TEXT,
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON dashboard_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON dashboard_notifications(created_at);

-- Product configuration
CREATE TABLE IF NOT EXISTS dashboard_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  status TEXT DEFAULT 'active',
  api_endpoint TEXT,
  dashboard_url TEXT,
  category TEXT,
  deployment_status TEXT,
  health_check_url TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON dashboard_products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON dashboard_products(status);

-- User preferences
CREATE TABLE IF NOT EXISTS dashboard_user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'dark',
  default_view TEXT DEFAULT 'overview',
  favorite_products TEXT,
  notification_settings TEXT,
  dashboard_layout TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Metrics snapshots
CREATE TABLE IF NOT EXISTS dashboard_metrics_snapshots (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  total_requests INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  response_time REAL DEFAULT 0,
  uptime REAL DEFAULT 0,
  error_rate REAL DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_product_timestamp ON dashboard_metrics_snapshots(product_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON dashboard_metrics_snapshots(timestamp);

-- Alerts and incidents
CREATE TABLE IF NOT EXISTS dashboard_alerts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  assigned_to TEXT,
  resolved_at DATETIME,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_product_status ON dashboard_alerts(product_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON dashboard_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON dashboard_alerts(created_at);

-- Dashboard sessions
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  duration_seconds INTEGER,
  pages_viewed INTEGER DEFAULT 0,
  actions_performed INTEGER DEFAULT 0,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_start ON dashboard_sessions(user_id, session_start);

-- API keys
CREATE TABLE IF NOT EXISTS dashboard_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT,
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apikeys_user_active ON dashboard_api_keys(user_id, is_active);

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
