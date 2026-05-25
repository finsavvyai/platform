// Audit log API: list audit trail entries for the authenticated user.

import { Hono } from "hono";
import { getAuthUser } from "./team-auth";
import type { Env } from "./types";

type Bindings = Env;
export const auditApiRoutes = new Hono<{ Bindings: Bindings }>();

// GET /api/audit/logs — paginated, filterable audit log
auditApiRoutes.get("/logs", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  const action = c.req.query("action") || "";
  const resourceType = c.req.query("resource_type") || "";

  const conditions = ["actor_sub = ?"];
  const params: (string | number)[] = [user.sub];

  if (action) {
    conditions.push("action = ?");
    params.push(action);
  }
  if (resourceType) {
    conditions.push("resource_type = ?");
    params.push(resourceType);
  }

  const where = conditions.join(" AND ");

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM audit_logs WHERE ${where}`
  ).bind(...params).first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = await c.env.DB.prepare(
    `SELECT id, actor_sub, actor_login, action, resource_type, resource_id, details_json, created_at
     FROM audit_logs WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({ logs: rows.results ?? [], total });
});
