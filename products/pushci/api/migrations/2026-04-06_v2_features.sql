-- SSO/SAML configuration per workspace
CREATE TABLE IF NOT EXISTS sso_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'saml',
  entity_id TEXT NOT NULL,
  sso_url TEXT NOT NULL,
  certificate TEXT NOT NULL,
  allow_idp_initiated INTEGER NOT NULL DEFAULT 0,
  auto_provision INTEGER NOT NULL DEFAULT 1,
  default_role TEXT NOT NULL DEFAULT 'developer',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id)
);

-- Artifact registry
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name, version)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id, name, created_at DESC);

-- Shared team runners (workspace-level)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  owner_sub TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, user_sub)
);

CREATE TABLE IF NOT EXISTS workspace_runners (
  runner_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (runner_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_sub);
CREATE INDEX IF NOT EXISTS idx_workspace_runners_ws ON workspace_runners(workspace_id);
