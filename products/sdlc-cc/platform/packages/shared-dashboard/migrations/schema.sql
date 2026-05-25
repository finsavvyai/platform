-- Complete AutoBoot Dashboard Database Schema
-- This file contains the complete schema for reference
-- For migrations, use the individual 000X_*.sql files
-- Created: 2025-01-04

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  oauth_provider TEXT CHECK(oauth_provider IN ('google', 'github', NULL)),
  oauth_id TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'viewer')),
  permissions TEXT NOT NULL DEFAULT '[]',
  organization_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  UNIQUE(oauth_provider, oauth_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON dashboard_users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON dashboard_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON dashboard_users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON dashboard_users(is_active);

CREATE TRIGGER IF NOT EXISTS trigger_users_updated_at
AFTER UPDATE ON dashboard_users
BEGIN
  UPDATE dashboard_users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  billing_email TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK(subscription_plan IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK(subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  subscription_id TEXT,
  trial_ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES dashboard_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON dashboard_organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON dashboard_organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription ON dashboard_organizations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON dashboard_organizations(is_active);

CREATE TRIGGER IF NOT EXISTS trigger_organizations_updated_at
AFTER UPDATE ON dashboard_organizations
BEGIN
  UPDATE dashboard_organizations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- =====================================================
-- SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON dashboard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON dashboard_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON dashboard_sessions(expires_at);

CREATE TRIGGER IF NOT EXISTS trigger_sessions_activity
AFTER UPDATE ON dashboard_sessions
BEGIN
  UPDATE dashboard_sessions SET last_activity_at = datetime('now') WHERE id = NEW.id;
END;

-- =====================================================
-- API KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_api_keys (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  rate_limit INTEGER NOT NULL DEFAULT 1000,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON dashboard_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON dashboard_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON dashboard_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON dashboard_api_keys(expires_at);

CREATE TRIGGER IF NOT EXISTS trigger_api_keys_updated_at
AFTER UPDATE ON dashboard_api_keys
BEGIN
  UPDATE dashboard_api_keys SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  organization_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure', 'warning')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES dashboard_organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON dashboard_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON dashboard_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON dashboard_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON dashboard_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON dashboard_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON dashboard_audit_logs(status);

-- =====================================================
-- EMAIL VERIFICATION TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_email_verification_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  token_prefix TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('email_verification', 'password_reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON dashboard_email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token_hash ON dashboard_email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON dashboard_email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_purpose ON dashboard_email_verification_tokens(purpose);
