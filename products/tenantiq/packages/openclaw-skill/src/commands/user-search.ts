/**
 * User Search Command for TenantIQ OpenClaw Skill
 */

import type { Command, CommandContext, CommandResponse } from '../types';
import { TenantIQClient } from '../lib/api-client';

export const searchUserCommand: Command = {
	name: 'search user',
	description: 'Find users by name or email',
	category: 'users',
	aliases: ['find user', 'search', 'user search'],
	examples: [
		'tenantiq search user john',
		'tenantiq search user john@contoso.com',
		'tenantiq find user smith'
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

		if (ctx.args.length === 0) {
			return {
				message: 'Usage: tenantiq search user <name or email>\nExample: tenantiq search user john',
				error: true
			};
		}

		const query = ctx.args.join(' ');

		try {
			const users = await client.searchUsers(ctx.config.activeTenantId, query);

			if (users.length === 0) {
				return {
					message: `No users found matching: "${query}"`,
					format: 'markdown'
				};
			}

			let message = `🔍 **User Search Results** (${users.length} found)\n\n`;

			users.slice(0, 15).forEach((user, i) => {
				const mfaBadge = user.mfaEnabled ? '🔒 MFA' : '⚠️ No MFA';
				const guestBadge = user.isGuest ? '👤 Guest' : '';
				const lastSeen = user.lastSignIn
					? new Date(user.lastSignIn).toLocaleDateString()
					: 'Never';

				message += `**${i + 1}. ${user.displayName}** ${guestBadge}\n`;
				message += `   📧 ${user.email}\n`;
				message += `   ${mfaBadge} | Last sign-in: ${lastSeen}\n`;
				message += `   Licenses: ${user.licenses.length > 0 ? user.licenses.join(', ') : 'None'}\n\n`;
			});

			if (users.length > 15) {
				message += `\n... and ${users.length - 15} more users\n`;
			}

			return {
				message,
				format: 'markdown',
				suggestedActions: users.length === 1 ? [
					{
						label: 'View Full Details',
						command: `tenantiq user details ${users[0].email}`
					}
				] : undefined
			};
		} catch (error) {
			return {
				message: `Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
