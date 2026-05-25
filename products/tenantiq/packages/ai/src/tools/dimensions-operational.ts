/**
 * Compliance, Adoption, Operational & Governance dimension scoring
 */

import type { HealthDimension, HealthFactor, TenantMetrics } from './health-score-types';
import { factorStatus, scoreToGrade } from './scoring-utils';

function avgFactorScore(factors: HealthFactor[]): number {
	return Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length);
}

export function computeComplianceDimension(m: TenantMetrics): HealthDimension {
	const policyScore = m.compliancePolicies >= 5 ? 100 : m.compliancePolicies >= 3 ? 75 : m.compliancePolicies >= 1 ? 50 : 0;

	const resolutionRate =
		m.activeAlerts + m.resolvedAlertsLast30d > 0
			? (m.resolvedAlertsLast30d / (m.activeAlerts + m.resolvedAlertsLast30d)) * 100
			: 100;
	const resolutionScore = Math.round(Math.min(100, resolutionRate));

	const factors: HealthFactor[] = [
		{
			id: 'compliance_policies',
			label: 'Compliance Policies',
			score: policyScore,
			maxScore: 100,
			status: factorStatus(policyScore, 100),
			recommendation: policyScore < 75 ? 'Enable additional compliance policies (DLP, retention, labeling)' : undefined,
		},
		{
			id: 'alert_resolution',
			label: 'Alert Resolution Rate',
			score: resolutionScore,
			maxScore: 100,
			status: factorStatus(resolutionScore, 100),
			recommendation:
				resolutionScore < 70
					? `${m.activeAlerts} unresolved alerts — prioritize critical items`
					: undefined,
		},
	];

	const score = avgFactorScore(factors);
	return { name: 'Compliance', score, weight: 0.2, grade: scoreToGrade(score), trend: 'stable', trendDelta: 0, factors };
}

export function computeAdoptionDimension(m: TenantMetrics): HealthDimension {
	const activeRate = m.totalUsers > 0 ? (m.activeUsers / m.totalUsers) * 100 : 0;
	const activeScore = Math.round(Math.min(100, activeRate));

	const factors: HealthFactor[] = [
		{
			id: 'user_adoption',
			label: 'Active User Rate',
			score: activeScore,
			maxScore: 100,
			status: factorStatus(activeScore, 100),
			recommendation:
				activeScore < 80
					? `${m.totalUsers - m.activeUsers} users are not actively using M365 — drive adoption campaigns`
					: undefined,
		},
	];

	return { name: 'Adoption', score: activeScore, weight: 0.15, grade: scoreToGrade(activeScore), trend: 'stable', trendDelta: 0, factors };
}

export function computeOperationalDimension(m: TenantMetrics): HealthDimension {
	const syncScore = m.lastSyncHoursAgo <= 6 ? 100 : m.lastSyncHoursAgo <= 12 ? 80 : m.lastSyncHoursAgo <= 24 ? 60 : 30;
	const remediationScore = m.remediationsExecuted >= 10 ? 100 : m.remediationsExecuted >= 5 ? 75 : m.remediationsExecuted >= 1 ? 50 : 25;

	const factors: HealthFactor[] = [
		{
			id: 'sync_freshness',
			label: 'Data Sync Freshness',
			score: syncScore,
			maxScore: 100,
			status: factorStatus(syncScore, 100),
			recommendation: syncScore < 80 ? 'Data is stale — check sync configuration' : undefined,
		},
		{
			id: 'remediation_activity',
			label: 'Remediation Activity',
			score: remediationScore,
			maxScore: 100,
			status: factorStatus(remediationScore, 100),
			recommendation:
				remediationScore < 50
					? 'Low remediation activity — review and action pending alerts'
					: undefined,
		},
	];

	const score = avgFactorScore(factors);
	return { name: 'Operational', score, weight: 0.1, grade: scoreToGrade(score), trend: 'stable', trendDelta: 0, factors };
}

export function computeGovernanceDimension(m: TenantMetrics): HealthDimension {
	const ownerlessScore = m.groupsWithNoOwner <= 0 ? 100 : m.groupsWithNoOwner <= 3 ? 75 : m.groupsWithNoOwner <= 10 ? 50 : 25;

	const factors: HealthFactor[] = [
		{
			id: 'group_governance',
			label: 'Group Ownership',
			score: ownerlessScore,
			maxScore: 100,
			status: factorStatus(ownerlessScore, 100),
			recommendation:
				ownerlessScore < 75
					? `${m.groupsWithNoOwner} groups have no owner — assign owners for accountability`
					: undefined,
		},
	];

	return { name: 'Governance', score: ownerlessScore, weight: 0.1, grade: scoreToGrade(ownerlessScore), trend: 'stable', trendDelta: 0, factors };
}
