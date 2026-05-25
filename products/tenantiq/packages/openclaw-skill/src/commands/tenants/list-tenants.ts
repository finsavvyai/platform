/**
 * List Tenants Command — show all accessible tenants
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

export const listTenantsCommand: Command = {
	name: 'list tenants',
	description: 'Show all tenants you have access to',
	category: 'tenants',
	aliases: ['tenants', 'show tenants', 'my tenants'],
	examples: [
		'tenantiq list tenants',
		'tenantiq tenants'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		try {
			const tenants = await client.listTenants();

			if (tenants.length === 0) {
				return {
					message: 'No tenants found. Connect your first tenant to get started!',
					format: 'markdown'
				};
			}

			const currentTenantId = ctx.config.activeTenantId;

			let message = `🏢 **Your Tenants** (${tenants.length} total)\n\n`;

			tenants.forEach((tenant, i) => {
				const isActive = tenant.id === currentTenantId ? '✅ **[ACTIVE]**' : '';
				const statusEmoji = tenant.status === 'active' ? '🟢' :
					tenant.status === 'syncing' ? '🔄' : '🔴';
				const lastSync = tenant.lastSyncAt
					? new Date(tenant.lastSyncAt).toLocaleString()
					: 'Never synced';

				message += `**${i + 1}. ${tenant.name}** ${isActive}\n`;
				message += `   📧 ${tenant.domain}\n`;
				message += `   ${statusEmoji} ${tenant.status} | Last sync: ${lastSync}\n\n`;
			});

			message += `💡 **Tip:** Use "tenantiq switch tenant <name or number>" to change tenant context.`;

			return {
				message,
				format: 'markdown'
			};
		} catch (error) {
			return {
				message: `Failed to list tenants: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
