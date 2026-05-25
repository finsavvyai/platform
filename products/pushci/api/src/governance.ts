import { Hono } from "hono";
import { verifyJwt } from "./auth";
import { evaluateDeploymentPolicy } from "./deploy-policy";
import {
  addDeploymentApproval,
  countProjectMemberships,
  createDeploymentRequest,
  countProjectsForUser,
  createProject,
  listAuditLogs,
  defaultDeploymentPolicy,
  getDeploymentPolicy,
  getProjectByRepo,
  getDeploymentRequest,
  getProject,
  getProjectMembership,
  getRunForUser,
  insertRun,
  insertAuditLog,
  listDeploymentPolicies,
  listProjectMemberships,
  upsertDeploymentPolicy,
  upsertProjectMembership,
  updateDeploymentRequestStatus,
} from "./db";
import { queueDeployRun } from "./cloud-runners";
import { getUser, upsertUser } from "./usage";
import {
  canApproveGate,
  canDeploy,
  canManageMemberships,
  canManagePolicies,
  canViewProject,
  isProjectRole,
  normalizeEnvironments,
} from "./project-auth";
import type { Env, JwtPayload, Platform } from "./types";

type Bindings = Env;

export const governanceRoutes = new Hono<{ Bindings: Bindings }>();

governanceRoutes.post("/projects", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ repo?: string; platform?: Platform; webhookSecret?: string }>();
  if (!body.repo || !body.platform) {
    return c.json({ error: "repo and platform are required" }, 400);
  }
  if (!["github", "gitlab", "bitbucket"].includes(body.platform)) {
    return c.json({ error: "unsupported platform" }, 400);
  }

  let userRecord = await getUser(c.env.DB, user.sub);
  if (!userRecord) {
    userRecord = await upsertUser(c.env.DB, user.sub, user.login, user.provider);
  }

  // If the repo is already connected, either return the existing project
  // (idempotent for the owner) or reject with a clear conflict.
  const existing = await getProjectByRepo(c.env.DB, body.repo);
  if (existing) {
    const existingMembership = await getProjectMembership(c.env.DB, existing.id, user.sub);
    if (existingMembership) {
      return c.json({
        project: existing,
        membership: existingMembership,
        webhook_installed: false,
        already_connected: true,
      }, 200);
    }
    return c.json({
      error: "repo_already_connected",
      message: `${body.repo} is already connected by another account. Use "Claim Existing Project Access" if this was set up before governance was enabled.`,
    }, 409);
  }

  let project: Awaited<ReturnType<typeof createProject>>;
  try {
    project = await createProject(c.env.DB, {
      id: crypto.randomUUID(),
      repo: body.repo,
      platform: body.platform,
      webhook_secret: body.webhookSecret || crypto.randomUUID(),
    });
  } catch (err) {
    // Race: another concurrent request created the same repo between the
    // getProjectByRepo check above and this INSERT. Surface a clean 409.
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed|already exists/i.test(message)) {
      return c.json({ error: "repo_already_connected", message: `${body.repo} is already connected.` }, 409);
    }
    throw err;
  }
  const membership = await upsertProjectMembership(c.env.DB, {
    project_id: project.id,
    user_sub: user.sub,
    login: user.login,
    provider: user.provider,
    role: "maintainer",
    environments: [],
  });
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "project.created",
    resource_type: "project",
    resource_id: project.id,
    details_json: JSON.stringify({ repo: project.repo, platform: project.platform }),
  });

  // Auto-install GitHub webhook if we have the user's GitHub token
  let webhookInstalled = false;
  if (body.platform === "github") {
    const userRow = await c.env.DB.prepare("SELECT github_token FROM users WHERE sub = ?")
      .bind(user.sub).first<{ github_token: string | null }>();
    if (userRow?.github_token) {
      try {
        const webhookRes = await fetch(`https://api.github.com/repos/${body.repo}/hooks`, {
          method: "POST",
          headers: {
            Authorization: `token ${userRow.github_token}`,
            "Content-Type": "application/json",
            "User-Agent": "PushCI/1.0",
          },
          body: JSON.stringify({
            name: "web",
            active: true,
            events: ["push", "pull_request"],
            config: {
              url: `https://api.pushci.dev/webhook/github`,
              content_type: "json",
              secret: project.webhook_secret,
              insecure_ssl: "0",
            },
          }),
        });
        webhookInstalled = webhookRes.ok;
      } catch { /* silently fail — user can install manually */ }
    }
  }

  return c.json({ project, membership, webhook_installed: webhookInstalled }, 201);
});

governanceRoutes.post("/projects/bootstrap", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ repo?: string }>();
  if (!body.repo) return c.json({ error: "repo is required" }, 400);

  const project = await getProjectByRepo(c.env.DB, body.repo);
  if (!project) return c.json({ error: "not found" }, 404);

  const membershipCount = await countProjectMemberships(c.env.DB, project.id);
  if (membershipCount > 0) {
    return c.json({ error: "project access is already initialized" }, 409);
  }

  const membership = await upsertProjectMembership(c.env.DB, {
    project_id: project.id,
    user_sub: user.sub,
    login: user.login,
    provider: user.provider,
    role: "maintainer",
    environments: [],
  });
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "project.bootstrap_access",
    resource_type: "project",
    resource_id: project.id,
    details_json: JSON.stringify({ repo: project.repo }),
  });

  return c.json({ project, membership }, 201);
});

governanceRoutes.get("/projects/:projectId/access", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const project = await getProject(c.env.DB, c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, project.id, user.sub);
  if (!canViewProject(membership)) return c.json({ error: "forbidden" }, 403);

  const policies = await effectivePolicies(c.env.DB, project.id);
  return c.json({ project, membership, policies });
});

governanceRoutes.get("/projects/:projectId/memberships", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const access = await requireProjectAccess(c.env.DB, c.req.param("projectId"), user.sub);
  if (!access.project) return c.json({ error: "not found" }, 404);
  if (!canManageMemberships(access.membership)) return c.json({ error: "forbidden" }, 403);

  const memberships = await listProjectMemberships(c.env.DB, access.project.id);
  return c.json({ memberships });
});

governanceRoutes.post("/projects/:projectId/memberships", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const access = await requireProjectAccess(c.env.DB, c.req.param("projectId"), user.sub);
  if (!access.project) return c.json({ error: "not found" }, 404);

  const body = await c.req.json<{
    userSub?: string;
    login?: string;
    provider?: "github" | "gitlab";
    role?: string;
    environments?: string[];
  }>();
  if (!body.userSub || !body.login || !body.provider || !body.role) {
    return c.json({ error: "userSub, login, provider, and role are required" }, 400);
  }
  if (!isProjectRole(body.role)) {
    return c.json({ error: "invalid role" }, 400);
  }

  const membershipCount = await countProjectMemberships(c.env.DB, access.project.id);
  const isBootstrap = membershipCount === 0;

  // Enforce team member limits per plan
  if (!isBootstrap) {
    const MEMBER_LIMITS: Record<string, number> = { free: 1, pro: 1, team: 25 };
    let ownerRecord = await getUser(c.env.DB, user.sub);
    if (!ownerRecord) ownerRecord = await upsertUser(c.env.DB, user.sub, user.login, user.provider);
    const memberLimit = MEMBER_LIMITS[ownerRecord.plan || "free"] ?? 1;
    if (membershipCount >= memberLimit) {
      return c.json({
        error: "member_limit_reached",
        message: `Your ${ownerRecord.plan || "free"} plan allows ${memberLimit} member(s). Upgrade for more.`,
        current: membershipCount,
        limit: memberLimit,
        upgrade_url: "https://app.pushci.dev/billing",
      }, 403);
    }
  }

  if (isBootstrap) {
    if (body.userSub !== user.sub || body.role !== "maintainer") {
      return c.json({ error: "initial bootstrap must grant yourself maintainer" }, 403);
    }
  } else if (!canManageMemberships(access.membership)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const membership = await upsertProjectMembership(c.env.DB, {
    project_id: access.project.id,
    user_sub: body.userSub,
    login: body.login,
    provider: body.provider,
    role: body.role,
    environments: normalizeEnvironments(body.environments),
  });
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: isBootstrap ? "project.bootstrap_access" : "project.membership.upserted",
    resource_type: "project_membership",
    resource_id: `${access.project.id}:${body.userSub}`,
    details_json: JSON.stringify({ role: membership.role, environments: membership.environments }),
  });

  return c.json({ membership }, isBootstrap ? 201 : 200);
});

governanceRoutes.get("/projects/:projectId/policies", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const access = await requireProjectAccess(c.env.DB, c.req.param("projectId"), user.sub);
  if (!access.project) return c.json({ error: "not found" }, 404);
  if (!canViewProject(access.membership)) return c.json({ error: "forbidden" }, 403);

  return c.json({ policies: await effectivePolicies(c.env.DB, access.project.id) });
});

governanceRoutes.put("/projects/:projectId/policies/:environment", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const access = await requireProjectAccess(c.env.DB, c.req.param("projectId"), user.sub);
  if (!access.project) return c.json({ error: "not found" }, 404);
  if (!canManagePolicies(access.membership)) return c.json({ error: "forbidden" }, 403);

  const body = await c.req.json<{
    requiredReviewApprovals?: number;
    requiredManualApprovals?: number;
    requireProtectedBranch?: boolean;
    requireSeparationOfDuties?: boolean;
  }>();
  const policy = await upsertDeploymentPolicy(c.env.DB, {
    project_id: access.project.id,
    environment: c.req.param("environment"),
    required_review_approvals: clampNonNegative(body.requiredReviewApprovals),
    required_manual_approvals: clampNonNegative(body.requiredManualApprovals),
    require_protected_branch: body.requireProtectedBranch === true,
    require_separation_of_duties: body.requireSeparationOfDuties === true,
  });
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "deployment.policy.updated",
    resource_type: "deployment_policy",
    resource_id: `${access.project.id}:${policy.environment}`,
    details_json: JSON.stringify(policy),
  });

  return c.json({ policy });
});

governanceRoutes.post("/projects/:projectId/deploy-requests", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const access = await requireProjectAccess(c.env.DB, c.req.param("projectId"), user.sub);
  if (!access.project) return c.json({ error: "not found" }, 404);

  const body = await c.req.json<{
    environment?: string;
    branch?: string;
    sha?: string;
    runId?: string;
    testsPassed?: boolean;
    reviewCount?: number;
    protectedBranch?: boolean;
    actorIsAuthor?: boolean;
    secretLeak?: boolean;
    hasSBOM?: boolean;
  }>();
  const environment = body.environment?.trim().toLowerCase() || "";
  if (!environment || !body.branch) {
    return c.json({ error: "environment and branch are required" }, 400);
  }
  if (!canDeploy(access.membership, environment)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const run = body.runId ? await getRunForUser(c.env.DB, body.runId, user.sub) : null;
  if (body.runId && !run) {
    return c.json({ error: "run not found" }, 404);
  }
  if (run && run.repo !== access.project.repo) {
    return c.json({ error: "run does not belong to project" }, 400);
  }

  const policy = await getDeploymentPolicy(c.env.DB, access.project.id, environment);
  const evaluation = evaluateDeploymentPolicy(policy, {
    environment,
    testsPassed: run ? run.status === "passed" : body.testsPassed === true,
    reviewCount: Number(body.reviewCount ?? 0),
    protectedBranch: body.protectedBranch === true,
    actorIsAuthor: body.actorIsAuthor === true,
    secretLeak: body.secretLeak === true,
    hasSBOM: body.hasSBOM === true,
  });
  const status = !evaluation.allowed
    ? "blocked"
    : policy.required_manual_approvals > 0
    ? "awaiting_approval"
    : "approved";

  const request = await createDeploymentRequest(c.env.DB, {
    id: crypto.randomUUID(),
    project_id: access.project.id,
    environment,
    branch: body.branch,
    sha: body.sha ?? run?.sha ?? null,
    run_id: body.runId ?? null,
    requested_by_sub: user.sub,
    requested_by_login: user.login,
    status,
    review_count: Number(body.reviewCount ?? 0),
    protected_branch: body.protectedBranch === true,
    actor_is_author: body.actorIsAuthor === true,
    tests_passed: run ? run.status === "passed" : body.testsPassed === true,
    secret_leak: body.secretLeak === true,
    has_sbom: body.hasSBOM === true,
    policy_reason: evaluation.reason || null,
  });

  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: `deployment.request.${status}`,
    resource_type: "deployment_request",
    resource_id: request.id,
    details_json: JSON.stringify({
      environment,
      branch: body.branch,
      runId: body.runId ?? null,
      reason: evaluation.reason || null,
    }),
  });

  return c.json({
    request,
    policy,
    evaluation,
    requiredManualApprovals: policy.required_manual_approvals,
  }, status === "blocked" ? 403 : 201);
});

governanceRoutes.get("/deploy-requests/:requestId", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const request = await getDeploymentRequest(c.env.DB, c.req.param("requestId"));
  if (!request) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, request.project_id, user.sub);
  if (!canViewProject(membership)) return c.json({ error: "forbidden" }, 403);

  const policy = await getDeploymentPolicy(c.env.DB, request.project_id, request.environment);
  return c.json({ request, policy });
});

governanceRoutes.post("/deploy-requests/:requestId/approve", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const request = await getDeploymentRequest(c.env.DB, c.req.param("requestId"));
  if (!request) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, request.project_id, user.sub);
  if (!canApproveGate(membership, request.environment)) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (request.requested_by_sub === user.sub) {
    return c.json({ error: "requester cannot self-approve deployment gate" }, 403);
  }

  const policy = await getDeploymentPolicy(c.env.DB, request.project_id, request.environment);
  if (policy.required_manual_approvals <= 0) {
    return c.json({ error: "manual approval is not required for this environment" }, 400);
  }
  if (request.status === "blocked") {
    return c.json({ error: "blocked request cannot be approved" }, 409);
  }

  const approvalCount = await addDeploymentApproval(c.env.DB, {
    request_id: request.id,
    approver_sub: user.sub,
    approver_login: user.login,
  });
  const nextStatus = approvalCount >= policy.required_manual_approvals ? "approved" : "awaiting_approval";
  const updated = await updateDeploymentRequestStatus(c.env.DB, request.id, nextStatus);

  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "deployment.request.approved",
    resource_type: "deployment_request",
    resource_id: request.id,
    details_json: JSON.stringify({ approvalCount, nextStatus }),
  });

  return c.json({
    request: updated,
    approvalCount,
    requiredApprovals: policy.required_manual_approvals,
  });
});

governanceRoutes.post("/deploy-requests/:requestId/execute", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const request = await getDeploymentRequest(c.env.DB, c.req.param("requestId"));
  if (!request) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, request.project_id, user.sub);
  if (!canDeploy(membership, request.environment)) {
    return c.json({ error: "forbidden" }, 403);
  }
  const project = await getProject(c.env.DB, request.project_id);
  if (!project) return c.json({ error: "not found" }, 404);
  if (request.status !== "approved") {
    return c.json({ error: `deployment request must be approved before execution (current: ${request.status})` }, 409);
  }

  const body: { labels?: string[]; steps?: string[] } = await c.req.json<{ labels?: string[]; steps?: string[] }>().catch(() => ({}));
  const run = request.run_id
    ? await getRunForUser(c.env.DB, request.run_id, user.sub)
    : {
        id: crypto.randomUUID(),
        repo: project.repo,
        branch: request.branch,
        sha: request.sha ?? "deploy",
        status: "pending" as const,
        created_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        duration_ms: null,
        checks_json: null,
      };
  if (!run) return c.json({ error: "run not found" }, 404);
  if (!request.run_id) {
    await insertRun(c.env.DB, run);
  }

  const updated = await updateDeploymentRequestStatus(c.env.DB, request.id, "queued", {
    executed_by_sub: user.sub,
    executed_by_login: user.login,
  });
  const job = await queueDeployRun(c.env, project, run, request, {
    labels: Array.isArray(body.labels) ? body.labels.filter((value: unknown): value is string => typeof value === "string") : [],
    steps: Array.isArray(body.steps) ? body.steps.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0) : undefined,
  });
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "deployment.request.queued",
    resource_type: "deployment_request",
    resource_id: request.id,
    details_json: JSON.stringify({ environment: request.environment, run_id: run.id, job_id: job.id }),
  });

  return c.json({
    request: updated,
    run,
    job,
    message: "Deployment authorization passed and the request is queued for a runner.",
  });
});

async function getCurrentUser(
  c: { req: { header: (name: string) => string | undefined }; env: Env }
): Promise<JwtPayload | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

async function requireProjectAccess(db: D1Database, projectId: string, userSub: string) {
  const project = await getProject(db, projectId);
  const membership = project ? await getProjectMembership(db, projectId, userSub) : null;
  return { project, membership };
}

async function effectivePolicies(db: D1Database, projectId: string) {
  const stored = await listDeploymentPolicies(db, projectId);
  const byEnvironment = new Map(stored.map((policy) => [policy.environment, policy]));
  for (const environment of ["staging", "production"]) {
    if (!byEnvironment.has(environment)) {
      byEnvironment.set(environment, defaultDeploymentPolicy(projectId, environment));
    }
  }
  return [...byEnvironment.values()].sort((a, b) => a.environment.localeCompare(b.environment));
}

// --- Audit log read endpoint ---
governanceRoutes.get("/projects/:projectId/audit-logs", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const access = await requireProjectAccess(c.env.DB, c.req.param("projectId"), user.sub);
  if (!access.project) return c.json({ error: "not found" }, 404);

  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);
  const action = c.req.query("action") || undefined;

  const logs = await listAuditLogs(c.env.DB, access.project.id, { limit, offset, action });
  return c.json({ audit_logs: logs, limit, offset });
});

function clampNonNegative(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.floor(value));
}
