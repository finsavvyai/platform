import { eq } from 'drizzle-orm';
import type { Database } from '../connection';
import { organizations, platformUsers } from '../schema-d1';

type DB = Database;

export async function getOrganizationById(db: DB, orgId: string) {
	const result = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
	return result[0] ?? null;
}

export async function createOrganization(db: DB, data: typeof organizations.$inferInsert) {
	const result = await db.insert(organizations).values(data).returning();
	return result[0];
}

export async function getPlatformUserByEmail(db: DB, email: string) {
	const result = await db
		.select()
		.from(platformUsers)
		.where(eq(platformUsers.email, email))
		.limit(1);
	return result[0] ?? null;
}

export async function getPlatformUserByAzureOid(db: DB, azureOid: string) {
	const result = await db
		.select()
		.from(platformUsers)
		.where(eq(platformUsers.azureOid, azureOid))
		.limit(1);
	return result[0] ?? null;
}

export async function createPlatformUser(db: DB, data: typeof platformUsers.$inferInsert) {
	const result = await db.insert(platformUsers).values(data).returning();
	return result[0];
}

/** D1 stores `last_login_at` as unix seconds. */
export async function updatePlatformUserLogin(db: DB, userId: string) {
	return db
		.update(platformUsers)
		.set({ lastLoginAt: Math.floor(Date.now() / 1000) })
		.where(eq(platformUsers.id, userId));
}
