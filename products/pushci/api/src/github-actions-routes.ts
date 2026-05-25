// GitHub Actions poll bridge — mounted at /api/github-actions.
// Mirrors runs from cloud github.com runners into the PushCI dashboard
// so DORA metrics, status cards, and zero-commit trials stay unified
// across every CI provider we support. Orthogonal to
// internal/platform/github.go (webhook-in) and internal/actions/ (local
// act runner). requireAuth is wired in api/src/index.ts.
// License: Apache-2.0

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "./types";
import {
  listRepos, listWorkflows, listRuns, getRun, listJobs,
  dispatchWorkflow, rerunRun, cancelRun, githubStatusToPushCI,
} from "./github-actions-client";
import {
  getUserSub, redact, connKey, loadConn, listConns, toAuth,
  type StoredConnection,
} from "./github-actions-storage";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;
type GhCtx = Context<{ Bindings: Bindings }>;
export const githubActionsRoutes = new Hono<{ Bindings: Bindings }>();

const bridgeError = (c: GhCtx, err: unknown, fb = "github fetch failed") =>
  c.json({ error: err instanceof Error ? err.message : fb }, 502);

async function requireConn(
  c: GhCtx
): Promise<{ sub: string; conn: StoredConnection } | Response> {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "connection id is required" }, 400);
  const conn = await loadConn(c.env, sub, id);
  if (!conn) return c.json({ error: "connection not found" }, 404);
  return { sub, conn };
}

// --- POST /connect ---
githubActionsRoutes.post("/connect", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ token?: string; label?: string; login?: string }>();
  if (!body.token) return c.json({ error: "token is required" }, 400);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conn: StoredConnection = {
    id,
    label: body.label ?? body.login ?? "github",
    login: body.login,
    token: body.token,
    created_at: now,
    updated_at: now,
  };
  await c.env.RUNNERS.put(connKey(sub, id), JSON.stringify(conn));
  await auditConnect(c.env, {
    sub,
    provider: "github-actions",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    ...(conn.login ? { meta: { login: conn.login } } : {}),
  });
  return c.json({ connection: redact(conn) }, 201);
});

// --- GET /connections ---
githubActionsRoutes.get("/connections", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conns = await listConns(c.env, sub);
  return c.json({ connections: conns.map(redact) });
});

// --- DELETE /connections/:id ---
githubActionsRoutes.delete("/connections/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const existing = await loadConn(c.env, sub, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  await c.env.RUNNERS.delete(connKey(sub, id));
  await auditDisconnect(c.env, {
    sub,
    provider: "github-actions",
    label: existing.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
  });
  return c.json({ ok: true });
});

// --- GET /connections/:id/repos?search= ---
githubActionsRoutes.get("/connections/:id/repos", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    const repos = await listRepos(toAuth(r.conn), {
      search: c.req.query("search") ?? undefined,
    });
    return c.json({
      repos: repos.map((rp) => ({
        id: rp.id, name: rp.name, full_name: rp.full_name,
        owner: rp.owner.login, private: rp.private,
        default_branch: rp.default_branch, html_url: rp.html_url,
      })),
    });
  } catch (err) { return bridgeError(c, err); }
});

// --- GET /bridge/:id/:owner/:repo/workflows ---
githubActionsRoutes.get("/bridge/:id/:owner/:repo/workflows", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    const wfs = await listWorkflows(c.req.param("owner"), c.req.param("repo"), toAuth(r.conn));
    return c.json({ workflows: wfs });
  } catch (err) { return bridgeError(c, err); }
});

// --- GET /bridge/:id/:owner/:repo/runs?workflowId=&branch= ---
githubActionsRoutes.get("/bridge/:id/:owner/:repo/runs", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    const runs = await listRuns(
      c.req.param("owner"), c.req.param("repo"), toAuth(r.conn),
      {
        workflowId: c.req.query("workflowId") ?? undefined,
        branch: c.req.query("branch") ?? undefined,
      }
    );
    return c.json({
      runs: runs.map((run) => ({
        id: run.id, run_number: run.run_number, event: run.event,
        name: run.name ?? null, workflow_id: run.workflow_id,
        status: githubStatusToPushCI(run.status, run.conclusion),
        head_branch: run.head_branch, head_sha: run.head_sha,
        html_url: run.html_url, created_at: run.created_at,
        updated_at: run.updated_at,
      })),
    });
  } catch (err) { return bridgeError(c, err); }
});

// --- GET /bridge/:id/:owner/:repo/runs/:runId — run + jobs ---
githubActionsRoutes.get("/bridge/:id/:owner/:repo/runs/:runId", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  const owner = c.req.param("owner"); const repo = c.req.param("repo");
  const runId = c.req.param("runId");
  try {
    const [run, jobs] = await Promise.all([
      getRun(owner, repo, runId, toAuth(r.conn)),
      listJobs(owner, repo, runId, toAuth(r.conn)),
    ]);
    return c.json({
      run: { ...run, pushciStatus: githubStatusToPushCI(run.status, run.conclusion) },
      jobs: jobs.map((j) => ({
        id: j.id, name: j.name, run_id: j.run_id,
        status: githubStatusToPushCI(j.status, j.conclusion),
        started_at: j.started_at, completed_at: j.completed_at,
        html_url: j.html_url, steps: j.steps ?? [],
      })),
    });
  } catch (err) { return bridgeError(c, err); }
});

// --- POST /bridge/:id/:owner/:repo/dispatch ---
githubActionsRoutes.post("/bridge/:id/:owner/:repo/dispatch", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  const body = await c.req.json<{
    workflowId?: number | string; ref?: string; inputs?: Record<string, string>;
  }>();
  if (!body.workflowId || !body.ref) {
    return c.json({ error: "workflowId and ref are required" }, 400);
  }
  try {
    const res = await dispatchWorkflow(
      c.req.param("owner"), c.req.param("repo"), body.workflowId,
      { ref: body.ref, inputs: body.inputs }, toAuth(r.conn)
    );
    return c.json({ dispatched: true, ...res });
  } catch (err) { return bridgeError(c, err, "dispatch failed"); }
});

// --- POST /bridge/:id/:owner/:repo/runs/:runId/rerun ---
githubActionsRoutes.post("/bridge/:id/:owner/:repo/runs/:runId/rerun", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    await rerunRun(c.req.param("owner"), c.req.param("repo"), c.req.param("runId"), toAuth(r.conn));
    return c.json({ rerun: true });
  } catch (err) { return bridgeError(c, err, "rerun failed"); }
});

// --- POST /bridge/:id/:owner/:repo/runs/:runId/cancel ---
githubActionsRoutes.post("/bridge/:id/:owner/:repo/runs/:runId/cancel", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    await cancelRun(c.req.param("owner"), c.req.param("repo"), c.req.param("runId"), toAuth(r.conn));
    return c.json({ cancelled: true });
  } catch (err) { return bridgeError(c, err, "cancel failed"); }
});
