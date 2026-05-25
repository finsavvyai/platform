CREATE TABLE IF NOT EXISTS project_memberships (
  project_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  login TEXT NOT NULL,
  provider TEXT NOT NULL,
  role TEXT NOT NULL,
  environments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_sub)
);

CREATE TABLE IF NOT EXISTS deployment_policies (
  project_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  required_review_approvals INTEGER NOT NULL DEFAULT 0,
  required_manual_approvals INTEGER NOT NULL DEFAULT 0,
  require_protected_branch INTEGER NOT NULL DEFAULT 0,
  require_separation_of_duties INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, environment)
);

CREATE TABLE IF NOT EXISTS deployment_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT,
  run_id TEXT,
  requested_by_sub TEXT NOT NULL,
  requested_by_login TEXT NOT NULL,
  executed_by_sub TEXT,
  executed_by_login TEXT,
  status TEXT NOT NULL DEFAULT 'blocked',
  review_count INTEGER NOT NULL DEFAULT 0,
  protected_branch INTEGER NOT NULL DEFAULT 0,
  actor_is_author INTEGER NOT NULL DEFAULT 0,
  tests_passed INTEGER NOT NULL DEFAULT 0,
  secret_leak INTEGER NOT NULL DEFAULT 0,
  has_sbom INTEGER NOT NULL DEFAULT 0,
  policy_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deployment_approvals (
  request_id TEXT NOT NULL,
  approver_sub TEXT NOT NULL,
  approver_login TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (request_id, approver_sub)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_sub TEXT,
  actor_login TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_memberships_user
  ON project_memberships(user_sub);

CREATE INDEX IF NOT EXISTS idx_deployment_requests_project_env
  ON deployment_requests(project_id, environment, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployment_approvals_request
  ON deployment_approvals(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);
