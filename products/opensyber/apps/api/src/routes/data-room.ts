/**
 * Data Room Routes (Series A Investor Metrics)
 *
 * Admin-only endpoints for investor package generation.
 * GET /api/admin/data-room — Full metrics snapshot
 * GET /api/admin/data-room/export — JSON bundle for investor portal
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';

const dataRoomRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
dataRoomRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

/** GET / — Investor metrics dashboard */
dataRoomRoutes.get('/', async (c) => {
  const [orgs, instances, agents, findings, assessments] = await Promise.all([
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN plan != 'free' THEN 1 ELSE 0 END) as paying FROM organizations`).first<Record<string, number>>(),
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM instances`).first<{ total: number }>(),
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM agent_activity`).first<{ total: number }>(),
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM cspm_findings`).first<{ total: number }>(),
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT AVG(overall_score) as avg_score FROM oasf_assessments`).first<{ avg_score: number }>(),
  ]);

  return c.json({
    data: {
      generatedAt: new Date().toISOString(),
      customers: {
        totalOrgs: orgs?.total ?? 0,
        payingOrgs: orgs?.paying ?? 0,
        freeOrgs: (orgs?.total ?? 0) - (orgs?.paying ?? 0),
      },
      product: {
        totalInstances: instances?.total ?? 0,
        totalAgentEvents: agents?.total ?? 0,
        totalFindings: findings?.total ?? 0,
        avgOasfScore: Math.round(assessments?.avg_score ?? 0),
      },
    },
  });
});

/** GET /export — Full data room JSON bundle */
dataRoomRoutes.get('/export', async (c) => {
  const [orgs, instances, monthlyOrgs, skills] = await Promise.all([
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT id, name, plan, created_at FROM organizations ORDER BY created_at DESC`).all(),
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active FROM instances`).first<Record<string, number>>(),
    // Safe: static query, no user input
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as signups
       FROM organizations GROUP BY month ORDER BY month DESC LIMIT 12`,
    ).all(),
    // Safe: static query, no user input
    c.env.DB.prepare(`SELECT COUNT(*) as total FROM skills WHERE is_certified = 1`).first<{ total: number }>(),
  ]);

  const anonymizedOrgs = (orgs.results ?? []).map((org, index) => ({
    name: `Org-${index + 1}`,
    plan: (org as Record<string, unknown>).plan,
    created_at: (org as Record<string, unknown>).created_at,
  }));

  return c.json({
    data: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      company: 'OpenSyber',
      organizations: anonymizedOrgs,
      instanceMetrics: {
        total: instances?.total ?? 0,
        active: instances?.active ?? 0,
      },
      monthlySignups: monthlyOrgs.results ?? [],
      certifiedSkills: skills?.total ?? 0,
    },
  });
});

export { dataRoomRoutes };
