// Core routes: runs, projects, auth, user, internal endpoints.

import { Hono } from "hono";
import type { Env } from "./types";
import { handleWebhook } from "./webhook";
import {
  cancelQueuedJobsForRun, getProject, getProjectByRepo,
  getProjectByRepoForUser, getLatestJobForRun, getRun, getRunForUser,
  insertAuditLog, insertRun, listRuns, listRunsByRepo,
  listRunsForUser, listProjectsForUser, getProjectMembership,
} from "./db";
import { githubOAuth, gitlabOAuth, googleOAuth, linkedinOAuth, facebookOAuth, bitbucketOAuth, microsoftOAuth, verifyJwt, createJwt } from "./auth";
import { queueCiRun, readRunLogs } from "./cloud-runners";
import { canTriggerRun, canCancelRun } from "./project-auth";
import { upsertUser, getUser } from "./usage";
import { getCloudUsageThisMonth } from "./db";

type Bindings = Env;

async function authCheck(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

function serviceAuthCheck(c: { req: { header: (n: string) => string | undefined }; env: Env }): boolean {
  const token = c.req.header("x-service-token")
    ?? (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return Boolean(token && c.env.PUSHCI_SERVICE_TOKEN && token === c.env.PUSHCI_SERVICE_TOKEN);
}

export const coreRoutes = new Hono<{ Bindings: Bindings }>();

coreRoutes.post("/api/telemetry", async (c) => {
  const b = await c.req.json<{ event: string; email_hash?: string; name?: string;
    stacks?: string[]; os?: string; arch?: string; version?: string; repo?: string; timestamp?: string }>();
  if (!b.event) return c.json({ error: "event required" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO telemetry_events (event,email_hash,name,stacks_json,os,arch,cli_version,repo_hash,event_ts) VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(b.event, b.email_hash||null, b.name||null, b.stacks?JSON.stringify(b.stacks):null,
    b.os||null, b.arch||null, b.version||null, b.repo||null, b.timestamp||new Date().toISOString()).run();
  return c.json({ ok: true });
});

coreRoutes.post("/webhook/:platform", async (c) => {
  const platform = c.req.param("platform");
  if (!["github", "gitlab", "bitbucket"].includes(platform))
    return c.json({ error: "unsupported platform" }, 400);
  const rawBody = await c.req.text();
  try {
    const result = await handleWebhook(platform as "github" | "gitlab" | "bitbucket", rawBody, c.req.raw.headers, c.env);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "webhook failed" }, 401);
  }
});

coreRoutes.get("/api/runs", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);
  return c.json({ runs: await listRunsForUser(c.env.DB, user.sub, limit, offset) });
});

coreRoutes.get("/api/runs/:id", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const run = await getRunForUser(c.env.DB, c.req.param("id"), user.sub);
  if (!run) return c.json({ error: "not found" }, 404);
  const logs = await readRunLogs(c.env.RUNNERS, run.id);
  return c.json({ run: { ...run, logs } });
});

coreRoutes.get("/api/runs/:id/logs", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const run = await getRunForUser(c.env.DB, c.req.param("id"), user.sub);
  if (!run) return c.json({ error: "not found" }, 404);
  return c.json({ runId: run.id, logs: await readRunLogs(c.env.RUNNERS, run.id) });
});

coreRoutes.post("/api/runs/:id/rerun", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const original = await getRunForUser(c.env.DB, c.req.param("id"), user.sub);
  if (!original) return c.json({ error: "not found" }, 404);
  const project = await getProjectByRepoForUser(c.env.DB, original.repo, user.sub);
  if (!project) return c.json({ error: "forbidden" }, 403);
  const membership = await getProjectMembership(c.env.DB, project.id, user.sub);
  if (!canTriggerRun(membership)) {
    return c.json({ error: "forbidden", message: "Your role does not allow triggering runs" }, 403);
  }
  const rerun = {
    id: crypto.randomUUID(), repo: original.repo, branch: original.branch,
    sha: original.sha, status: "pending" as const, created_at: new Date().toISOString(),
    started_at: null, finished_at: null, duration_ms: null, checks_json: null,
  };
  await insertRun(c.env.DB, rerun);
  const job = await queueCiRun(c.env, project, rerun, { trigger: "rerun" });
  await insertAuditLog(c.env.DB, {
    actor_sub: user.sub, actor_login: user.login, action: "run.rerun.queued",
    resource_type: "run", resource_id: rerun.id,
    details_json: JSON.stringify({ source_run_id: original.id, job_id: job.id }),
  });
  return c.json({ run: rerun, job }, 202);
});

coreRoutes.post("/api/runs/:id/cancel", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const run = await getRunForUser(c.env.DB, c.req.param("id"), user.sub);
  if (!run) return c.json({ error: "not found" }, 404);
  const cancelProject = await getProjectByRepoForUser(c.env.DB, run.repo, user.sub);
  if (cancelProject) {
    const cancelMembership = await getProjectMembership(c.env.DB, cancelProject.id, user.sub);
    if (!canCancelRun(cancelMembership)) {
      return c.json({ error: "forbidden", message: "Your role does not allow cancelling runs" }, 403);
    }
  }
  await cancelQueuedJobsForRun(c.env.DB, run.id);
  const job = await getLatestJobForRun(c.env.DB, run.id);
  if (!job || job.status === "queued") {
    await insertAuditLog(c.env.DB, { actor_sub: user.sub, actor_login: user.login,
      action: "run.cancelled", resource_type: "run", resource_id: run.id,
      details_json: JSON.stringify({ mode: "queued" }) });
    return c.json({ ok: true });
  }
  await c.env.RUNNERS.put(`run:cancel:${run.id}`, "1", { expirationTtl: 60 * 30 });
  await insertAuditLog(c.env.DB, { actor_sub: user.sub, actor_login: user.login,
    action: "run.cancel.requested", resource_type: "run", resource_id: run.id,
    details_json: JSON.stringify({ job_id: job.id }) });
  return c.json({ ok: true, requested: true });
});

coreRoutes.get("/api/projects", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  return c.json({ projects: await listProjectsForUser(c.env.DB, user.sub) });
});

export const internalRoutes = new Hono<{ Bindings: Bindings }>();

internalRoutes.get("/projects/:id", async (c) => {
  if (!serviceAuthCheck(c)) return c.json({ error: "unauthorized" }, 401);
  const project = await getProject(c.env.DB, c.req.param("id"));
  return project ? c.json({ project }) : c.json({ error: "not found" }, 404);
});

internalRoutes.get("/projects/by-repo", async (c) => {
  if (!serviceAuthCheck(c)) return c.json({ error: "unauthorized" }, 401);
  const repo = c.req.query("repo");
  if (!repo) return c.json({ error: "repo required" }, 400);
  const project = await getProjectByRepo(c.env.DB, repo);
  return project ? c.json({ project }) : c.json({ error: "not found" }, 404);
});

internalRoutes.get("/runs", async (c) => {
  if (!serviceAuthCheck(c)) return c.json({ error: "unauthorized" }, 401);
  const repo = c.req.query("repo");
  const limit = Math.min(Number(c.req.query("limit") ?? "10"), 50);
  return repo
    ? c.json({ runs: await listRunsByRepo(c.env.DB, repo, limit) })
    : c.json({ runs: await listRuns(c.env.DB, limit, 0) });
});

internalRoutes.get("/runs/:id", async (c) => {
  if (!serviceAuthCheck(c)) return c.json({ error: "unauthorized" }, 401);
  const run = await getRun(c.env.DB, c.req.param("id"));
  return run ? c.json({ run }) : c.json({ error: "not found" }, 404);
});

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.post("/github", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await githubOAuth(code, c.env);
    let ghEmail: string | null = null;
    try {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${session.providerToken}`, "User-Agent": "PushCI" },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        ghEmail = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
      }
    } catch {}
    await upsertUser(c.env.DB, `github:${session.user.id}`, session.user.login, "github", ghEmail);
    await c.env.DB.prepare("UPDATE users SET github_token = ? WHERE sub = ?")
      .bind(session.providerToken, `github:${session.user.id}`).run();
    return c.json({ token: session.token, user: session.user });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/github/config", (c) => c.json({ clientId: c.env.GITHUB_CLIENT_ID || "" }));

authRoutes.post("/gitlab", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await gitlabOAuth(code, c.env);
    await upsertUser(c.env.DB, `gitlab:${session.user.id}`, session.user.login, "gitlab");
    return c.json(session);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/gitlab/config", (c) => c.json({
  clientId: c.env.GITLAB_CLIENT_ID || "",
  baseUrl: c.env.GITLAB_BASE_URL || "https://gitlab.com",
}));

authRoutes.post("/google", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await googleOAuth(code, c.env);
    await upsertUser(c.env.DB, `google:${session.user.id}`, session.user.login, "google", session.user.login);
    return c.json(session);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/google/config", (c) => c.json({ clientId: c.env.GOOGLE_CLIENT_ID || "" }));

authRoutes.post("/linkedin", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await linkedinOAuth(code, c.env);
    const lnEmail = session.user.login.includes("@") ? session.user.login : null;
    await upsertUser(c.env.DB, `linkedin:${session.user.id}`, session.user.login, "linkedin", lnEmail);
    return c.json(session);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/linkedin/config", (c) => c.json({ clientId: c.env.LINKEDIN_CLIENT_ID || "" }));

authRoutes.post("/facebook", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await facebookOAuth(code, c.env);
    await upsertUser(c.env.DB, `facebook:${session.user.id}`, session.user.login, "facebook");
    return c.json(session);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/facebook/config", (c) => c.json({ clientId: c.env.FACEBOOK_CLIENT_ID || "" }));

authRoutes.post("/bitbucket", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await bitbucketOAuth(code, c.env);
    await upsertUser(c.env.DB, `bitbucket:${session.user.id}`, session.user.login, "bitbucket");
    return c.json(session);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/bitbucket/config", (c) => c.json({ clientId: c.env.BITBUCKET_CLIENT_ID || "" }));

authRoutes.post("/microsoft", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ error: "code required" }, 400);
  try {
    const session = await microsoftOAuth(code, c.env);
    const msEmail = session.user.login.includes("@") ? session.user.login : null;
    await upsertUser(c.env.DB, `microsoft:${session.user.id}`, session.user.login, "microsoft", msEmail);
    return c.json(session);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "auth failed" }, 500);
  }
});

authRoutes.get("/microsoft/config", (c) => c.json({
  clientId: c.env.MICROSOFT_CLIENT_ID || "",
  baseUrl: c.env.MICROSOFT_TENANT_ID || "common",
}));

authRoutes.get("/cli/token", async (c) => {
  try {
    const user = await authCheck(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const now = Math.floor(Date.now() / 1000);
    const provider = user.provider || "github";
    const cliToken = await createJwt(
      { sub: user.sub, login: user.login, provider, iat: now, exp: now + 86400 * 365 },
      c.env.JWT_SECRET);
    return c.json({ token: cliToken, login: user.login, sub: user.sub });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return c.json({ error: `token generation failed: ${msg}` }, 500);
  }
});

export const userRoutes = new Hono<{ Bindings: Bindings }>();

userRoutes.get("/me", async (c) => {
  const user = await authCheck(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  let record = await getUser(c.env.DB, user.sub);
  if (!record) record = await upsertUser(c.env.DB, user.sub, user.login, user.provider);
  const plan = (record.plan || "free") as "free" | "pro" | "team";
  const aiLimits: Record<string, number> = { free: 0, pro: 100, team: 500 };
  const cloudLimits: Record<string, number> = { free: 0, pro: 500, team: 2000 };
  const cloudUsed = await getCloudUsageThisMonth(c.env.DB, user.sub);
  return c.json({
    sub: record.sub, plan,
    ai_usage: record.ai_usage_count, ai_limit: aiLimits[plan],
    ai_reset_at: record.ai_usage_reset_at,
    cloud_minutes_used: cloudUsed, cloud_minutes_limit: cloudLimits[plan],
  });
});
