/**
 * Alert commands — list active alerts and show critical alert details
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

export const checkAlertsCommand: Command = {
	name: 'check alerts',
	description: 'List active alerts for the tenant',
	category: 'security',
	aliases: ['alerts', 'list alerts'],
	examples: [
		'tenantiq check alerts',
		'tenantiq alerts'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const result = resolveClientAndTenant(ctx);
		if (isErrorResult(result)) return result.error;

		const { client, tenantId } = result;

		try {
			const alerts = await client.listAlerts(tenantId, { status: 'active' });

			if (alerts.length === 0) {
				return {
					message: '✅ No active alerts! Your tenant is in good shape.',
					format: 'markdown'
				};
			}

			const critical = alerts.filter(a => a.severity === 'critical');
			const high = alerts.filter(a => a.severity === 'high');
			const medium = alerts.filter(a => a.severity === 'medium');
			const low = alerts.filter(a => a.severity === 'low');

			let message = `🚨 **Active Alerts** (${alerts.length} total)\n\n`;

			if (critical.length > 0) {
				message += `**🔴 Critical (${critical.length})**\n`;
				critical.slice(0, 3).forEach(a => { message += `• ${a.title}\n`; });
				if (critical.length > 3) message += `  ... and ${critical.length - 3} more\n`;
				message += '\n';
			}

			if (high.length > 0) {
				message += `**🟠 High (${high.length})**\n`;
				high.slice(0, 2).forEach(a => { message += `• ${a.title}\n`; });
				if (high.length > 2) message += `  ... and ${high.length - 2} more\n`;
				message += '\n';
			}

			if (medium.length > 0) message += `**🟡 Medium (${medium.length})**\n`;
			if (low.length > 0) message += `**⚪ Low (${low.length})**\n`;

			const suggestedActions = [];
			if (critical.length > 0) {
				suggestedActions.push({
					label: 'Show Critical Details',
					command: 'tenantiq show critical alerts'
				});
			}
			suggestedActions.push({ label: 'View Dashboard', command: 'tenantiq dashboard' });

			return { message, format: 'markdown', suggestedActions };
		} catch (err) {
			return errorResponse('check alerts', err);
		}
	}
};

export const showCriticalAlertsCommand: Command = {
	name: 'show critical alerts',
	description: 'Display critical alerts with full details',
	category: 'security',
	aliases: ['critical alerts', 'critical'],
	examples: [
		'tenantiq show critical alerts',
		'tenantiq critical'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const result = resolveClientAndTenant(ctx);
		if (isErrorResult(result)) return result.error;

		const { client, tenantId } = result;

		try {
			const alerts = await client.listAlerts(tenantId, {
				status: 'active',
				severity: 'critical'
			});

			if (alerts.length === 0) {
				return { message: '✅ No critical alerts!', format: 'markdown' };
			}

			let message = `🔴 **Critical Alerts** (${alerts.length})\n\n`;

			alerts.forEach((alert, index) => {
				message += `**${index + 1}. ${alert.title}**\n`;
				message += `${alert.description}\n`;

				if (alert.affectedEntities.length > 0) {
					message += `\n*Affected:* ${alert.affectedEntities.slice(0, 3).join(', ')}`;
					if (alert.affectedEntities.length > 3) {
						message += ` and ${alert.affectedEntities.length - 3} more`;
					}
					message += '\n';
				}

				if (alert.suggestedRemediations && alert.suggestedRemediations.length > 0) {
					message += `*Suggested Action:* ${alert.suggestedRemediations[0]}\n`;
				}

				message += '\n';
			});

			return {
				message,
				format: 'markdown',
				suggestedActions: [{
					label: 'View Remediation Options',
					command: 'tenantiq ask how do I fix these critical alerts?'
				}]
			};
		} catch (err) {
			return errorResponse('get critical alerts', err);
		}
	}
};
