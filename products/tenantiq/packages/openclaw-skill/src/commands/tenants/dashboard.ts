/**
 * Dashboard Command — comprehensive tenant metrics and health overview
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

interface AlertCounts {
	critical: number;
	high: number;
	medium: number;
	low: number;
}

function computeHealthScore(alertCounts: AlertCounts): number {
	const totalAlerts = alertCounts.critical + alertCounts.high +
		alertCounts.medium + alertCounts.low;

	if (totalAlerts === 0) return 100;

	return Math.max(0, 100 - (
		alertCounts.critical * 15 +
		alertCounts.high * 5 +
		alertCounts.medium * 2 +
		alertCounts.low
	));
}

function healthLabel(score: number): { emoji: string; status: string; band: string } {
	if (score >= 90) return { emoji: '🟢', status: 'Excellent', band: 'top 10%' };
	if (score >= 80) return { emoji: '🟢', status: 'Excellent', band: 'top 25%' };
	if (score >= 70) return { emoji: '🟡', status: 'Good', band: 'top 40%' };
	if (score >= 65) return { emoji: '🟡', status: 'Good', band: 'top 40%' };
	if (score >= 50) return { emoji: '🟠', status: 'Fair', band: 'middle of pack' };
	return { emoji: '🔴', status: 'Poor', band: 'below benchmark' };
}

export const dashboardCommand: Command = {
	name: 'dashboard',
	description: 'Get comprehensive dashboard metrics for the active tenant',
	category: 'tenants',
	aliases: ['dash', 'overview', 'status'],
	examples: [
		'tenantiq dashboard',
		'tenantiq dash'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		if (!ctx.config.activeTenantId) {
			return {
				message: 'No active tenant selected. Use "tenantiq switch tenant" first.',
				error: true
			};
		}

		try {
			const dashboard = await client.getDashboard(ctx.config.activeTenantId);
			const totalAlerts = dashboard.alertCounts.critical +
				dashboard.alertCounts.high +
				dashboard.alertCounts.medium +
				dashboard.alertCounts.low;

			const healthScore = computeHealthScore(dashboard.alertCounts);
			const { emoji: healthEmoji, status: healthStatus, band: benchmarkBand } =
				healthLabel(healthScore);

			const biggestRisk =
				dashboard.alertCounts.critical > 0
					? `${dashboard.alertCounts.critical} critical alerts`
					: dashboard.secureScore < 80
						? `secure score at ${dashboard.secureScore}/100`
						: dashboard.licenseWaste > 0
							? `$${dashboard.licenseWaste.toFixed(2)}/mo in license waste`
							: 'no critical risk driver detected';

			const boardSummary = `Tenant health is ${healthScore}/100 (${healthStatus}), placing this tenant in the ${benchmarkBand}. Biggest risk driver: ${biggestRisk}.`;
			const shareSnippet = `Tenant snapshot: ${healthScore}/100 health, ${dashboard.secureScore}/100 secure score, ${totalAlerts} active alerts, and $${dashboard.licenseWaste.toFixed(2)}/mo in license waste.`;

			const message = buildDashboardMessage({
				healthEmoji, healthScore, healthStatus,
				boardSummary, shareSnippet,
				userCount: dashboard.userCount,
				guestCount: dashboard.guestCount,
				alertCounts: dashboard.alertCounts,
				totalAlerts,
				secureScore: dashboard.secureScore,
				licenseWaste: dashboard.licenseWaste
			});

			const suggestedActions = buildSuggestedActions(dashboard);

			return {
				message,
				format: 'markdown',
				suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
			};
		} catch (error) {
			return {
				message: `Failed to get dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};

interface DashboardMessageParams {
	healthEmoji: string;
	healthScore: number;
	healthStatus: string;
	boardSummary: string;
	shareSnippet: string;
	userCount: number;
	guestCount: number;
	alertCounts: AlertCounts;
	totalAlerts: number;
	secureScore: number;
	licenseWaste: number;
}

function buildDashboardMessage(p: DashboardMessageParams): string {
	let msg = `📊 **Tenant Dashboard**\n\n`;
	msg += `**Overall Health:** ${p.healthEmoji} ${p.healthScore}/100 (${p.healthStatus})\n\n`;
	msg += `**🧠 Executive Snapshot**\n`;
	msg += `• ${p.boardSummary}\n`;
	msg += `• Share-ready summary: _${p.shareSnippet}_\n\n`;
	msg += `**👥 Users**\n`;
	msg += `• Total: ${p.userCount}\n`;
	msg += `• Guests: ${p.guestCount}\n\n`;
	msg += `**🚨 Active Alerts** (${p.totalAlerts} total)\n`;
	msg += `• 🔴 Critical: ${p.alertCounts.critical}\n`;
	msg += `• 🟠 High: ${p.alertCounts.high}\n`;
	msg += `• 🟡 Medium: ${p.alertCounts.medium}\n`;
	msg += `• ⚪ Low: ${p.alertCounts.low}\n\n`;
	msg += `**🔒 Security**\n`;
	msg += `• Secure Score: ${p.secureScore}/100\n\n`;
	msg += `**💰 License Optimization**\n`;
	msg += `• Monthly Waste: $${p.licenseWaste.toFixed(2)}\n`;
	msg += `• Annual Impact: $${(p.licenseWaste * 12).toFixed(2)}\n\n`;
	return msg;
}

function buildSuggestedActions(dashboard: {
	alertCounts: AlertCounts;
	licenseWaste: number;
	secureScore: number;
	guestCount: number;
}) {
	const actions: Array<{ label: string; command: string }> = [];

	if (dashboard.alertCounts.critical > 0) {
		actions.push({ label: 'View Critical Alerts', command: 'tenantiq show critical alerts' });
	}
	if (dashboard.licenseWaste > 0) {
		actions.push({ label: 'Optimize Licenses', command: 'tenantiq license waste' });
	}
	if (dashboard.secureScore < 80) {
		actions.push({ label: 'Security Status', command: 'tenantiq security status' });
	}
	if (dashboard.guestCount > 0) {
		actions.push({ label: 'Review Guests', command: 'tenantiq guest users' });
	}
	actions.push({ label: 'Ask AI For Executive Report', command: 'tenantiq ai generate executive report' });

	return actions;
}
