import { eq, desc } from 'drizzle-orm';
import type { Database } from '../connection';
import { remediationLog } from '../schema-d1';

type DB = Database;

export async function getRemediationsByTenant(
	db: DB,
	tenantId: string,
	filters?: { limit?: number; offset?: number },
) {
	return db
		.select()
		.from(remediationLog)
		.where(eq(remediationLog.tenantId, tenantId))
		.orderBy(desc(remediationLog.executedAt))
		.limit(filters?.limit ?? 50)
		.offset(filters?.offset ?? 0);
}

export async function getRemediationById(db: DB, remediationId: string) {
	const result = await db
		.select()
		.from(remediationLog)
		.where(eq(remediationLog.id, remediationId))
		.limit(1);
	return result[0] ?? null;
}

export async function createRemediationEntry(
	db: DB,
	entry: {
		tenantId: string;
		actor: string;
		actionType: string;
		targetResource?: string;
		beforeState?: unknown;
		afterState?: unknown;
		status?: string;
	},
) {
	const result = await db
		.insert(remediationLog)
		.values({
			id: crypto.randomUUID(),
			tenantId: entry.tenantId,
			actor: entry.actor,
			actionType: entry.actionType,
			targetResource: entry.targetResource,
			beforeState: entry.beforeState ? JSON.stringify(entry.beforeState) : null,
			afterState: entry.afterState ? JSON.stringify(entry.afterState) : null,
			status: entry.status ?? 'pending',
			executedAt: Math.floor(Date.now() / 1000),
		})
		.returning();
	return result[0];
}

export async function updateRemediationStatus(
	db: DB,
	remediationId: string,
	status: string,
	afterState?: unknown,
	errorMessage?: string,
) {
	return db
		.update(remediationLog)
		.set({
			status,
			afterState: afterState !== undefined ? JSON.stringify(afterState) : undefined,
			errorMessage: errorMessage ?? undefined,
			completedAt: Math.floor(Date.now() / 1000),
		})
		.where(eq(remediationLog.id, remediationId));
}
