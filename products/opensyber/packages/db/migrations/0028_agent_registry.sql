-- Agent Registry for centralized AI agent tracking
CREATE TABLE IF NOT EXISTS agent_registry (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  instance_id TEXT,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ide', 'copilot', 'openai-sdk', 'langsmith', 'mcp')),
  owner TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_active_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_user ON agent_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_registry_source ON agent_registry(source);
CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_agent_registry_risk ON agent_registry(risk_score);
