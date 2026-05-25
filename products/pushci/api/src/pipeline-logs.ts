// Structured pipeline logs: persistent, searchable, filterable run logs.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type LogLevel = "debug" | "info" | "warn" | "error";
type Bindings = Env;

export const logRoutes = new Hono<{ Bindings: Bindings }>();

async function getUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

/** POST /ingest — runners push structured log lines. */
logRoutes.post("/ingest", async (c) => {
  const token = c.req.header("x-runner-token") ?? c.req.header("x-service-token");
  const serviceToken = c.env.PUSHCI_SERVICE_TOKEN;
  if (!token || !serviceToken || token !== serviceToken) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { logs } = await c.req.json<{
    logs: Array<{
      runId: string; jobId?: string; level?: LogLevel;
      source?: string; message: string; metadata?: Record<string, unknown>;
    }>;
  }>();

  if (!logs?.length) return c.json({ error: "logs array required" }, 400);

  const stmts = logs.map((log) =>
    c.env.DB.prepare(
      `INSERT INTO pipeline_logs (id,run_id,job_id,level,source,message,metadata)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(
      crypto.randomUUID(), log.runId, log.jobId ?? null,
      log.level ?? "info", log.source ?? "runner",
      log.message, JSON.stringify(log.metadata ?? {}),
    )
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true, count: logs.length });
});

/** GET /:runId — get logs for a run with filtering. */
logRoutes.get("/:runId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const runId = c.req.param("runId");
  const level = c.req.query("level") as LogLevel | undefined;
  const search = c.req.query("q");
  const limit = Math.min(Number(c.req.query("limit") ?? "500"), 2000);
  const offset = Number(c.req.query("offset") ?? "0");

  let sql = "SELECT * FROM pipeline_logs WHERE run_id=?";
  const params: unknown[] = [runId];

  if (level) {
    sql += " AND level=?";
    params.push(level);
  }
  if (search) {
    sql += " AND message LIKE ?";
    params.push(`%${search}%`);
  }

  sql += " ORDER BY timestamp ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = c.env.DB.prepare(sql);
  const rows = await stmt.bind(...params).all();

  // Also get level counts for the sidebar
  const counts = await c.env.DB.prepare(
    `SELECT level, COUNT(*) as count FROM pipeline_logs WHERE run_id=? GROUP BY level`
  ).bind(runId).all<{ level: string; count: number }>();

  return c.json({
    logs: rows.results,
    total: rows.results.length,
    levels: Object.fromEntries((counts.results ?? []).map((r) => [r.level, r.count])),
  });
});

/** GET /:runId/summary — quick stats for a run's logs. */
logRoutes.get("/:runId/summary", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const runId = c.req.param("runId");
  const stats = await c.env.DB.prepare(
    `SELECT level, COUNT(*) as count, MIN(timestamp) as first, MAX(timestamp) as last
     FROM pipeline_logs WHERE run_id=? GROUP BY level`
  ).bind(runId).all<{ level: string; count: number; first: string; last: string }>();

  const total = (stats.results ?? []).reduce((sum, r) => sum + r.count, 0);
  const errors = (stats.results ?? []).find((r) => r.level === "error")?.count ?? 0;

  return c.json({ runId, total, errors, levels: stats.results });
});
