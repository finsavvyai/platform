-- PostgreSQL to D1 SQLite Migration Script
-- This script converts PostgreSQL data types and syntax to SQLite-compatible format

-- ============================================================================
-- Data Type Conversion Mapping
-- ============================================================================

-- UUID -> TEXT
-- VARCHAR -> TEXT
-- TEXT -> TEXT
-- TIMESTAMP -> INTEGER (Unix timestamp)
-- BOOLEAN -> INTEGER (0/1)
-- JSONB -> TEXT (JSON mode)
-- DECIMAL -> REAL
-- INTEGER -> INTEGER
-- SERIAL -> INTEGER

-- ============================================================================
-- Core Schema Tables
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Recording sessions table
CREATE TABLE IF NOT EXISTS recording_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Recorded actions table
CREATE TABLE IF NOT EXISTS recorded_actions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  session_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  coordinates TEXT,
  text TEXT,
  element TEXT,
  selector TEXT,
  screenshot TEXT,
  metadata TEXT DEFAULT '{}',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS recorded_actions_session_id_idx ON recorded_actions(session_id);
CREATE INDEX IF NOT EXISTS recorded_actions_sequence_idx ON recorded_actions(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS recorded_actions_type_idx ON recorded_actions(type);

-- Test suites table
CREATE TABLE IF NOT EXISTS test_suites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Test cases table
CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Test runs table
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Usage analytics table
CREATE TABLE IF NOT EXISTS usage_analytics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- Data sources table
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- ============================================================================
-- Trigger for updating timestamps
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS users_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS projects_updated_at
  AFTER UPDATE ON projects
  FOR EACH ROW
  BEGIN
    UPDATE projects SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS recording_sessions_updated_at
  AFTER UPDATE ON recording_sessions
  FOR EACH ROW
  BEGIN
    UPDATE recording_sessions SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS test_suites_updated_at
  AFTER UPDATE ON test_suites
  FOR EACH ROW
  BEGIN
    UPDATE test_suites SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS test_cases_updated_at
  AFTER UPDATE ON test_cases
  FOR EACH ROW
  BEGIN
    UPDATE test_cases SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS integrations_updated_at
  AFTER UPDATE ON integrations
  FOR EACH ROW
  BEGIN
    UPDATE integrations SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS data_sources_updated_at
  AFTER UPDATE ON data_sources
  FOR EACH ROW
  BEGIN
    UPDATE data_sources SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;

-- ============================================================================
-- Notes and Considerations
-- ============================================================================

-- 1. UUID Generation: SQLite doesn't have built-in UUID generation, so we use
--    a custom UUID v4 function for primary keys. In production, you might want
--    to generate UUIDs in the application layer.

-- 2. JSON Storage: PostgreSQL JSONB is converted to TEXT fields with JSON
--    validation in the application layer using Drizzle's JSON mode.

-- 3. Boolean Handling: PostgreSQL BOOLEAN becomes INTEGER (0/1) in SQLite.

-- 4. Timestamp Conversion: PostgreSQL TIMESTAMP becomes INTEGER (Unix timestamp)
--    in SQLite for better performance in edge computing environments.

-- 5. Foreign Key Constraints: SQLite requires foreign key support to be enabled
--    with PRAGMA foreign_keys = ON;

-- 6. Index Optimization: All PostgreSQL indexes are converted to SQLite indexes
--    for optimal query performance.

-- 7. Array Types: PostgreSQL arrays are stored as JSON strings in SQLite.

-- 8. Data Migration: This schema is designed to work with Drizzle migrations
--    for seamless data transfer from PostgreSQL to D1.
