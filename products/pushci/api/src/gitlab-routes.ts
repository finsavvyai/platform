// GitLab poll-bridge routes — mounted at /api/gitlab. Connection meta
// (baseUrl + PAT) in KV under `gitlab:conn:${userSub}:${id}`. Requires
// requireAuth in api/src/index.ts. Complements the webhook-in bridge at
// `internal/platform/gitlab.go`. License: Apache-2.0
import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import { listProjects, listPipelines, getPipeline, listPipelineJobs, triggerPipeline, getRawFile, gitlabStatusToRunStatus, type GitLabAuth } from "./gitlab";
import { gitlabCIToPushciYaml } from "./gitlab-importer";
import { validateForBridge } from "./bridge-url-guard";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;
export const gitlabRoutes = new Hono<{ Bindings: Bindings }>();

const KV_PREFIX = "gitlab:conn:";
const DEFAULT_BASE_URL = "https://gitlab.com";

interface StoredConnection {
  id: string; label: string; baseUrl: string; privateToken: string;
  created_at: string; updated_at: string;
}

async function getUserSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

function redact(c: StoredConnection) {
  const t = c.privateToken;
  const preview = t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "***";
  return { id: c.id, label: c.label, baseUrl: c.baseUrl, privateTokenPreview: preview, created_at: c.created_at, updated_at: c.updated_at };
}

const connKey = (sub: string, id: string) => `${KV_PREFIX}${sub}:${id}`;
const toAuth = (c: StoredConnection): GitLabAuth => ({ privateToken: c.privateToken });

async function loadConn(env: Env, sub: string, id: string): Promise<StoredConnection | null> {
  const raw = await env.RUNNERS.get(connKey(sub, id));
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredConnection; } catch { return null; }
}

async function listConns(env: Env, sub: string): Promise<StoredConnection[]> {
  const list = await env.RUNNERS.list({ prefix: `${KV_PREFIX}${sub}:` });
  const out: StoredConnection[] = [];
  for (const key of list.keys) {
    const raw = await env.RUNNERS.get(key.name);
    if (!raw) continue;
    try { out.push(JSON.parse(raw) as StoredConnection); } catch { /* skip */ }
  }
  return out;
}

// Guard combo: auth + load connection. Returns conn or early JSON response.
async function requireConn(c: any): Promise<StoredConnection | Response> {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  return conn;
}

function badGateway(c: any, err: unknown, fallback: string) {
  return c.json({ error: err instanceof Error ? err.message : fallback }, 502);
}

// --- POST /connect — register a GitLab instance for the user ---
gitlabRoutes.post("/connect", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ baseUrl?: string; privateToken?: string; label?: string }>();
  if (!body.privateToken) return c.json({ error: "privateToken is required" }, 400);
  const rawBase = (body.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const validated = validateForBridge(rawBase, "gitlab", c.env as unknown as Record<string, string | undefined>);
  if (!validated) {
    return c.json({
      error: "baseUrl blocked: must be HTTPS, no credentials, not a private/loopback/metadata address, and on the GitLab allowlist",
      hint: "Self-hosted instances must be allowlisted via PUSHCI_GITLAB_ALLOWED_HOSTS",
    }, 400);
  }
  const baseUrl = validated.origin;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conn: StoredConnection = {
    id,
    label: body.label ?? validated.host,
    baseUrl,
    privateToken: body.privateToken,
    created_at: now,
    updated_at: now,
  };
  await c.env.RUNNERS.put(connKey(sub, id), JSON.stringify(conn));
  await auditConnect(c.env, {
    sub,
    provider: "gitlab",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: { baseUrl },
  });
  return c.json({ connection: redact(conn) }, 201);
});

// --- GET /connections — list the caller's connections ---
gitlabRoutes.get("/connections", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conns = await listConns(c.env, sub);
  return c.json({ connections: conns.map(redact) });
});

// --- DELETE /connections/:id — remove a connection ---
gitlabRoutes.delete("/connections/:id", async (c) => {
  const conn = await requireConn(c);
  if (conn instanceof Response) return conn;
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  await c.env.RUNNERS.delete(connKey(sub, conn.id));
  await auditDisconnect(c.env, {
    sub,
    provider: "gitlab",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
  });
  return c.json({ ok: true });
});

// --- GET /connections/:id/projects — list projects on the instance ---
gitlabRoutes.get("/connections/:id/projects", async (c) => {
  const conn = await requireConn(c);
  if (conn instanceof Response) return conn;
  const search = c.req.query("search") ?? undefined;
  try {
    const projects = await listProjects(conn.baseUrl, toAuth(conn), { search });
    return c.json({
      projects: projects.map((p) => ({ id: p.id, name: p.name, path: p.path_with_namespace, web_url: p.web_url, default_branch: p.default_branch })),
    });
  } catch (err) { return badGateway(c, err, "gitlab fetch failed"); }
});

// --- GET /bridge/:id/projects/:pid/pipelines — recent pipelines (mirror) ---
gitlabRoutes.get("/bridge/:id/projects/:pid/pipelines", async (c) => {
  const conn = await requireConn(c);
  if (conn instanceof Response) return conn;
  const pid = c.req.param("pid");
  const ref = c.req.query("ref") ?? undefined;
  try {
    const pipelines = await listPipelines(conn.baseUrl, pid, toAuth(conn), { ref });
    return c.json({
      pipelines: pipelines.map((p) => ({
        id: p.id, ref: p.ref, sha: p.sha,
        status: gitlabStatusToRunStatus(p.status), raw_status: p.status,
        web_url: p.web_url, created_at: p.created_at, updated_at: p.updated_at,
      })),
    });
  } catch (err) { return badGateway(c, err, "gitlab fetch failed"); }
});

// --- GET /bridge/:id/projects/:pid/pipelines/:plid — one pipeline + jobs ---
gitlabRoutes.get("/bridge/:id/projects/:pid/pipelines/:plid", async (c) => {
  const conn = await requireConn(c);
  if (conn instanceof Response) return conn;
  const pid = c.req.param("pid");
  const plid = c.req.param("plid");
  try {
    const [pipeline, jobs] = await Promise.all([
      getPipeline(conn.baseUrl, pid, plid, toAuth(conn)),
      listPipelineJobs(conn.baseUrl, pid, plid, toAuth(conn)),
    ]);
    return c.json({
      pipeline: {
        id: pipeline.id, status: gitlabStatusToRunStatus(pipeline.status), raw_status: pipeline.status,
        ref: pipeline.ref, sha: pipeline.sha, web_url: pipeline.web_url, duration: pipeline.duration,
      },
      jobs: jobs.map((j) => ({
        id: j.id, name: j.name, stage: j.stage,
        status: gitlabStatusToRunStatus(j.status), raw_status: j.status, duration: j.duration,
      })),
    });
  } catch (err) { return badGateway(c, err, "gitlab fetch failed"); }
});

// --- POST /bridge/:id/projects/:pid/trigger — trigger a pipeline on a ref ---
gitlabRoutes.post("/bridge/:id/projects/:pid/trigger", async (c) => {
  const conn = await requireConn(c);
  if (conn instanceof Response) return conn;
  const pid = c.req.param("pid");
  const body = await c.req.json<{ ref?: string; variables?: Record<string, string> }>();
  if (!body.ref) return c.json({ error: "ref is required" }, 400);
  try {
    const pipeline = await triggerPipeline(conn.baseUrl, pid, body.ref, toAuth(conn), body.variables ?? {});
    return c.json({ triggered: true, pipeline: { id: pipeline.id, web_url: pipeline.web_url, status: gitlabStatusToRunStatus(pipeline.status) } }, 201);
  } catch (err) { return badGateway(c, err, "trigger failed"); }
});

// --- POST /import — fetch .gitlab-ci.yml and return a parsed preview ---
gitlabRoutes.post("/import", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ connectionId?: string; projectId?: number | string; ref?: string; filePath?: string }>();
  if (!body.connectionId || !body.projectId) return c.json({ error: "connectionId and projectId are required" }, 400);
  const conn = await loadConn(c.env, sub, body.connectionId);
  if (!conn) return c.json({ error: "connection not found" }, 404);
  const ref = body.ref ?? "HEAD";
  const filePath = body.filePath ?? ".gitlab-ci.yml";
  try {
    const raw = await getRawFile(conn.baseUrl, body.projectId, filePath, ref, toAuth(conn));
    const { pipeline, yaml } = gitlabCIToPushciYaml(raw);
    return c.json({ preview: { pipeline, yaml, source: raw } });
  } catch (err) { return badGateway(c, err, "import failed"); }
});
