import type { Env } from '../../index';
import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import type { ActivitySnapshot } from './types';

/**
 * Get activity snapshot for a specific user
 */
export async function getUserActivitySnapshot(
	env: Env,
	userId: string
): Promise<ActivitySnapshot | null> {
	const db = getDb(env);

	const snapshots = await db
		.select()
		.from(schema.userActivitySnapshots)
		.where(
			eq(schema.userActivitySnapshots.userId, userId)
		)
		.orderBy(schema.userActivitySnapshots.snapshotDate)
		.limit(1);

	if (snapshots.length === 0) return null;

	const snapshot = snapshots[0];
	return {
		userId: snapshot.userId,
		lastSignIn: snapshot.lastSignIn,
		lastExchangeActivity: snapshot.lastExchangeActivity,
		lastTeamsActivity: snapshot.lastTeamsActivity,
		lastSharePointActivity: snapshot.lastSharepointActivity,
		activityScore: snapshot.activityScore || 0,
		assignedLicenses: snapshot.assignedLicenses
			? JSON.parse(snapshot.assignedLicenses)
			: [],
		licenseCostMonthly: snapshot.licenseCostMonthly || 0,
	};
}
