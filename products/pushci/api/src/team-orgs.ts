// Organization management: create, list, members, projects.

import { Hono } from "hono";
import { getAuthUser } from "./team-auth";
import type { Env } from "./types";

type Bindings = Env;
export const teamOrgRoutes = new Hono<{ Bindings: Bindings }>();

// GET /orgs — list user's organizations
teamOrgRoutes.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const orgs = await c.env.DB.prepare(`
    SELECT o.id, o.name, o.slug, o.owner_sub, o.plan, o.domains_json, o.sso_provider, o.created_at,
           om.role as member_role
    FROM organizations o JOIN org_members om ON om.org_id = o.id
    WHERE om.user_sub = ? ORDER BY o.created_at DESC
  `).bind(user.sub).all();

  return c.json({ organizations: orgs.results ?? [] });
});

// POST /orgs — create organization
teamOrgRoutes.post("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ name: string; slug?: string }>();
  if (!body.name) return c.json({ error: "name required" }, 400);

  const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const id = crypto.randomUUID();

  await c.env.DB.prepare("INSERT INTO organizations (id, name, slug, owner_sub) VALUES (?, ?, ?, ?)")
    .bind(id, body.name, slug, user.sub).run();
  await c.env.DB.prepare("INSERT INTO org_members (org_id, user_sub, login, provider, role) VALUES (?, ?, ?, ?, 'owner')")
    .bind(id, user.sub, user.login, user.provider).run();

  return c.json({ id, name: body.name, slug, owner_sub: user.sub }, 201);
});

// POST /orgs/:orgId/projects — add project to org
teamOrgRoutes.post("/:orgId/projects", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const orgId = c.req.param("orgId");
  const member = await c.env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_sub = ?"
  ).bind(orgId, user.sub).first<{ role: string }>();
  if (!member || !["owner", "admin"].includes(member.role)) return c.json({ error: "forbidden" }, 403);

  const body = await c.req.json<{ project_id: string }>();
  if (!body.project_id) return c.json({ error: "project_id required" }, 400);

  await c.env.DB.prepare("INSERT OR IGNORE INTO org_projects (org_id, project_id) VALUES (?, ?)")
    .bind(orgId, body.project_id).run();
  return c.json({ ok: true });
});

// GET /orgs/:orgId/members — list org members + projects
teamOrgRoutes.get("/:orgId/members", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const orgId = c.req.param("orgId");
  const isMember = await c.env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_sub = ?"
  ).bind(orgId, user.sub).first();
  if (!isMember) return c.json({ error: "forbidden" }, 403);

  const members = await c.env.DB.prepare(
    "SELECT user_sub, login, provider, role, created_at FROM org_members WHERE org_id = ? ORDER BY created_at"
  ).bind(orgId).all();
  const projects = await c.env.DB.prepare(`
    SELECT op.project_id, p.repo, p.platform FROM org_projects op
    JOIN projects p ON p.id = op.project_id WHERE op.org_id = ?
  `).bind(orgId).all();

  return c.json({ members: members.results ?? [], projects: projects.results ?? [] });
});

// POST /orgs/:orgId/members — invite to org (auto-adds to org projects)
teamOrgRoutes.post("/:orgId/members", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const orgId = c.req.param("orgId");
  const caller = await c.env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_sub = ?"
  ).bind(orgId, user.sub).first<{ role: string }>();
  if (!caller || !["owner", "admin"].includes(caller.role)) return c.json({ error: "forbidden" }, 403);

  const body = await c.req.json<{ login: string; provider: string; role?: string }>();
  if (!body.login || !body.provider) return c.json({ error: "login and provider required" }, 400);

  const role = body.role && ["admin", "member", "viewer"].includes(body.role) ? body.role : "member";
  const userSub = `${body.provider}:${body.login}`;

  await c.env.DB.prepare(`
    INSERT INTO org_members (org_id, user_sub, login, provider, role) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(org_id, user_sub) DO UPDATE SET role = excluded.role
  `).bind(orgId, userSub, body.login, body.provider, role).run();

  // Auto-add to all org projects as developer
  const orgProjects = await c.env.DB.prepare("SELECT project_id FROM org_projects WHERE org_id = ?").bind(orgId).all();
  for (const op of (orgProjects.results ?? []) as Array<{ project_id: string }>) {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
      VALUES (?, ?, ?, ?, 'developer', '[]')
    `).bind(op.project_id, userSub, body.login, body.provider).run();
  }

  return c.json({ ok: true, login: body.login, role });
});

// DELETE /orgs/:orgId/members/:userSub — remove from org
teamOrgRoutes.delete("/:orgId/members/:userSub", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const orgId = c.req.param("orgId");
  const targetSub = decodeURIComponent(c.req.param("userSub"));

  const caller = await c.env.DB.prepare(
    "SELECT role FROM org_members WHERE org_id = ? AND user_sub = ?"
  ).bind(orgId, user.sub).first<{ role: string }>();
  if (!caller || !["owner", "admin"].includes(caller.role)) return c.json({ error: "forbidden" }, 403);

  await c.env.DB.prepare("DELETE FROM org_members WHERE org_id = ? AND user_sub = ?")
    .bind(orgId, targetSub).run();
  return c.json({ ok: true });
});
