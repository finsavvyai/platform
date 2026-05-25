/**
 * CSPM Risk Score & Drift Routes
 *
 * GET /api/cloud/risk — Org-level CSPM risk score
 * GET /api/cloud/risk/:accountId — Per-account risk score
 * GET /api/cloud/drift/:accountId — Finding drift between scans
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createDb } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { calculateAccountRiskScore, calculateOrgRiskScore } from '../services/cspm-risk-score.js';
import { detectDrift } from '../services/cspm-drift.js';

const cspmRiskRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

cspmRiskRoutes.use('*', authMiddleware);

/** GET /risk — Org-level risk score */
cspmRiskRoutes.get('/risk', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const db = createDb(c.env.DB);
  const score = await calculateOrgRiskScore(db, orgId);
  return c.json({ data: score });
});

/** GET /risk/:accountId — Per-account risk score */
cspmRiskRoutes.get('/risk/:accountId', async (c) => {
  const db = createDb(c.env.DB);
  const score = await calculateAccountRiskScore(db, c.req.param('accountId'));
  return c.json({ data: score });
});

/** GET /drift/:accountId — Finding drift between consecutive scans */
cspmRiskRoutes.get('/drift/:accountId', async (c) => {
  const db = createDb(c.env.DB);
  const drift = await detectDrift(db, c.req.param('accountId'));
  return c.json({ data: drift });
});

export { cspmRiskRoutes };
