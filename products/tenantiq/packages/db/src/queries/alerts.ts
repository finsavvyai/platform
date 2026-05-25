import { eq, and, desc, count } from 'drizzle-orm';
import type { Database } from '../connection';
import { alerts } from '../schema-d1';

type DB = Database;

export async function getAlertsByTenant(
	db: DB,
	tenantId: string,
	filters?: {
		status?: string;
		severity?: string;
		category?: string;
		limit?: number;
		offset?: number;
	}
) {
	const conditions = [eq(alerts.tenantId, tenantId)];

	if (filters?.status) {
		conditions.push(eq(alerts.status, filters.status));
	}
	if (filters?.severity) {
		conditions.push(eq(alerts.severity, filters.severity));
	}
	// `category` filter deprecated — D1 alerts table has no category column.
	// Use `type` filter for equivalent behavior.

	return db
		.select()
		.from(alerts)
		.where(and(...conditions))
		.orderBy(desc(alerts.createdAt))
		.limit(filters?.limit ?? 50)
		.offset(filters?.offset ?? 0);
}

export async function countAlertsByTenant(
	db: DB,
	tenantId: string,
	filters?: {
		status?: string;
		severity?: string;
		category?: string;
	}
) {
	const conditions = [eq(alerts.tenantId, tenantId)];

	if (filters?.status) {
		conditions.push(eq(alerts.status, filters.status));
	}
	if (filters?.severity) {
		conditions.push(eq(alerts.severity, filters.severity));
	}
	// `category` filter deprecated — D1 alerts table has no category column.
	// Use `type` filter for equivalent behavior.

	const result = await db
		.select({ count: count() })
		.from(alerts)
		.where(and(...conditions));

	return Number(result[0]?.count ?? 0);
}

export async function getAlertById(db: DB, alertId: string) {
	const result = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
	return result[0] ?? null;
}

export async function updateAlertStatus(
	db: DB,
	alertId: string,
	status: string,
	resolvedBy?: string
) {
	return db
		.update(alerts)
		.set({
			status,
			resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined,
			resolvedBy,
		})
		.where(eq(alerts.id, alertId));
}

export async function getAlertCountsByTenant(db: DB, tenantId: string) {
	const rows = await db
		.select({
			severity: alerts.severity,
			count: count()
		})
		.from(alerts)
		.where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, 'active')))
		.groupBy(alerts.severity);

	const counts: Record<string, number> = {};
	let total = 0;
	for (const row of rows) {
		counts[row.severity] = Number(row.count);
		total += Number(row.count);
	}

	return {
		critical: counts['critical'] ?? 0,
		high: counts['high'] ?? 0,
		medium: counts['medium'] ?? 0,
		low: counts['low'] ?? 0,
		total
	};
}
