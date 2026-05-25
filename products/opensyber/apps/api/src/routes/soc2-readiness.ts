/**
 * SOC2 Type 1 Readiness Routes
 *
 * GET /api/soc2/readiness — SOC2 readiness summary from latest OASF assessment
 * GET /api/soc2/mappings — OASF-to-SOC2 TSC mapping table
 * GET /api/soc2/evidence — Evidence snapshot for auditor
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { SOC2_MAPPINGS, SOC2_TSC_CATEGORIES } from '@opensyber/shared';
import type { Soc2ControlMapping } from '@opensyber/shared';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext } from '../middleware/rbac.js';

const soc2Routes = new Hono<{ Bindings: Env; Variables: Variables }>();
soc2Routes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** GET / — SOC2 readiness summary */
soc2Routes.get('/', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  // Safe: parameterized query via .bind()
  const assessment = await c.env.DB.prepare(
    `SELECT * FROM oasf_assessments WHERE org_id = ? ORDER BY created_at DESC LIMIT 1`,
  ).bind(orgId).first();

  if (!assessment) {
    return c.json({ data: { hasAssessment: false, readinessScore: 0, controls: [] } });
  }

  // Safe: parameterized query via .bind()
  const results = await c.env.DB.prepare(
    `SELECT * FROM oasf_assessment_results WHERE assessment_id = ?`,
  ).bind((assessment as Record<string, unknown>).id).all();

  const controls = SOC2_MAPPINGS.map((mapping: Soc2ControlMapping) => {
    const result = (results.results ?? []).find(
      (r) => (r as Record<string, unknown>).control_id === mapping.oasfId,
    ) as Record<string, unknown> | undefined;

    return {
      ...mapping,
      status: result?.status ?? 'unknown',
      summary: result?.summary ?? 'No assessment data',
    };
  });

  const passing = controls.filter((ctrl) => ctrl.status === 'pass').length;
  const readinessScore = Math.round((passing / controls.length) * 100);

  return c.json({
    data: {
      hasAssessment: true,
      assessmentDate: (assessment as Record<string, unknown>).created_at,
      readinessScore,
      passingControls: passing,
      totalControls: controls.length,
      controls,
    },
  });
});

/** GET /mappings — Full OASF-to-SOC2 mapping table */
soc2Routes.get('/mappings', (c) => {
  return c.json({ data: { mappings: SOC2_MAPPINGS, categories: SOC2_TSC_CATEGORIES } });
});

/** GET /evidence — Evidence snapshot for auditor delivery */
soc2Routes.get('/evidence', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const [members, policies, incidents, alerts, uptime] = await Promise.all([
    // Safe: parameterized query via .bind()
  c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM org_members WHERE org_id = ?`).bind(orgId).first<{ cnt: number }>(),
    // Safe: parameterized query via .bind()
  c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM agent_policies WHERE org_id = ?`).bind(orgId).first<{ cnt: number }>(),
    // Safe: parameterized query via .bind()
  c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM incidents WHERE instance_id IN (SELECT id FROM instances WHERE org_id = ?)`).bind(orgId).first<{ cnt: number }>(),
    // Safe: parameterized query via .bind()
  c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM alert_channels WHERE org_id = ?`).bind(orgId).first<{ cnt: number }>(),
    // Safe: parameterized query via .bind()
  c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM uptime_records WHERE instance_id IN (SELECT id FROM instances WHERE org_id = ?)`).bind(orgId).first<{ cnt: number }>(),
  ]);

  return c.json({
    data: {
      collectedAt: new Date().toISOString(),
      orgId,
      evidence: {
        rbacMembers: members?.cnt ?? 0,
        agentPolicies: policies?.cnt ?? 0,
        incidentRecords: incidents?.cnt ?? 0,
        alertChannels: alerts?.cnt ?? 0,
        uptimeRecords: uptime?.cnt ?? 0,
      },
    },
  });
});

export { soc2Routes };
