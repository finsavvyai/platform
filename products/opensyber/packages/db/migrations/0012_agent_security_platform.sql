-- Sprint 24: Agent Security Platform + Thin CSPM
-- Creates tables for cloud account management, CSPM scanning/findings,
-- agent policies, and policy violations. Adds org_id to agent_activity.

-- ─── Cloud Accounts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cloud_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL CHECK(provider IN ('aws', 'gcp', 'azure')),
  name TEXT NOT NULL,
  external_id TEXT,
  role_arn TEXT,
  credentials TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'error', 'scanning')),
  last_scan_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cloud_accounts_org ON cloud_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_cloud_accounts_user ON cloud_accounts(user_id);

-- ─── CSPM Scan Runs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cspm_scan_runs (
  id TEXT PRIMARY KEY,
  cloud_account_id TEXT NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
  finding_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cspm_scan_runs_account ON cspm_scan_runs(cloud_account_id);

-- ─── CSPM Findings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cspm_findings (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL REFERENCES cspm_scan_runs(id) ON DELETE CASCADE,
  cloud_account_id TEXT NOT NULL REFERENCES cloud_accounts(id),
  org_id TEXT REFERENCES organizations(id),
  check_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'muted')),
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  region TEXT,
  title TEXT NOT NULL,
  description TEXT,
  remediation TEXT,
  compliance_frameworks TEXT,
  first_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  muted_at TEXT,
  muted_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cspm_findings_org ON cspm_findings(org_id);
CREATE INDEX IF NOT EXISTS idx_cspm_findings_severity ON cspm_findings(severity);
CREATE INDEX IF NOT EXISTS idx_cspm_findings_status ON cspm_findings(status);
CREATE INDEX IF NOT EXISTS idx_cspm_findings_account ON cspm_findings(cloud_account_id);

-- ─── Agent Policies ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('file_pattern', 'command_pattern', 'risk_threshold', 'secrets_threshold')),
  rule_config TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_policies_org ON agent_policies(org_id);

-- ─── Agent Policy Violations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_policy_violations (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES agent_policies(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  activity_id TEXT REFERENCES agent_activity(id),
  user_id TEXT REFERENCES users(id),
  severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
  summary TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_by TEXT REFERENCES users(id),
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_violations_org ON agent_policy_violations(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_violations_policy ON agent_policy_violations(policy_id);
CREATE INDEX IF NOT EXISTS idx_agent_violations_severity ON agent_policy_violations(severity);

-- ─── Add org_id to agent_activity ───────────────────────────────────
ALTER TABLE agent_activity ADD COLUMN org_id TEXT REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_org ON agent_activity(org_id);
