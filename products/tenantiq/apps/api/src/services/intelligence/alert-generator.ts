import type { Env } from '../../index';
import { getDb, schema } from '../../lib/db';
import { createGraphClient } from '../../lib/graph-client';
import type { InactiveUserAlert, ActivitySnapshot } from './types';
import {
	calculateActivityScore,
	getInactivitySeverity,
	calculateLicenseCost,
} from './anomaly-scorer';
import {
	storeSnapshots,
	createInactiveUserAlerts,
	completeScan,
	failScan,
} from './scan-helpers';

/**
 * Analyze inactive users and create alerts
 */
export async function analyzeInactiveUsers(env: Env, tenantId: string): Promise<InactiveUserAlert[]> {
	const db = getDb(env);
	const graphClient = createGraphClient(env, tenantId);

	const scanId = crypto.randomUUID();
	await db.insert(schema.intelligenceScans).values({
		id: scanId,
		tenantId,
		scanType: 'inactive_users',
		startedAt: new Date().toISOString(),
		status: 'running',
		findingsCount: 0,
		alertsCreated: 0,
	});

	try {
		const users = await graphClient.getUsers();

		const [mailboxActivity, teamsActivity, sharepointActivity] = await Promise.all([
			graphClient.getMailboxUsage('D7'),
			graphClient.getTeamsActivity('D7'),
			graphClient.getSharePointActivity('D7'),
		]);

		const mailboxMap = new Map(
			mailboxActivity.map((m) => [m.userPrincipalName.toLowerCase(), m])
		);
		const teamsMap = new Map(
			teamsActivity.map((t) => [t.userPrincipalName.toLowerCase(), t])
		);
		const sharepointMap = new Map(
			sharepointActivity.map((s) => [s.userPrincipalName.toLowerCase(), s])
		);

		const inactiveUsers: InactiveUserAlert[] = [];
		const snapshots: ActivitySnapshot[] = [];
		const now = new Date();

		for (const user of users) {
			if (!user.accountEnabled) continue;

			const upn = user.userPrincipalName.toLowerCase();
			const lastSignIn = user.signInActivity?.lastSignInDateTime;
			const daysSinceSignIn = lastSignIn
				? Math.floor((now.getTime() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60 * 24))
				: 9999;

			const mailbox = mailboxMap.get(upn);
			const teams = teamsMap.get(upn);
			const sharepoint = sharepointMap.get(upn);

			const activityScore = calculateActivityScore({
				daysSinceSignIn,
				hasMailboxActivity: !!mailbox?.lastActivityDate,
				hasTeamsActivity: !!teams?.lastActivityDate,
				hasSharePointActivity: !!sharepoint?.lastActivityDate,
				teamsChatCount: Number(teams?.teamChatMessageCount ?? 0),
				teamsCallCount: Number(teams?.callCount ?? 0),
				sharePointFileCount: Number(sharepoint?.viewedOrEditedFileCount ?? 0),
			});

			const licenseCost = calculateLicenseCost(user.assignedLicenses);

			snapshots.push({
				userId: user.id,
				lastSignIn: lastSignIn || null,
				lastExchangeActivity: mailbox?.lastActivityDate || null,
				lastTeamsActivity: teams?.lastActivityDate || null,
				lastSharePointActivity: sharepoint?.lastActivityDate || null,
				activityScore,
				assignedLicenses: user.assignedLicenses.map((l) => l.skuId),
				licenseCostMonthly: licenseCost,
			});

			const severity = getInactivitySeverity(daysSinceSignIn);
			if (severity) {
				inactiveUsers.push({
					userId: user.id,
					userPrincipalName: user.userPrincipalName,
					displayName: user.displayName,
					daysSinceLastSignIn: daysSinceSignIn,
					severity,
					estimatedMonthlyCost: licenseCost,
					assignedLicenses: user.assignedLicenses.map((l) => l.skuId),
				});
			}
		}

		await storeSnapshots(db, tenantId, snapshots, now);
		const alertsCreated = await createInactiveUserAlerts(db, tenantId, inactiveUsers, now);
		await completeScan(db, scanId, users.length, inactiveUsers, alertsCreated);

		return inactiveUsers;
	} catch (error) {
		await failScan(db, scanId, error);
		throw error;
	}
}
