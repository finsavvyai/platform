-- Sprint 38 — TokenForge workforce policies.
-- See packages/db/src/schema/tf-policies.ts for documentation.

CREATE TABLE IF NOT EXISTS tf_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rules TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_policies_tenant ON tf_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_policies_enabled ON tf_policies(tenant_id, enabled);
