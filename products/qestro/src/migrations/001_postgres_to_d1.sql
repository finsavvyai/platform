-- PostgreSQL to D1 SQLite Migration Script
-- Converts Qestro PostgreSQL schema to Cloudflare D1 SQLite format
--
-- This script handles the data type conversions and schema differences
-- between PostgreSQL and SQLite for D1 compatibility.

-- Migration Configuration
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;

-- Core User Management Tables

-- Users table conversion
CREATE TABLE IF NOT EXISTS users (
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
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Projects table conversion
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  platform TEXT,
  settings TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_type_idx ON projects(type);

-- Recording Sessions table conversion
CREATE TABLE IF NOT EXISTS recording_sessions (
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
  metadata TEXT DEFAULT '{}',
  artifacts TEXT DEFAULT '{}',
  export_formats TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recording_sessions_project_id_idx ON recording_sessions(project_id);
CREATE INDEX IF NOT EXISTS recording_sessions_user_id_idx ON recording_sessions(user_id);
CREATE INDEX IF NOT EXISTS recording_sessions_status_idx ON recording_sessions(status);
CREATE INDEX IF NOT EXISTS recording_sessions_type_idx ON recording_sessions(type);

-- Test Management Tables

-- Test Suites table conversion
CREATE TABLE IF NOT EXISTS test_suites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  test_cases TEXT DEFAULT '[]',
  settings TEXT DEFAULT '{}',
  schedule TEXT,
  is_active INTEGER DEFAULT 1,
  last_run_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS test_suites_project_id_idx ON test_suites(project_id);
CREATE INDEX IF NOT EXISTS test_suites_user_id_idx ON test_suites(user_id);
CREATE INDEX IF NOT EXISTS test_suites_type_idx ON test_suites(type);

-- Test Cases table conversion
CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  platform TEXT,
  test_data TEXT NOT NULL,
  expected_results TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS test_cases_project_id_idx ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS test_cases_session_id_idx ON test_cases(session_id);
CREATE INDEX IF NOT EXISTS test_cases_user_id_idx ON test_cases(user_id);
CREATE INDEX IF NOT EXISTS test_cases_type_idx ON test_cases(type);

-- Test Runs table conversion
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  test_suite_id TEXT,
  test_case_id TEXT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER,
  results TEXT DEFAULT '{}',
  logs TEXT DEFAULT '[]',
  screenshots TEXT DEFAULT '[]',
  videos TEXT DEFAULT '[]',
  error_message TEXT,
  environment TEXT DEFAULT '{}',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (test_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS test_runs_test_suite_id_idx ON test_runs(test_suite_id);
CREATE INDEX IF NOT EXISTS test_runs_test_case_id_idx ON test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS test_runs_project_id_idx ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS test_runs_user_id_idx ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS test_runs_status_idx ON test_runs(status);

-- Integration and API Tables

-- Integrations table conversion
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  last_triggered_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS integrations_user_id_idx ON integrations(user_id);
CREATE INDEX IF NOT EXISTS integrations_project_id_idx ON integrations(project_id);
CREATE INDEX IF NOT EXISTS integrations_type_idx ON integrations(type);

-- API Keys table conversion
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT DEFAULT '[]',
  last_used_at INTEGER,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_unique ON api_keys(key_hash);

-- Usage Analytics table conversion
CREATE TABLE IF NOT EXISTS usage_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  date INTEGER NOT NULL,
  recording_minutes INTEGER DEFAULT 0,
  test_runs INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_used INTEGER DEFAULT 0,
  bandwidth INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_analytics_user_date_unique ON usage_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS usage_analytics_project_id_idx ON usage_analytics(project_id);
CREATE INDEX IF NOT EXISTS usage_analytics_date_idx ON usage_analytics(date);

-- Data Sources table conversion
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  last_tested_at INTEGER,
  tags TEXT DEFAULT '[]',
  metadata TEXT DEFAULT '{}',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS data_sources_user_id_idx ON data_sources(user_id);
CREATE INDEX IF NOT EXISTS data_sources_type_idx ON data_sources(type);
CREATE INDEX IF NOT EXISTS data_sources_status_idx ON data_sources(status);

-- Payment System Tables

-- Payment Customers table conversion
CREATE TABLE IF NOT EXISTS payment_customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lemon_squeezy_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS payment_customers_user_id_idx ON payment_customers(user_id);
CREATE INDEX IF NOT EXISTS payment_customers_lemon_squeezy_customer_id_idx ON payment_customers(lemon_squeezy_customer_id);

-- Subscriptions table conversion
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  lemon_squeezy_subscription_id TEXT NOT NULL UNIQUE,
  lemon_squeezy_customer_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_lemon_squeezy_subscription_id_idx ON subscriptions(lemon_squeezy_subscription_id);

-- Insert initial data if needed
-- This section can be used to seed default data or perform initial migrations

-- Migration completion log
CREATE TABLE IF NOT EXISTS migration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_message TEXT,
  notes TEXT
);

INSERT INTO migration_log (migration_name, status, started_at, notes)
VALUES ('postgres_to_d1_migration', 'completed', strftime('%s', 'now'), 'Successfully migrated PostgreSQL schema to D1 SQLite');

-- Performance optimization settings
PRAGMA optimize;
