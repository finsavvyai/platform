import { Hono } from 'hono';
import { desc, and, gte, lte, eq } from 'drizzle-orm';
import { auditLog, securityEvents } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';
import { parseLimit, parseDateRange } from '../utils/pagination.js';

interface UnifiedEntry {
  id: string;
  timestamp: string;
  source: 'audit' | 'security';
  type: string;
  severity: string;
  actorId: string | null;
  instanceId: string | null;
  details: string | null;
}

const adminAuditRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminAuditRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

/** GET /api/admin/audit — unified audit + security events */
adminAuditRoutes.get('/', async (c) => {
  const db = c.get('db');
  const limit = parseLimit(c.req.query('limit'));
  const sourceFilter = c.req.query('source') as 'audit' | 'security' | undefined;
  const severityFilter = c.req.query('severity');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const { from: dateFrom, to: dateTo } = parseDateRange(from, to);

  const entries: UnifiedEntry[] = [];

  // Query audit log
  if (!sourceFilter || sourceFilter === 'audit') {
    const auditConditions = [];
    if (dateFrom) auditConditions.push(gte(auditLog.createdAt, dateFrom));
    if (dateTo) auditConditions.push(lte(auditLog.createdAt, dateTo));

    const auditRows = await db
      .select()
      .from(auditLog)
      .where(auditConditions.length > 0 ? and(...auditConditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    for (const row of auditRows) {
      entries.push({
        id: row.id,
        timestamp: row.createdAt,
        source: 'audit',
        type: row.action,
        severity: 'info',
        actorId: row.actorId,
        instanceId: row.instanceId,
        details: row.details,
      });
    }
  }

  // Query security events
  if (!sourceFilter || sourceFilter === 'security') {
    const secConditions = [];
    if (dateFrom) secConditions.push(gte(securityEvents.createdAt, dateFrom));
    if (dateTo) secConditions.push(lte(securityEvents.createdAt, dateTo));
    if (severityFilter) secConditions.push(eq(securityEvents.severity, severityFilter as typeof securityEvents.severity.enumValues[number]));

    const secRows = await db
      .select()
      .from(securityEvents)
      .where(secConditions.length > 0 ? and(...secConditions) : undefined)
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit);

    for (const row of secRows) {
      entries.push({
        id: row.id,
        timestamp: row.createdAt,
        source: 'security',
        type: row.eventType,
        severity: row.severity,
        actorId: null,
        instanceId: row.instanceId,
        details: row.details,
      });
    }
  }

  // Merge and sort by timestamp descending
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const data = entries.slice(0, limit);

  return c.json({ data, total: data.length });
});

/** GET /api/admin/audit/export — CSV export */
adminAuditRoutes.get('/export', async (c) => {
  const db = c.get('db');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const { from: dateFrom, to: dateTo } = parseDateRange(from, to);

  const conditions = [];
  if (dateFrom) conditions.push(gte(auditLog.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(auditLog.createdAt, dateTo));

  const rows = await db
    .select()
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(10000);

  const header = 'id,timestamp,action,actorId,instanceId,details\n';
  const csv = rows.map((r) =>
    `${r.id},${r.createdAt},${r.action},${r.actorId ?? ''},${r.instanceId},${(r.details ?? '').replace(/,/g, ';')}`,
  ).join('\n');

  return new Response(header + csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
});

export { adminAuditRoutes };
