-- Link projects to teams. Nullable — opt-in. When set, /v1/prompt enforces
-- both project-level and team-level monthly budget caps.

ALTER TABLE projects ADD COLUMN team_id TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
