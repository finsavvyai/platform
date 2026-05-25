-- Create dashboard_users table with OAuth support
-- Migration: 0001_create_users_table
-- Created: 2025-01-04

CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  oauth_provider TEXT CHECK(oauth_provider IN ('google', 'github', NULL)),
  oauth_id TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'viewer')),
  permissions TEXT NOT NULL DEFAULT '[]', -- JSON array of permissions
  organization_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  UNIQUE(oauth_provider, oauth_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON dashboard_users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON dashboard_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON dashboard_users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON dashboard_users(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trigger_users_updated_at
AFTER UPDATE ON dashboard_users
BEGIN
  UPDATE dashboard_users SET updated_at = datetime('now') WHERE id = NEW.id;
END;
