-- Tenant-scoped audit log. Distinct from platform-level `audit_logs` which
-- tracks platform admin actions. This table captures actor + action inside a
-- specific tenant (e.g. AI chat, alert remediation, workflow run).

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant ON tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_action ON tenant_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_created ON tenant_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant_created ON tenant_audit_log(tenant_id, created_at);
