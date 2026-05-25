-- TokenForge: device-bound cryptographic token protection
-- Tables: tokenforge_config, tokenforge_device_bindings, tokenforge_events

CREATE TABLE IF NOT EXISTS tokenforge_config (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  enforce_mode TEXT NOT NULL DEFAULT 'monitor',
  max_devices_per_user INTEGER NOT NULL DEFAULT 5,
  binding_ttl_days INTEGER NOT NULL DEFAULT 90,
  auto_revoke_on_risk INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_config_tenant ON tokenforge_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_config_org ON tokenforge_config(org_id);

CREATE TABLE IF NOT EXISTS tokenforge_device_bindings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  public_key_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_verified_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tf_bindings_org ON tokenforge_device_bindings(org_id);
CREATE INDEX IF NOT EXISTS idx_tf_bindings_tenant ON tokenforge_device_bindings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_bindings_user ON tokenforge_device_bindings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_bindings_device ON tokenforge_device_bindings(tenant_id, user_id, device_fingerprint);

CREATE TABLE IF NOT EXISTS tokenforge_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  device_fingerprint TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tf_events_tenant ON tokenforge_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_events_type ON tokenforge_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tf_events_created ON tokenforge_events(created_at);
