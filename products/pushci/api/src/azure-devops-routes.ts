// Azure DevOps bridge HTTP routes — mounted at /api/azure-devops.
//
// Stores per-user Azure DevOps connection metadata (org + PAT) in KV
// via azure-devops-storage.ts. Requires requireAuth middleware, wired
// in api/src/index.ts. Complementary to the inbound webhook parser at
// internal/platform/azure.go — this module is the OUTBOUND poll/mirror.
//
// License: Apache-2.0

import { Hono } from "hono";
import type { Env } from "./types";
import {
  listProjects,
  listPipelines,
  listRuns,
  getRun,
  runPipeline,
  getPipeline,
  azureStatus,
  trimBaseUrl,
} from "./azure-devops";
import { azurePipelineToPushciYaml } from "./azure-devops-importer";
import {
  getUserSub,
  redact,
  connKey,
  loadConn,
  listConns,
  toAuth,
  type StoredConnection,
} from "./azure-devops-storage";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;
export const azureDevOpsRoutes = new Hono<{ Bindings: Bindings }>();

// --- POST /connect ------------------------------------------------------
azureDevOpsRoutes.post("/connect", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ org?: string; pat?: string; label?: string }>();
  if (!body.org || !body.pat) return c.json({ error: "org and pat are required" }, 400);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const orgSlug = trimBaseUrl(body.org);
  const conn: StoredConnection = {
    id,
    label: body.label ?? orgSlug,
    org: orgSlug,
    pat: body.pat,
    created_at: now,
    updated_at: now,
  };
  await c.env.RUNNERS.put(connKey(sub, id), JSON.stringify(conn));
  await auditConnect(c.env, {
    sub,
    provider: "azure-devops",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: { org: conn.org },
  });
  return c.json({ connection: redact(conn) }, 201);
});

// --- GET /connections ---------------------------------------------------
azureDevOpsRoutes.get("/connections", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conns = await listConns(c.env, sub);
  return c.json({ connections: conns.map(redact) });
});

// --- DELETE /connections/:id -------------------------------------------
azureDevOpsRoutes.delete("/connections/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const existing = await loadConn(c.env, sub, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  await c.env.RUNNERS.delete(connKey(sub, id));
  await auditDisconnect(c.env, {
    sub,
    provider: "azure-devops",
    label: existing.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
  });
  return c.json({ ok: true });
});

// --- GET /connections/:id/projects -------------------------------------
azureDevOpsRoutes.get("/connections/:id/projects", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  try {
    const projects = await listProjects(conn.org, toAuth(conn));
    return c.json({ projects });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "azure fetch failed" }, 502);
  }
});

// --- GET /connections/:id/projects/:project/pipelines -------------------
azureDevOpsRoutes.get("/connections/:id/projects/:project/pipelines", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  try {
    const pipelines = await listPipelines(conn.org, c.req.param("project"), toAuth(conn));
    return c.json({ pipelines });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "azure fetch failed" }, 502);
  }
});

// --- GET /bridge/:id/:project/:pipelineId/runs — mirror recent runs -----
azureDevOpsRoutes.get("/bridge/:id/:project/:pipelineId/runs", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  const pid = Number(c.req.param("pipelineId"));
  if (!Number.isFinite(pid)) return c.json({ error: "pipelineId must be numeric" }, 400);
  try {
    const runs = await listRuns(conn.org, c.req.param("project"), pid, toAuth(conn));
    return c.json({
      runs: runs.map((r) => ({
        id: r.id,
        name: r.name,
        status: azureStatus(r.state, r.result),
        createdDate: r.createdDate,
        finishedDate: r.finishedDate,
        url: r.url,
      })),
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "azure fetch failed" }, 502);
  }
});

// --- GET /bridge/:id/:project/:pipelineId/runs/:runId -------------------
azureDevOpsRoutes.get("/bridge/:id/:project/:pipelineId/runs/:runId", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  const pid = Number(c.req.param("pipelineId"));
  const rid = Number(c.req.param("runId"));
  if (!Number.isFinite(pid) || !Number.isFinite(rid)) {
    return c.json({ error: "pipelineId and runId must be numeric" }, 400);
  }
  try {
    const run = await getRun(conn.org, c.req.param("project"), pid, rid, toAuth(conn));
    return c.json({ run: { ...run, pushciStatus: azureStatus(run.state, run.result) } });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "azure fetch failed" }, 502);
  }
});

// --- POST /bridge/:id/:project/:pipelineId/run — trigger a run ----------
azureDevOpsRoutes.post("/bridge/:id/:project/:pipelineId/run", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  const pid = Number(c.req.param("pipelineId"));
  if (!Number.isFinite(pid)) return c.json({ error: "pipelineId must be numeric" }, 400);
  const body = await c.req.json<{
    refName?: string;
    variables?: Record<string, { value: string; isSecret?: boolean }>;
  }>();
  try {
    const run = await runPipeline(conn.org, c.req.param("project"), pid, body, toAuth(conn));
    return c.json({ triggered: true, run });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "trigger failed" }, 502);
  }
});

// --- POST /import — inline YAML body → pushci.yml preview ---------------
azureDevOpsRoutes.post("/import", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{
    connectionId?: string;
    project?: string;
    pipelineId?: number;
    yaml?: string;
  }>();
  if (!body.connectionId || !body.project) {
    return c.json({ error: "connectionId and project are required" }, 400);
  }
  const conn = await loadConn(c.env, sub, body.connectionId);
  if (!conn) return c.json({ error: "connection not found" }, 404);
  // If the client pasted raw YAML, skip the REST hop — /pipelines doesn't
  // return the inline definition anyway, so inline upload is the primary path.
  if (body.yaml) {
    const { doc, yaml } = azurePipelineToPushciYaml(body.yaml);
    return c.json({ preview: { doc, yaml } });
  }
  if (!body.pipelineId) return c.json({ error: "pipelineId or yaml required" }, 400);
  try {
    const detail = await getPipeline(conn.org, body.project, body.pipelineId, toAuth(conn));
    return c.json({
      detail,
      hint: "Azure does not return raw YAML via /pipelines; POST the file contents as `yaml`.",
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "import failed" }, 502);
  }
});
