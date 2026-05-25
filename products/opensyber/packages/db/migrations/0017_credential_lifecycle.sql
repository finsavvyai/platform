-- Sprint 31: Credential Lifecycle tables

CREATE TABLE IF NOT EXISTS vault_rotation_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  secret_pattern TEXT NOT NULL,
  rotation_interval_days INTEGER NOT NULL,
  last_rotated_at TEXT,
  next_rotation_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notify_channel_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jit_access_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL,
  secret_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_secret_access (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  secret_name TEXT NOT NULL,
  access_type TEXT NOT NULL,
  accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rotation_policies_org ON vault_rotation_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_jit_requests_org ON jit_access_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_secret_access_org ON agent_secret_access(org_id);
