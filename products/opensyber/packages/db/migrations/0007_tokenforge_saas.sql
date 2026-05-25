-- TokenForge Multi-Tenant SaaS Tables
-- Sprint 7: Tenants, API keys, usage tracking

-- Tenants (organizations using TokenForge)
CREATE TABLE IF NOT EXISTS tf_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  lemonsqueezy_customer_id TEXT,
  lemonsqueezy_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API Keys for tenant authentication
CREATE TABLE IF NOT EXISTS tf_api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tf_tenants(id),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tf_api_keys_hash ON tf_api_keys(key_hash);
CREATE INDEX idx_tf_api_keys_tenant ON tf_api_keys(tenant_id);

-- Add tenant_id column to existing TokenForge tables
ALTER TABLE device_sessions ADD COLUMN tenant_id TEXT;
ALTER TABLE tf_security_events ADD COLUMN tenant_id TEXT;
ALTER TABLE step_up_challenges ADD COLUMN tenant_id TEXT;

CREATE INDEX idx_device_sessions_tenant ON device_sessions(tenant_id);
CREATE INDEX idx_tf_security_events_tenant ON tf_security_events(tenant_id);
CREATE INDEX idx_step_up_challenges_tenant ON step_up_challenges(tenant_id);

-- Usage tracking for billing
CREATE TABLE IF NOT EXISTS tf_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tf_tenants(id),
  date TEXT NOT NULL,
  verification_count INTEGER NOT NULL DEFAULT 0,
  bind_count INTEGER NOT NULL DEFAULT 0,
  step_up_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_tf_usage_tenant_date ON tf_usage(tenant_id, date);
