// CircleCI bridge HTTP routes — /api/circleci/*. Per-user connection
// metadata lives in KV under `circleci:conn:${sub}:${id}`. Auth is wired
// via requireAuth in api/src/index.ts. Orthogonal to the inbound webhook
// handler at internal/platform/circleci.go. License: Apache-2.0
import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import {
  listCollaborations, listPipelines, getPipeline, getPipelineWorkflows,
  triggerPipeline, circleCIStatusToPushCI, type CircleCIAuth,
} from "./circleci-client";
import { circleCIConfigToPushciYaml } from "./circleci-importer";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

export const circleCIRoutes = new Hono<{ Bindings: Env }>();
const KV_PREFIX = "circleci:conn:";

interface StoredConnection {
  id: string;
  label: string;
  apiToken: string;
  defaultOrgSlug?: string;
  created_at: string;
  updated_at: string;
}

async function authedSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

function redact(conn: StoredConnection) {
  const t = conn.apiToken;
  return {
    id: conn.id, label: conn.label,
    apiTokenPreview: t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "***",
    defaultOrgSlug: conn.defaultOrgSlug,
    created_at: conn.created_at, updated_at: conn.updated_at,
  };
}

const connKey = (sub: string, id: string) => `${KV_PREFIX}${sub}:${id}`;
const toAuth = (c: StoredConnection): CircleCIAuth => ({ apiToken: c.apiToken });

async function loadConn(env: Env, sub: string, id: string): Promise<StoredConnection | null> {
  const raw = await env.RUNNERS.get(connKey(sub, id));
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredConnection; } catch { return null; }
}

/** Auth + load the :id connection. Returns `{sub, conn}` or a JSON Response. */
async function requireConn(c: any): Promise<{ sub: string; conn: StoredConnection } | Response> {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  return { sub, conn };
}

const bridgeError = (c: any, err: unknown, fb = "fetch failed"): Response =>
  c.json({ error: err instanceof Error ? err.message : fb }, 502);

// --- POST /connect ---
circleCIRoutes.post("/connect", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ apiToken?: string; label?: string; defaultOrgSlug?: string }>();
  if (!body.apiToken) return c.json({ error: "apiToken is required" }, 400);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conn: StoredConnection = {
    id, label: body.label ?? "circleci", apiToken: body.apiToken,
    defaultOrgSlug: body.defaultOrgSlug, created_at: now, updated_at: now,
  };
  await c.env.RUNNERS.put(connKey(sub, id), JSON.stringify(conn));
  await auditConnect(c.env, {
    sub,
    provider: "circleci",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    ...(conn.defaultOrgSlug ? { meta: { orgSlug: conn.defaultOrgSlug } } : {}),
  });
  return c.json({ connection: redact(conn) }, 201);
});

// --- GET /connections ---
circleCIRoutes.get("/connections", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const list = await c.env.RUNNERS.list({ prefix: `${KV_PREFIX}${sub}:` });
  const out: StoredConnection[] = [];
  for (const key of list.keys) {
    const raw = await c.env.RUNNERS.get(key.name);
    if (!raw) continue;
    try { out.push(JSON.parse(raw) as StoredConnection); } catch { /* skip */ }
  }
  return c.json({ connections: out.map(redact) });
});

// --- DELETE /connections/:id ---
circleCIRoutes.delete("/connections/:id", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  await c.env.RUNNERS.delete(connKey(r.sub, r.conn.id));
  await auditDisconnect(c.env, {
    sub: r.sub,
    provider: "circleci",
    label: r.conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
  });
  return c.json({ ok: true });
});

// --- GET /connections/:id/collaborations ---
circleCIRoutes.get("/connections/:id/collaborations", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    return c.json({ collaborations: await listCollaborations(toAuth(r.conn)) });
  } catch (err) {
    return bridgeError(c, err);
  }
});

// --- GET /bridge/:id/projects/:slug/pipelines?branch=... ---
circleCIRoutes.get("/bridge/:id/projects/:slug{.+}/pipelines", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  try {
    const result = await listPipelines(c.req.param("slug"), toAuth(r.conn), {
      branch: c.req.query("branch") ?? undefined,
      pageToken: c.req.query("pageToken") ?? undefined,
    });
    return c.json({
      items: result.items.map((p) => ({
        id: p.id, number: p.number, project_slug: p.project_slug,
        status: circleCIStatusToPushCI(p.state), created_at: p.created_at,
        branch: p.vcs?.branch, revision: p.vcs?.revision,
      })),
      nextPageToken: result.next_page_token ?? null,
    });
  } catch (err) { return bridgeError(c, err); }
});

// --- GET /bridge/:id/pipelines/:pipelineId — mirror pipeline + workflows ---
circleCIRoutes.get("/bridge/:id/pipelines/:pipelineId", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  const pid = c.req.param("pipelineId");
  try {
    const [pipeline, workflows] = await Promise.all([
      getPipeline(pid, toAuth(r.conn)),
      getPipelineWorkflows(pid, toAuth(r.conn)),
    ]);
    return c.json({
      id: pipeline.id, number: pipeline.number, project_slug: pipeline.project_slug,
      status: circleCIStatusToPushCI(pipeline.state), created_at: pipeline.created_at,
      workflows: workflows.map((w) => ({
        id: w.id, name: w.name, status: circleCIStatusToPushCI(w.status),
        created_at: w.created_at, stopped_at: w.stopped_at ?? null,
      })),
    });
  } catch (err) { return bridgeError(c, err); }
});

// --- POST /bridge/:id/trigger ---
circleCIRoutes.post("/bridge/:id/trigger", async (c) => {
  const r = await requireConn(c);
  if (r instanceof Response) return r;
  const body = await c.req.json<{
    projectSlug?: string;
    branch?: string;
    tag?: string;
    parameters?: Record<string, string | number | boolean>;
  }>();
  if (!body.projectSlug) return c.json({ error: "projectSlug is required" }, 400);
  try {
    const res = await triggerPipeline(
      body.projectSlug,
      { branch: body.branch, tag: body.tag, parameters: body.parameters },
      toAuth(r.conn)
    );
    return c.json({ triggered: true, pipeline: res });
  } catch (err) {
    return bridgeError(c, err, "trigger failed");
  }
});

// --- POST /import — .circleci/config.yml → .pushci.yml preview ---
circleCIRoutes.post("/import", async (c) => {
  const sub = await authedSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ config?: string }>();
  if (!body.config) return c.json({ error: "config (YAML string) is required" }, 400);
  const { pipeline, yaml } = circleCIConfigToPushciYaml(body.config);
  return c.json({ preview: { pipeline, yaml, source: body.config } });
});
