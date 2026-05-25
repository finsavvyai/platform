/**
 * Risky users command — list users with risky sign-ins or security issues
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

export const riskyUsersCommand: Command = {
	name: 'risky users',
	description: 'List users with risky sign-ins or security issues',
	category: 'security',
	aliases: ['risky', 'compromised users'],
	examples: [
		'tenantiq risky users',
		'tenantiq risky'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const result = resolveClientAndTenant(ctx);
		if (isErrorResult(result)) return result.error;

		const { client, tenantId } = result;

		try {
			const alerts = await client.listAlerts(tenantId, {
				status: 'active',
				category: 'security'
			});

			const riskyUserAlerts = alerts.filter(
				a => a.title.includes('risky')
					|| a.title.includes('impossible travel')
					|| a.title.includes('failed login')
			);

			if (riskyUserAlerts.length === 0) {
				return { message: '✅ No risky users detected!', format: 'markdown' };
			}

			let message = `⚠️ **Risky Users Detected**\n\n`;

			riskyUserAlerts.forEach((alert, index) => {
				message += `**${index + 1}. ${alert.title}**\n`;
				message += `${alert.description}\n`;

				if (alert.affectedEntities.length > 0) {
					message += `*Users:* ${alert.affectedEntities.slice(0, 5).join(', ')}\n`;
				}

				message += '\n';
			});

			return {
				message,
				format: 'markdown',
				suggestedActions: [{
					label: 'Block Compromised Users',
					command: 'tenantiq ask how do I secure these risky accounts?'
				}]
			};
		} catch (err) {
			return errorResponse('get risky users', err);
		}
	}
};
