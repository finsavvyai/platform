// Team management: invite members, list team, remove.

import { Hono } from "hono";
import { getUser } from "./usage";
import { getAuthUser } from "./team-auth";
import { teamSsoRoutes } from "./team-sso";
import { teamOrgRoutes } from "./team-orgs";
import type { Env } from "./types";

type Bindings = Env;
export const teamRoutes = new Hono<{ Bindings: Bindings }>();

// Mount sub-routes
teamRoutes.route("/", teamSsoRoutes);
teamRoutes.route("/orgs", teamOrgRoutes);

// GET /api/team — list all members across user's projects
teamRoutes.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const members = await c.env.DB.prepare(`
    SELECT pm.project_id, pm.user_sub, pm.login, pm.provider, pm.role,
           pm.environments_json, pm.created_at, p.repo
    FROM project_memberships pm
    JOIN projects p ON p.id = pm.project_id
    WHERE pm.project_id IN (
      SELECT project_id FROM project_memberships WHERE user_sub = ?
    )
    ORDER BY pm.created_at DESC
  `).bind(user.sub).all();

  return c.json({ members: members.results ?? [] });
});

// POST /api/team/invite — invite by GitHub/GitLab username
teamRoutes.post("/invite", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    login: string;
    provider: "github" | "gitlab";
    project_id: string;
    role?: string;
  }>();
  if (!body.login || !body.provider || !body.project_id) {
    return c.json({ error: "login, provider, and project_id required" }, 400);
  }

  // Verify caller is maintainer/admin
  const callerMembership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(body.project_id, user.sub).first<{ role: string }>();
  if (!callerMembership || !["maintainer", "admin"].includes(callerMembership.role)) {
    return c.json({ error: "forbidden — must be maintainer or admin" }, 403);
  }

  // Enforce member limit per plan
  const userRecord = await getUser(c.env.DB, user.sub);
  const plan = userRecord?.plan || "free";
  const LIMITS: Record<string, number> = { free: 1, pro: 3, team: 25 };
  const limit = LIMITS[plan] ?? 1;
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM project_memberships WHERE project_id = ?"
  ).bind(body.project_id).first<{ cnt: number }>();
  if ((count?.cnt ?? 0) >= limit) {
    return c.json({
      error: "member_limit_reached",
      message: `${plan} plan allows ${limit} members per project.`,
      upgrade_url: "https://app.pushci.dev/billing",
    }, 403);
  }

  // Resolve GitHub user ID
  let userSub = `${body.provider}:${body.login}`;
  if (body.provider === "github") {
    const userRow = await c.env.DB.prepare(
      "SELECT github_token FROM users WHERE sub = ?"
    ).bind(user.sub).first<{ github_token: string | null }>();
    if (userRow?.github_token) {
      try {
        const ghRes = await fetch(`https://api.github.com/users/${body.login}`, {
          headers: { Authorization: `token ${userRow.github_token}`, "User-Agent": "PushCI/1.0" },
        });
        if (ghRes.ok) {
          const ghUser = await ghRes.json() as { id: number };
          userSub = `github:${ghUser.id}`;
        }
      } catch { /* fallback */ }
    }
  }

  const role = body.role && ["developer", "viewer", "auditor", "deploy_approver", "release_manager", "maintainer"].includes(body.role)
    ? body.role : "developer";

  await c.env.DB.prepare(`
    INSERT INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
    VALUES (?, ?, ?, ?, ?, '[]')
    ON CONFLICT(project_id, user_sub) DO UPDATE SET role = excluded.role, updated_at = datetime('now')
  `).bind(body.project_id, userSub, body.login, body.provider, role).run();

  return c.json({ ok: true, login: body.login, role, project_id: body.project_id });
});

// DELETE /api/team/:projectId/:userSub — remove a member
teamRoutes.delete("/:projectId/:userSub", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const targetSub = decodeURIComponent(c.req.param("userSub"));

  const callerMembership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first<{ role: string }>();
  if (!callerMembership || !["maintainer", "admin"].includes(callerMembership.role)) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (targetSub === user.sub) {
    return c.json({ error: "cannot remove yourself" }, 400);
  }

  await c.env.DB.prepare(
    "DELETE FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, targetSub).run();

  return c.json({ ok: true, removed: targetSub });
});
