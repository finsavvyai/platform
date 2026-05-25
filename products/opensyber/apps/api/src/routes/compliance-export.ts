import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { complianceReports } from '@opensyber/db';
import type { ComplianceControlResult } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import {
  exportComplianceToCsv, exportAuditToCsv,
  storeExport, buildExportKey,
} from '../services/report-export.js';
import { parseDateRange } from '../utils/pagination.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const complianceExportRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

complianceExportRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// GET /api/security/instances/:id/compliance-reports/:reportId/export?format=csv
complianceExportRoutes.get('/instances/:id/compliance-reports/:reportId/export', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('id');
  const reportId = c.req.param('reportId');
  const format = c.req.query('format') ?? 'csv';

  if (format !== 'csv') {
    return c.json({ error: 'Bad Request', message: 'Only CSV export is supported' }, 400);
  }

  const instance = await verifyInstanceAccess(db, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Forbidden', message: 'No access to instance' }, 403);

  const [report] = await db.select().from(complianceReports)
    .where(eq(complianceReports.id, reportId)).limit(1);

  if (!report) return c.json({ error: 'Not Found', message: 'Report not found' }, 404);

  const results = JSON.parse(report.results) as ComplianceControlResult[];
  const csv = exportComplianceToCsv(results, report.framework);
  const key = buildExportKey(instanceId, 'compliance', report.framework);

  await storeExport(c.env.STORAGE, key, csv);

  return c.json({ data: { key, format: 'csv', size: csv.length } });
});

// GET /api/security/instances/:id/audit/export?from=&to=&format=csv
complianceExportRoutes.get('/instances/:id/audit/export', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('id');
  const format = c.req.query('format') ?? 'csv';

  if (format !== 'csv') {
    return c.json({ error: 'Bad Request', message: 'Only CSV export is supported' }, 400);
  }

  const instance = await verifyInstanceAccess(db, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Forbidden', message: 'No access to instance' }, 403);

  const { from, to } = parseDateRange(c.req.query('from'), c.req.query('to'));
  const csv = await exportAuditToCsv(db, instanceId, from, to);
  const key = buildExportKey(instanceId, 'audit');

  await storeExport(c.env.STORAGE, key, csv);

  return c.json({ data: { key, format: 'csv', size: csv.length } });
});

export { complianceExportRoutes };
