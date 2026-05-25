import { eq, and, desc, gte, lte, count } from 'drizzle-orm';
import type { Database } from '../connection';
import { tenantAuditLog } from '../schema-d1';

type DB = Database;

/** Tenant-scoped audit log. `created_at` is stored as unix seconds. */
export async function getAuditLog(
	db: DB,
	tenantId: string,
	filters?: {
		actor?: string;
		action?: string;
		dateFrom?: Date;
		dateTo?: Date;
		limit?: number;
		offset?: number;
	},
) {
	const conditions = [eq(tenantAuditLog.tenantId, tenantId)];
	if (filters?.actor) conditions.push(eq(tenantAuditLog.actor, filters.actor));
	if (filters?.action) conditions.push(eq(tenantAuditLog.action, filters.action));
	if (filters?.dateFrom) conditions.push(gte(tenantAuditLog.createdAt, Math.floor(filters.dateFrom.getTime() / 1000)));
	if (filters?.dateTo) conditions.push(lte(tenantAuditLog.createdAt, Math.floor(filters.dateTo.getTime() / 1000)));

	return db
		.select()
		.from(tenantAuditLog)
		.where(and(...conditions))
		.orderBy(desc(tenantAuditLog.createdAt))
		.limit(filters?.limit ?? 50)
		.offset(filters?.offset ?? 0);
}

export async function countAuditLog(
	db: DB,
	tenantId: string,
	filters?: {
		actor?: string;
		action?: string;
		dateFrom?: Date;
		dateTo?: Date;
	},
) {
	const conditions = [eq(tenantAuditLog.tenantId, tenantId)];
	if (filters?.actor) conditions.push(eq(tenantAuditLog.actor, filters.actor));
	if (filters?.action) conditions.push(eq(tenantAuditLog.action, filters.action));
	if (filters?.dateFrom) conditions.push(gte(tenantAuditLog.createdAt, Math.floor(filters.dateFrom.getTime() / 1000)));
	if (filters?.dateTo) conditions.push(lte(tenantAuditLog.createdAt, Math.floor(filters.dateTo.getTime() / 1000)));

	const result = await db
		.select({ count: count() })
		.from(tenantAuditLog)
		.where(and(...conditions));

	return Number(result[0]?.count ?? 0);
}

export async function createAuditEntry(
	db: DB,
	entry: {
		tenantId: string;
		actor: string;
		action: string;
		resourceType?: string;
		resourceId?: string;
		details?: unknown;
		ipAddress?: string;
	},
) {
	return db.insert(tenantAuditLog).values({
		id: crypto.randomUUID(),
		tenantId: entry.tenantId,
		actor: entry.actor,
		action: entry.action,
		resourceType: entry.resourceType,
		resourceId: entry.resourceId,
		details: entry.details !== undefined ? JSON.stringify(entry.details) : null,
		ipAddress: entry.ipAddress,
		createdAt: Math.floor(Date.now() / 1000),
	});
}
