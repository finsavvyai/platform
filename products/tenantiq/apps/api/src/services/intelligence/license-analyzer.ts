import type { Env } from '../../index';
import { getDb, schema } from '../../lib/db';
import { createGraphClient } from '../../lib/graph-client';
import { eq } from 'drizzle-orm';
import { LICENSE_PRICING } from './types';
import { isLicenseUsed } from './anomaly-scorer';
import { createUnusedLicenseAlert, checkDowngradeOpportunity } from './license-alerts';

interface LicenseWasteResult {
	unusedLicenses: number;
	underutilizedLicenses: number;
	downgradeOpportunities: number;
	totalMonthlySavings: number;
}

/**
 * Analyze license waste and suggest optimizations
 */
export async function analyzeLicenseWaste(env: Env, tenantId: string): Promise<LicenseWasteResult> {
	const db = getDb(env);
	const graphClient = createGraphClient(env, tenantId);

	const scanId = crypto.randomUUID();
	await db.insert(schema.intelligenceScans).values({
		id: scanId,
		tenantId,
		scanType: 'license_waste',
		startedAt: new Date().toISOString(),
		status: 'running',
		findingsCount: 0,
		alertsCreated: 0,
	});

	try {
		const users = await graphClient.getUsers();

		const [mailboxActivity, teamsActivity, sharepointActivity] = await Promise.all([
			graphClient.getMailboxUsage('D30'),
			graphClient.getTeamsActivity('D30'),
			graphClient.getSharePointActivity('D30'),
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

		let unusedLicenses = 0;
		let underutilizedLicenses = 0;
		let downgradeOpportunities = 0;
		let totalMonthlySavings = 0;
		let alertsCreated = 0;
		const now = new Date();

		for (const user of users) {
			if (!user.accountEnabled) continue;

			const upn = user.userPrincipalName.toLowerCase();
			const mailbox = mailboxMap.get(upn);
			const teams = teamsMap.get(upn);
			const sharepoint = sharepointMap.get(upn);

			for (const license of user.assignedLicenses) {
				const skuId = license.skuId;
				const licenseCost = LICENSE_PRICING[skuId] || 2000;

				const isUsed = isLicenseUsed(skuId, {
					hasMailboxActivity: !!mailbox?.lastActivityDate,
					hasTeamsActivity: !!teams?.lastActivityDate,
					hasSharePointActivity: !!sharepoint?.lastActivityDate,
					teamsChatCount: typeof teams?.teamChatMessageCount === 'number' ? teams.teamChatMessageCount : parseInt(teams?.teamChatMessageCount || '0', 10),
					teamsCallCount: typeof teams?.callCount === 'number' ? teams.callCount : parseInt(teams?.callCount || '0', 10),
				});

				if (!isUsed) {
					unusedLicenses++;
					totalMonthlySavings += licenseCost;
					alertsCreated += await createUnusedLicenseAlert(db, tenantId, user, skuId, licenseCost, now);
				}

				if (skuId === 'ENTERPRISEPREMIUM' || skuId === 'SPE_E5') {
					const result = await checkDowngradeOpportunity(db, tenantId, user, skuId, teams, now);
					downgradeOpportunities += result.downgraded ? 1 : 0;
					totalMonthlySavings += result.savings;
					alertsCreated += result.alertCreated ? 1 : 0;
				}
			}
		}

		await db
			.update(schema.intelligenceScans)
			.set({
				completedAt: new Date().toISOString(),
				status: 'completed',
				findingsCount: unusedLicenses + downgradeOpportunities,
				alertsCreated,
				metadata: JSON.stringify({ unusedLicenses, underutilizedLicenses, downgradeOpportunities, totalMonthlySavings }),
			})
			.where(eq(schema.intelligenceScans.id, scanId));

		return { unusedLicenses, underutilizedLicenses, downgradeOpportunities, totalMonthlySavings };
	} catch (error) {
		await db
			.update(schema.intelligenceScans)
			.set({
				completedAt: new Date().toISOString(),
				status: 'failed',
				metadata: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
			})
			.where(eq(schema.intelligenceScans.id, scanId));

		throw error;
	}
}
