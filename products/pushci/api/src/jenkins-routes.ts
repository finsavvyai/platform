// Jenkins bridge HTTP routes — mounted at /api/jenkins.
//
// Stores per-user Jenkins connection metadata (baseUrl, basic-auth
// credentials) in KV under `jenkins:conn:${userSub}:${id}`. Requires the
// caller to go through `requireAuth` middleware, which is wired up in
// api/src/index.ts.
//
// License: Apache-2.0

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import {
  getJob,
  listJobs,
  getBuild,
  getCrumb,
  triggerBuild,
  getConfigXml,
  extractScriptFromConfigXml,
  jenkinsColorToStatus,
  type JenkinsAuth,
} from "./jenkins";
import { jenkinsfileToPushciYaml } from "./jenkins-importer";
import { validateForBridge } from "./bridge-url-guard";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;

export const jenkinsRoutes = new Hono<{ Bindings: Bindings }>();

const KV_PREFIX = "jenkins:conn:";

interface StoredConnection {
  id: string;
  label: string;
  baseUrl: string;
  user: string;
  apiToken: string; // stored as-is for now; KV is tenant-scoped
  created_at: string;
  updated_at: string;
}

interface RedactedConnection {
  id: string;
  label: string;
  baseUrl: string;
  user: string;
  apiTokenPreview: string;
  created_at: string;
  updated_at: string;
}

async function getUserSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

function redact(conn: StoredConnection): RedactedConnection {
  const t = conn.apiToken;
  const preview = t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "***";
  return {
    id: conn.id,
    label: conn.label,
    baseUrl: conn.baseUrl,
    user: conn.user,
    apiTokenPreview: preview,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  };
}

function connKey(sub: string, id: string): string {
  return `${KV_PREFIX}${sub}:${id}`;
}

async function loadConn(env: Env, sub: string, id: string): Promise<StoredConnection | null> {
  const raw = await env.RUNNERS.get(connKey(sub, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredConnection;
  } catch {
    return null;
  }
}

async function listConns(env: Env, sub: string): Promise<StoredConnection[]> {
  const prefix = `${KV_PREFIX}${sub}:`;
  const list = await env.RUNNERS.list({ prefix });
  const out: StoredConnection[] = [];
  for (const key of list.keys) {
    const raw = await env.RUNNERS.get(key.name);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as StoredConnection);
    } catch {
      // skip malformed entries
    }
  }
  return out;
}

function toAuth(conn: StoredConnection): JenkinsAuth {
  return { user: conn.user, apiToken: conn.apiToken };
}

// --- POST /connect — register a new Jenkins instance for the user ---
jenkinsRoutes.post("/connect", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ baseUrl?: string; user?: string; apiToken?: string; label?: string }>();
  if (!body.baseUrl || !body.user || !body.apiToken) {
    return c.json({ error: "baseUrl, user, apiToken are required" }, 400);
  }
  const validated = validateForBridge(
    body.baseUrl.replace(/\/+$/, ""),
    "jenkins",
    c.env as unknown as Record<string, string | undefined>,
  );
  if (!validated) {
    return c.json({
      error: "baseUrl blocked: must be HTTPS, no credentials, not a private/loopback/metadata address, and on the Jenkins allowlist",
      hint: "Self-hosted deployments must set PUSHCI_JENKINS_ALLOWED_HOSTS",
    }, 400);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conn: StoredConnection = {
    id,
    label: body.label ?? validated.host,
    baseUrl: validated.origin,
    user: body.user,
    apiToken: body.apiToken,
    created_at: now,
    updated_at: now,
  };
  await c.env.RUNNERS.put(connKey(sub, id), JSON.stringify(conn));
  await auditConnect(c.env, {
    sub,
    provider: "jenkins",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: { baseUrl: conn.baseUrl, user: conn.user },
  });
  return c.json({ connection: redact(conn) }, 201);
});

// --- GET /connections — list all connections for the user ---
jenkinsRoutes.get("/connections", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const conns = await listConns(c.env, sub);
  return c.json({ connections: conns.map(redact) });
});

// --- DELETE /connections/:id — remove a connection ---
jenkinsRoutes.delete("/connections/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const id = c.req.param("id");
  const existing = await loadConn(c.env, sub, id);
  if (!existing) return c.json({ error: "not found" }, 404);

  await c.env.RUNNERS.delete(connKey(sub, id));
  await auditDisconnect(c.env, {
    sub,
    provider: "jenkins",
    label: existing.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
  });
  return c.json({ ok: true });
});

// --- GET /connections/:id/jobs — list jobs on the Jenkins instance ---
jenkinsRoutes.get("/connections/:id/jobs", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const id = c.req.param("id");
  const conn = await loadConn(c.env, sub, id);
  if (!conn) return c.json({ error: "connection not found" }, 404);

  try {
    const jobs = await listJobs(conn.baseUrl, toAuth(conn));
    return c.json({
      jobs: jobs.map((j) => ({
        name: j.name,
        url: j.url,
        status: jenkinsColorToStatus(j.color),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "jenkins fetch failed";
    return c.json({ error: msg }, 502);
  }
});

// --- POST /import — fetch config.xml and return a parsed .pushci.yml preview
jenkinsRoutes.post("/import", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ connectionId?: string; jobName?: string }>();
  if (!body.connectionId || !body.jobName) {
    return c.json({ error: "connectionId and jobName are required" }, 400);
  }

  const conn = await loadConn(c.env, sub, body.connectionId);
  if (!conn) return c.json({ error: "connection not found" }, 404);

  try {
    const xml = await getConfigXml(conn.baseUrl, body.jobName, toAuth(conn));
    const script = extractScriptFromConfigXml(xml);
    if (!script) {
      return c.json(
        {
          error: "jenkinsfile not inline — job is SCM-backed",
          hint: "Open the Jenkinsfile from the repository directly.",
        },
        422
      );
    }
    const { pipeline, yaml } = jenkinsfileToPushciYaml(script);
    return c.json({ preview: { pipeline, yaml, source: script } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "import failed";
    return c.json({ error: msg }, 502);
  }
});

// --- POST /bridge/:id/build — trigger a parameterised build on Jenkins ---
jenkinsRoutes.post("/bridge/:id/build", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const id = c.req.param("id");
  const conn = await loadConn(c.env, sub, id);
  if (!conn) return c.json({ error: "connection not found" }, 404);

  const body = await c.req.json<{ jobName?: string; params?: Record<string, string> }>();
  if (!body.jobName) return c.json({ error: "jobName is required" }, 400);

  try {
    const crumb = await getCrumb(conn.baseUrl, toAuth(conn));
    const result = await triggerBuild(
      conn.baseUrl,
      body.jobName,
      body.params ?? {},
      toAuth(conn),
      crumb ?? undefined
    );
    return c.json({ triggered: true, queueUrl: result.queueUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "trigger failed";
    return c.json({ error: msg }, 502);
  }
});

// --- GET /bridge/:id/jobs/:job — fetch current job status (mirror) ---
jenkinsRoutes.get("/bridge/:id/jobs/:job", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const id = c.req.param("id");
  const job = c.req.param("job");
  const conn = await loadConn(c.env, sub, id);
  if (!conn) return c.json({ error: "connection not found" }, 404);

  try {
    const info = await getJob(conn.baseUrl, job, toAuth(conn));
    return c.json({
      name: info.name,
      status: jenkinsColorToStatus(info.color),
      lastBuild: info.lastBuild,
      lastSuccessfulBuild: info.lastSuccessfulBuild,
      lastFailedBuild: info.lastFailedBuild,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "jenkins fetch failed";
    return c.json({ error: msg }, 502);
  }
});

// --- GET /bridge/:id/jobs/:job/builds/:buildId — fetch a specific build ---
jenkinsRoutes.get("/bridge/:id/jobs/:job/builds/:buildId", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const id = c.req.param("id");
  const job = c.req.param("job");
  const buildId = c.req.param("buildId");
  const conn = await loadConn(c.env, sub, id);
  if (!conn) return c.json({ error: "connection not found" }, 404);

  try {
    const info = await getBuild(conn.baseUrl, job, buildId, toAuth(conn));
    return c.json({
      id: info.id,
      number: info.number,
      result: info.result,
      building: info.building,
      duration: info.duration,
      timestamp: info.timestamp,
      url: info.url,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "jenkins fetch failed";
    return c.json({ error: msg }, 502);
  }
});
