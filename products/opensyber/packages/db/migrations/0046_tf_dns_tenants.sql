-- OpenSyber DNS firewall — per-tenant Unbound + RPZ resolver state.
-- One row per tenant resolver. VM provisioning lives in agent-runtime;
-- this table holds the orchestration / sync metadata only.

CREATE TABLE IF NOT EXISTS tf_dns_tenants (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT REFERENCES organizations(id),

  tenant_name TEXT NOT NULL,

  vm_id TEXT,
  resolver_ip TEXT,

  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'active', 'paused', 'error', 'deleted')),

  last_sync_at TEXT,
  blocked_count_24h INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_dns_tenants_owner
  ON tf_dns_tenants(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_tf_dns_tenants_org
  ON tf_dns_tenants(org_id);

CREATE INDEX IF NOT EXISTS idx_tf_dns_tenants_status
  ON tf_dns_tenants(status);

CREATE INDEX IF NOT EXISTS idx_tf_dns_tenants_vm
  ON tf_dns_tenants(vm_id);
