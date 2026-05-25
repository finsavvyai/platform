// Build Number API — track, increment, and serve embeddable build badges.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";

export const buildRoutes = new Hono<{ Bindings: Env }>();

// Public: Get build number + status for any repo
buildRoutes.get("/build/:owner/:repo", async (c) => {
  const repo = `${c.req.param("owner")}/${c.req.param("repo")}`;
  const project = await c.env.DB.prepare(
    "SELECT build_number FROM projects WHERE repo = ?"
  ).bind(repo).first<{ build_number: number }>();
  const run = await c.env.DB.prepare(
    "SELECT status, branch, sha, created_at FROM runs WHERE repo = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(repo).first<{ status: string; branch: string; sha: string; created_at: string }>();

  const buildNum = project?.build_number ?? 0;
  const status = run?.status ?? "unknown";

  return c.json({
    repo, build_number: buildNum, status,
    branch: run?.branch ?? "main",
    sha: run?.sha?.slice(0, 7) ?? null,
    last_run: run?.created_at ?? null,
    badge_url: `https://api.pushci.dev/badge/${repo}`,
    widget_url: `https://api.pushci.dev/widget/${repo}`,
    dashboard_url: `https://app.pushci.dev`,
  });
});

// Internal: Increment build number — requires auth + project membership
buildRoutes.post("/build/:owner/:repo/increment", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const repo = `${c.req.param("owner")}/${c.req.param("repo")}`;
  const project = await c.env.DB.prepare("SELECT id FROM projects WHERE repo = ?").bind(repo).first<{ id: string }>();
  if (!project) return c.json({ error: "not found" }, 404);

  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(project.id, user.sub).first();
  if (!membership) return c.json({ error: "forbidden" }, 403);

  await c.env.DB.prepare("UPDATE projects SET build_number = build_number + 1 WHERE repo = ?").bind(repo).run();
  const updated = await c.env.DB.prepare("SELECT build_number FROM projects WHERE repo = ?").bind(repo).first<{ build_number: number }>();
  return c.json({ repo, build_number: updated?.build_number ?? 0 });
});
