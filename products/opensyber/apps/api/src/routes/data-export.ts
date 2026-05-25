/**
 * Bulk Data Export API
 *
 * REST endpoints for exporting platform data as JSON or CSV.
 * All endpoints require auth + audit.export permission.
 *
 * Endpoints:
 *   GET /export/agents    — export agent activity
 *   GET /export/findings  — export CSPM + SaaS findings
 *   GET /export/compliance — export compliance reports
 *   GET /export/assets    — export asset inventory
 */
import { Hono } from 'hono';
import { desc, eq, and, gte, lte, inArray } from 'drizzle-orm';
import {
  agentActivity, cspmFindings, saasFindings,
  complianceReports, assets, instances,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import {
  parseExportFormat, exportToFormat,
  buildDateFilter, parseExportLimit,
} from '../services/data-exporter.js';

type AppEnv = { Bindings: Env; Variables: Variables };

const dataExportRoutes = new Hono<AppEnv>();

dataExportRoutes.use('*', dbMiddleware, authMiddleware, requirePermission('audit.export'));

/** GET /export/agents — export agent activity as JSON/CSV */
dataExportRoutes.get('/agents', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const format = parseExportFormat(c.req.query('format'));
  const limit = parseExportLimit(c.req.query('limit'));
  const { from, to } = buildDateFilter(c.req.query('from'), c.req.query('to'));

  const conditions = orgId
    ? [eq(agentActivity.orgId, orgId)]
    : [eq(agentActivity.userId, userId)];

  if (from) conditions.push(gte(agentActivity.createdAt, from));
  if (to) conditions.push(lte(agentActivity.createdAt, to));

  const rows = await db.select().from(agentActivity)
    .where(and(...conditions))
    .orderBy(desc(agentActivity.createdAt))
    .limit(limit);

  const { content, contentType } = exportToFormat(rows as Record<string, unknown>[], format);
  return new Response(content, {
    headers: { 'Content-Type': contentType, 'X-Export-Count': String(rows.length) },
  });
});

/** GET /export/findings — export CSPM + SaaS findings */
dataExportRoutes.get('/findings', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const format = parseExportFormat(c.req.query('format'));
  const limit = parseExportLimit(c.req.query('limit'));
  const { from, to } = buildDateFilter(c.req.query('from'), c.req.query('to'));

  if (!orgId) {
    return c.json({ error: 'Bad Request', message: 'Org context required for findings export' }, 400);
  }

  const cspmConditions = [eq(cspmFindings.orgId, orgId)];
  if (from) cspmConditions.push(gte(cspmFindings.firstSeenAt, from));
  if (to) cspmConditions.push(lte(cspmFindings.firstSeenAt, to));

  const cspmRows = await db.select().from(cspmFindings)
    .where(and(...cspmConditions))
    .limit(Math.ceil(limit / 2));

  const saasConditions = [eq(saasFindings.orgId, orgId)];
  if (from) saasConditions.push(gte(saasFindings.firstSeenAt, from));
  if (to) saasConditions.push(lte(saasFindings.firstSeenAt, to));

  const saasRows = await db.select().from(saasFindings)
    .where(and(...saasConditions))
    .limit(Math.ceil(limit / 2));

  const combined = [
    ...cspmRows.map((r) => ({ ...r, source: 'cspm' })),
    ...saasRows.map((r) => ({ ...r, source: 'saas' })),
  ];

  const { content, contentType } = exportToFormat(combined as Record<string, unknown>[], format);
  return new Response(content, {
    headers: { 'Content-Type': contentType, 'X-Export-Count': String(combined.length) },
  });
});

/** GET /export/compliance — export compliance reports */
dataExportRoutes.get('/compliance', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const format = parseExportFormat(c.req.query('format'));
  const limit = parseExportLimit(c.req.query('limit'));
  const { from, to } = buildDateFilter(c.req.query('from'), c.req.query('to'));
  const instanceId = c.req.query('instanceId');

  if (instanceId) {
    const instance = await verifyInstanceAccess(db as any, instanceId, userId, orgId);
    if (!instance) {
      return c.json({ error: 'Forbidden', message: 'Instance not accessible' }, 403);
    }
  }

  const orgInstanceIds = db.select({ id: instances.id }).from(instances).where(
    orgId ? eq(instances.orgId, orgId) : eq(instances.userId, userId),
  );

  const conditions = [inArray(complianceReports.instanceId, orgInstanceIds)];
  if (instanceId) conditions.push(eq(complianceReports.instanceId, instanceId));
  if (from) conditions.push(gte(complianceReports.generatedAt, from));
  if (to) conditions.push(lte(complianceReports.generatedAt, to));

  const query = db.select().from(complianceReports).where(and(...conditions));

  const rows = await query
    .orderBy(desc(complianceReports.generatedAt))
    .limit(limit);

  const sanitized = rows.map(({ results, ...rest }) => ({
    ...rest,
    controlResults: results ? JSON.parse(results).length : 0,
  }));

  const { content, contentType } = exportToFormat(sanitized as Record<string, unknown>[], format);
  return new Response(content, {
    headers: { 'Content-Type': contentType, 'X-Export-Count': String(sanitized.length) },
  });
});

/** GET /export/assets — export asset inventory */
dataExportRoutes.get('/assets', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const format = parseExportFormat(c.req.query('format'));
  const limit = parseExportLimit(c.req.query('limit'));
  const { from, to } = buildDateFilter(c.req.query('from'), c.req.query('to'));

  if (!orgId) {
    return c.json({ error: 'Bad Request', message: 'Org context required for asset export' }, 400);
  }

  const conditions = [eq(assets.orgId, orgId)];
  if (from) conditions.push(gte(assets.createdAt, from));
  if (to) conditions.push(lte(assets.createdAt, to));

  const rows = await db.select().from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt))
    .limit(limit);

  const { content, contentType } = exportToFormat(rows as Record<string, unknown>[], format);
  return new Response(content, {
    headers: { 'Content-Type': contentType, 'X-Export-Count': String(rows.length) },
  });
});

export { dataExportRoutes };
