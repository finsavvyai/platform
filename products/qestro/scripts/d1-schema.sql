-- D1 SQLite Schema for Questro SaaS Platform
-- Cloudflare D1 compatible (no explicit transactions)
-- Generated: 2025-10-26T12:39:00.000Z
-- Schema Version: 1.0.0-d1

-- ==========================================
-- CORE SYSTEM TABLES
-- ==========================================

-- Users table - Central user management
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  subscription TEXT DEFAULT 'free',
  is_email_verified INTEGER DEFAULT 0,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Projects table - Test project management
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  platform TEXT,
  settings TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recording sessions table - Test recording sessions
CREATE TABLE recording_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT,
  type TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER DEFAULT 0,
  actions_count INTEGER DEFAULT 0,
  metadata TEXT,
  artifacts TEXT,
  export_formats TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recorded actions table - Individual test actions
CREATE TABLE recorded_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  coordinates TEXT,
  text_value TEXT,
  element TEXT,
  selector TEXT,
  screenshot TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE
);

-- Test suites table - Test suite organization
CREATE TABLE test_suites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  test_cases TEXT,
  settings TEXT,
  schedule TEXT,
  is_active INTEGER DEFAULT 1,
  last_run_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Test cases table - Individual test cases
CREATE TABLE test_cases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  platform TEXT,
  test_data TEXT NOT NULL,
  expected_results TEXT,
  tags TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Test runs table - Test execution results
CREATE TABLE test_runs (
  id TEXT PRIMARY KEY,
  test_suite_id TEXT,
  test_case_id TEXT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER,
  results TEXT,
  logs TEXT,
  screenshots TEXT,
  videos TEXT,
  error_message TEXT,
  environment TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (test_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Teams table - Team management
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  settings TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Team members table - Team member relationships
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  permissions TEXT,
  joined_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- API MANAGEMENT TABLES
-- ==========================================

-- API endpoints table - API endpoint definitions
CREATE TABLE api_endpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  version TEXT NOT NULL,
  authentication TEXT NOT NULL,
  headers TEXT,
  rate_limit TEXT,
  timeout INTEGER DEFAULT 30000,
  retry_config TEXT,
  health_check TEXT,
  documentation TEXT,
  tags TEXT,
  is_active INTEGER DEFAULT 1,
  last_health_check INTEGER,
  health_status TEXT DEFAULT 'unknown',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API calls table - API call history
CREATE TABLE api_calls (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  headers TEXT,
  query_params TEXT,
  body TEXT,
  response_status INTEGER,
  response_headers TEXT,
  response_body TEXT,
  response_time INTEGER,
  success INTEGER NOT NULL,
  error TEXT,
  validation_results TEXT,
  transformed_data TEXT,
  executed_at INTEGER NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API test results table - API test execution results
CREATE TABLE api_test_results (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time INTEGER,
  assertions TEXT,
  error_message TEXT,
  executed_at INTEGER NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API schemas table - API schema definitions
CREATE TABLE api_schemas (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  schema TEXT NOT NULL,
  version TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE
);

-- ==========================================
-- PLUGIN SYSTEM TABLES
-- ==========================================

-- Plugins table - Plugin definitions
CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  author_id TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  code TEXT NOT NULL,
  entry_point TEXT NOT NULL,
  configuration TEXT,
  permissions TEXT,
  security_scan_status TEXT DEFAULT 'pending',
  security_scan_results TEXT,
  is_public INTEGER DEFAULT 0,
  is_approved INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  ai_generated INTEGER DEFAULT 0,
  generation_prompt TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_active INTEGER DEFAULT 1,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Plugin versions table - Plugin version history
CREATE TABLE plugin_versions (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  version TEXT NOT NULL,
  changelog TEXT,
  breaking_changes TEXT,
  code TEXT NOT NULL,
  entry_point TEXT NOT NULL,
  configuration TEXT,
  security_scan_status TEXT DEFAULT 'pending',
  security_scan_results TEXT,
  is_latest INTEGER DEFAULT 0,
  is_stable INTEGER DEFAULT 0,
  is_deprecated INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin dependencies table - Plugin dependency management
CREATE TABLE plugin_dependencies (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  dependency_plugin_id TEXT,
  dependency_name TEXT NOT NULL,
  dependency_type TEXT NOT NULL,
  version_constraint TEXT NOT NULL,
  is_optional INTEGER DEFAULT 0,
  conflicts_with TEXT,
  alternatives TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
  FOREIGN KEY (dependency_plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

-- Plugin executions table - Plugin execution tracking
CREATE TABLE plugin_executions (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  installation_id TEXT,
  execution_context TEXT NOT NULL,
  project_id TEXT,
  test_case_id TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER,
  status TEXT NOT NULL,
  input TEXT,
  output TEXT,
  error TEXT,
  memory_usage INTEGER,
  cpu_usage REAL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL
);

-- ==========================================
-- VOICE SYSTEM TABLES
-- ==========================================

-- Voice recordings table - Voice recording metadata
CREATE TABLE voice_recordings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT,
  test_case_id TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  format TEXT NOT NULL,
  sample_rate INTEGER,
  bit_rate INTEGER,
  channels INTEGER,
  transcription_text TEXT,
  transcription_provider TEXT,
  transcription_confidence REAL,
  transcription_language TEXT,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  contains_commands INTEGER DEFAULT 0,
  detected_commands TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL
);

-- Voice commands table - Voice command definitions
CREATE TABLE voice_commands (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  alternative_triggers TEXT,
  category TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL,
  action_config TEXT NOT NULL,
  parameters TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  is_active INTEGER DEFAULT 1,
  is_system_command INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voice preferences table - User voice preferences
CREATE TABLE voice_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  voice_provider TEXT NOT NULL DEFAULT 'openai',
  auto_transcribe INTEGER DEFAULT 1,
  command_detection INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0.8,
  settings TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voice analytics table - Voice usage analytics
CREATE TABLE voice_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date INTEGER NOT NULL,
  recording_count INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  transcription_count INTEGER DEFAULT 0,
  command_count INTEGER DEFAULT 0,
  avg_confidence REAL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- ADVANCED ANALYTICS TABLES
-- ==========================================

-- Analytics events table - Generic analytics events
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  properties TEXT,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User behavior table - User behavior tracking
CREATE TABLE user_behavior (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  value TEXT,
  context TEXT,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance metrics table - System performance metrics
CREATE TABLE performance_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  tags TEXT,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Security audit logs table - Security audit trail
CREATE TABLE security_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- PAYMENT SYSTEM TABLES
-- ==========================================

-- Subscriptions table - User subscription management
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  lemon_squeezy_id TEXT,
  lemon_squeezy_order_id TEXT,
  lemon_squeezy_product_id TEXT,
  lemon_squeezy_variant_id TEXT,
  trial_start INTEGER,
  trial_end INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Invoices table - Invoice management
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  lemon_squeezy_id TEXT,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date INTEGER,
  paid_at INTEGER,
  billing_reason TEXT,
  invoice_url TEXT,
  invoice_pdf TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Payment methods table - Payment method management
CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  last_4 TEXT,
  brand TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default INTEGER DEFAULT 0,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Usage metrics table - Usage tracking for billing
CREATE TABLE usage_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  metric_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- ==========================================
-- UTILITY TABLES
-- ==========================================

-- API keys table - API key management
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT,
  last_used_at INTEGER,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Integrations table - Third-party integrations
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_triggered_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Usage analytics table - General usage analytics
CREATE TABLE usage_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  date INTEGER NOT NULL,
  recording_minutes INTEGER DEFAULT 0,
  test_runs INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used INTEGER DEFAULT 0,
  bandwidth INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Core system indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_recording_sessions_project_id ON recording_sessions(project_id);
CREATE INDEX idx_recording_sessions_user_id ON recording_sessions(user_id);
CREATE INDEX idx_recorded_actions_session_id ON recorded_actions(session_id);
CREATE INDEX idx_test_suites_project_id ON test_suites(project_id);
CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- API management indexes
CREATE INDEX idx_api_endpoints_user_id ON api_endpoints(user_id);
CREATE INDEX idx_api_calls_endpoint_id ON api_calls(endpoint_id);
CREATE INDEX idx_api_calls_user_id ON api_calls(user_id);
CREATE INDEX idx_api_calls_executed_at ON api_calls(executed_at);

-- Plugin system indexes
CREATE INDEX idx_plugins_author_id ON plugins(author_id);
CREATE INDEX idx_plugins_is_active ON plugins(is_active);
CREATE INDEX idx_plugin_executions_plugin_id ON plugin_executions(plugin_id);
CREATE INDEX idx_plugin_executions_user_id ON plugin_executions(user_id);

-- Voice system indexes
CREATE INDEX idx_voice_recordings_user_id ON voice_recordings(user_id);
CREATE INDEX idx_voice_recordings_processing_status ON voice_recordings(processing_status);
CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_voice_analytics_user_date ON voice_analytics(user_id, date);

-- Analytics indexes
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_user_behavior_user_id ON user_behavior(user_id);
CREATE INDEX idx_user_behavior_timestamp ON user_behavior(timestamp);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_logs_timestamp ON security_audit_logs(timestamp);

-- Payment system indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_period ON usage_metrics(period_start, period_end);

-- Utility table indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_date ON usage_analytics(date);

-- Generated 35 tables with indexes successfully for Cloudflare D1
