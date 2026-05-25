/**
 * Executive Report Section Builders
 *
 * Builds individual report sections: security, financial, operations, compliance.
 */

import type { ReportMetrics, ReportSection } from './types';
import { formatCurrency, formatPct } from './helpers';

export function buildSecuritySection(m: ReportMetrics): ReportSection {
	const mfaChange = m.mfaAdoptionRate - 85; // vs baseline
	const scoreChange = m.secureScore - m.previousSecureScore;

	return {
		title: 'Security Posture',
		icon: '🛡️',
		summary: `Secure Score is ${m.secureScore}/100 (${scoreChange >= 0 ? '+' : ''}${scoreChange} vs last period). MFA adoption at ${formatPct(m.mfaAdoptionRate)}.`,
		kpis: [
			{
				label: 'Secure Score',
				value: `${m.secureScore}/100`,
				previousValue: `${m.previousSecureScore}/100`,
				change: scoreChange,
				changeDirection: scoreChange > 0 ? 'up' : scoreChange < 0 ? 'down' : 'stable',
				isPositive: scoreChange >= 0,
				icon: '🔒',
			},
			{
				label: 'MFA Adoption',
				value: formatPct(m.mfaAdoptionRate),
				change: mfaChange,
				changeDirection: mfaChange > 0 ? 'up' : 'stable',
				isPositive: true,
				icon: '🔑',
			},
			{
				label: 'Alerts Resolved',
				value: `${m.alertsResolved}/${m.alertsGenerated}`,
				changeDirection: 'stable',
				isPositive: m.alertsResolved >= m.alertsGenerated * 0.8,
				icon: '🔔',
			},
		],
		highlights: [
			m.mfaAdoptionRate >= 95 ? 'MFA adoption exceeds 95% — excellent security posture' : '',
			m.secureScore >= 80 ? 'Secure Score above industry average (80+)' : '',
			m.alertsResolved > m.alertsGenerated * 0.9 ? 'Over 90% of alerts resolved this period' : '',
		].filter(Boolean),
		risks: [
			m.mfaAdoptionRate < 80 ? `MFA adoption below 80% — ${Math.round((100 - m.mfaAdoptionRate) * m.totalUsers / 100)} users at risk` : '',
			m.secureScore < 60 ? 'Secure Score critically low — immediate action needed' : '',
			m.alertsGenerated - m.alertsResolved > 10 ? `${m.alertsGenerated - m.alertsResolved} unresolved alerts accumulating` : '',
		].filter(Boolean),
		chartData: {
			type: 'gauge',
			labels: ['Secure Score'],
			values: [m.secureScore],
			colors: [m.secureScore >= 80 ? '#10b981' : m.secureScore >= 60 ? '#f59e0b' : '#ef4444'],
		},
	};
}

export function buildFinancialSection(m: ReportMetrics): ReportSection {
	const utilizationRate = m.totalLicenses > 0 ? (m.assignedLicenses / m.totalLicenses) * 100 : 100;
	const costPerUser = m.activeUsers > 0 ? m.monthlyLicenseCost / m.activeUsers : 0;

	return {
		title: 'Financial Overview',
		icon: '💰',
		summary: `Monthly spend: ${formatCurrency(m.monthlyLicenseCost)}. ${formatCurrency(m.savingsRealized)} saved this period. ${formatCurrency(m.wastedLicenseCost)}/mo in recoverable waste.`,
		kpis: [
			{
				label: 'Monthly Spend',
				value: formatCurrency(m.monthlyLicenseCost),
				changeDirection: 'stable',
				isPositive: true,
				icon: '💳',
			},
			{
				label: 'Waste Identified',
				value: formatCurrency(m.wastedLicenseCost),
				changeDirection: m.wastedLicenseCost > 0 ? 'down' : 'stable',
				isPositive: m.wastedLicenseCost === 0,
				icon: '🗑️',
			},
			{
				label: 'Savings Realized',
				value: formatCurrency(m.savingsRealized),
				changeDirection: m.savingsRealized > 0 ? 'up' : 'stable',
				isPositive: m.savingsRealized > 0,
				icon: '💎',
			},
			{
				label: 'License Utilization',
				value: formatPct(utilizationRate),
				changeDirection: 'stable',
				isPositive: utilizationRate >= 85,
				icon: '📊',
			},
			{
				label: 'Cost Per User',
				value: `${formatCurrency(Math.round(costPerUser))}/mo`,
				changeDirection: 'stable',
				isPositive: costPerUser < 35,
				icon: '👤',
			},
		],
		highlights: [
			m.savingsRealized > 0 ? `${formatCurrency(m.savingsRealized)} in savings realized this period` : '',
			utilizationRate >= 90 ? 'License utilization above 90% — well optimized' : '',
		].filter(Boolean),
		risks: [
			m.wastedLicenseCost > 500 ? `${formatCurrency(m.wastedLicenseCost)}/mo in license waste — run reclamation autopilot` : '',
			utilizationRate < 70 ? `License utilization at ${formatPct(utilizationRate)} — significant over-provisioning` : '',
		].filter(Boolean),
		chartData: {
			type: 'pie',
			labels: ['Active Use', 'Assigned Unused', 'Unassigned'],
			values: [
				m.activeUsers,
				m.assignedLicenses - m.activeUsers,
				m.totalLicenses - m.assignedLicenses,
			],
			colors: ['#10b981', '#f59e0b', '#ef4444'],
		},
	};
}

export function buildOperationsSection(m: ReportMetrics): ReportSection {
	return {
		title: 'Operations & Automation',
		icon: '⚙️',
		summary: `${m.remediationsExecuted} remediations executed. ${m.onboardingsCompleted} employees onboarded (avg ${m.avgOnboardingTime} min).`,
		kpis: [
			{
				label: 'Remediations',
				value: `${m.remediationsExecuted}`,
				changeDirection: m.remediationsExecuted > 0 ? 'up' : 'stable',
				isPositive: true,
				icon: '🔧',
			},
			{
				label: 'Onboardings',
				value: `${m.onboardingsCompleted}`,
				changeDirection: m.onboardingsCompleted > 0 ? 'up' : 'stable',
				isPositive: true,
				icon: '🚀',
			},
			{
				label: 'Avg Onboard Time',
				value: `${m.avgOnboardingTime} min`,
				changeDirection: 'stable',
				isPositive: m.avgOnboardingTime <= 30,
				icon: '⏱️',
			},
			{
				label: 'User Changes',
				value: `+${m.newUsersThisPeriod} / -${m.departedsThisPeriod}`,
				changeDirection: 'stable',
				isPositive: true,
				icon: '👥',
			},
		],
		highlights: [
			m.remediationsExecuted > 5 ? 'Active remediation — security posture actively maintained' : '',
			m.avgOnboardingTime <= 20 ? 'Onboarding under 20 minutes — best-in-class automation' : '',
		].filter(Boolean),
		risks: [
			m.remediationsExecuted === 0 ? 'No remediations executed — review pending alerts' : '',
			m.avgOnboardingTime > 60 ? 'Onboarding takes over 1 hour — optimize provisioning workflow' : '',
		].filter(Boolean),
		chartData: {
			type: 'bar',
			labels: ['Remediations', 'Onboardings', 'Alerts Resolved'],
			values: [m.remediationsExecuted, m.onboardingsCompleted, m.alertsResolved],
			colors: ['#6366f1', '#10b981', '#f59e0b'],
		},
	};
}


