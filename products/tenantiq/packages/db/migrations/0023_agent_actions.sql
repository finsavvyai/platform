-- Autonomous-agent action log. Every action a Claude-driven agent takes
-- (scan, finding-raised, email-sent, fix-applied, drift-reverted) writes
-- one row here. Powers the public live counter, /leaderboard aggregation,
-- and the per-MSP autonomous-activity timeline.

CREATE TABLE IF NOT EXISTS agent_actions (
  id              TEXT PRIMARY KEY,
  org_id          TEXT,
  tenant_id       TEXT,
  agent           TEXT NOT NULL,            -- 'public-scan' | 'autonomous-auditor' | 'auto-remediator' | …
  action          TEXT NOT NULL,            -- 'scan' | 'finding-raised' | 'email-sent' | 'fix-applied' | …
  finding_id      TEXT,
  severity        TEXT,                     -- 'critical' | 'high' | 'medium' | 'low' | 'info'
  status          TEXT NOT NULL DEFAULT 'success',
  metadata        TEXT,                     -- JSON
  created_at      INTEGER NOT NULL          -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_org ON agent_actions (org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_actions_tenant ON agent_actions (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent ON agent_actions (agent, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions (created_at);
