/**
 * Guest User Commands for TenantIQ OpenClaw Skill
 */

import type { Command, CommandContext, CommandResponse } from '../types';
import { TenantIQClient } from '../lib/api-client';

export const guestUsersCommand: Command = {
	name: 'guest users',
	description: 'List all guest user accounts',
	category: 'users',
	aliases: ['guests', 'external users'],
	examples: [
		'tenantiq guest users',
		'tenantiq guests'
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
			const users = await client.searchUsers(ctx.config.activeTenantId, 'guests');
			const guests = users.filter(u => u.isGuest);

			if (guests.length === 0) {
				return {
					message: '✅ No guest users found.',
					format: 'markdown'
				};
			}

			// Find stale guests (90+ days inactive)
			const now = Date.now();
			const staleThreshold = 90 * 24 * 60 * 60 * 1000; // 90 days
			const staleGuests = guests.filter(g => {
				if (!g.lastSignIn) return true;
				return now - new Date(g.lastSignIn).getTime() > staleThreshold;
			});

			let message = `👥 **Guest Users**\n\n`;
			message += `**Total Guests:** ${guests.length}\n`;
			message += `**Stale Guests (90+ days):** ${staleGuests.length}\n\n`;

			if (staleGuests.length > 0) {
				message += `⚠️ **Stale Guest Accounts:**\n`;
				staleGuests.slice(0, 10).forEach((guest, i) => {
					const lastSeen = guest.lastSignIn
						? new Date(guest.lastSignIn).toLocaleDateString()
						: 'Never';
					message += `${i + 1}. **${guest.displayName}** (${guest.email})\n`;
					message += `   Last seen: ${lastSeen}\n\n`;
				});

				if (staleGuests.length > 10) {
					message += `... and ${staleGuests.length - 10} more stale guests\n\n`;
				}

				message += `\n💡 **Recommendation:** Review and remove stale guest accounts to reduce security risk.`;
			}

			return {
				message,
				format: 'markdown',
				suggestedActions: staleGuests.length > 0 ? [
					{
						label: 'Remove Stale Guests',
						command: 'tenantiq ask help me remove stale guest accounts'
					}
				] : undefined
			};
		} catch (error) {
			return {
				message: `Failed to list guest users: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};

export const removeGuestCommand: Command = {
	name: 'remove guest',
	description: 'Remove a guest user from the tenant',
	category: 'users',
	aliases: ['delete guest'],
	examples: [
		'tenantiq remove guest external@partner.com'
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
				message: 'Usage: tenantiq remove guest <email>\nExample: tenantiq remove guest external@partner.com',
				error: true
			};
		}

		const email = ctx.args[0];

		try {
			// Verify it's a guest user
			const users = await client.searchUsers(ctx.config.activeTenantId, email);

			if (users.length === 0) {
				return {
					message: `User not found: ${email}`,
					error: true
				};
			}

			const user = users[0];

			if (!user.isGuest) {
				return {
					message: `Error: ${email} is not a guest user. Cannot remove member accounts with this command.\n\nUse "tenantiq ask decommission ${email}" for member accounts.`,
					error: true
				};
			}

			const message = `🗑️ **Remove Guest User**

**User:** ${user.displayName} (${user.email})
**Type:** Guest User
**Last Sign-in:** ${user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : 'Never'}

⚠️ **Warning:** This will permanently remove the guest user and revoke all access.

To proceed, use:
\`tenantiq ask remove guest user ${email}\`

This will:
1. Remove the guest user account
2. Revoke all access to shared resources
3. Log the action in audit trail
4. Cannot be undone`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'Confirm Removal',
						command: `tenantiq ask remove guest user ${email}`
					}
				]
			};
		} catch (error) {
			return {
				message: `Failed to remove guest: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
