import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../connection';
import { tenants } from '../schema-d1';

type DB = Database;

export async function getTenantsByOrganization(db: DB, organizationId: string) {
	return db
		.select()
		.from(tenants)
		.where(eq(tenants.organizationId, organizationId))
		.orderBy(desc(tenants.createdAt));
}

export async function getTenantById(db: DB, tenantId: string) {
	const result = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
	return result[0] ?? null;
}

export async function getTenantByAzureId(db: DB, azureTenantId: string) {
	const result = await db
		.select()
		.from(tenants)
		.where(eq(tenants.azureTenantId, azureTenantId))
		.limit(1);
	return result[0] ?? null;
}

export async function createTenant(db: DB, data: typeof tenants.$inferInsert) {
	const result = await db.insert(tenants).values(data).returning();
	return result[0];
}

export async function updateTenant(
	db: DB,
	tenantId: string,
	data: Partial<typeof tenants.$inferInsert>,
) {
	return db.update(tenants).set(data).where(eq(tenants.id, tenantId)).returning();
}

/** D1 stores timestamps as unix-second integers. */
export async function updateTenantSyncTime(db: DB, tenantId: string) {
	return db
		.update(tenants)
		.set({ lastSyncAt: Math.floor(Date.now() / 1000) })
		.where(eq(tenants.id, tenantId));
}

export async function disconnectTenant(db: DB, tenantId: string) {
	return db
		.update(tenants)
		.set({
			status: 'disconnected',
			accessTokenEncrypted: null,
			refreshTokenEncrypted: null,
		})
		.where(eq(tenants.id, tenantId));
}

export async function getAllActiveTenants(db: DB) {
	return db.select().from(tenants).where(eq(tenants.status, 'active'));
}
