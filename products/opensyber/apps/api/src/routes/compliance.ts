import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { complianceReports } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { evaluateCompliance } from '../services/compliance.js';
import type { ComplianceFramework } from '@opensyber/shared';
import { generateComplianceReportSchema } from './validation/compliance.js';

const validFrameworks = new Set(['soc2', 'iso27001', 'cis']);

const complianceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

complianceRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List compliance reports
complianceRoutes.get('/instances/:instanceId/compliance-reports', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(db as any, c.req.param('instanceId'), c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const reports = await db.select().from(complianceReports)
    .where(eq(complianceReports.instanceId, c.req.param('instanceId')))
    .orderBy(desc(complianceReports.generatedAt));
  return c.json({ reports });
});

// Generate compliance report
complianceRoutes.post('/instances/:instanceId/compliance-reports', requirePermission('compliance.generate'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const parsed = generateComplianceReportSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);

  const { results, overallScore } = await evaluateCompliance(db, instanceId, parsed.data.framework as ComplianceFramework);
  const passing = results.filter((r) => r.status === 'pass').length;
  const failing = results.filter((r) => r.status === 'fail').length;

  const report = {
    id: crypto.randomUUID(), instanceId,
    framework: parsed.data.framework as typeof complianceReports.$inferInsert.framework,
    overallScore, totalControls: results.length,
    passingControls: passing, failingControls: failing,
    results: JSON.stringify(results), generatedAt: new Date().toISOString(),
  };

  await db.insert(complianceReports).values(report);
  return c.json({ report: { ...report, results } }, 201);
});

// Get report detail
complianceRoutes.get('/instances/:instanceId/compliance-reports/:reportId', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const reportId = c.req.param('reportId');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [report] = await db.select().from(complianceReports)
    .where(and(eq(complianceReports.id, reportId), eq(complianceReports.instanceId, instanceId)));
  if (!report) return c.json({ error: 'Not found', message: 'Report not found' }, 404);

  return c.json({ report: { ...report, results: JSON.parse(report.results) } });
});

export { complianceRoutes };
