/**
 * Unused licenses detection command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';
import { requireActiveTenant, formatError } from './helpers';

export const unusedLicensesCommand: Command = {
	name: 'unused licenses',
	description: 'List unassigned licenses that are being wasted',
	category: 'licenses',
	aliases: ['unassigned licenses', 'wasted licenses'],
	examples: [
		'tenantiq unused licenses',
		'tenantiq unassigned licenses'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const noTenant = requireActiveTenant(ctx);
		if (noTenant) return noTenant;

		const client = new TenantIQClient(ctx.config);

		try {
			const waste = await client.getLicenseWaste(ctx.config.activeTenantId!);

			if (waste.breakdown.unassigned.count === 0) {
				return {
					message: '✅ No unassigned licenses! All licenses are being used.',
					format: 'markdown'
				};
			}

			const message = `📦 **Unassigned Licenses**

**Total Unassigned:** ${waste.breakdown.unassigned.count} licenses
**Monthly Cost:** $${waste.breakdown.unassigned.cost.toFixed(2)}
**Annual Waste:** $${(waste.breakdown.unassigned.cost * 12).toFixed(2)}

⚠️ These licenses are being paid for but not assigned to any users. Consider:
1. Assigning them to users who need them
2. Reducing your subscription count
3. Removing them entirely to save costs

**Recommendation:** Review your license subscriptions and reduce by ${waste.breakdown.unassigned.count} to eliminate this waste.`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'View License Details',
						command: 'tenantiq ask show me detailed license allocation'
					}
				]
			};
		} catch (error) {
			return formatError('get unused licenses', error);
		}
	}
};
