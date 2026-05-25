import { eq, and, lt, isNull, or, desc, like } from 'drizzle-orm';
import type { Database } from '../connection';
import { usersCache } from '../schema-d1';

type DB = Database;

/** Column names match D1 SQLite schema (snake_case mapped via Drizzle): `last_sign_in_at`, `synced_at`. */
export async function getUsersByTenant(
	db: DB,
	tenantId: string,
	filters?: { limit?: number; offset?: number },
) {
	return db
		.select()
		.from(usersCache)
		.where(eq(usersCache.tenantId, tenantId))
		.orderBy(desc(usersCache.syncedAt))
		.limit(filters?.limit ?? 50)
		.offset(filters?.offset ?? 0);
}

export async function getInactiveUsers(db: DB, tenantId: string, inactiveDays = 30) {
	const cutoffSec = Math.floor((Date.now() - inactiveDays * 24 * 60 * 60 * 1000) / 1000);

	return db
		.select()
		.from(usersCache)
		.where(
			and(
				eq(usersCache.tenantId, tenantId),
				eq(usersCache.accountEnabled, 1),
				or(lt(usersCache.lastSignInAt, cutoffSec), isNull(usersCache.lastSignInAt)),
			),
		)
		.orderBy(usersCache.lastSignInAt);
}

/** Guest users are external accounts — identified by `#EXT#` in their UPN. */
export async function getGuestUsers(db: DB, tenantId: string) {
	return db
		.select()
		.from(usersCache)
		.where(and(eq(usersCache.tenantId, tenantId), like(usersCache.userPrincipalName, '%#EXT#%')));
}

export async function upsertUser(
	db: DB,
	tenantId: string,
	azureUserId: string,
	data: Partial<typeof usersCache.$inferInsert>,
) {
	const nowSec = Math.floor(Date.now() / 1000);
	return db
		.insert(usersCache)
		.values({ tenantId, azureUserId, createdAt: nowSec, syncedAt: nowSec, ...data })
		.onConflictDoUpdate({
			target: [usersCache.tenantId, usersCache.azureUserId],
			set: { ...data, syncedAt: nowSec },
		});
}
