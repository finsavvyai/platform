/**
 * OASF Compliance Routes
 *
 * POST /api/oasf/assess              — Run full OASF assessment, store results
 * POST /api/oasf/assessments         — Run new assessment (alias)
 * GET  /api/oasf/assessments         — List assessment history
 * GET  /api/oasf/assessments/:id     — Get assessment detail
 * GET  /api/oasf/controls            — Get OASF 1.0 control definitions
 * GET  /api/oasf/framework-mapping   — Get SOC2/ISO/NIST mappings
 */
import { Hono } from 'hono';
import { OASF_CONTROLS } from '@opensyber/shared';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { resolveOrgContextAutoDetect, requirePermission } from '../../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../../middleware/plan-enforcement.js';
import { runAssessment, getAssessmentHistory, getAssessmentDetail } from '../../services/oasf/index.js';

const oasfComplianceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

oasfComplianceRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect, loadPlanConfig);

// Run full OASF assessment and store results
async function handleAssess(c: any) {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Organization required' }, 400);

  const userId = c.get('userId');
  const result = await runAssessment(c.get('db'), orgId, userId);
  return c.json({ data: result }, 201);
}

oasfComplianceRoutes.post(
  '/assess',
  requirePermission('compliance.generate'),
  requirePlanFeature('teamDashboard'),
  handleAssess,
);

// Alias: POST /assessments
oasfComplianceRoutes.post(
  '/assessments',
  requirePermission('compliance.generate'),
  requirePlanFeature('teamDashboard'),
  handleAssess,
);

// List assessment history
oasfComplianceRoutes.get('/assessments', requirePermission('compliance.view'), async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ data: [] });

  const limit = Math.min(parseInt(c.req.query('limit') ?? '10'), 50);
  const assessments = await getAssessmentHistory(c.get('db'), orgId, limit);
  return c.json({ data: assessments });
});

// Get assessment detail
oasfComplianceRoutes.get('/assessments/:id', requirePermission('compliance.view'), async (c) => {
  const detail = await getAssessmentDetail(c.get('db'), c.req.param('id'));
  if (!detail) return c.json({ error: 'Assessment not found' }, 404);
  return c.json({ data: detail });
});

// Get OASF control definitions (static)
oasfComplianceRoutes.get('/controls', async (c) => {
  return c.json({ data: OASF_CONTROLS });
});

// Get framework mapping table
oasfComplianceRoutes.get('/framework-mapping', async (c) => {
  const mappings = OASF_CONTROLS.map((ctrl) => ({
    controlId: ctrl.id,
    name: ctrl.name,
    category: ctrl.category,
    soc2: ctrl.soc2Mapping,
    iso27001: ctrl.iso27001Mapping,
    nistCsf: ctrl.nistCsfMapping,
  }));
  return c.json({ data: mappings });
});

export { oasfComplianceRoutes };
