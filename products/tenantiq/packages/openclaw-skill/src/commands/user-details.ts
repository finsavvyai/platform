/**
 * User Details Command for TenantIQ OpenClaw Skill
 */

import type { Command, CommandContext, CommandResponse } from '../types';
import { TenantIQClient } from '../lib/api-client';

export const userDetailsCommand: Command = {
	name: 'user details',
	description: 'Get comprehensive information about a specific user',
	category: 'users',
	aliases: ['user info', 'user'],
	examples: [
		'tenantiq user details john@contoso.com',
		'tenantiq user john@contoso.com'
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
				message: 'Usage: tenantiq user details <email>\nExample: tenantiq user details john@contoso.com',
				error: true
			};
		}

		const email = ctx.args[0];

		try {
			const users = await client.searchUsers(ctx.config.activeTenantId, email);

			if (users.length === 0) {
				return {
					message: `User not found: ${email}`,
					error: true
				};
			}

			const user = users[0];
			const lastSeen = user.lastSignIn
				? new Date(user.lastSignIn).toLocaleDateString()
				: 'Never';

			const message = `👤 **User Details**

**Name:** ${user.displayName}
**Email:** ${user.email}
**Type:** ${user.isGuest ? '👥 Guest User' : '👤 Member'}
**Status:** ${user.id ? '✅ Active' : '❌ Disabled'}

**Security:**
• MFA Enabled: ${user.mfaEnabled ? '✅ Yes' : '⚠️ No (Security Risk!)'}
• Last Sign-in: ${lastSeen}

**Licenses (${user.licenses.length}):**
${user.licenses.length > 0 ? user.licenses.map(lic => `• ${lic}`).join('\n') : '• No licenses assigned'}

**Cost Analysis:**
• Monthly Cost: $${(user.licenses.length * 20).toFixed(2)} (estimated)
• Annual Cost: $${(user.licenses.length * 20 * 12).toFixed(2)}

${!user.mfaEnabled ? '\n⚠️ **Security Warning:** This user does not have MFA enabled!' : ''}
${user.isGuest ? '\n💡 **Note:** Guest users have limited access to resources.' : ''}`;

			const suggestedActions = [];

			if (!user.mfaEnabled) {
				suggestedActions.push({
					label: 'Enable MFA',
					command: `tenantiq ask enable MFA for ${email}`
				});
			}

			if (user.lastSignIn && new Date(user.lastSignIn) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
				suggestedActions.push({
					label: 'Decommission User',
					command: `tenantiq ask should I decommission ${email}?`
				});
			}

			return {
				message,
				format: 'markdown',
				suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
			};
		} catch (error) {
			return {
				message: `Failed to get user details: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
