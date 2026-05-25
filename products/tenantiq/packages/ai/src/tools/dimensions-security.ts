/**
 * Security & Cost Optimization dimension scoring
 */

import type { HealthDimension, HealthFactor, TenantMetrics } from './health-score-types';
import { factorStatus, scoreToGrade } from './scoring-utils';

function avgFactorScore(factors: HealthFactor[]): number {
	return Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length);
}

export function computeSecurityDimension(m: TenantMetrics): HealthDimension {
	const mfaRate = m.totalUsers > 0 ? (m.mfaEnabledCount / m.totalUsers) * 100 : 0;
	const mfaScore = Math.min(100, mfaRate);

	const adminRatio = m.totalUsers > 0 ? (m.adminCount / m.totalUsers) * 100 : 0;
	const adminScore = adminRatio <= 2 ? 100 : adminRatio <= 5 ? 75 : adminRatio <= 10 ? 50 : 25;

	const guestRatio = m.totalUsers > 0 ? (m.guestUsers / m.totalUsers) * 100 : 0;
	const guestScore = guestRatio <= 5 ? 100 : guestRatio <= 15 ? 75 : guestRatio <= 30 ? 50 : 25;

	const critScore = m.criticalAlerts === 0 ? 100 : m.criticalAlerts <= 2 ? 60 : m.criticalAlerts <= 5 ? 30 : 0;

	const factors: HealthFactor[] = [
		{
			id: 'mfa_adoption',
			label: 'MFA Adoption',
			score: Math.round(mfaScore),
			maxScore: 100,
			status: factorStatus(mfaScore, 100),
			recommendation: mfaScore < 90 ? `Enable MFA for ${m.totalUsers - m.mfaEnabledCount} remaining users` : undefined,
		},
		{
			id: 'admin_ratio',
			label: 'Admin Account Ratio',
			score: adminScore,
			maxScore: 100,
			status: factorStatus(adminScore, 100),
			recommendation: adminScore < 75 ? 'Reduce admin accounts — use PIM for just-in-time access' : undefined,
		},
		{
			id: 'guest_management',
			label: 'Guest User Management',
			score: guestScore,
			maxScore: 100,
			status: factorStatus(guestScore, 100),
			recommendation: guestScore < 75 ? 'Review and remove stale guest accounts' : undefined,
		},
		{
			id: 'critical_alerts',
			label: 'Critical Alert Resolution',
			score: critScore,
			maxScore: 100,
			status: factorStatus(critScore, 100),
			recommendation: critScore < 60 ? `Resolve ${m.criticalAlerts} critical security alerts immediately` : undefined,
		},
	];

	const score = avgFactorScore(factors);
	return { name: 'Security', score, weight: 0.25, grade: scoreToGrade(score), trend: 'stable', trendDelta: 0, factors };
}

export function computeOptimizationDimension(m: TenantMetrics): HealthDimension {
	const utilizationRate = m.totalLicenses > 0 ? (m.assignedLicenses / m.totalLicenses) * 100 : 100;
	const utilizationScore = Math.min(100, utilizationRate);

	const wasteRate = m.monthlyLicenseCost > 0 ? (m.wastedLicenseCost / m.monthlyLicenseCost) * 100 : 0;
	const wasteScore = wasteRate <= 2 ? 100 : wasteRate <= 5 ? 80 : wasteRate <= 15 ? 50 : wasteRate <= 30 ? 25 : 0;

	const inactiveRate = m.totalUsers > 0 ? (m.inactiveUsers30d / m.totalUsers) * 100 : 0;
	const inactiveScore = inactiveRate <= 5 ? 100 : inactiveRate <= 10 ? 75 : inactiveRate <= 20 ? 50 : 25;

	const factors: HealthFactor[] = [
		{
			id: 'license_utilization',
			label: 'License Utilization',
			score: Math.round(utilizationScore),
			maxScore: 100,
			status: factorStatus(utilizationScore, 100),
			recommendation:
				utilizationScore < 85
					? `${m.totalLicenses - m.assignedLicenses} unassigned licenses — reclaim or reduce subscription`
					: undefined,
		},
		{
			id: 'cost_waste',
			label: 'Cost Efficiency',
			score: wasteScore,
			maxScore: 100,
			status: factorStatus(wasteScore, 100),
			recommendation:
				wasteScore < 80
					? `$${m.wastedLicenseCost.toLocaleString()}/mo wasted — run Cost Optimizer to reclaim`
					: undefined,
		},
		{
			id: 'inactive_users',
			label: 'Inactive User Cleanup',
			score: inactiveScore,
			maxScore: 100,
			status: factorStatus(inactiveScore, 100),
			recommendation:
				inactiveScore < 75 ? `${m.inactiveUsers30d} users inactive 30+ days — review and disable` : undefined,
		},
	];

	const score = avgFactorScore(factors);
	return { name: 'Cost Optimization', score, weight: 0.2, grade: scoreToGrade(score), trend: 'stable', trendDelta: 0, factors };
}
