/**
 * AI-powered license optimization command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';
import { requireActiveTenant, formatError } from './helpers';

export const optimizeLicensesCommand: Command = {
	name: 'optimize licenses',
	description: 'Get AI-powered license optimization recommendations',
	category: 'licenses',
	aliases: ['optimize', 'license recommendations'],
	examples: [
		'tenantiq optimize licenses',
		'tenantiq optimize'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const noTenant = requireActiveTenant(ctx);
		if (noTenant) return noTenant;

		const client = new TenantIQClient(ctx.config);

		try {
			const waste = await client.getLicenseWaste(ctx.config.activeTenantId!);

			const aiResponse = await client.askAI(
				ctx.config.activeTenantId!,
				'Analyze our license usage and provide specific optimization recommendations. Include cost savings for each recommendation.'
			);

			const message = `🤖 **AI-Powered License Optimization**

**Current Waste:** $${waste.totalWasteMonthly.toFixed(2)}/month ($${waste.totalWasteYearly.toFixed(2)}/year)

**AI Analysis:**
${aiResponse}

**Quick Actions:**
${waste.recommendations.map((rec, i) => `${i + 1}. ${rec.action} (saves $${rec.impact.toFixed(2)}/mo)`).join('\n')}

**Total Potential Savings:** 💰 $${waste.totalWasteYearly.toFixed(2)}/year

Would you like me to help you execute any of these optimizations?`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{
						label: 'View Inactive Users',
						command: 'tenantiq inactive users'
					},
					{
						label: 'Create Optimization Workflow',
						command: 'tenantiq ask create a workflow to optimize licenses automatically'
					}
				]
			};
		} catch (error) {
			return formatError('optimize licenses', error);
		}
	}
};
