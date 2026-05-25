/**
 * Executive Report Actions, Financial Summary & Compliance Section
 *
 * Builds prioritized key actions, financial summary, and compliance section.
 */

import type { ReportMetrics, ReportAction, FinancialSummary, ReportSection } from './types';
import { formatCurrency, formatPct } from './helpers';

export function buildKeyActions(m: ReportMetrics): ReportAction[] {
	const actions: ReportAction[] = [];

	if (m.wastedLicenseCost > 200) {
		actions.push({
			priority: m.wastedLicenseCost > 1000 ? 'critical' : 'high',
			title: 'Reclaim wasted licenses',
			description: `${formatCurrency(m.wastedLicenseCost)}/mo in recoverable waste identified. Run the License Reclamation Autopilot.`,
			estimatedSavings: m.wastedLicenseCost * 12,
		});
	}

	if (m.mfaAdoptionRate < 90) {
		actions.push({
			priority: m.mfaAdoptionRate < 70 ? 'critical' : 'high',
			title: 'Enforce MFA for all users',
			description: `${formatPct(100 - m.mfaAdoptionRate)} of users lack MFA — enable Conditional Access policy.`,
		});
	}

	if (m.alertsGenerated - m.alertsResolved > 5) {
		actions.push({
			priority: 'high',
			title: 'Resolve outstanding alerts',
			description: `${m.alertsGenerated - m.alertsResolved} alerts pending resolution. Prioritize critical items.`,
		});
	}

	if (m.secureScore < 70) {
		actions.push({
			priority: 'medium',
			title: 'Improve Secure Score',
			description: `Current Secure Score (${m.secureScore}) below target (70). Follow Microsoft recommendations.`,
		});
	}

	if (m.complianceScore < 70) {
		actions.push({
			priority: 'medium',
			title: 'Strengthen compliance posture',
			description: `Enable DLP policies, sensitivity labels, and audit retention.`,
		});
	}

	return actions.sort((a, b) => {
		const order = { critical: 0, high: 1, medium: 2, low: 3 };
		return order[a.priority] - order[b.priority];
	});
}

export function buildFinancialSummary(m: ReportMetrics): FinancialSummary {
	const costPerUser = m.activeUsers > 0 ? m.monthlyLicenseCost / m.activeUsers : 0;
	const industryAvg = 32; // $/user/mo industry average
	const roi = m.savingsRealized > 0 ? (m.savingsRealized / (m.monthlyLicenseCost * 0.05)) * 100 : 0;

	return {
		totalSpend: m.monthlyLicenseCost,
		wastedSpend: m.wastedLicenseCost,
		savingsRealized: m.savingsRealized,
		projectedSavings: m.wastedLicenseCost * 12,
		costPerUser: Math.round(costPerUser),
		industryAvgCostPerUser: industryAvg,
		roi: Math.round(roi),
	};
}

export function buildComplianceSection(m: ReportMetrics): ReportSection {
	const compChange = m.complianceScore - m.previousComplianceScore;
	return {
		title: 'Compliance & Governance',
		icon: '📋',
		summary: `Compliance score: ${m.complianceScore}/100 (${compChange >= 0 ? '+' : ''}${compChange} vs last period).`,
		kpis: [
			{
				label: 'Compliance Score',
				value: `${m.complianceScore}/100`,
				previousValue: `${m.previousComplianceScore}/100`,
				change: compChange,
				changeDirection: compChange > 0 ? 'up' : compChange < 0 ? 'down' : 'stable',
				isPositive: compChange >= 0,
				icon: '✅',
			},
		],
		highlights: [
			m.complianceScore >= 85 ? 'Compliance score above 85 — strong governance' : '',
		].filter(Boolean),
		risks: [
			m.complianceScore < 60 ? 'Compliance score critically low — review DLP and retention policies' : '',
		].filter(Boolean),
		chartData: {
			type: 'gauge',
			labels: ['Compliance'],
			values: [m.complianceScore],
			colors: [m.complianceScore >= 80 ? '#10b981' : m.complianceScore >= 60 ? '#f59e0b' : '#ef4444'],
		},
	};
}
