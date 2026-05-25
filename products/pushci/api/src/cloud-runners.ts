import { Hono } from "hono";
import { verifyJwt } from "./auth";
import {
  claimJob,
  consumeRunnerRegistrationToken,
  createJob,
  createRunner,
  createRunnerRegistrationToken,
  deleteRunner,
  getDeploymentRequest,
  getJob,
  getPoolStatusForUser,
  getProject,
  getProjectByRepoForUser,
  getProjectMembership,
  getRun,
  getValidRunnerRegistrationTokenByHash,
  getRunner,
  getRunnerByTokenHash,
  insertAuditLog,
  insertRun,
  listQueuedJobsForProject,
  listRunnersForProject,
  listRunnersForUser,
  updateDeploymentRequestStatus,
  updateJobStatus,
  updateRun,
  updateRunnerHeartbeat,
  recordCloudMinutes,
  getCloudUsageThisMonth,
} from "./db";
import { getUser, upsertUser } from "./usage";
import { canManagePolicies, canTriggerRun, canViewProject } from "./project-auth";
import type {
  DeploymentRequest,
  Env,
  JobRecord,
  JobStatus,
  JwtPayload,
  Platform,
  Project,
  RunnerRecord,
  RunnerStatus,
  Run,
} from "./types";
import { notifyChannels } from "./channel-notify";
import { notifyGerritOnRunComplete } from "./gerrit-callback";
import { sendRunFailedEmail } from "./email";

type Bindings = Env;

const encoder = new TextEncoder();
const runnerOfflineMs = 60_000;

export const cloudRoutes = new Hono<{ Bindings: Bindings }>();
export const runnerProtocolRoutes = new Hono<{ Bindings: Bindings }>();

function parseTimestampMs(value: string): number {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function parseRepoInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("://")) return trimmed.replace(/^\/+/, "");
  try {
    const url = new URL(trimmed);
    return url.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
  } catch {
    return trimmed;
  }
}

function runnerIsOnline(runner: RunnerRecord): boolean {
  return Date.now() - parseTimestampMs(runner.last_heartbeat) < runnerOfflineMs;
}

function effectiveRunnerStatus(runner: RunnerRecord): RunnerStatus {
  return runnerIsOnline(runner) ? runner.status : "offline";
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

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function serializeRunner(runner: RunnerRecord) {
  return {
    id: runner.id,
    project_id: runner.project_id,
    name: runner.name,
    labels: parseStringArray(runner.labels_json),
    os: runner.os,
    arch: runner.arch,
    status: effectiveRunnerStatus(runner),
    ip: runner.ip,
    version: runner.version,
    last_heartbeat: runner.last_heartbeat,
    created_at: runner.created_at,
    updated_at: runner.updated_at,
  };
}

function labelsMatch(job: JobRecord, runner: RunnerRecord): boolean {
  const jobLabels = parseStringArray(job.labels_json);
  if (jobLabels.length === 0) return true;
  const runnerLabels = new Set(parseStringArray(runner.labels_json));
  return jobLabels.every((label) => runnerLabels.has(label));
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mintOpaqueToken(prefix: string): string {
  const parts = [crypto.randomUUID(), crypto.randomUUID().replace(/-/g, "")];
  return `${prefix}_${parts.join("")}`;
}

async function getCurrentUser(
  c: { req: { header: (name: string) => string | undefined }; env: Env }
): Promise<JwtPayload | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

async function authenticateRunner(
  c: { req: { header: (name: string) => string | undefined }; env: Env }
): Promise<RunnerRecord | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const tokenHash = await sha256(token);
  return getRunnerByTokenHash(c.env.DB, tokenHash);
}

async function appendRunLogs(kv: KVNamespace, runId: string, chunk: string): Promise<void> {
  if (!chunk) return;
  const key = `run:logs:${runId}`;
  const current = (await kv.get(key)) ?? "";
  await kv.put(key, `${current}${chunk}`, { expirationTtl: 60 * 60 * 24 * 7 });
}

export async function readRunLogs(kv: KVNamespace, runId: string): Promise<string> {
  return (await kv.get(`run:logs:${runId}`)) ?? "";
}

async function clearRunLogs(kv: KVNamespace, runId: string): Promise<void> {
  await kv.delete(`run:logs:${runId}`);
}

function defaultCiSteps(): string[] {
  return ["pushci run"];
}

function defaultDeploySteps(environment: string): string[] {
  return [`pushci deploy --environment ${environment}`];
}

/** Fetch installed skills for a project and expand to executable steps. */
async function buildSkillSteps(env: Env, projectId: string): Promise<string[]> {
  try {
    const key = `skills:${projectId}`;
    const raw = await env.RUNNERS.get(key);
    if (!raw) return [];

    const skillIds: string[] = JSON.parse(raw);
    if (skillIds.length === 0) return [];

    // Import skill catalog to resolve IDs to step commands
    const { getSkillById } = await import("./skills");
    const steps: string[] = [];

    for (const id of skillIds) {
      const skill = getSkillById(id);
      if (!skill) continue;
      for (const step of skill.steps) {
        steps.push(step.run);
      }
    }
    return steps;
  } catch {
    return [];
  }
}

export async function queueCiRun(
  env: Env,
  project: Project,
  run: Run,
  options?: { labels?: string[]; trigger?: string }
): Promise<JobRecord> {
  // Build steps: default CI + installed skill steps
  const baseSteps = defaultCiSteps();
  const skillSteps = await buildSkillSteps(env, project.id);
  const allSteps = skillSteps.length > 0
    ? [...baseSteps, ...skillSteps]
    : baseSteps;

  return createJob(env.DB, {
    id: crypto.randomUUID(),
    run_id: run.id,
    project_id: project.id,
    kind: "ci",
    repo: project.repo,
    branch: run.branch,
    sha: run.sha,
    steps: allSteps,
    labels: options?.labels ?? [],
    payload: {
      trigger: options?.trigger ?? "push",
      platform: project.platform,
      skill_count: skillSteps.length,
    },
  });
}

export async function queueDeployRun(
  env: Env,
  project: Project,
  run: Run,
  request: DeploymentRequest,
  options?: { labels?: string[]; steps?: string[] }
): Promise<JobRecord> {
  return createJob(env.DB, {
    id: crypto.randomUUID(),
    run_id: run.id,
    project_id: project.id,
    kind: "deploy",
    repo: project.repo,
    branch: request.branch,
    sha: request.sha ?? run.sha,
    environment: request.environment,
    steps: options?.steps ?? defaultDeploySteps(request.environment),
    labels: options?.labels ?? [],
    payload: {
      deploymentRequestId: request.id,
      environment: request.environment,
    },
  });
}

cloudRoutes.post("/provision", async (c) => {
  return c.json({
    error: "Managed runner provisioning is not available in this deployment. Use self-hosted runners.",
  }, 501);
});

cloudRoutes.get("/status", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const runners = (await listRunnersForUser(c.env.DB, user.sub)).map(serializeRunner);
  const pending = (await getPoolStatusForUser(c.env.DB, user.sub)).pending;

  const pool = { total: runners.length, idle: 0, busy: 0, pending };
  for (const runner of runners) {
    if (runner.status === "idle") pool.idle += 1;
    if (runner.status === "busy") pool.busy += 1;
  }

  return c.json({ pool, runners });
});

cloudRoutes.get("/projects/:projectId/runners", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const project = await getProject(c.env.DB, c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, project.id, user.sub);
  if (!canViewProject(membership)) return c.json({ error: "forbidden" }, 403);

  const runners = (await listRunnersForProject(c.env.DB, project.id)).map(serializeRunner);
  return c.json({ project, runners });
});

cloudRoutes.post("/projects/:projectId/runners/registration-token", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const project = await getProject(c.env.DB, c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, project.id, user.sub);
  if (!canManagePolicies(membership)) return c.json({ error: "forbidden" }, 403);

  const body: { expiresInHours?: number } = await c.req.json<{ expiresInHours?: number }>().catch(() => ({}));
  const expiresInHours = Math.min(Math.max(Number(body.expiresInHours ?? 24), 1), 168);
  const rawToken = mintOpaqueToken("preg");
  const token = await createRunnerRegistrationToken(c.env.DB, {
    id: crypto.randomUUID(),
    project_id: project.id,
    token_hash: await sha256(rawToken),
    created_by_sub: user.sub,
    created_by_login: user.login,
    expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
  });

  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "runner.registration_token.created",
    resource_type: "project",
    resource_id: project.id,
    details_json: JSON.stringify({ expires_at: token.expires_at }),
  });

  return c.json({
    token: rawToken,
    expiresAt: token.expires_at,
    project: { id: project.id, repo: project.repo, platform: project.platform },
  }, 201);
});

cloudRoutes.delete("/projects/:projectId/runners/:runnerId", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const project = await getProject(c.env.DB, c.req.param("projectId"));
  if (!project) return c.json({ error: "not found" }, 404);

  const membership = await getProjectMembership(c.env.DB, project.id, user.sub);
  if (!canManagePolicies(membership)) return c.json({ error: "forbidden" }, 403);

  const runner = await getRunner(c.env.DB, c.req.param("runnerId"));
  if (!runner || runner.project_id !== project.id) return c.json({ error: "not found" }, 404);

  await deleteRunner(c.env.DB, runner.id);
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub,
    actor_login: user.login,
    action: "runner.deleted",
    resource_type: "runner",
    resource_id: runner.id,
    details_json: JSON.stringify({ name: runner.name }),
  });
  return c.json({ ok: true });
});

cloudRoutes.post("/run", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    repo?: string;
    repoUrl?: string;
    branch?: string;
    sha?: string;
    labels?: string[];
  }>();
  const repo = parseRepoInput(body.repo ?? body.repoUrl ?? "");
  if (!repo) return c.json({ error: "repo or repoUrl is required" }, 400);

  const project = await getProjectByRepoForUser(c.env.DB, repo, user.sub);
  if (!project) return c.json({ error: "forbidden" }, 403);

  // Enforce role-based access: viewers and auditors cannot trigger runs
  const membership = await getProjectMembership(c.env.DB, project.id, user.sub);
  if (!canTriggerRun(membership)) {
    return c.json({ error: "forbidden", message: "Your role does not allow triggering runs" }, 403);
  }

  const run: Run = {
    id: crypto.randomUUID(),
    repo: project.repo,
    branch: body.branch?.trim() || "main",
    sha: body.sha?.trim() || "manual",
    status: "pending",
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    duration_ms: null,
    checks_json: null,
  };

  await insertRun(c.env.DB, run);
  const job = await queueCiRun(c.env, project, run, { labels: body.labels ?? [], trigger: "manual" });
  await clearRunLogs(c.env.RUNNERS, run.id);

  return c.json({ run, job }, 202);
});

runnerProtocolRoutes.post("/runners/register", async (c) => {
  const body = await c.req.json<{
    registrationToken?: string;
    name?: string;
    labels?: string[];
    os?: string;
    arch?: string;
    version?: string;
  }>();
  if (!body.registrationToken || !body.name || !body.os || !body.arch) {
    return c.json({ error: "registrationToken, name, os, and arch are required" }, 400);
  }

  const registration = await getValidRunnerRegistrationTokenByHash(
    c.env.DB,
    await sha256(body.registrationToken)
  );
  if (!registration) return c.json({ error: "invalid or expired registration token" }, 401);

  const rawRunnerToken = mintOpaqueToken("rtkn");
  const runner = await createRunner(c.env.DB, {
    id: crypto.randomUUID(),
    project_id: registration.project_id,
    name: body.name,
    token_hash: await sha256(rawRunnerToken),
    labels: Array.isArray(body.labels) ? body.labels.filter((value): value is string => typeof value === "string") : [],
    os: body.os,
    arch: body.arch,
    status: "idle",
    ip: c.req.header("cf-connecting-ip") ?? null,
    version: body.version ?? null,
  });
  await consumeRunnerRegistrationToken(c.env.DB, registration.id);

  return c.json({
    runner_id: runner.id,
    project_id: runner.project_id,
    token: rawRunnerToken,
    heartbeat_interval_ms: 30_000,
    poll_interval_ms: 2_000,
  }, 201);
});

runnerProtocolRoutes.post("/runners/:id/heartbeat", async (c) => {
  const runner = await authenticateRunner(c);
  if (!runner || runner.id !== c.req.param("id")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body: { status?: RunnerStatus; version?: string } = await c.req.json<{ status?: RunnerStatus; version?: string }>().catch(() => ({}));
  const status = body.status === "busy" || body.status === "idle" ? body.status : runner.status;
  const updated = await updateRunnerHeartbeat(c.env.DB, runner.id, {
    status,
    ip: c.req.header("cf-connecting-ip") ?? null,
    version: body.version ?? null,
  });

  return c.json({
    ok: true,
    runner: updated ? serializeRunner(updated) : null,
  });
});

runnerProtocolRoutes.get("/runners/:id/next-job", async (c) => {
  const runner = await authenticateRunner(c);
  if (!runner || runner.id !== c.req.param("id")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const queuedJobs = await listQueuedJobsForProject(c.env.DB, runner.project_id, 25);
  for (const queuedJob of queuedJobs) {
    if (!labelsMatch(queuedJob, runner)) continue;

    const claimed = await claimJob(c.env.DB, queuedJob.id, runner.id);
    if (!claimed) continue;

    await updateRunnerHeartbeat(c.env.DB, runner.id, {
      status: "busy",
      ip: c.req.header("cf-connecting-ip") ?? null,
      version: runner.version,
    });

    if (claimed.run_id) {
      await updateRun(c.env.DB, claimed.run_id, {
        status: "running",
        started_at: new Date().toISOString(),
      });
    }

    return c.json({
      job_id: claimed.id,
      run_id: claimed.run_id,
      kind: claimed.kind,
      repo: claimed.repo,
      branch: claimed.branch,
      sha: claimed.sha,
      environment: claimed.environment,
      steps: parseStringArray(claimed.steps_json),
      labels: parseStringArray(claimed.labels_json),
      payload: parsePayload(claimed.payload_json),
    });
  }

  await updateRunnerHeartbeat(c.env.DB, runner.id, {
    status: "idle",
    ip: c.req.header("cf-connecting-ip") ?? null,
    version: runner.version,
  });

  return c.json({ job_id: null });
});

runnerProtocolRoutes.patch("/jobs/:id", async (c) => {
  const runner = await authenticateRunner(c);
  if (!runner) return c.json({ error: "unauthorized" }, 401);

  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  if (job.runner_id && job.runner_id !== runner.id) return c.json({ error: "forbidden" }, 403);

  const body = await c.req.json<{
    status?: JobStatus;
    error?: string;
    checks?: Array<{ name: string; passed: boolean; output: string; duration_ms: number }>;
  }>();
  const nextStatus = body.status;
  if (!nextStatus) return c.json({ error: "status is required" }, 400);

  if (nextStatus === "running") {
    const updatedJob = await updateJobStatus(c.env.DB, job.id, {
      status: "running",
      runner_id: runner.id,
      started_at: new Date().toISOString(),
    });
    await updateRunnerHeartbeat(c.env.DB, runner.id, {
      status: "busy",
      ip: c.req.header("cf-connecting-ip") ?? null,
      version: runner.version,
    });
    if (job.run_id) {
      await updateRun(c.env.DB, job.run_id, {
        status: "running",
        started_at: new Date().toISOString(),
      });
      // Notify channels that run started
      const owner = await c.env.DB.prepare(
        "SELECT user_sub FROM project_memberships WHERE project_id=? AND role IN ('admin','maintainer') LIMIT 1"
      ).bind(job.project_id).first<{ user_sub: string }>();
      if (owner) {
        c.executionCtx.waitUntil(notifyChannels(c.env, owner.user_sub, {
          runId: job.run_id, repo: job.repo, branch: job.branch, status: "running",
        }));
      }
    }
    return c.json({ job: updatedJob });
  }

  const finishedAt = new Date().toISOString();
  const updatedJob = await updateJobStatus(c.env.DB, job.id, {
    status: nextStatus,
    runner_id: runner.id,
    error: body.error ?? null,
    finished_at: finishedAt,
  });
  await updateRunnerHeartbeat(c.env.DB, runner.id, {
    status: "idle",
    ip: c.req.header("cf-connecting-ip") ?? null,
    version: runner.version,
  });

  // Record cloud minutes for usage tracking
  if (job.started_at && job.project_id) {
    const durationMs = Math.max(0, Date.now() - parseTimestampMs(job.started_at));
    const minutes = Math.ceil(durationMs / 60000);
    // Find project owner to charge minutes against
    const membership = await c.env.DB.prepare(
      "SELECT user_sub FROM project_memberships WHERE project_id = ? AND role IN ('admin','maintainer') LIMIT 1"
    ).bind(job.project_id).first<{ user_sub: string }>();
    if (membership) {
      await recordCloudMinutes(c.env.DB, membership.user_sub, job.project_id, job.id, minutes);
    }
  }

  if (job.run_id) {
    const logs = await readRunLogs(c.env.RUNNERS, job.run_id);
    const checks = Array.isArray(body.checks) && body.checks.length > 0
      ? body.checks
      : [{
          name: job.kind === "deploy" ? `deploy/${job.environment ?? "target"}` : "pushci/run",
          passed: nextStatus === "passed",
          output: body.error ?? (logs.slice(-4000) || (nextStatus === "passed" ? "Completed successfully" : "Job failed")),
          duration_ms: job.started_at
            ? Math.max(0, Date.now() - parseTimestampMs(job.started_at))
            : 0,
        }];

    const runStatus: Run["status"] = nextStatus === "passed"
      ? "passed"
      : nextStatus === "cancelled"
      ? "cancelled"
      : "failed";

    const durationMs = job.started_at ? Math.max(0, Date.now() - parseTimestampMs(job.started_at)) : 0;
    await updateRun(c.env.DB, job.run_id, {
      status: runStatus,
      finished_at: finishedAt,
      duration_ms: durationMs,
      checks_json: JSON.stringify(checks),
    });

    // Gerrit Verified label writeback (Stream M)
    try { await notifyGerritOnRunComplete(c.env, job.run_id, runStatus); } catch {}

    // Notify channels of completion
    const runOwner = await c.env.DB.prepare(
      "SELECT user_sub FROM project_memberships WHERE project_id=? AND role IN ('admin','maintainer') LIMIT 1"
    ).bind(job.project_id).first<{ user_sub: string }>();
    if (runOwner) {
      const durStr = durationMs > 0 ? `${Math.round(durationMs / 1000)}s` : undefined;
      c.executionCtx.waitUntil(notifyChannels(c.env, runOwner.user_sub, {
        runId: job.run_id, repo: job.repo, branch: job.branch,
        status: runStatus, duration: durStr, error: body.error,
      }));
      if (runStatus === "failed") {
        const ownerRow = await c.env.DB.prepare(
          "SELECT email FROM users WHERE sub=?"
        ).bind(runOwner.user_sub).first<{ email: string | null }>();
        if (ownerRow?.email) {
          c.executionCtx.waitUntil(sendRunFailedEmail(c.env, ownerRow.email, {
            id: job.run_id, repo: job.repo, branch: job.branch, sha: job.sha ?? "",
          }));
        }
      }
    }
  }

  if (job.kind === "deploy") {
    const payload = parsePayload(job.payload_json);
    const requestId = typeof payload.deploymentRequestId === "string" ? payload.deploymentRequestId : null;
    if (requestId) {
      await updateDeploymentRequestStatus(
        c.env.DB,
        requestId,
        nextStatus === "passed" ? "executed" : "failed",
        { policy_reason: body.error ?? null }
      );
    }
  }

  return c.json({ job: updatedJob });
});

runnerProtocolRoutes.post("/jobs/:id/logs", async (c) => {
  const runner = await authenticateRunner(c);
  if (!runner) return c.json({ error: "unauthorized" }, 401);

  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  if (job.runner_id && job.runner_id !== runner.id) return c.json({ error: "forbidden" }, 403);

  const contentType = c.req.header("content-type") ?? "";
  let chunk = "";
  if (contentType.includes("application/json")) {
    const body: { chunk?: string } = await c.req.json<{ chunk?: string }>().catch(() => ({}));
    chunk = body.chunk ?? "";
  } else {
    chunk = await c.req.text();
  }
  if (!chunk) return c.json({ ok: true, size: 0 });

  if (job.run_id) {
    await appendRunLogs(c.env.RUNNERS, job.run_id, chunk);
  }

  return c.json({ ok: true, size: chunk.length });
});

export async function loadDeployRequestForExecution(
  env: Env,
  requestId: string
): Promise<DeploymentRequest | null> {
  return getDeploymentRequest(env.DB, requestId);
}
