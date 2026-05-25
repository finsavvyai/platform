// Project Stats API — build metrics, test results, pipeline health.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";

export const statsRoutes = new Hono<{ Bindings: Env }>();

statsRoutes.get("/stats/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  // Verify user has membership on this project
  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first();
  if (!membership) return c.json({ error: "forbidden — no access to this project" }, 403);

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId).first();
  if (!project) return c.json({ error: "not found" }, 404);

  const repo = project.repo as string;

  // Total runs
  const total = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM runs WHERE repo = ?"
  ).bind(repo).first<{ count: number }>();

  // Pass/fail counts
  const passed = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM runs WHERE repo = ? AND status = 'passed'"
  ).bind(repo).first<{ count: number }>();

  const failed = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM runs WHERE repo = ? AND status = 'failed'"
  ).bind(repo).first<{ count: number }>();

  // Average duration
  const avgDur = await c.env.DB.prepare(
    "SELECT AVG(duration_ms) as avg_ms FROM runs WHERE repo = ? AND duration_ms > 0"
  ).bind(repo).first<{ avg_ms: number | null }>();

  // Last 10 runs for chart
  const recent = await c.env.DB.prepare(
    "SELECT id, status, duration_ms, created_at, commit_message, substr(sha,1,7) as short_sha, branch FROM runs WHERE repo = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(repo).all();

  // Build number
  const buildNum = (project.build_number as number) || 0;

  const totalCount = total?.count ?? 0;
  const passedCount = passed?.count ?? 0;
  const failedCount = failed?.count ?? 0;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return c.json({
    project_id: projectId,
    repo,
    build_number: buildNum,
    deploy_target: project.deploy_target || null,
    total_runs: totalCount,
    passed: passedCount,
    failed: failedCount,
    pass_rate: passRate,
    avg_duration_ms: Math.round(avgDur?.avg_ms ?? 0),
    recent_runs: recent.results || [],
    cost_saved: `$${(totalCount * (avgDur?.avg_ms ?? 3000) / 60000 * 0.008).toFixed(2)}`,
  });
});
