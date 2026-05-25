-- Migration 0041: AI Agent Discovery Suite MVP schema

CREATE TABLE IF NOT EXISTS agent_discovery_runs (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  started_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  total_found INTEGER NOT NULL DEFAULT 0,
  total_scored INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (started_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_discovery_runs_org_status
  ON agent_discovery_runs(org_id, status);

CREATE TABLE IF NOT EXISTS discovered_agents (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  name TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'unknown',
  runtime TEXT NOT NULL DEFAULT 'unknown',
  surface_type TEXT NOT NULL DEFAULT 'repo',
  location_path TEXT,
  status TEXT NOT NULL DEFAULT 'unsecured',
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES agent_discovery_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discovered_agents_org_status
  ON discovered_agents(org_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_discovered_agents_org_fingerprint
  ON discovered_agents(org_id, fingerprint);

CREATE TABLE IF NOT EXISTS discovered_agent_risk_scores (
  id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'low',
  factors_json TEXT NOT NULL DEFAULT '[]',
  scored_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES discovered_agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discovered_agent_risk_scores_agent_scored
  ON discovered_agent_risk_scores(agent_id, scored_at DESC);

CREATE TABLE IF NOT EXISTS discovered_agent_owners (
  id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL,
  owner_user_id TEXT,
  owner_team_id TEXT,
  owner_source TEXT NOT NULL DEFAULT 'manual',
  confidence INTEGER NOT NULL DEFAULT 50,
  mapped_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES discovered_agents(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_discovered_agent_owners_agent
  ON discovered_agent_owners(agent_id);

CREATE TABLE IF NOT EXISTS discovery_protection_links (
  id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL,
  instance_id TEXT,
  protection_method TEXT NOT NULL DEFAULT 'opensyber-runtime',
  status TEXT NOT NULL DEFAULT 'active',
  protected_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES discovered_agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discovery_protection_links_agent
  ON discovery_protection_links(agent_id, protected_at DESC);
