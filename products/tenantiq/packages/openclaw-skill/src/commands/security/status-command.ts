/**
 * Security status command — secure score, alert counts, MFA adoption
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

export const securityStatusCommand: Command = {
	name: 'security status',
	description: 'Get security posture summary for active tenant',
	category: 'security',
	aliases: ['sec status', 'security'],
	examples: [
		'tenantiq security status',
		'tenantiq sec status'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const result = resolveClientAndTenant(ctx);
		if (isErrorResult(result)) return result.error;

		const { client, tenantId } = result;

		try {
			const status = await client.getSecurityStatus(tenantId);

			const scoreEmoji = status.secureScore >= 80 ? '🟢' : status.secureScore >= 60 ? '🟡' : '🔴';
			const scoreLevel = status.secureScore >= 80 ? 'Good' : status.secureScore >= 60 ? 'Medium' : 'Low';

			const message = `🔒 **Security Status**

**Secure Score:** ${scoreEmoji} ${status.secureScore}/100 (${scoreLevel})

**Active Alerts:**
• Critical: ${status.alertCounts.critical}
• High: ${status.alertCounts.high}
• Medium: ${status.alertCounts.medium}
• Low: ${status.alertCounts.low}

**Metrics:**
• MFA Adoption: ${status.mfaAdoption}% ${status.mfaAdoption >= 95 ? '✅' : '⚠️'}
• Risky Users: ${status.riskyUsers}

${status.alertCounts.critical > 0 ? '⚠️ You have critical alerts that need immediate attention!' : ''}`;

			const suggestedActions = [];

			if (status.alertCounts.critical > 0) {
				suggestedActions.push({
					label: 'View Critical Alerts',
					command: 'tenantiq show critical alerts'
				});
			}

			if (status.mfaAdoption < 95) {
				suggestedActions.push({
					label: 'Check MFA Status',
					command: 'tenantiq mfa status'
				});
			}

			if (status.riskyUsers > 0) {
				suggestedActions.push({
					label: 'View Risky Users',
					command: 'tenantiq risky users'
				});
			}

			return {
				message,
				format: 'markdown',
				suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
			};
		} catch (err) {
			return errorResponse('get security status', err);
		}
	}
};
