/**
 * EU AI Act Compliance Routes
 * Risk classification, audit trail export, NIST mapping
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import {
  exportAuditTrail,
  AI_RISK_CATEGORIES,
  NIST_AI_RMF_FUNCTIONS,
} from '../services/eu-ai-act.js';

export const complianceAiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
complianceAiRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// GET /risk-classification — list AI systems with risk levels
complianceAiRoutes.get('/risk-classification', async (c) => {
  return c.json({
    data: [],
    riskCategories: AI_RISK_CATEGORIES,
  });
});

// GET /audit-trail — export audit trail for date range
complianceAiRoutes.get('/audit-trail', async (c) => {
  const fromStr = c.req.query('from');
  const toStr = c.req.query('to');

  if (!fromStr || !toStr) {
    return c.json(
      { error: 'Bad request', message: 'from and to date parameters required' },
      400,
    );
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return c.json(
      { error: 'Bad request', message: 'Invalid date format' },
      400,
    );
  }

  const trail = await exportAuditTrail(c.get('db'), from, to);

  return c.json({ data: trail });
});

// GET /nist-mapping — get NIST AI RMF mapping for recent findings
complianceAiRoutes.get('/nist-mapping', async (c) => {
  return c.json({
    data: [],
    nistFunctions: NIST_AI_RMF_FUNCTIONS,
  });
});
