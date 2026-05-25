import type {
  DeploymentPolicy,
  DeploymentRequest,
  JobRecord,
  JobStatus,
  Platform,
  Project,
  ProjectMembership,
  ProjectRole,
  RunnerRecord,
  RunnerRegistrationToken,
  RunnerStatus,
  Run,
} from "./types";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  checks_json TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  webhook_secret TEXT NOT NULL
);
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
CREATE TABLE IF NOT EXISTS runner_registration_tokens (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by_sub TEXT NOT NULL,
  created_by_login TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS runners (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  labels_json TEXT NOT NULL DEFAULT '[]',
  os TEXT NOT NULL,
  arch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  ip TEXT,
  version TEXT,
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  project_id TEXT NOT NULL,
  runner_id TEXT,
  kind TEXT NOT NULL DEFAULT 'ci',
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  environment TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  steps_json TEXT NOT NULL DEFAULT '[]',
  labels_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_sub TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'team',
  domains_json TEXT NOT NULL DEFAULT '[]',
  sso_provider TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  login TEXT NOT NULL,
  provider TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, user_sub)
);
CREATE TABLE IF NOT EXISTS org_projects (
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, project_id)
);
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'landing',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_runs_repo ON runs(repo);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_project_memberships_user ON project_memberships(user_sub);
CREATE INDEX IF NOT EXISTS idx_deployment_requests_project_env ON deployment_requests(project_id, environment, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_approvals_request ON deployment_approvals(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runner_registration_tokens_project ON runner_registration_tokens(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runners_project_status ON runners(project_id, status, last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_project_status ON jobs(project_id, status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_jobs_run ON jobs(run_id, created_at ASC);
`;

export async function insertRun(db: D1Database, run: Run): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runs (id, repo, branch, sha, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(run.id, run.repo, run.branch, run.sha, run.status, run.created_at)
    .run();
}

export async function getRun(db: D1Database, id: string): Promise<Run | null> {
  const result = await db
    .prepare("SELECT * FROM runs WHERE id = ?")
    .bind(id)
    .first<Run>();
  return result ?? null;
}

export async function getRunForUser(
  db: D1Database,
  id: string,
  userSub: string
): Promise<Run | null> {
  const result = await db
    .prepare(`
      SELECT runs.*
      FROM runs
      JOIN projects ON projects.repo = runs.repo
      JOIN project_memberships ON project_memberships.project_id = projects.id
      WHERE runs.id = ? AND project_memberships.user_sub = ?
      LIMIT 1
    `)
    .bind(id, userSub)
    .first<Run>();
  return result ?? null;
}

export async function updateRun(
  db: D1Database,
  id: string,
  updates: {
    status: Run["status"];
    started_at?: string | null;
    finished_at?: string | null;
    duration_ms?: number | null;
    checks_json?: string | null;
  }
): Promise<Run | null> {
  await db
    .prepare(`
      UPDATE runs
      SET status = ?,
          started_at = COALESCE(?, started_at),
          finished_at = COALESCE(?, finished_at),
          duration_ms = COALESCE(?, duration_ms),
          checks_json = COALESCE(?, checks_json)
      WHERE id = ?
    `)
    .bind(
      updates.status,
      updates.started_at ?? null,
      updates.finished_at ?? null,
      updates.duration_ms ?? null,
      updates.checks_json ?? null,
      id
    )
    .run();
  return getRun(db, id);
}

export async function getProject(
  db: D1Database,
  id: string
): Promise<Project | null> {
  const result = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<Project>();
  return result ?? null;
}

export async function createProject(
  db: D1Database,
  project: { id: string; repo: string; platform: Platform; webhook_secret: string }
): Promise<Project> {
  await db
    .prepare(
      `INSERT INTO projects (id, repo, platform, webhook_secret)
       VALUES (?, ?, ?, ?)`
    )
    .bind(project.id, project.repo, project.platform, project.webhook_secret)
    .run();

  const created = await getProject(db, project.id);
  if (!created) throw new Error("failed to create project");
  return created;
}

export async function listRuns(
  db: D1Database,
  limit = 50,
  offset = 0
): Promise<Run[]> {
  const { results } = await db
    .prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<Run>();
  return results;
}

export async function listRunsForUser(
  db: D1Database,
  userSub: string,
  limit = 50,
  offset = 0
): Promise<Run[]> {
  const { results } = await db
    .prepare(`
      SELECT runs.*
      FROM runs
      JOIN projects ON projects.repo = runs.repo
      JOIN project_memberships ON project_memberships.project_id = projects.id
      WHERE project_memberships.user_sub = ?
      ORDER BY COALESCE(runs.started_at, runs.created_at) DESC
      LIMIT ? OFFSET ?
    `)
    .bind(userSub, limit, offset)
    .all<Run>();
  return results;
}

export async function listRunsByRepo(
  db: D1Database,
  repo: string,
  limit = 20
): Promise<Run[]> {
  const { results } = await db
    .prepare("SELECT * FROM runs WHERE repo = ? ORDER BY created_at DESC LIMIT ?")
    .bind(repo, limit)
    .all<Run>();
  return results;
}

export async function listRunsByRepoForUser(
  db: D1Database,
  repo: string,
  userSub: string,
  limit = 20
): Promise<Run[]> {
  const { results } = await db
    .prepare(`
      SELECT runs.*
      FROM runs
      JOIN projects ON projects.repo = runs.repo
      JOIN project_memberships ON project_memberships.project_id = projects.id
      WHERE runs.repo = ? AND project_memberships.user_sub = ?
      ORDER BY runs.created_at DESC
      LIMIT ?
    `)
    .bind(repo, userSub, limit)
    .all<Run>();
  return results;
}

export async function listProjects(db: D1Database): Promise<Project[]> {
  const { results } = await db
    .prepare("SELECT * FROM projects ORDER BY created_at DESC")
    .all<Project>();
  return results;
}

export async function countProjectsForUser(
  db: D1Database,
  userSub: string
): Promise<number> {
  const row = await db
    .prepare(`
      SELECT COUNT(*) as cnt
      FROM project_memberships
      WHERE user_sub = ?
    `)
    .bind(userSub)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function listProjectsForUser(
  db: D1Database,
  userSub: string
): Promise<Project[]> {
  const { results } = await db
    .prepare(`
      SELECT projects.*
      FROM projects
      JOIN project_memberships ON project_memberships.project_id = projects.id
      WHERE project_memberships.user_sub = ?
      ORDER BY projects.created_at DESC
    `)
    .bind(userSub)
    .all<Project>();
  return results;
}

export async function getProjectByRepo(
  db: D1Database,
  repo: string
): Promise<Project | null> {
  const result = await db
    .prepare("SELECT * FROM projects WHERE repo = ?")
    .bind(repo)
    .first<Project>();
  return result ?? null;
}

export async function getProjectByRepoForUser(
  db: D1Database,
  repo: string,
  userSub: string
): Promise<Project | null> {
  const result = await db
    .prepare(`
      SELECT projects.*
      FROM projects
      JOIN project_memberships ON project_memberships.project_id = projects.id
      WHERE projects.repo = ? AND project_memberships.user_sub = ?
      LIMIT 1
    `)
    .bind(repo, userSub)
    .first<Project>();
  return result ?? null;
}

type ProjectMembershipRow = Omit<ProjectMembership, "environments"> & {
  environments_json: string;
};

export async function getProjectMembership(
  db: D1Database,
  projectId: string,
  userSub: string
): Promise<ProjectMembership | null> {
  const result = await db
    .prepare(`
      SELECT *
      FROM project_memberships
      WHERE project_id = ? AND user_sub = ?
      LIMIT 1
    `)
    .bind(projectId, userSub)
    .first<ProjectMembershipRow>();
  return result ? mapProjectMembership(result) : null;
}

export async function countProjectMemberships(
  db: D1Database,
  projectId: string
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM project_memberships WHERE project_id = ?")
    .bind(projectId)
    .first<{ count: number | string }>();
  return Number(row?.count ?? 0);
}

export async function listProjectMemberships(
  db: D1Database,
  projectId: string
): Promise<ProjectMembership[]> {
  const { results } = await db
    .prepare(`
      SELECT *
      FROM project_memberships
      WHERE project_id = ?
      ORDER BY created_at ASC
    `)
    .bind(projectId)
    .all<ProjectMembershipRow>();
  return results.map(mapProjectMembership);
}

export async function upsertProjectMembership(
  db: D1Database,
  membership: {
    project_id: string;
    user_sub: string;
    login: string;
    provider: "github" | "gitlab" | "google" | "linkedin" | "facebook" | "bitbucket" | "microsoft";
    role: ProjectRole;
    environments: string[];
  }
): Promise<ProjectMembership> {
  await db
    .prepare(`
      INSERT INTO project_memberships (
        project_id, user_sub, login, provider, role, environments_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, user_sub)
      DO UPDATE SET
        login = excluded.login,
        provider = excluded.provider,
        role = excluded.role,
        environments_json = excluded.environments_json,
        updated_at = datetime('now')
    `)
    .bind(
      membership.project_id,
      membership.user_sub,
      membership.login,
      membership.provider,
      membership.role,
      JSON.stringify(membership.environments)
    )
    .run();

  const stored = await getProjectMembership(db, membership.project_id, membership.user_sub);
  if (!stored) throw new Error("failed to upsert project membership");
  return stored;
}

type DeploymentPolicyRow = Omit<
  DeploymentPolicy,
  "require_protected_branch" | "require_separation_of_duties"
> & {
  require_protected_branch: number;
  require_separation_of_duties: number;
};

export function defaultDeploymentPolicy(
  projectId: string,
  environment: string
): DeploymentPolicy {
  const normalizedEnvironment = environment.trim().toLowerCase();
  if (normalizedEnvironment === "production" || normalizedEnvironment === "prod") {
    return {
      project_id: projectId,
      environment: normalizedEnvironment,
      required_review_approvals: 2,
      required_manual_approvals: 1,
      require_protected_branch: true,
      require_separation_of_duties: true,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
  if (normalizedEnvironment === "staging") {
    return {
      project_id: projectId,
      environment: normalizedEnvironment,
      required_review_approvals: 1,
      required_manual_approvals: 0,
      require_protected_branch: false,
      require_separation_of_duties: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
  return {
    project_id: projectId,
    environment: normalizedEnvironment,
    required_review_approvals: 0,
    required_manual_approvals: 0,
    require_protected_branch: false,
    require_separation_of_duties: false,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export async function getDeploymentPolicy(
  db: D1Database,
  projectId: string,
  environment: string
): Promise<DeploymentPolicy> {
  const normalizedEnvironment = environment.trim().toLowerCase();
  const row = await db
    .prepare(`
      SELECT *
      FROM deployment_policies
      WHERE project_id = ? AND environment = ?
      LIMIT 1
    `)
    .bind(projectId, normalizedEnvironment)
    .first<DeploymentPolicyRow>();
  return row ? mapDeploymentPolicy(row) : defaultDeploymentPolicy(projectId, normalizedEnvironment);
}

export async function listDeploymentPolicies(
  db: D1Database,
  projectId: string
): Promise<DeploymentPolicy[]> {
  const { results } = await db
    .prepare(`
      SELECT *
      FROM deployment_policies
      WHERE project_id = ?
      ORDER BY environment ASC
    `)
    .bind(projectId)
    .all<DeploymentPolicyRow>();
  return results.map(mapDeploymentPolicy);
}

export async function upsertDeploymentPolicy(
  db: D1Database,
  policy: {
    project_id: string;
    environment: string;
    required_review_approvals: number;
    required_manual_approvals: number;
    require_protected_branch: boolean;
    require_separation_of_duties: boolean;
  }
): Promise<DeploymentPolicy> {
  const environment = policy.environment.trim().toLowerCase();
  await db
    .prepare(`
      INSERT INTO deployment_policies (
        project_id, environment, required_review_approvals, required_manual_approvals,
        require_protected_branch, require_separation_of_duties
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, environment)
      DO UPDATE SET
        required_review_approvals = excluded.required_review_approvals,
        required_manual_approvals = excluded.required_manual_approvals,
        require_protected_branch = excluded.require_protected_branch,
        require_separation_of_duties = excluded.require_separation_of_duties,
        updated_at = datetime('now')
    `)
    .bind(
      policy.project_id,
      environment,
      policy.required_review_approvals,
      policy.required_manual_approvals,
      policy.require_protected_branch ? 1 : 0,
      policy.require_separation_of_duties ? 1 : 0
    )
    .run();
  return getDeploymentPolicy(db, policy.project_id, environment);
}

type DeploymentRequestRow = Omit<
  DeploymentRequest,
  "protected_branch" | "actor_is_author" | "tests_passed" | "secret_leak" | "has_sbom"
> & {
  protected_branch: number;
  actor_is_author: number;
  tests_passed: number;
  secret_leak: number;
  has_sbom: number;
};

export async function createDeploymentRequest(
  db: D1Database,
  request: {
    id: string;
    project_id: string;
    environment: string;
    branch: string;
    sha: string | null;
    run_id: string | null;
    requested_by_sub: string;
    requested_by_login: string;
    status: DeploymentRequest["status"];
    review_count: number;
    protected_branch: boolean;
    actor_is_author: boolean;
    tests_passed: boolean;
    secret_leak: boolean;
    has_sbom: boolean;
    policy_reason: string | null;
  }
): Promise<DeploymentRequest> {
  await db
    .prepare(`
      INSERT INTO deployment_requests (
        id, project_id, environment, branch, sha, run_id,
        requested_by_sub, requested_by_login, status, review_count,
        protected_branch, actor_is_author, tests_passed, secret_leak, has_sbom,
        policy_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      request.id,
      request.project_id,
      request.environment.trim().toLowerCase(),
      request.branch,
      request.sha,
      request.run_id,
      request.requested_by_sub,
      request.requested_by_login,
      request.status,
      request.review_count,
      request.protected_branch ? 1 : 0,
      request.actor_is_author ? 1 : 0,
      request.tests_passed ? 1 : 0,
      request.secret_leak ? 1 : 0,
      request.has_sbom ? 1 : 0,
      request.policy_reason
    )
    .run();

  const stored = await getDeploymentRequest(db, request.id);
  if (!stored) throw new Error("failed to create deployment request");
  return stored;
}

export async function getDeploymentRequest(
  db: D1Database,
  id: string
): Promise<DeploymentRequest | null> {
  const row = await db
    .prepare("SELECT * FROM deployment_requests WHERE id = ?")
    .bind(id)
    .first<DeploymentRequestRow>();
  return row ? mapDeploymentRequest(row) : null;
}

export async function updateDeploymentRequestStatus(
  db: D1Database,
  id: string,
  status: DeploymentRequest["status"],
  updates?: {
    executed_by_sub?: string | null;
    executed_by_login?: string | null;
    policy_reason?: string | null;
  }
): Promise<DeploymentRequest | null> {
  await db
    .prepare(`
      UPDATE deployment_requests
      SET status = ?,
          executed_by_sub = COALESCE(?, executed_by_sub),
          executed_by_login = COALESCE(?, executed_by_login),
          policy_reason = COALESCE(?, policy_reason),
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(
      status,
      updates?.executed_by_sub ?? null,
      updates?.executed_by_login ?? null,
      updates?.policy_reason ?? null,
      id
    )
    .run();
  return getDeploymentRequest(db, id);
}

export async function countDeploymentApprovals(
  db: D1Database,
  requestId: string
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM deployment_approvals WHERE request_id = ?")
    .bind(requestId)
    .first<{ count: number | string }>();
  return Number(row?.count ?? 0);
}

export async function addDeploymentApproval(
  db: D1Database,
  approval: { request_id: string; approver_sub: string; approver_login: string }
): Promise<number> {
  await db
    .prepare(`
      INSERT INTO deployment_approvals (request_id, approver_sub, approver_login)
      VALUES (?, ?, ?)
      ON CONFLICT(request_id, approver_sub) DO NOTHING
    `)
    .bind(approval.request_id, approval.approver_sub, approval.approver_login)
    .run();
  return countDeploymentApprovals(db, approval.request_id);
}

export async function insertAuditLog(
  db: D1Database,
  event: {
    actor_sub: string | null;
    actor_login: string | null;
    action: string;
    resource_type: string;
    resource_id: string;
    details_json?: string;
  }
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO audit_logs (
        actor_sub, actor_login, action, resource_type, resource_id, details_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      event.actor_sub,
      event.actor_login,
      event.action,
      event.resource_type,
      event.resource_id,
      event.details_json ?? "{}"
    )
    .run();
}

// --- Audit log reads ---

export async function listAuditLogs(
  db: D1Database,
  projectId: string,
  opts: { limit?: number; offset?: number; action?: string }
): Promise<{ id: number; actor_sub: string; actor_login: string; action: string; resource_type: string; resource_id: string; details_json: string; created_at: string }[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  if (opts.action) {
    const { results } = await db
      .prepare(`SELECT * FROM audit_logs WHERE resource_id LIKE ? AND action = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(`${projectId}%`, opts.action, limit, offset)
      .all();
    return results as any;
  }

  const { results } = await db
    .prepare(`SELECT * FROM audit_logs WHERE resource_id LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(`${projectId}%`, limit, offset)
    .all();
  return results as any;
}

// --- Cloud usage tracking ---

export async function recordCloudMinutes(
  db: D1Database,
  userSub: string,
  projectId: string,
  jobId: string,
  minutes: number
): Promise<void> {
  await db
    .prepare(`INSERT OR IGNORE INTO cloud_usage (user_sub, project_id, job_id, minutes) VALUES (?, ?, ?, ?)`)
    .bind(userSub, projectId, jobId, minutes)
    .run();
}

export async function getCloudUsageThisMonth(
  db: D1Database,
  userSub: string
): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(minutes), 0) AS total FROM cloud_usage WHERE user_sub = ? AND recorded_at >= datetime('now', 'start of month')`)
    .bind(userSub)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function createRunnerRegistrationToken(
  db: D1Database,
  token: {
    id: string;
    project_id: string;
    token_hash: string;
    created_by_sub: string;
    created_by_login: string;
    expires_at: string;
  }
): Promise<RunnerRegistrationToken> {
  await db
    .prepare(`
      INSERT INTO runner_registration_tokens (
        id, project_id, token_hash, created_by_sub, created_by_login, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      token.id,
      token.project_id,
      token.token_hash,
      token.created_by_sub,
      token.created_by_login,
      token.expires_at
    )
    .run();

  const stored = await db
    .prepare("SELECT * FROM runner_registration_tokens WHERE id = ?")
    .bind(token.id)
    .first<RunnerRegistrationToken>();
  if (!stored) throw new Error("failed to create runner registration token");
  return stored;
}

export async function getValidRunnerRegistrationTokenByHash(
  db: D1Database,
  tokenHash: string
): Promise<RunnerRegistrationToken | null> {
  const row = await db
    .prepare(`
      SELECT *
      FROM runner_registration_tokens
      WHERE token_hash = ?
        AND consumed_at IS NULL
        AND datetime(expires_at) > datetime('now')
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<RunnerRegistrationToken>();
  return row ?? null;
}

export async function consumeRunnerRegistrationToken(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare(`
      UPDATE runner_registration_tokens
      SET consumed_at = datetime('now')
      WHERE id = ? AND consumed_at IS NULL
    `)
    .bind(id)
    .run();
}

export async function createRunner(
  db: D1Database,
  runner: {
    id: string;
    project_id: string;
    name: string;
    token_hash: string;
    labels: string[];
    os: string;
    arch: string;
    status?: RunnerStatus;
    ip?: string | null;
    version?: string | null;
  }
): Promise<RunnerRecord> {
  await db
    .prepare(`
      INSERT INTO runners (
        id, project_id, name, token_hash, labels_json, os, arch, status, ip, version, last_heartbeat
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .bind(
      runner.id,
      runner.project_id,
      runner.name,
      runner.token_hash,
      JSON.stringify(runner.labels),
      runner.os,
      runner.arch,
      runner.status ?? "idle",
      runner.ip ?? null,
      runner.version ?? null
    )
    .run();

  const stored = await getRunner(db, runner.id);
  if (!stored) throw new Error("failed to create runner");
  return stored;
}

export async function getRunner(
  db: D1Database,
  id: string
): Promise<RunnerRecord | null> {
  const row = await db
    .prepare("SELECT * FROM runners WHERE id = ?")
    .bind(id)
    .first<RunnerRecord>();
  return row ?? null;
}

export async function getRunnerByTokenHash(
  db: D1Database,
  tokenHash: string
): Promise<RunnerRecord | null> {
  const row = await db
    .prepare("SELECT * FROM runners WHERE token_hash = ? LIMIT 1")
    .bind(tokenHash)
    .first<RunnerRecord>();
  return row ?? null;
}

export async function listRunnersForProject(
  db: D1Database,
  projectId: string
): Promise<RunnerRecord[]> {
  const { results } = await db
    .prepare(`
      SELECT *
      FROM runners
      WHERE project_id = ?
      ORDER BY datetime(last_heartbeat) DESC, created_at DESC
    `)
    .bind(projectId)
    .all<RunnerRecord>();
  return results;
}

export async function listRunnersForUser(
  db: D1Database,
  userSub: string
): Promise<RunnerRecord[]> {
  const { results } = await db
    .prepare(`
      SELECT runners.*
      FROM runners
      JOIN project_memberships ON project_memberships.project_id = runners.project_id
      WHERE project_memberships.user_sub = ?
      ORDER BY datetime(runners.last_heartbeat) DESC, runners.created_at DESC
    `)
    .bind(userSub)
    .all<RunnerRecord>();
  return results;
}

export async function updateRunnerHeartbeat(
  db: D1Database,
  runnerId: string,
  updates: {
    status: RunnerStatus;
    ip?: string | null;
    version?: string | null;
  }
): Promise<RunnerRecord | null> {
  await db
    .prepare(`
      UPDATE runners
      SET status = ?,
          ip = COALESCE(?, ip),
          version = COALESCE(?, version),
          last_heartbeat = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(updates.status, updates.ip ?? null, updates.version ?? null, runnerId)
    .run();
  return getRunner(db, runnerId);
}

export async function deleteRunner(
  db: D1Database,
  runnerId: string
): Promise<void> {
  await db
    .prepare("DELETE FROM runners WHERE id = ?")
    .bind(runnerId)
    .run();
}

export async function getPoolStatusForUser(
  db: D1Database,
  userSub: string
): Promise<{ total: number; idle: number; busy: number; pending: number }> {
  const counts = await db
    .prepare(`
      SELECT runners.status AS status, COUNT(*) AS count
      FROM runners
      JOIN project_memberships ON project_memberships.project_id = runners.project_id
      WHERE project_memberships.user_sub = ?
      GROUP BY runners.status
    `)
    .bind(userSub)
    .all<{ status: RunnerStatus; count: number | string }>();
  const pendingRow = await db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM jobs
      JOIN project_memberships ON project_memberships.project_id = jobs.project_id
      WHERE project_memberships.user_sub = ? AND jobs.status = 'queued'
    `)
    .bind(userSub)
    .first<{ count: number | string }>();

  const pool = { total: 0, idle: 0, busy: 0, pending: Number(pendingRow?.count ?? 0) };
  for (const row of counts.results) {
    const count = Number(row.count ?? 0);
    pool.total += count;
    if (row.status === "idle") pool.idle += count;
    if (row.status === "busy") pool.busy += count;
  }
  return pool;
}

export async function createJob(
  db: D1Database,
  job: {
    id: string;
    run_id: string | null;
    project_id: string;
    kind: "ci" | "deploy";
    repo: string;
    branch: string;
    sha: string;
    environment?: string | null;
    steps: string[];
    labels: string[];
    payload?: Record<string, unknown>;
  }
): Promise<JobRecord> {
  await db
    .prepare(`
      INSERT INTO jobs (
        id, run_id, project_id, kind, repo, branch, sha, environment,
        status, steps_json, labels_json, payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)
    `)
    .bind(
      job.id,
      job.run_id,
      job.project_id,
      job.kind,
      job.repo,
      job.branch,
      job.sha,
      job.environment ?? null,
      JSON.stringify(job.steps),
      JSON.stringify(job.labels),
      JSON.stringify(job.payload ?? {})
    )
    .run();

  const stored = await getJob(db, job.id);
  if (!stored) throw new Error("failed to create job");
  return stored;
}

export async function getJob(
  db: D1Database,
  jobId: string
): Promise<JobRecord | null> {
  const row = await db
    .prepare("SELECT * FROM jobs WHERE id = ?")
    .bind(jobId)
    .first<JobRecord>();
  return row ?? null;
}

export async function getLatestJobForRun(
  db: D1Database,
  runId: string
): Promise<JobRecord | null> {
  const row = await db
    .prepare(`
      SELECT *
      FROM jobs
      WHERE run_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `)
    .bind(runId)
    .first<JobRecord>();
  return row ?? null;
}

export async function listQueuedJobsForProject(
  db: D1Database,
  projectId: string,
  limit = 25
): Promise<JobRecord[]> {
  const { results } = await db
    .prepare(`
      SELECT *
      FROM jobs
      WHERE project_id = ? AND status = 'queued'
      ORDER BY datetime(created_at) ASC
      LIMIT ?
    `)
    .bind(projectId, limit)
    .all<JobRecord>();
  return results;
}

export async function claimJob(
  db: D1Database,
  jobId: string,
  runnerId: string
): Promise<JobRecord | null> {
  const result = await db
    .prepare(`
      UPDATE jobs
      SET status = 'running',
          runner_id = ?,
          started_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND status = 'queued'
    `)
    .bind(runnerId, jobId)
    .run();
  if ((result.meta?.changes ?? 0) === 0) return null;
  return getJob(db, jobId);
}

export async function updateJobStatus(
  db: D1Database,
  jobId: string,
  updates: {
    status: JobStatus;
    runner_id?: string | null;
    error?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  }
): Promise<JobRecord | null> {
  await db
    .prepare(`
      UPDATE jobs
      SET status = ?,
          runner_id = COALESCE(?, runner_id),
          error = COALESCE(?, error),
          started_at = COALESCE(?, started_at),
          finished_at = COALESCE(?, finished_at),
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(
      updates.status,
      updates.runner_id ?? null,
      updates.error ?? null,
      updates.started_at ?? null,
      updates.finished_at ?? null,
      jobId
    )
    .run();
  return getJob(db, jobId);
}

export async function cancelQueuedJobsForRun(
  db: D1Database,
  runId: string
): Promise<void> {
  await db
    .prepare(`
      UPDATE jobs
      SET status = 'cancelled',
          finished_at = datetime('now'),
          updated_at = datetime('now'),
          error = COALESCE(error, 'Cancelled before execution')
      WHERE run_id = ? AND status = 'queued'
    `)
    .bind(runId)
    .run();
}

export async function migrateDb(db: D1Database): Promise<void> {
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}

function mapProjectMembership(row: ProjectMembershipRow): ProjectMembership {
  return {
    project_id: row.project_id,
    user_sub: row.user_sub,
    login: row.login,
    provider: row.provider,
    role: row.role,
    environments: parseStringArray(row.environments_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDeploymentPolicy(row: DeploymentPolicyRow): DeploymentPolicy {
  return {
    project_id: row.project_id,
    environment: row.environment,
    required_review_approvals: row.required_review_approvals,
    required_manual_approvals: row.required_manual_approvals,
    require_protected_branch: Boolean(row.require_protected_branch),
    require_separation_of_duties: Boolean(row.require_separation_of_duties),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDeploymentRequest(row: DeploymentRequestRow): DeploymentRequest {
  return {
    id: row.id,
    project_id: row.project_id,
    environment: row.environment,
    branch: row.branch,
    sha: row.sha,
    run_id: row.run_id,
    requested_by_sub: row.requested_by_sub,
    requested_by_login: row.requested_by_login,
    executed_by_sub: row.executed_by_sub,
    executed_by_login: row.executed_by_login,
    status: row.status,
    review_count: row.review_count,
    protected_branch: Boolean(row.protected_branch),
    actor_is_author: Boolean(row.actor_is_author),
    tests_passed: Boolean(row.tests_passed),
    secret_leak: Boolean(row.secret_leak),
    has_sbom: Boolean(row.has_sbom),
    policy_reason: row.policy_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}
