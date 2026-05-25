-- OpenSyber Sprint D1 — Workload Protection (Falco + osquery + Wazuh).
-- Per-host agent registry + the runtime-detection finding stream those
-- engines produce. Mirrors packages/db/src/schema/wlp-agents.ts.

CREATE TABLE IF NOT EXISTS tf_wlp_agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT REFERENCES organizations(id),

  hostname TEXT NOT NULL,
  agent_type TEXT NOT NULL
    CHECK (agent_type IN ('falco', 'osquery', 'wazuh')),
  version TEXT NOT NULL,

  last_seen_at TEXT,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'stale', 'offline')),

  tags TEXT NOT NULL DEFAULT '[]',

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_wlp_agents_tenant
  ON tf_wlp_agents(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tf_wlp_agents_owner
  ON tf_wlp_agents(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_tf_wlp_agents_status
  ON tf_wlp_agents(status);

CREATE TABLE IF NOT EXISTS tf_wlp_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  agent_id TEXT NOT NULL REFERENCES tf_wlp_agents(id),

  rule_id TEXT NOT NULL,

  severity TEXT NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),

  mitre_technique TEXT NOT NULL,

  title TEXT NOT NULL,
  description TEXT NOT NULL,
  raw_event TEXT NOT NULL,

  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tf_wlp_findings_tenant_time
  ON tf_wlp_findings(tenant_id, detected_at);

CREATE INDEX IF NOT EXISTS idx_tf_wlp_findings_agent
  ON tf_wlp_findings(agent_id);

CREATE INDEX IF NOT EXISTS idx_tf_wlp_findings_severity_time
  ON tf_wlp_findings(severity, detected_at);
