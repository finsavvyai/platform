-- OpenSyber D1 Database Schema
-- Migration: 0001_initial
-- Date: 2026-02-21

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT NOT NULL DEFAULT 'personal' CHECK (plan IN ('personal', 'pro', 'team')),
  lemonsqueezy_customer_id TEXT,
  lemonsqueezy_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_lemonsqueezy_customer_id ON users(lemonsqueezy_customer_id);

-- Instances (one per user on Personal/Pro, multiple on Team)
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Agent',
  hetzner_server_id INTEGER,
  ipv4 TEXT,
  ipv6 TEXT,
  region TEXT NOT NULL CHECK (region IN ('eu-central', 'us-east', 'us-west', 'ap-southeast')),
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN (
    'provisioning', 'installing', 'ready', 'running', 'stopped', 'error', 'suspended', 'destroying'
  )),
  engine_version TEXT,
  agent_version TEXT,
  gateway_token_encrypted TEXT,
  last_health_check TEXT,
  last_backup TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_instances_user_id ON instances(user_id);
CREATE INDEX idx_instances_status ON instances(status);
CREATE INDEX idx_instances_hetzner_server_id ON instances(hetzner_server_id);

-- Skills (verified marketplace)
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'productivity', 'developer', 'finance', 'communication', 'home', 'security', 'utilities'
  )),
  author_id TEXT NOT NULL,
  github_url TEXT,
  current_version TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'scanning', 'reviewing', 'approved', 'rejected', 'revoked'
  )),
  verified_at TEXT,
  install_count INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_skills_slug ON skills(slug);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_verification_status ON skills(verification_status);

-- Skill Installations (per instance)
CREATE TABLE IF NOT EXISTS skill_installations (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  version TEXT NOT NULL,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_skill_installations_instance_id ON skill_installations(instance_id);
CREATE INDEX idx_skill_installations_skill_id ON skill_installations(skill_id);

-- Security Events
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'skill_blocked', 'skill_installed', 'skill_removed', 'anomaly_detected',
    'credential_access', 'unauthorized_network', 'file_access_violation',
    'update_applied', 'instance_hardened', 'brute_force_attempt'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  skill_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_security_events_instance_id ON security_events(instance_id);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'shell_exec', 'file_read', 'file_write', 'http_request',
    'credential_access', 'skill_install', 'skill_uninstall', 'config_change'
  )),
  skill_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_instance_id ON audit_log(instance_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
