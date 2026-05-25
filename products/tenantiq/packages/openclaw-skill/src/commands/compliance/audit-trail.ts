/**
 * Audit Trail Command
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';

function buildAuditMessage(searchTerm: string | undefined, aiResponse: string): string {
	let message = `📜 **Audit Trail**\n\n`;

	if (searchTerm) {
		message += `**Search Query:** ${searchTerm}\n\n`;
	}

	message += aiResponse;

	message += `\n\n💡 **Tip:** Audit logs track all actions taken on your tenant, including:\n`;
	message += `• User account changes\n`;
	message += `• License assignments\n`;
	message += `• Security policy modifications\n`;
	message += `• Remediation executions\n`;
	message += `• Administrative actions\n`;

	return message;
}

export const auditTrailCommand: Command = {
	name: 'audit trail',
	description: 'Search the audit log for specific actions or actors',
	category: 'compliance',
	aliases: ['audit log', 'audit', 'search audit'],
	examples: [
		'tenantiq audit trail',
		'tenantiq audit trail user_deleted',
		'tenantiq audit trail admin@contoso.com'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		if (!ctx.config.activeTenantId) {
			return { message: 'No active tenant selected. Use "tenantiq switch tenant" first.', error: true };
		}

		const searchTerm = ctx.args.length > 0 ? ctx.args.join(' ') : undefined;

		try {
			let query = 'Show me recent audit log entries';
			if (searchTerm) {
				query = `Search the audit log for: ${searchTerm}`;
			}

			const aiResponse = await client.askAI(ctx.config.activeTenantId, query);

			return {
				message: buildAuditMessage(searchTerm, aiResponse),
				format: 'markdown',
				suggestedActions: [
					{
						label: 'Export Full Audit Log',
						command: 'tenantiq ask export full audit log to CSV'
					}
				]
			};
		} catch (error) {
			return {
				message: `Failed to search audit trail: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}
};
