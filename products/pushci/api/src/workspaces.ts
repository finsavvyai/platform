import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import { getUser, upsertUser } from "./usage";

export const workspaceRoutes = new Hono<{ Bindings: Env }>();

// Create workspace
workspaceRoutes.post("/", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { name } = await c.req.json<{ name: string }>();
  if (!name) return c.json({ error: "name required" }, 400);

  let record = await getUser(c.env.DB, user.sub);
  if (!record) record = await upsertUser(c.env.DB, user.sub, user.login, user.provider);
  if (record.plan !== "team") {
    return c.json({ error: "workspaces require Team plan", upgrade_url: "https://app.pushci.dev/billing" }, 403);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO workspaces (id, name, owner_sub, plan) VALUES (?, ?, ?, ?)"
  ).bind(id, name, user.sub, record.plan).run();

  await c.env.DB.prepare(
    "INSERT INTO workspace_members (workspace_id, user_sub, role) VALUES (?, ?, 'owner')"
  ).bind(id, user.sub).run();

  return c.json({ id, name, owner: user.sub }, 201);
});

// List workspaces for user
workspaceRoutes.get("/", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(`
    SELECT w.id, w.name, w.owner_sub, w.plan, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_sub = ?
    ORDER BY w.created_at DESC
  `).bind(user.sub).all();

  return c.json({ workspaces: results });
});

// Add member to workspace
workspaceRoutes.post("/:id/members", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const wsId = c.req.param("id");
  const owner = await c.env.DB.prepare(
    "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_sub = ?"
  ).bind(wsId, user.sub).first<{ role: string }>();
  if (!owner || !["owner", "admin"].includes(owner.role)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const { user_sub, role } = await c.req.json<{ user_sub: string; role?: string }>();
  if (!user_sub) return c.json({ error: "user_sub required" }, 400);

  const memberCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM workspace_members WHERE workspace_id = ?"
  ).bind(wsId).first<{ cnt: number }>();
  if ((memberCount?.cnt ?? 0) >= 25) {
    return c.json({ error: "workspace member limit reached (25)" }, 403);
  }

  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO workspace_members (workspace_id, user_sub, role) VALUES (?, ?, ?)"
  ).bind(wsId, user_sub, role || "member").run();

  return c.json({ ok: true });
});

// Share runner with workspace
workspaceRoutes.post("/:id/runners", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const wsId = c.req.param("id");
  const { runner_id } = await c.req.json<{ runner_id: string }>();
  if (!runner_id) return c.json({ error: "runner_id required" }, 400);

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO workspace_runners (runner_id, workspace_id) VALUES (?, ?)"
  ).bind(runner_id, wsId).run();

  return c.json({ ok: true });
});

// List workspace runners
workspaceRoutes.get("/:id/runners", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const wsId = c.req.param("id");
  const { results } = await c.env.DB.prepare(`
    SELECT r.id, r.name, r.status, r.os, r.arch, r.last_heartbeat, r.project_id
    FROM runners r
    JOIN workspace_runners wr ON wr.runner_id = r.id
    WHERE wr.workspace_id = ?
    ORDER BY r.last_heartbeat DESC
  `).bind(wsId).all();

  return c.json({ runners: results });
});

// List workspace members
workspaceRoutes.get("/:id/members", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT user_sub, role, created_at FROM workspace_members WHERE workspace_id = ? ORDER BY created_at"
  ).bind(c.req.param("id")).all();

  return c.json({ members: results });
});
