import { getDb, schema } from '../../lib/db';
import { LICENSE_PRICING } from './types';
import { usesE5Features } from './anomaly-scorer';

/**
 * Create an alert for an unused license
 */
export async function createUnusedLicenseAlert(
	db: ReturnType<typeof getDb>,
	tenantId: string,
	user: { id: string; displayName: string; userPrincipalName: string },
	skuId: string,
	licenseCost: number,
	now: Date
): Promise<number> {
	const alertId = crypto.randomUUID();
	await db.insert(schema.alerts).values({
		id: alertId,
		tenantId,
		type: 'optimization',
		severity: 'medium',
		title: `Unused license: ${user.displayName}`,
		description: `User has an assigned ${skuId} license but is not using it. Consider removing to save costs.`,
		source: 'intelligence_engine',
		status: 'active',
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
		estimatedCostImpact: licenseCost,
		estimatedRiskScore: 30,
		affectedUsers: 1,
		resourceId: user.id,
		resourceType: 'license',
		metadata: JSON.stringify({
			userPrincipalName: user.userPrincipalName,
			skuId,
			reason: 'No usage detected in last 30 days',
		}),
		recommendations: JSON.stringify([
			{
				action: 'remove_license',
				description: `Remove ${skuId} license`,
				estimatedSavings: licenseCost,
			},
		]),
		canAutoRemediate: 1,
		autoRemediationAction: 'remove_license',
	});

	await db.insert(schema.alertHistory).values({
		id: crypto.randomUUID(),
		alertId,
		action: 'created',
		performedBy: 'system',
		performedAt: now.toISOString(),
		notes: 'Alert created by license waste analysis',
	});

	return 1;
}

/**
 * Check for E5 to E3 downgrade opportunity and create alert if applicable
 */
export async function checkDowngradeOpportunity(
	db: ReturnType<typeof getDb>,
	tenantId: string,
	user: { id: string; displayName: string; userPrincipalName: string },
	skuId: string,
	teams: { lastActivityDate?: string; callCount?: number | string; meetingCount?: number | string } | undefined,
	now: Date
): Promise<{ downgraded: boolean; savings: number; alertCreated: boolean }> {
	const usesAdvanced = usesE5Features({
		hasTeamsActivity: !!teams?.lastActivityDate,
		teamsCallCount: typeof teams?.callCount === 'number' ? teams.callCount : parseInt(teams?.callCount || '0', 10),
		teamsMeetingCount: typeof teams?.meetingCount === 'number' ? teams.meetingCount : parseInt(teams?.meetingCount || '0', 10),
	});

	if (usesAdvanced) {
		return { downgraded: false, savings: 0, alertCreated: false };
	}

	const savings = (LICENSE_PRICING['ENTERPRISEPREMIUM'] || 5700) -
					(LICENSE_PRICING['ENTERPRISEPACK'] || 2000);

	const alertId = crypto.randomUUID();
	await db.insert(schema.alerts).values({
		id: alertId,
		tenantId,
		type: 'optimization',
		severity: 'low',
		title: `License downgrade opportunity: ${user.displayName}`,
		description: `User has an E5 license but is not using E5-exclusive features. Consider downgrading to E3 to save $${savings / 100}/month.`,
		source: 'intelligence_engine',
		status: 'active',
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
		estimatedCostImpact: savings,
		estimatedRiskScore: 10,
		affectedUsers: 1,
		resourceId: user.id,
		resourceType: 'license',
		metadata: JSON.stringify({
			userPrincipalName: user.userPrincipalName,
			currentSku: skuId,
			suggestedSku: 'ENTERPRISEPACK',
			reason: 'Not using E5-exclusive features',
		}),
		recommendations: JSON.stringify([
			{
				action: 'downgrade_license',
				description: 'Downgrade from E5 to E3',
				estimatedSavings: savings,
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
		notes: 'Alert created by license waste analysis',
	});

	return { downgraded: true, savings, alertCreated: true };
}
