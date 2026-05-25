import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { AppEnv } from '../app/types';

const audit = new Hono<AppEnv>();

audit.use('*', authMiddleware);
audit.use('*', standardRateLimit);

audit.get('/logs', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const eventType = c.req.query('eventType');
	const actorId = c.req.query('actorId');
	const startDate = c.req.query('startDate');
	const endDate = c.req.query('endDate');
	const db = getDb(c.env);

	const conditions = [eq(schema.auditLogs.tenantId, tenantId)];

	if (eventType) conditions.push(eq(schema.auditLogs.eventType, eventType));
	if (actorId) conditions.push(eq(schema.auditLogs.actorId, actorId));
	if (startDate) conditions.push(gte(schema.auditLogs.timestamp, startDate));
	if (endDate) conditions.push(lte(schema.auditLogs.timestamp, endDate));

	const logs = await db
		.select()
		.from(schema.auditLogs)
		.where(and(...conditions))
		.orderBy(desc(schema.auditLogs.timestamp))
		.limit(100);

	return c.json({ logs, count: logs.length });
});

audit.get('/reports', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	const reports = await db
		.select()
		.from(schema.reports)
		.where(eq(schema.reports.tenantId, tenantId))
		.orderBy(desc(schema.reports.createdAt));

	return c.json({ reports });
});

export default audit;
