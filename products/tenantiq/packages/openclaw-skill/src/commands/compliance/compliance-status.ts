/**
 * Compliance Status Command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

interface SeverityCounts {
	critical: number;
	high: number;
	medium: number;
	low: number;
}

function countBySeverity(alerts: Array<{ severity: string }>): SeverityCounts {
	return {
		critical: alerts.filter(a => a.severity === 'critical').length,
		high: alerts.filter(a => a.severity === 'high').length,
		medium: alerts.filter(a => a.severity === 'medium').length,
		low: alerts.filter(a => a.severity === 'low').length
	};
}

function calculateComplianceScore(counts: SeverityCounts): number {
	const totalIssues = counts.critical + counts.high + counts.medium + counts.low;
	if (totalIssues === 0) return 100;
	return Math.max(0, 100 - (counts.critical * 10 + counts.high * 5 + counts.medium * 2 + counts.low));
}

function buildScoreMessage(counts: SeverityCounts, score: number): string {
	const scoreEmoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
	const scoreLevel = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';

	let message = `📋 **Compliance Status**\n\n`;
	message += `**Compliance Score:** ${scoreEmoji} ${score}/100 (${scoreLevel})\n\n`;
	message += `**Active Issues:**\n`;
	message += `• 🔴 Critical: ${counts.critical}\n`;
	message += `• 🟠 High: ${counts.high}\n`;
	message += `• 🟡 Medium: ${counts.medium}\n`;
	message += `• ⚪ Low: ${counts.low}\n\n`;
	return message;
}

function buildSuggestedActions(
	alerts: Array<{ severity: string; title: string }>,
	counts: SeverityCounts
): Array<{ label: string; command: string }> {
	const actions: Array<{ label: string; command: string }> = [];

	if (counts.critical > 0) {
		actions.push({ label: 'View Critical Issues', command: 'tenantiq show critical alerts' });
	}

	const guestIssues = alerts.filter(a => a.title.toLowerCase().includes('guest'));
	if (guestIssues.length > 0) {
		actions.push({ label: 'Review Guest Users', command: 'tenantiq guest users' });
	}

	const groupIssues = alerts.filter(a => a.title.toLowerCase().includes('group'));
	if (groupIssues.length > 0) {
		actions.push({ label: 'Check Groups', command: 'tenantiq groups without owners' });
	}

	return actions;
}

export const complianceStatusCommand: Command = {
	name: 'compliance status',
	description: 'Get compliance overview for the tenant',
	category: 'compliance',
	aliases: ['compliance', 'comp status'],
	examples: ['tenantiq compliance status', 'tenantiq compliance'],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		if (!ctx.config.activeTenantId) {
			return { message: 'No active tenant selected. Use "tenantiq switch tenant" first.', error: true };
		}

		try {
			const alerts = await client.listAlerts(ctx.config.activeTenantId, {
				status: 'active',
				category: 'compliance'
			});

			const counts = countBySeverity(alerts);
			const complianceScore = calculateComplianceScore(counts);
			let message = buildScoreMessage(counts, complianceScore);

			if (alerts.length > 0) {
				message += `**Top Compliance Issues:**\n`;
				alerts.slice(0, 5).forEach((alert, i) => {
					const severityEmoji = alert.severity === 'critical' ? '🔴' :
						alert.severity === 'high' ? '🟠' :
						alert.severity === 'medium' ? '🟡' : '⚪';
					message += `${i + 1}. ${severityEmoji} ${alert.title}\n`;
				});
				if (alerts.length > 5) {
					message += `\n... and ${alerts.length - 5} more issues\n`;
				}
			} else {
				message += `✅ **All compliance checks passed!**\n`;
			}

			const suggestedActions = buildSuggestedActions(alerts, counts);

			return {
				message,
				format: 'markdown',
				suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
			};
		} catch (error) {
			return {
				message: `Failed to get compliance status: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
