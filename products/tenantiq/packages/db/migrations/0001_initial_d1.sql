-- TenantIQ D1 Database Schema (SQLite)
-- Multi-tenant SaaS for Microsoft 365 management

-- ============================================================
-- Organizations (Your Customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'direct' | 'msp'
  billing_plan TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- Tenants (Customer's Microsoft 365 Tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  azure_tenant_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  domain TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at INTEGER,
  last_sync_at INTEGER,
  status TEXT DEFAULT 'active', -- 'active' | 'suspended' | 'disconnected'
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tenants_org ON tenants(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_azure ON tenants(azure_tenant_id);

-- ============================================================
-- Platform Users (Your customers - IT admins)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin' | 'member' | 'viewer'
  status TEXT DEFAULT 'active',
  last_login_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_platform_users_org ON platform_users(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);

-- ============================================================
-- Users Cache (M365 users synced from Graph API)
-- ============================================================
CREATE TABLE IF NOT EXISTS users_cache (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  azure_user_id TEXT NOT NULL,
  user_principal_name TEXT NOT NULL,
  display_name TEXT,
  mail TEXT,
  job_title TEXT,
  department TEXT,
  account_enabled INTEGER DEFAULT 1, -- SQLite uses INTEGER for boolean
  last_sign_in_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  synced_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users_cache(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_azure ON users_cache(tenant_id, azure_user_id);

-- ============================================================
-- Licenses Cache
-- ============================================================
CREATE TABLE IF NOT EXISTS licenses_cache (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  sku_id TEXT NOT NULL,
  sku_part_number TEXT NOT NULL,
  consumed_units INTEGER DEFAULT 0,
  enabled_units INTEGER DEFAULT 0,
  prepaid_units INTEGER DEFAULT 0,
  synced_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_licenses_tenant ON licenses_cache(tenant_id);

-- ============================================================
-- User Licenses (Assignment mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_licenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users_cache(id),
  sku_id TEXT NOT NULL,
  assigned_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_licenses_tenant ON user_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_licenses_user ON user_licenses(user_id);

-- ============================================================
-- Security Alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS security_alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  alert_type TEXT NOT NULL, -- 'inactive_license' | 'security_risk' | 'compliance' | 'cost_optimization'
  severity TEXT NOT NULL, -- 'low' | 'medium' | 'high' | 'critical'
  title TEXT NOT NULL,
  description TEXT,
  affected_users INTEGER DEFAULT 0,
  potential_savings REAL DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  metadata TEXT, -- JSON string
  detected_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON security_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON security_alerts(status);

-- ============================================================
-- Webhook Configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  notification_mode TEXT DEFAULT 'realtime', -- 'realtime' | 'digest'
  min_severity TEXT, -- 'low' | 'medium' | 'high' | 'critical'
  categories TEXT, -- JSON array
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_tenant ON webhook_configs(tenant_id);

-- ============================================================
-- Webhook Deliveries (Audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  config_id TEXT NOT NULL REFERENCES webhook_configs(id),
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON string
  status TEXT NOT NULL, -- 'pending' | 'delivered' | 'failed'
  attempts INTEGER DEFAULT 0,
  last_attempt_at INTEGER,
  next_retry_at INTEGER,
  response_code INTEGER,
  response_body TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config ON webhook_deliveries(config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
