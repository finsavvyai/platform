/**
 * Cost Optimization Advisor — Analysis engine
 * Analyzes license usage and generates cost savings recommendations
 */

import type { LicenseUsageData, CostOptimizationResult, CostRecommendation } from './cost-optimizer.types';

/**
 * Analyze license usage and generate cost optimization recommendations
 */
export function analyzeCostOptimization(
	licenses: LicenseUsageData[],
	inactivityThresholds = { warning: 30, critical: 60, severe: 90 }
): CostOptimizationResult {
	const recommendations: CostRecommendation[] = [];
	let totalMonthlyCost = 0;
	let potentialMonthlySavings = 0;

	// Calculate total monthly cost
	for (const license of licenses) {
		totalMonthlyCost += license.assigned * license.costPerUnit;
	}

	// 1. Identify unassigned licenses (waste)
	for (const license of licenses) {
		const unassigned = license.total - license.assigned;
		if (unassigned > 0) {
			const monthlySavings = unassigned * license.costPerUnit;
			potentialMonthlySavings += monthlySavings;

			recommendations.push({
				id: `unused-${license.skuId}`,
				category: 'unused_licenses',
				severity: unassigned > 5 ? 'high' : unassigned > 2 ? 'medium' : 'low',
				title: `${unassigned} Unassigned ${license.skuName} Licenses`,
				description: `You have ${unassigned} ${license.skuName} licenses that are purchased but not assigned to any users. These licenses are generating zero value.`,
				monthlySavings,
				annualSavings: monthlySavings * 12,
				affectedUsers: 0,
				actionItems: [
					`Remove ${unassigned} unassigned licenses from your subscription`,
					'Update license count at next renewal',
					'Set up alerts for license utilization dropping below 90%',
				],
				riskLevel: 'low',
				implementationEffort: 'easy',
			});
		}
	}

	// 2. Identify inactive users with expensive licenses
	for (const license of licenses) {
		const inactiveUsers = license.users.filter(
			(u) => u.inactiveDays >= inactivityThresholds.critical && u.lastSignIn !== null
		);

		if (inactiveUsers.length > 0) {
			const monthlySavings = inactiveUsers.length * license.costPerUnit;
			potentialMonthlySavings += monthlySavings;

			recommendations.push({
				id: `inactive-${license.skuId}`,
				category: 'inactive_users',
				severity: inactiveUsers.length > 10 ? 'high' : inactiveUsers.length > 5 ? 'medium' : 'low',
				title: `${inactiveUsers.length} Inactive Users with ${license.skuName}`,
				description: `${inactiveUsers.length} users haven't signed in for ${inactivityThresholds.critical}+ days but still have ${license.skuName} licenses assigned. Consider removing licenses or offboarding these users.`,
				monthlySavings,
				annualSavings: monthlySavings * 12,
				affectedUsers: inactiveUsers.length,
				actionItems: [
					`Review the ${inactiveUsers.length} inactive users (see detailed list)`,
					'Contact managers to confirm employment status',
					'Remove licenses from confirmed inactive users',
					'Consider offboarding users who have left the organization',
				],
				riskLevel: 'low',
				implementationEffort: 'moderate',
			});
		}
	}

	// 3. Identify E5 to E3 downgrade opportunities
	potentialMonthlySavings += addDowngradeRecommendations(licenses, inactivityThresholds, recommendations);

	// 4. Storage optimization opportunities
	addStorageRecommendation(recommendations);

	// Sort recommendations by potential savings (highest first)
	recommendations.sort((a, b) => b.monthlySavings - a.monthlySavings);

	const potentialAnnualSavings = potentialMonthlySavings * 12;
	const summary = generateSummary(totalMonthlyCost, potentialMonthlySavings, recommendations.length);

	return {
		totalMonthlyCost,
		potentialMonthlySavings,
		potentialAnnualSavings,
		recommendations,
		summary,
	};
}

function addDowngradeRecommendations(
	licenses: LicenseUsageData[],
	inactivityThresholds: { warning: number; critical: number; severe: number },
	recommendations: CostRecommendation[]
): number {
	const e5License = licenses.find((l) => l.skuName.includes('E5') || l.skuName.includes('Microsoft 365 E5'));
	if (!e5License) return 0;

	const e3Cost = 23;
	const e5Cost = e5License.costPerUnit || 38;

	const downgradeCandidates = e5License.users.filter((u) => u.inactiveDays > inactivityThresholds.warning);
	if (downgradeCandidates.length === 0) return 0;

	const monthlySavings = downgradeCandidates.length * (e5Cost - e3Cost);

	recommendations.push({
		id: 'e5-to-e3-downgrade',
		category: 'license_downgrade',
		severity: downgradeCandidates.length > 20 ? 'high' : downgradeCandidates.length > 10 ? 'medium' : 'low',
		title: `${downgradeCandidates.length} Users Can Downgrade from E5 to E3`,
		description: `${downgradeCandidates.length} users have E5 licenses but show low activity or don't use advanced features like Power BI, Advanced Threat Protection, or eDiscovery. Downgrading to E3 maintains core functionality at lower cost.`,
		monthlySavings,
		annualSavings: monthlySavings * 12,
		affectedUsers: downgradeCandidates.length,
		actionItems: [
			'Analyze actual E5 feature usage per user (Power BI, ATP, eDiscovery)',
			'Identify users who only use email, Teams, and Office apps',
			'Pilot E3 downgrade with 5-10 users for 30 days',
			'Monitor for any feature access issues',
			'Roll out downgrade to remaining users',
		],
		riskLevel: 'medium',
		implementationEffort: 'moderate',
	});

	return monthlySavings;
}

function addStorageRecommendation(recommendations: CostRecommendation[]): void {
	recommendations.push({
		id: 'storage-optimization',
		category: 'storage',
		severity: 'medium',
		title: 'Storage Optimization Opportunities',
		description:
			'Large mailboxes and unused OneDrive files can be archived or cleaned up to reduce storage costs and improve performance.',
		monthlySavings: 0,
		annualSavings: 0,
		affectedUsers: 0,
		actionItems: [
			'Identify mailboxes over 50GB and review with users',
			'Enable archive mailboxes for users with large mailboxes',
			'Scan OneDrive for files not accessed in 12+ months',
			'Implement retention policies to auto-delete old files',
			'Consider moving cold data to cheaper storage tiers',
		],
		riskLevel: 'low',
		implementationEffort: 'moderate',
	});
}

function generateSummary(
	totalMonthlyCost: number,
	potentialMonthlySavings: number,
	recommendationCount: number
): string {
	const savingsPercentage = ((potentialMonthlySavings / totalMonthlyCost) * 100).toFixed(1);
	const annualSavings = potentialMonthlySavings * 12;

	return `Found ${recommendationCount} cost optimization opportunities that could save $${potentialMonthlySavings.toFixed(2)}/month ($${annualSavings.toFixed(2)}/year), representing ${savingsPercentage}% of your current license spend. The highest-impact actions are removing unassigned licenses and addressing inactive users.`;
}
