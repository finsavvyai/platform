/**
 * MFA status command — check MFA adoption rate
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

export const mfaStatusCommand: Command = {
	name: 'mfa status',
	description: 'Check MFA adoption rate and users without MFA',
	category: 'security',
	aliases: ['mfa'],
	examples: [
		'tenantiq mfa status',
		'tenantiq mfa'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const result = resolveClientAndTenant(ctx);
		if (isErrorResult(result)) return result.error;

		const { client, tenantId } = result;

		try {
			const status = await client.getSecurityStatus(tenantId);
			const adoptionEmoji = status.mfaAdoption >= 95 ? '✅' : status.mfaAdoption >= 75 ? '⚠️' : '🔴';

			const message = `🔐 **MFA Adoption Status**

**Current Adoption:** ${adoptionEmoji} ${status.mfaAdoption}%
**Target:** 100%

${status.mfaAdoption < 100 ? `
⚠️ **${100 - status.mfaAdoption}% of users** do not have MFA enabled.

This is a critical security gap. MFA should be enforced for all users, especially admins.
` : '✅ All users have MFA enabled!'}`;

			const suggestedActions = [];

			if (status.mfaAdoption < 100) {
				suggestedActions.push({
					label: 'Enable MFA for All',
					command: 'tenantiq ask how do I enable MFA for all users?'
				});
			}

			return {
				message,
				format: 'markdown',
				suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
			};
		} catch (err) {
			return errorResponse('get MFA status', err);
		}
	}
};
