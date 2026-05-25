/**
 * Groups Without Owners Command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

function buildGroupsMessage(
	groupAlerts: Array<{ title: string; description: string; affectedEntities: string[] }>
): string {
	let totalGroups = 0;
	groupAlerts.forEach(alert => {
		totalGroups += alert.affectedEntities.length;
	});

	let message = `📁 **Groups Without Owners**\n\n`;
	message += `**Total Groups:** ${totalGroups}\n\n`;
	message += `⚠️ **Compliance Risk:** Groups without owners can lead to:\n`;
	message += `• Unmanaged access permissions\n`;
	message += `• Orphaned resources\n`;
	message += `• Compliance violations\n`;
	message += `• Security vulnerabilities\n\n`;

	groupAlerts.forEach((alert, i) => {
		message += `**Alert ${i + 1}: ${alert.title}**\n`;
		message += `${alert.description}\n\n`;

		if (alert.affectedEntities.length > 0) {
			message += `Affected groups:\n`;
			alert.affectedEntities.slice(0, 10).forEach((entity, j) => {
				message += `${j + 1}. ${entity}\n`;
			});

			if (alert.affectedEntities.length > 10) {
				message += `... and ${alert.affectedEntities.length - 10} more\n`;
			}
			message += '\n';
		}
	});

	message += `💡 **Recommendation:** Assign owners to all groups to maintain proper governance.`;
	return message;
}

export const groupsWithoutOwnersCommand: Command = {
	name: 'groups without owners',
	description: 'List groups that have no designated owners',
	category: 'compliance',
	aliases: ['orphaned groups', 'ownerless groups'],
	examples: ['tenantiq groups without owners', 'tenantiq orphaned groups'],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		if (!ctx.config.activeTenantId) {
			return { message: 'No active tenant selected. Use "tenantiq switch tenant" first.', error: true };
		}

		try {
			const alerts = await client.listAlerts(ctx.config.activeTenantId, {
				status: 'active',
				category: 'compliance'
			});

			const groupAlerts = alerts.filter(a =>
				a.title.toLowerCase().includes('group') &&
				a.title.toLowerCase().includes('owner')
			);

			if (groupAlerts.length === 0) {
				return { message: '✅ All groups have designated owners!', format: 'markdown' };
			}

			return {
				message: buildGroupsMessage(groupAlerts),
				format: 'markdown',
				suggestedActions: [
					{
						label: 'Get Assignment Help',
						command: 'tenantiq ask how do I assign owners to these groups?'
					}
				]
			};
		} catch (error) {
			return {
				message: `Failed to get groups without owners: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
