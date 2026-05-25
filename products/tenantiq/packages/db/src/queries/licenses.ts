import { eq } from 'drizzle-orm';
import type { Database } from '../connection';
import { licensesCache } from '../schema-d1';

type DB = Database;

/** Returns D1 rows with snake→camel mapping: `sku_part_number`, `consumed_units`, `enabled_units`. */
export async function getLicensesByTenant(db: DB, tenantId: string) {
	return db.select().from(licensesCache).where(eq(licensesCache.tenantId, tenantId));
}

export async function upsertLicense(
	db: DB,
	tenantId: string,
	skuId: string,
	data: Partial<typeof licensesCache.$inferInsert>,
) {
	const nowSec = Math.floor(Date.now() / 1000);
	return db
		.insert(licensesCache)
		.values({
			id: (data.id as string) ?? crypto.randomUUID(),
			tenantId,
			skuId,
			skuPartNumber: data.skuPartNumber ?? skuId,
			consumedUnits: data.consumedUnits ?? 0,
			enabledUnits: data.enabledUnits ?? 0,
			prepaidUnits: data.prepaidUnits ?? 0,
			syncedAt: nowSec,
			...data,
		})
		.onConflictDoUpdate({
			target: [licensesCache.tenantId, licensesCache.skuId],
			set: { ...data, syncedAt: nowSec },
		});
}

/** License waste — enabled units not consumed. D1 schema doesn't track cost; callers
 *  must look up cost via `getSkuCost()` from the API lib. */
export async function getLicenseWaste(db: DB, tenantId: string) {
	const licenses = await getLicensesByTenant(db, tenantId);
	type License = Awaited<ReturnType<typeof getLicensesByTenant>>[number];
	return licenses
		.filter((l: License) => (l.enabledUnits ?? 0) > (l.consumedUnits ?? 0))
		.map((l: License) => ({
			skuPartNumber: l.skuPartNumber,
			unused: (l.enabledUnits ?? 0) - (l.consumedUnits ?? 0),
		}));
}
