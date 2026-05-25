import { Hono } from 'hono';
import { eq, desc, and, gte } from 'drizzle-orm';
import {
  securityScoreHistory,
  instances,
  securityEvents,
  skillInstallations,
  skills,
  securityPolicies,
  alertRules,
  alerts,
  incidents,
  fileBaselines,
  vulnerabilities,
  agentRiskSnapshots,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { calculateSecurityScore } from '../services/security-score.js';
import { getRiskTrend } from '../services/risk-snapshotter.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const scoreRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

scoreRoutes.use('*', dbMiddleware, authMiddleware);

function gradeFromScore(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// GET /:instanceId — Security scorecard (requires ownership)
scoreRoutes.get('/:instanceId', async (c) => {
  const instanceId = c.req.param('instanceId');
  const db = c.get('db');

  // Verify the authenticated user owns or has access to this instance
  const instance = await verifyInstanceAccess(
    db as any, instanceId, c.get('userId'), c.get('orgId'),
  );

  if (!instance) {
    return c.json({ error: 'Not found', message: 'No scorecard available' }, 404);
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const sinceIso = new Date(now - day).toISOString();

  // Fan out all reads concurrently. Drizzle D1 ships each as an independent
  // prepared statement; total wall-clock is bounded by the slowest query.
  const [
    latestRows,
    instRows,
    events,
    skillRows,
    activePolicies,
    activeAlertRules,
    openAlerts,
    incidentRows,
    fBaselines,
    vulns,
  ] = await Promise.all([
    db.select().from(securityScoreHistory)
      .where(eq(securityScoreHistory.instanceId, instanceId))
      .orderBy(desc(securityScoreHistory.recordedAt)).limit(1),
    db.select().from(instances).where(eq(instances.id, instanceId)).limit(1),
    db.select().from(securityEvents)
      .where(and(eq(securityEvents.instanceId, instanceId),
        gte(securityEvents.createdAt, sinceIso)))
      .limit(200),
    db.select({ status: skills.verificationStatus })
      .from(skillInstallations)
      .innerJoin(skills, eq(skillInstallations.skillId, skills.id))
      .where(eq(skillInstallations.instanceId, instanceId)),
    db.select().from(securityPolicies)
      .where(and(eq(securityPolicies.instanceId, instanceId), eq(securityPolicies.isActive, true))),
    db.select().from(alertRules)
      .where(and(eq(alertRules.instanceId, instanceId), eq(alertRules.isActive, true))),
    db.select().from(alerts)
      .where(and(eq(alerts.instanceId, instanceId), eq(alerts.status, 'open'))),
    db.select().from(incidents).where(eq(incidents.instanceId, instanceId)),
    db.select().from(fileBaselines).where(eq(fileBaselines.instanceId, instanceId)),
    db.select().from(vulnerabilities)
      .where(and(eq(vulnerabilities.instanceId, instanceId), eq(vulnerabilities.status, 'open'))),
  ]);

  const [latest] = latestRows;
  const [inst] = instRows;

  const skillCounts = { verified: 0, unverified: 0, blocked: 0 };
  for (const r of skillRows) {
    if (r.status === 'approved') skillCounts.verified++;
    else if (r.status === 'pending' || r.status === 'scanning') skillCounts.unverified++;
    else if (r.status === 'rejected' || r.status === 'revoked') skillCounts.blocked++;
  }

  const openIncidents = (incidentRows as Array<{ status: string }>).filter(
    (r) => r.status !== 'closed' && r.status !== 'resolved',
  );

  const vulnSummary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const v of vulns as Array<{ severity: string }>) {
    if (v.severity === 'critical') vulnSummary.critical++;
    else if (v.severity === 'high') vulnSummary.high++;
    else if (v.severity === 'medium') vulnSummary.medium++;
    else if (v.severity === 'low') vulnSummary.low++;
  }

  const extended = {
    activePolicies: activePolicies.length,
    activeAlertRules: activeAlertRules.length,
    openAlerts: openAlerts.length,
    openIncidents: openIncidents.length,
    fileBaselines: fBaselines.length,
    vulnSummary,
  };

  const result = calculateSecurityScore(
    inst ?? { lastHealthCheck: null, gatewayTokenEncrypted: null, agentVersion: null },
    events.map((e) => ({ severity: e.severity, eventType: e.eventType, createdAt: e.createdAt })),
    skillCounts,
    extended,
  );

  const overall = result.overall;
  const grade = gradeFromScore(overall);

  c.header('Cache-Control', 'private, s-maxage=300');
  return c.json({
    overall,
    grade,
    instanceName: (instance as any)?.name ?? 'Agent',
    lastUpdated: latest?.recordedAt ?? new Date().toISOString(),
    categories: result.categories,
    recommendationCount: result.recommendations.length,
  });
});

// GET /api/score/trend — Historical risk scores over time
scoreRoutes.get('/trend', async (c) => {
  // Always use authenticated user's ID — ignore any user-supplied userId (BOLA fix)
  const userId = c.get('userId');
  const orgId = c.req.query('orgId');
  const startDate = c.req.query('start');
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 30;

  const db = c.get('db');

  try {
    const trend = await getRiskTrend(db, userId, orgId, {
      startDate: startDate ?? undefined,
      limit,
    });

    return c.json({
      data: trend,
      meta: {
        count: trend.length,
        startDate: trend[0]?.date,
        endDate: trend[trend.length - 1]?.date,
      },
    });
  } catch {
    return c.json({
      error: 'Failed to fetch trend data',
      message: 'An unexpected error occurred',
    }, 500);
  }
});

export { scoreRoutes };
