/**
 * Password Reset Command for TenantIQ OpenClaw Skill
 */

import type { Command, CommandContext, CommandResponse } from '../types';
import { TenantIQClient } from '../lib/api-client';

export const resetPasswordCommand: Command = {
	name: 'reset password',
	description: 'Force a user to reset their password on next login',
	category: 'users',
	aliases: ['password reset', 'force password'],
	examples: [
		'tenantiq reset password john@contoso.com'
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
				message: 'Usage: tenantiq reset password <email>\nExample: tenantiq reset password john@contoso.com',
				error: true
			};
		}

		const email = ctx.args[0];

		try {
			// Verify user exists
			const users = await client.searchUsers(ctx.config.activeTenantId, email);

			if (users.length === 0) {
				return {
					message: `User not found: ${email}`,
					error: true
				};
			}

			const user = users[0];

			const message = `🔐 **Force Password Reset**

**User:** ${user.displayName} (${user.email})

⚠️ **Warning:** This will execute a remediation action (REM-006).

To proceed, use:
\`tenantiq ask force password reset for ${email}\`

This will:
1. Generate a temporary password
2. Send reset instructions to the user
3. Require password change on next login
4. Log the action in audit trail

**Use Case:** Suspected account compromise or security incident.`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'Execute Reset',
						command: `tenantiq ask force password reset for ${email}`
					}
				]
			};
		} catch (error) {
			return {
				message: `Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
