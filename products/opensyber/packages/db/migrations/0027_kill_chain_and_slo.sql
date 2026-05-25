-- Kill Chain Rules
CREATE TABLE IF NOT EXISTS kill_chain_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  stages TEXT NOT NULL, -- JSON array of stage definitions
  time_window_minutes INTEGER NOT NULL DEFAULT 60,
  severity TEXT NOT NULL DEFAULT 'critical'
    CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kill Chain Incidents (unified correlated incidents)
CREATE TABLE IF NOT EXISTS kill_chain_incidents (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES kill_chain_rules(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  severity TEXT NOT NULL DEFAULT 'critical'
    CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved')),
  correlated_event_ids TEXT NOT NULL, -- JSON array of event IDs
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- MCP Server Inventory
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  instance_id TEXT NOT NULL REFERENCES instances(id),
  server_name TEXT NOT NULL,
  server_uri TEXT,
  tools_count INTEGER NOT NULL DEFAULT 0,
  is_registered INTEGER NOT NULL DEFAULT 0,
  has_static_credentials INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for kill chain correlation queries
CREATE INDEX IF NOT EXISTS idx_kc_incidents_rule
  ON kill_chain_incidents(rule_id);
CREATE INDEX IF NOT EXISTS idx_kc_incidents_user_status
  ON kill_chain_incidents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_kc_incidents_created
  ON kill_chain_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user
  ON mcp_servers(user_id, instance_id);

-- Integration events: add index for kill chain time-window queries
CREATE INDEX IF NOT EXISTS idx_integration_events_type_time
  ON integration_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_integration_events_connection_time
  ON integration_events(connection_id, created_at);

-- Seed built-in kill chain rules
INSERT OR IGNORE INTO kill_chain_rules (id, name, description, stages, time_window_minutes, severity)
VALUES
  ('kc-phishing-mfa', 'Phishing + MFA Anomaly',
   'Phishing detected via Outlook/Defender followed by risky sign-in within 30 minutes for same user',
   '["outlook.phishing_detected","entra.risky_signin"]', 30, 'critical'),
  ('kc-supply-chain', 'Supply Chain Attack',
   'Dependabot alert + suspicious npm install + IAM change within 72 hours for same account',
   '["github.dependabot_alert","ide.npm_install","cloudtrail.iam_change"]', 4320, 'critical'),
  ('kc-agent-compromise', 'AI Agent Compromise',
   'Suspicious IDE command + filesystem enumeration + credential theft within 1 hour',
   '["ide.suspicious_command","agent.filesystem_enum","cloudtrail.credential_theft"]', 60, 'critical');
