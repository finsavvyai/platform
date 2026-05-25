import { Hono } from 'hono';
import { eq, and, desc, gte } from 'drizzle-orm';
import {
  securityEvents, auditLog, instances, skillInstallations, skills,
  securityScoreHistory, securityPolicies, alertRules, alerts,
  vulnerabilities, fileBaselines, incidents,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { calculateSecurityScore } from '../services/security-score.js';

const securityDashboardRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

securityDashboardRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get security dashboard for an instance
securityDashboardRoutes.get('/instances/:instanceId/dashboard', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  // Fan out all 8 reads in parallel — Drizzle + D1 ships them as concurrent
  // prepared statements. Order preserved to keep tests deterministic.
  const [
    events,
    installations,
    policies,
    rules,
    openAlertRows,
    incidentRows,
    baselines,
    vulns,
  ] = await Promise.all([
    db.select().from(securityEvents)
      .where(eq(securityEvents.instanceId, instanceId))
      .orderBy(desc(securityEvents.createdAt)).limit(50),
    db.select({ installation: skillInstallations, skill: skills })
      .from(skillInstallations)
      .innerJoin(skills, eq(skillInstallations.skillId, skills.id))
      .where(eq(skillInstallations.instanceId, instanceId)),
    db.select().from(securityPolicies).where(and(eq(securityPolicies.instanceId, instanceId), eq(securityPolicies.isActive, true))),
    db.select().from(alertRules).where(and(eq(alertRules.instanceId, instanceId), eq(alertRules.isActive, true))),
    db.select().from(alerts).where(and(eq(alerts.instanceId, instanceId), eq(alerts.status, 'open'))),
    db.select().from(incidents).where(eq(incidents.instanceId, instanceId)),
    db.select().from(fileBaselines).where(eq(fileBaselines.instanceId, instanceId)),
    db.select().from(vulnerabilities).where(and(eq(vulnerabilities.instanceId, instanceId), eq(vulnerabilities.status, 'open'))),
  ]);

  type InstallRow = { skill: { verificationStatus: string } };
  const installs = installations as InstallRow[];
  const verifiedCount = installs.filter((i) => i.skill.verificationStatus === 'approved').length;
  const blockedCount = installs.filter((i) => i.skill.verificationStatus === 'revoked').length;
  const unverifiedCount = installs.length - verifiedCount - blockedCount;

  const openIncidentRows = (incidentRows as Array<{ status: string }>).filter(
    (r) => r.status !== 'closed' && r.status !== 'resolved',
  );

  type VulnRow = { severity: string };
  const v = vulns as VulnRow[];
  const vulnSummary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of v) {
    if (row.severity === 'critical') vulnSummary.critical++;
    else if (row.severity === 'high') vulnSummary.high++;
    else if (row.severity === 'medium') vulnSummary.medium++;
    else if (row.severity === 'low') vulnSummary.low++;
  }

  const score = calculateSecurityScore(instance, events, {
    verified: verifiedCount, unverified: unverifiedCount, blocked: blockedCount,
  }, {
    activePolicies: policies.length,
    activeAlertRules: rules.length,
    openAlerts: openAlertRows.length,
    openIncidents: openIncidentRows.length,
    fileBaselines: baselines.length,
    vulnSummary,
  });

  // Private cache: dashboard is per-user and changes slowly (events lag by 5s+).
  c.header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
  return c.json({
    dashboard: {
      score,
      recentEvents: events.slice(0, 20),
      installedSkills: { verified: verifiedCount, unverified: unverifiedCount, blocked: blockedCount },
      openAlerts: openAlertRows.length,
      openIncidents: openIncidentRows.length,
      vulnerabilitySummary: vulnSummary,
      lastScan: instance.lastHealthCheck,
    },
  });
});

// Get security events
securityDashboardRoutes.get('/instances/:instanceId/events', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const events = await db.select().from(securityEvents)
    .where(eq(securityEvents.instanceId, instanceId))
    .orderBy(desc(securityEvents.createdAt)).limit(100);

  c.header('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
  return c.json({ events });
});

// Get audit log
securityDashboardRoutes.get('/instances/:instanceId/audit', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const logs = await db.select().from(auditLog)
    .where(eq(auditLog.instanceId, instanceId))
    .orderBy(desc(auditLog.createdAt)).limit(200);

  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return c.json({ auditLog: logs });
});

// Get score history
securityDashboardRoutes.get('/instances/:instanceId/score-history', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const period = c.req.query('period') || '7d';
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const periodDays = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const history = await db.select().from(securityScoreHistory)
    .where(and(eq(securityScoreHistory.instanceId, instanceId), gte(securityScoreHistory.recordedAt, since)))
    .orderBy(desc(securityScoreHistory.recordedAt));

  // Score history is append-only, revalidate minutes not seconds.
  c.header('Cache-Control', 'private, max-age=120, stale-while-revalidate=300');
  return c.json({ history });
});

export { securityDashboardRoutes };
