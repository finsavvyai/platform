/**
 * Inactive users detection command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';
import { requireActiveTenant, formatError } from './helpers';

export const inactiveUsersCommand: Command = {
	name: 'inactive users',
	description: 'Find users who haven\'t logged in for specified days',
	category: 'licenses',
	aliases: ['inactive', 'dormant users'],
	examples: [
		'tenantiq inactive users',
		'tenantiq inactive users 60',
		'tenantiq inactive users 90'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const noTenant = requireActiveTenant(ctx);
		if (noTenant) return noTenant;

		const days = ctx.args.length > 0 ? parseInt(ctx.args[0], 10) : 90;

		if (isNaN(days) || days < 1) {
			return {
				message: 'Invalid number of days. Usage: tenantiq inactive users [days]\nExample: tenantiq inactive users 90',
				error: true
			};
		}

		const client = new TenantIQClient(ctx.config);

		try {
			const users = await client.searchUsers(ctx.config.activeTenantId!, `inactive:${days}`);

			if (users.length === 0) {
				return {
					message: `✅ No users inactive for ${days}+ days!`,
					format: 'markdown'
				};
			}

			const totalCost = users.reduce((sum, user) => {
				const licenseCost = user.licenses.reduce((lsum) => lsum + 20, 0);
				return sum + licenseCost;
			}, 0);

			let message = `⏰ **Inactive Users** (${days}+ days)\n\n`;
			message += `**Found:** ${users.length} users\n`;
			message += `**Total Cost:** $${totalCost.toFixed(2)}/month\n`;
			message += `**Annual Waste:** $${(totalCost * 12).toFixed(2)}/year\n\n`;

			message += `**Top ${Math.min(10, users.length)} Inactive Users:**\n`;
			users.slice(0, 10).forEach((user, i) => {
				const lastSeen = user.lastSignIn
					? new Date(user.lastSignIn).toLocaleDateString()
					: 'Never';
				message += `${i + 1}. **${user.displayName}** (${user.email})\n`;
				message += `   Last sign-in: ${lastSeen}\n`;
				message += `   Licenses: ${user.licenses.length}\n\n`;
			});

			if (users.length > 10) {
				message += `\n... and ${users.length - 10} more inactive users\n`;
			}

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'Decommission Inactive Users',
						command: 'tenantiq ask how do I safely decommission these inactive users?'
					}
				]
			};
		} catch (error) {
			return formatError('find inactive users', error);
		}
	}
};
