// Bitbucket Cloud bridge HTTP routes — mounted at /api/bitbucket.
// Storage helpers live in `bitbucket-conn.ts`; auth wired in index.ts.
// Scope: Bitbucket Cloud (api.bitbucket.org). Server rejected at /connect.
// License: Apache-2.0

import { Hono } from "hono";
import type { Env } from "./types";
import {
  listWorkspaces, listRepos, listPipelines, getPipeline, getPipelineSteps,
  triggerPipeline, getPipelinesYaml, pipelineStatus,
} from "./bitbucket";
import { bitbucketYmlToPushciYaml } from "./bitbucket-importer";
import {
  getUserSub, redact, connKey, loadConn, listConns, toAuth,
  type StoredConnection,
} from "./bitbucket-conn";
import { validateForBridge } from "./bridge-url-guard";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;
export const bitbucketRoutes = new Hono<{ Bindings: Bindings }>();

function err(c: any, status: any, e: unknown, fallback: string) {
  return c.json({ error: e instanceof Error ? e.message : fallback }, status);
}

// --- POST /connect ----------------------------------------------------------
bitbucketRoutes.post("/connect", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    user?: string; appPassword?: string; bearer?: string;
    baseUrl?: string; defaultWorkspace?: string; label?: string;
  }>();

  if (body.baseUrl) {
    const validated = validateForBridge(
      body.baseUrl,
      "bitbucket",
      c.env as unknown as Record<string, string | undefined>,
    );
    if (!validated) {
      return c.json({
        error: "baseUrl blocked: bridge targets Bitbucket Cloud — https://bitbucket.org or https://api.bitbucket.org only",
        hint: "contact hello@pushci.dev for Bitbucket Server support",
      }, 400);
    }
  }
  if (!body.bearer && !(body.user && body.appPassword)) {
    return c.json({ error: "provide either 'bearer' or both 'user' and 'appPassword'" }, 400);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conn: StoredConnection = {
    id,
    label: body.label ?? (body.defaultWorkspace ?? body.user ?? "bitbucket"),
    user: body.user,
    appPassword: body.appPassword,
    bearer: body.bearer,
    defaultWorkspace: body.defaultWorkspace,
    created_at: now,
    updated_at: now,
  };
  await c.env.RUNNERS.put(connKey(sub, id), JSON.stringify(conn));
  await auditConnect(c.env, {
    sub,
    provider: "bitbucket",
    label: conn.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: {
      mode: body.bearer ? "bearer" : "app_password",
      ...(body.defaultWorkspace ? { workspace: body.defaultWorkspace } : {}),
    },
  });
  return c.json({ connection: redact(conn) }, 201);
});

// --- GET /connections -------------------------------------------------------
bitbucketRoutes.get("/connections", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conns = await listConns(c.env, sub);
  return c.json({ connections: conns.map(redact) });
});

// --- DELETE /connections/:id ------------------------------------------------
bitbucketRoutes.delete("/connections/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const existing = await loadConn(c.env, sub, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  await c.env.RUNNERS.delete(connKey(sub, id));
  await auditDisconnect(c.env, {
    sub,
    provider: "bitbucket",
    label: existing.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
  });
  return c.json({ ok: true });
});

// --- GET /connections/:id/workspaces ---------------------------------------
bitbucketRoutes.get("/connections/:id/workspaces", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  try {
    return c.json({ workspaces: await listWorkspaces(toAuth(conn)) });
  } catch (e) {
    return err(c, 502, e, "fetch failed");
  }
});

// --- GET /connections/:id/workspaces/:workspace/repos ----------------------
bitbucketRoutes.get("/connections/:id/workspaces/:workspace/repos", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  try {
    return c.json({ repos: await listRepos(c.req.param("workspace"), toAuth(conn)) });
  } catch (e) {
    return err(c, 502, e, "fetch failed");
  }
});

// --- GET /bridge/:id/:workspace/:repo/pipelines ----------------------------
bitbucketRoutes.get("/bridge/:id/:workspace/:repo/pipelines", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  try {
    const pipelines = await listPipelines(c.req.param("workspace"), c.req.param("repo"), toAuth(conn));
    return c.json({
      pipelines: pipelines.map((p) => ({
        uuid: p.uuid,
        build_number: p.build_number,
        status: pipelineStatus(p),
        created_on: p.created_on,
        duration: p.duration_in_seconds,
        ref: p.target?.ref_name,
        commit: p.target?.commit?.hash,
      })),
    });
  } catch (e) {
    return err(c, 502, e, "fetch failed");
  }
});

// --- GET /bridge/:id/:workspace/:repo/pipelines/:uuid ----------------------
bitbucketRoutes.get("/bridge/:id/:workspace/:repo/pipelines/:uuid", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  const ws = c.req.param("workspace");
  const repo = c.req.param("repo");
  const uuid = c.req.param("uuid");
  try {
    const [pipeline, steps] = await Promise.all([
      getPipeline(ws, repo, uuid, toAuth(conn)),
      getPipelineSteps(ws, repo, uuid, toAuth(conn)),
    ]);
    return c.json({
      pipeline: { ...pipeline, normalized_status: pipelineStatus(pipeline) },
      steps,
    });
  } catch (e) {
    return err(c, 502, e, "fetch failed");
  }
});

// --- POST /bridge/:id/:workspace/:repo/trigger -----------------------------
bitbucketRoutes.post("/bridge/:id/:workspace/:repo/trigger", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const conn = await loadConn(c.env, sub, c.req.param("id"));
  if (!conn) return c.json({ error: "connection not found" }, 404);
  type TriggerBody = { ref?: string; refType?: "branch" | "tag" };
  const body = await c.req.json<TriggerBody>().catch(() => ({} as TriggerBody));
  try {
    const triggered = await triggerPipeline(
      c.req.param("workspace"),
      c.req.param("repo"),
      body.ref ?? "main",
      toAuth(conn),
      body.refType ?? "branch"
    );
    return c.json({ triggered: true, pipeline: triggered });
  } catch (e) {
    return err(c, 502, e, "trigger failed");
  }
});

// --- POST /import — bitbucket-pipelines.yml → .pushci.yml ------------------
bitbucketRoutes.post("/import", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ connectionId?: string; workspace?: string; repo?: string; ref?: string }>();
  if (!body.connectionId || !body.workspace || !body.repo) {
    return c.json({ error: "connectionId, workspace, repo are required" }, 400);
  }
  const conn = await loadConn(c.env, sub, body.connectionId);
  if (!conn) return c.json({ error: "connection not found" }, 404);
  try {
    const source = await getPipelinesYaml(body.workspace, body.repo, body.ref ?? "HEAD", toAuth(conn));
    const { pipeline, yaml } = bitbucketYmlToPushciYaml(source);
    return c.json({ preview: { pipeline, yaml, source } });
  } catch (e) {
    return err(c, 502, e, "import failed");
  }
});
