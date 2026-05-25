/**
 * SLA Monitoring Routes
 *
 * GET /api/sla/status — SLA compliance status for the org
 * GET /api/sla/metrics — Uptime and response time aggregation
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';

const slaMonitoringRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
slaMonitoringRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** GET / — SLA compliance status */
slaMonitoringRoutes.get('/', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  // Safe: parameterized query via .bind()
  const slaConfig = await c.env.DB.prepare(
    `SELECT * FROM sla_configs WHERE org_id = ?`,
  ).bind(orgId).first();

  const targetUptime = (slaConfig as Record<string, unknown>)?.target_uptime ?? 99.9;

  // Safe: parameterized query via .bind()
  const uptimeStats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as total_checks,
       SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks,
       AVG(response_time_ms) as avg_response_ms,
       MIN(response_time_ms) as min_response_ms,
       MAX(response_time_ms) as max_response_ms
     FROM uptime_records
     WHERE instance_id IN (SELECT id FROM instances WHERE org_id = ?)
     AND checked_at >= datetime('now', '-30 days')`,
  ).bind(orgId).first<Record<string, number>>();

  const totalChecks = uptimeStats?.total_checks ?? 0;
  const upChecks = uptimeStats?.up_checks ?? 0;
  const uptimePercent = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 100;
  const isCompliant = uptimePercent >= Number(targetUptime);

  return c.json({
    data: {
      targetUptime: Number(targetUptime),
      currentUptime: Math.round(uptimePercent * 1000) / 1000,
      isCompliant,
      totalChecks,
      period: '30d',
      responseTime: {
        avg: Math.round(uptimeStats?.avg_response_ms ?? 0),
        min: uptimeStats?.min_response_ms ?? 0,
        max: uptimeStats?.max_response_ms ?? 0,
      },
    },
  });
});

/** GET /metrics — Detailed SLA metrics with daily breakdown */
slaMonitoringRoutes.get('/metrics', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const days = Math.min(Number(c.req.query('days') ?? '30'), 90);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  // Safe: parameterized query via .bind()
  const daily = await c.env.DB.prepare(
    `SELECT
       date(checked_at) as day,
       COUNT(*) as checks,
       SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_checks,
       AVG(response_time_ms) as avg_ms
     FROM uptime_records
     WHERE instance_id IN (SELECT id FROM instances WHERE org_id = ?)
     AND checked_at >= ?
     GROUP BY date(checked_at)
     ORDER BY day DESC`,
  ).bind(orgId, cutoff).all();

  // Safe: parameterized query via .bind()
  const incidents = await c.env.DB.prepare(
    `SELECT id, title, severity, status, created_at, resolved_at
     FROM incidents
     WHERE instance_id IN (SELECT id FROM instances WHERE org_id = ?)
     AND created_at >= ?
     ORDER BY created_at DESC`,
  ).bind(orgId, cutoff).all();

  const resolvedIncidents = (incidents.results ?? []).filter(
    (i) => (i as Record<string, unknown>).resolved_at,
  );

  let mttrMinutes = 0;
  if (resolvedIncidents.length > 0) {
    const totalMs = resolvedIncidents.reduce((sum, i) => {
      const rec = i as Record<string, unknown>;
      const created = new Date(rec.created_at as string).getTime();
      const resolved = new Date(rec.resolved_at as string).getTime();
      return sum + (resolved - created);
    }, 0);
    mttrMinutes = Math.round(totalMs / resolvedIncidents.length / 60000);
  }

  return c.json({
    data: {
      period: `${days}d`,
      dailyUptime: (daily.results ?? []).map((d) => {
        const rec = d as Record<string, number>;
        return {
          day: (d as Record<string, unknown>).day,
          uptime: (rec.checks ?? 0) > 0 ? Math.round(((rec.up_checks ?? 0) / (rec.checks ?? 1)) * 10000) / 100 : 100,
          avgResponseMs: Math.round(rec.avg_ms ?? 0),
        };
      }),
      incidents: incidents.results ?? [],
      mttrMinutes,
    },
  });
});

export { slaMonitoringRoutes };
