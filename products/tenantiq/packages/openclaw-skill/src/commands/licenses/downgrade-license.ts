/**
 * License downgrade preview command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';
import { requireActiveTenant, formatError } from './helpers';

export const downgradeLicenseCommand: Command = {
	name: 'downgrade',
	description: 'Downgrade a user\'s license (e.g., E5 to E3)',
	category: 'licenses',
	aliases: ['downgrade license'],
	examples: [
		'tenantiq downgrade john@contoso.com',
		'tenantiq downgrade john@contoso.com E5 E3'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const noTenant = requireActiveTenant(ctx);
		if (noTenant) return noTenant;

		if (ctx.args.length === 0) {
			return {
				message: 'Usage: tenantiq downgrade <email> [from-sku] [to-sku]\nExample: tenantiq downgrade john@contoso.com E5 E3',
				error: true
			};
		}

		const userEmail = ctx.args[0];
		const client = new TenantIQClient(ctx.config);

		try {
			const users = await client.searchUsers(ctx.config.activeTenantId!, userEmail);

			if (users.length === 0) {
				return {
					message: `User not found: ${userEmail}`,
					error: true
				};
			}

			const user = users[0];

			if (user.licenses.length === 0) {
				return {
					message: `User ${userEmail} has no licenses assigned.`,
					error: true
				};
			}

			const message = `🔄 **License Downgrade Preview**

**User:** ${user.displayName} (${user.email})
**Current Licenses:** ${user.licenses.join(', ')}

⚠️ **Warning:** This will execute a remediation action to downgrade the license.

To proceed with the downgrade, use:
\`tenantiq ask downgrade ${userEmail} from E5 to E3\`

This will:
1. Remove the E5 license
2. Assign the E3 license
3. Preserve all user data
4. Log the action in audit trail

**Estimated Savings:** ~$37/month per user`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'Execute Downgrade',
						command: `tenantiq ask downgrade ${userEmail} from E5 to E3`
					}
				]
			};
		} catch (error) {
			return formatError('preview downgrade', error);
		}
	}
};
