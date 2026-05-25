// Project environment routes — /api/projects/:projectId/environments
//
// CRUD for per-project lifecycle environments (dev/test/staging/
// pre-prod/prod/canary). Access is gated by project membership:
// the authenticated user must appear in `project_memberships` for
// the target project. We do NOT check role permissions here —
// environment config is treated as a project-level read/write and
// any member can mutate it. Tightening to specific roles is a
// follow-up once Stream K (RBAC expansion) lands.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";
import { getProject, getProjectMembership } from "./db";
import {
  listEnvironments,
  getEnvironment,
  upsertEnvironment,
  deleteEnvironment,
  validateEnvironment,
  type EnvKind,
  type ProjectEnvironment,
} from "./project-environments";

export const projectEnvRoutes = new Hono<{ Bindings: Env }>();

async function authedUser(c: {
  req: { header: (n: string) => string | undefined };
  env: Env;
}) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

/**
 * Load a project and verify that the authenticated user has a
 * membership on it. Returns 401 / 403 / 404 responses directly so
 * each route handler can early-return on the error case.
 */
type EnvCtx = {
  req: { header: (n: string) => string | undefined; param: (k: string) => string | undefined };
  env: Env;
  json: (body: unknown, status?: number) => Response;
};

async function requireProjectAccess(
  c: EnvCtx,
): Promise<{ ok: true; userSub: string } | { ok: false; resp: Response }> {
  const user = await authedUser(c);
  if (!user) return { ok: false, resp: c.json({ error: "unauthorized" }, 401) };
  const projectId = c.req.param("projectId") ?? "";
  if (!projectId) return { ok: false, resp: c.json({ error: "project_not_found" }, 404) };
  const project = await getProject(c.env.DB, projectId);
  if (!project) return { ok: false, resp: c.json({ error: "project_not_found" }, 404) };
  const membership = await getProjectMembership(c.env.DB, projectId, user.sub);
  if (!membership) return { ok: false, resp: c.json({ error: "forbidden" }, 403) };
  return { ok: true, userSub: user.sub };
}

function projectIdOf(c: EnvCtx): string {
  return c.req.param("projectId") ?? "";
}

function envIdOf(c: EnvCtx): string {
  return c.req.param("envId") ?? "";
}

projectEnvRoutes.get("/", async (c) => {
  const guard = await requireProjectAccess(c);
  if (!guard.ok) return guard.resp;
  const envs = await listEnvironments(c.env.RUNNERS, projectIdOf(c));
  return c.json({ environments: envs });
});

projectEnvRoutes.get("/:envId", async (c) => {
  const guard = await requireProjectAccess(c);
  if (!guard.ok) return guard.resp;
  const env = await getEnvironment(c.env.RUNNERS, projectIdOf(c), envIdOf(c));
  if (!env) return c.json({ error: "not_found" }, 404);
  return c.json({ environment: env });
});

projectEnvRoutes.post("/", async (c) => {
  const guard = await requireProjectAccess(c);
  if (!guard.ok) return guard.resp;
  let body: Partial<ProjectEnvironment>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const errors = validateEnvironment(body);
  if (errors.length > 0) {
    return c.json({ error: "validation_failed", detail: errors }, 400);
  }
  const env = await upsertEnvironment(c.env.RUNNERS, projectIdOf(c), {
    ...body,
    name: body.name!,
    kind: body.kind as EnvKind,
  });
  return c.json({ environment: env }, 201);
});

projectEnvRoutes.put("/:envId", async (c) => {
  const guard = await requireProjectAccess(c);
  if (!guard.ok) return guard.resp;
  let body: Partial<ProjectEnvironment>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const errors = validateEnvironment(body);
  if (errors.length > 0) {
    return c.json({ error: "validation_failed", detail: errors }, 400);
  }
  const projectId = projectIdOf(c);
  const envId = envIdOf(c);
  const existing = await getEnvironment(c.env.RUNNERS, projectId, envId);
  if (!existing) return c.json({ error: "not_found" }, 404);
  const env = await upsertEnvironment(c.env.RUNNERS, projectId, {
    ...body,
    id: envId,
    name: body.name!,
    kind: body.kind as EnvKind,
  });
  return c.json({ environment: env });
});

projectEnvRoutes.delete("/:envId", async (c) => {
  const guard = await requireProjectAccess(c);
  if (!guard.ok) return guard.resp;
  const removed = await deleteEnvironment(c.env.RUNNERS, projectIdOf(c), envIdOf(c));
  if (!removed) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
