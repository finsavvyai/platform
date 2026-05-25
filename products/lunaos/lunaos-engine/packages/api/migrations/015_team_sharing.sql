-- Migration 015: Team Sharing
-- Enables sharing custom agents with teams

CREATE TABLE IF NOT EXISTS team_shared_agents (
  team_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  shared_by TEXT NOT NULL,
  shared_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (team_id, agent_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES custom_agents(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_shared_agents_team ON team_shared_agents(team_id);
