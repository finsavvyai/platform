-- Workspace Governance tables
CREATE TABLE IF NOT EXISTS workspace_inventory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  workspace_type TEXT NOT NULL DEFAULT 'group',
  created_at TEXT,
  last_activity TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  guest_count INTEGER NOT NULL DEFAULT 0,
  owner_count INTEGER NOT NULL DEFAULT 0,
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,
  external_sharing TEXT NOT NULL DEFAULT 'internal_only',
  visibility TEXT NOT NULL DEFAULT 'Private',
  status TEXT NOT NULL DEFAULT 'active',
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_tenant ON workspace_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspace_type ON workspace_inventory(tenant_id, workspace_type);
