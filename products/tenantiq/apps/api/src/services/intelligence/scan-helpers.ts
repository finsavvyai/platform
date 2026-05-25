import { getDb, schema } from '../../lib/db';
import { eq } from 'drizzle-orm';
import type { InactiveUserAlert, ActivitySnapshot } from './types';

/**
 * Shared scan lifecycle helpers for the intelligence engine
 */

export async function storeSnapshots(
	db: ReturnType<typeof getDb>,
	tenantId: string,
	snapshots: ActivitySnapshot[],
	now: Date
): Promise<void> {
	const snapshotDate = now.toISOString().split('T')[0];
	for (const snapshot of snapshots) {
		await db.insert(schema.userActivitySnapshots).values({
			id: crypto.randomUUID(),
			tenantId,
			userId: snapshot.userId,
			lastSignIn: snapshot.lastSignIn,
			lastExchangeActivity: snapshot.lastExchangeActivity,
			lastTeamsActivity: snapshot.lastTeamsActivity,
			lastSharepointActivity: snapshot.lastSharePointActivity,
			assignedLicenses: JSON.stringify(snapshot.assignedLicenses),
			licenseCostMonthly: snapshot.licenseCostMonthly,
			snapshotDate,
			activityScore: snapshot.activityScore,
		});
	}
}

export async function createInactiveUserAlerts(
	db: ReturnType<typeof getDb>,
	tenantId: string,
	inactiveUsers: InactiveUserAlert[],
	now: Date
): Promise<number> {
	let alertsCreated = 0;
	for (const inactiveUser of inactiveUsers) {
		const alertId = crypto.randomUUID();
		await db.insert(schema.alerts).values({
			id: alertId,
			tenantId,
			type: 'optimization',
			severity: inactiveUser.severity,
			title: `Inactive user detected: ${inactiveUser.displayName}`,
			description: `User has not signed in for ${inactiveUser.daysSinceLastSignIn} days. Consider removing licenses or deactivating account.`,
			source: 'intelligence_engine',
			status: 'active',
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
			estimatedCostImpact: inactiveUser.estimatedMonthlyCost,
			estimatedRiskScore: Math.min(100, Math.floor(inactiveUser.daysSinceLastSignIn / 3)),
			affectedUsers: 1,
			resourceId: inactiveUser.userId,
			resourceType: 'user',
			metadata: JSON.stringify({
				userPrincipalName: inactiveUser.userPrincipalName,
				daysSinceLastSignIn: inactiveUser.daysSinceLastSignIn,
				assignedLicenses: inactiveUser.assignedLicenses,
			}),
			recommendations: JSON.stringify([
				{
					action: 'remove_licenses',
					description: 'Remove unused licenses to save costs',
					estimatedSavings: inactiveUser.estimatedMonthlyCost,
				},
				{
					action: 'disable_account',
					description: 'Disable account if user has left the organization',
				},
			]),
			canAutoRemediate: 0,
		});

		await db.insert(schema.alertHistory).values({
			id: crypto.randomUUID(),
			alertId,
			action: 'created',
			performedBy: 'system',
			performedAt: now.toISOString(),
			notes: 'Alert created by intelligence engine',
		});

		alertsCreated++;
	}
	return alertsCreated;
}

export async function completeScan(
	db: ReturnType<typeof getDb>,
	scanId: string,
	totalUsers: number,
	inactiveUsers: InactiveUserAlert[],
	alertsCreated: number
): Promise<void> {
	await db
		.update(schema.intelligenceScans)
		.set({
			completedAt: new Date().toISOString(),
			status: 'completed',
			findingsCount: inactiveUsers.length,
			alertsCreated,
			metadata: JSON.stringify({
				totalUsers,
				inactiveUsers: inactiveUsers.length,
				totalMonthlyCostAtRisk: inactiveUsers.reduce(
					(sum, u) => sum + u.estimatedMonthlyCost,
					0
				),
			}),
		})
		.where(eq(schema.intelligenceScans.id, scanId));
}

export async function failScan(
	db: ReturnType<typeof getDb>,
	scanId: string,
	error: unknown
): Promise<void> {
	await db
		.update(schema.intelligenceScans)
		.set({
			completedAt: new Date().toISOString(),
			status: 'failed',
			metadata: JSON.stringify({
				error: error instanceof Error ? error.message : 'Unknown error',
			}),
		})
		.where(eq(schema.intelligenceScans.id, scanId));
}
