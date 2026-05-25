-- Project invitations: admin sends invite to email, recipient accepts to join
-- as project_members. Token is unique and single-use.

CREATE TABLE IF NOT EXISTS project_invitations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON project_invitations(email);
