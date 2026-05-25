-- Sprint 30: SaaS Posture Management tables

CREATE TABLE IF NOT EXISTS saas_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  connection_type TEXT NOT NULL,
  last_scan_at TEXT,
  finding_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saas_findings (
  id TEXT PRIMARY KEY,
  saas_account_id TEXT NOT NULL REFERENCES saas_accounts(id) ON DELETE CASCADE,
  org_id TEXT,
  check_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  remediation TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saas_oauth_apps (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  app_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  scopes TEXT,
  risk_score INTEGER DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  granted_by TEXT,
  is_ai_agent INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_accounts_org ON saas_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_saas_findings_account ON saas_findings(saas_account_id);
CREATE INDEX IF NOT EXISTS idx_saas_oauth_apps_org ON saas_oauth_apps(org_id);
