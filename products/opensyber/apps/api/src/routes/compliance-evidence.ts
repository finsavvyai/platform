import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  collectPlatformEvidence,
  collectDynamicEvidence,
  summarizeEvidence,
} from '../services/soc2-evidence-collector.js';

const complianceEvidenceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

complianceEvidenceRoutes.use('*', dbMiddleware, authMiddleware);

const VALID_FRAMEWORKS = new Set(['soc2', 'iso27001', 'nist', 'gdpr', 'hipaa', 'pci']);

/**
 * GET /api/compliance/evidence/:framework
 *
 * Returns combined static + dynamic evidence for audit preparation.
 */
complianceEvidenceRoutes.get(
  '/:framework',
  requirePermission('compliance.view'),
  async (c) => {
    const framework = c.req.param('framework');
    if (!VALID_FRAMEWORKS.has(framework)) {
      return c.json({ error: 'Bad Request', message: `Unknown framework: ${framework}` }, 400);
    }

    const db = c.get('db');
    const orgId = c.get('orgId') ?? null;

    // Static evidence (architectural controls)
    const staticEvidence = collectPlatformEvidence();
    const staticSummary = summarizeEvidence(staticEvidence);

    // Dynamic evidence (DB-driven, live state)
    const { items: dynamicItems, readinessScore } = await collectDynamicEvidence(db, orgId);

    // Merge into unified response
    const gaps = dynamicItems
      .filter((i) => i.status === 'fail')
      .map((i) => ({
        tsc: i.tsc,
        category: i.category,
        description: i.description,
        recommendation: `Configure ${i.source.replace(/_/g, ' ')} to improve this control.`,
      }));

    return c.json({
      data: {
        framework,
        staticEvidence: {
          items: staticEvidence,
          summary: staticSummary,
        },
        dynamicEvidence: {
          items: dynamicItems,
          readinessScore,
        },
        gaps,
        overallReadiness: Math.round((staticSummary.coveragePercent + readinessScore) / 2),
      },
    });
  },
);

export { complianceEvidenceRoutes };
