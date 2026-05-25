/**
 * License waste analysis command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';
import { requireActiveTenant, formatError } from './helpers';

export const licenseWasteCommand: Command = {
	name: 'license waste',
	description: 'Calculate license waste and potential savings',
	category: 'licenses',
	aliases: ['waste', 'license cost', 'savings'],
	examples: [
		'tenantiq license waste',
		'tenantiq waste',
		'tenantiq savings'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const noTenant = requireActiveTenant(ctx);
		if (noTenant) return noTenant;

		const client = new TenantIQClient(ctx.config);

		try {
			const waste = await client.getLicenseWaste(ctx.config.activeTenantId!);

			const message = `💰 **License Waste Analysis**

**Total Waste:** $${waste.totalWasteMonthly.toFixed(2)}/month ($${waste.totalWasteYearly.toFixed(2)}/year)

**Breakdown:**
• **Inactive Users (90+ days):** ${waste.breakdown.inactiveUsers.count} users × $${(waste.breakdown.inactiveUsers.cost / waste.breakdown.inactiveUsers.count).toFixed(2)}/mo = **$${waste.breakdown.inactiveUsers.cost.toFixed(2)}/mo**
• **Unassigned Licenses:** ${waste.breakdown.unassigned.count} licenses = **$${waste.breakdown.unassigned.cost.toFixed(2)}/mo**
• **Underutilized E5:** ${waste.breakdown.underutilized.count} users could downgrade = **$${waste.breakdown.underutilized.cost.toFixed(2)}/mo**

**💡 Recommended Actions:**
${waste.recommendations.map((rec, i) => `${i + 1}. ${rec.action} (saves $${rec.impact.toFixed(2)}/mo)`).join('\n')}

**Annual Savings Potential:** 🎯 $${waste.totalWasteYearly.toFixed(2)}`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'View Inactive Users',
						command: 'tenantiq inactive users'
					},
					{
						label: 'Optimize Licenses',
						command: 'tenantiq optimize licenses'
					}
				]
			};
		} catch (error) {
			return formatError('get license waste analysis', error);
		}
	}
};
