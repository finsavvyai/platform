-- TokenForge: per-tenant outgoing webhook subscription config.
-- Lets tenants register a single endpoint URL + a subset of event types to
-- receive. Cloud event emitters (bind, revoke, verify failures) fan out to
-- each enabled subscription on fire-and-forget basis.

CREATE TABLE IF NOT EXISTS tf_webhook_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tf_tenants(id),
  endpoint_url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '',
  secret TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_delivery_at TEXT,
  last_delivery_status INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_webhook_config_tenant ON tf_webhook_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_webhook_config_enabled ON tf_webhook_config(enabled);
