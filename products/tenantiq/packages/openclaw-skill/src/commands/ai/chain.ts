/**
 * AI Chain & Status commands — multi-agent chains and engine status
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { TenantIQClient } from '../../lib/api-client';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

const VALID_PRESETS = [
	'security-audit',
	'compliance-check',
	'cost-review',
	'full-assessment'
] as const;

type ChainPreset = typeof VALID_PRESETS[number];

/**
 * AI Multi-agent Chain command
 */
export const aiChainCommand: Command = {
	name: 'ai chain',
	description: 'Run a multi-agent analysis chain (security-audit, compliance-check, cost-review, full-assessment)',
	category: 'ai',
	aliases: ['chain ai'],
	examples: [
		'tenantiq ai chain security-audit',
		'tenantiq ai chain full-assessment',
		'tenantiq ai chain cost-review',
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const resolved = resolveClientAndTenant(ctx);
		if (isErrorResult(resolved)) return resolved.error;
		const { client, tenantId } = resolved;

		const preset = (ctx.args[0] as ChainPreset) || 'full-assessment';

		if (!VALID_PRESETS.includes(preset)) {
			return {
				message: `Invalid preset. Choose from: ${VALID_PRESETS.join(', ')}`,
				error: true
			};
		}

		try {
			const result = await client.aiChain(tenantId, preset);

			let message = `🔗 **AI Chain: ${preset}** _(powered by ${result.source})_\n\n`;
			message += result.result;

			return { message, format: 'markdown' };
		} catch (error) {
			return errorResponse('AI chain failed', error);
		}
	}
};

/**
 * AI Status command
 */
export const aiStatusCommand: Command = {
	name: 'ai status',
	description: 'Check the AI engine (OpenClaw/Anthropic) connection status',
	category: 'ai',
	aliases: ['status ai'],
	examples: ['tenantiq ai status'],
	requiresAuth: false,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const client = new TenantIQClient(ctx.config);

		try {
			const status = await client.aiStatus();
			const connected = status.openclaw === 'connected';
			const emoji = connected ? '🟢' : '🟡';

			let message = `${emoji} **AI Engine Status**\n\n`;
			message += `**OpenClaw:** ${status.openclaw}\n`;
			if (status.agentCount) {
				message += `**Available Agents:** ${status.agentCount}\n`;
			}
			message += '\n**Features:**\n';
			Object.entries(status.features).forEach(([feature, enabled]) => {
				message += `• ${feature}: ${enabled ? '✅' : '❌'}\n`;
			});

			if (!connected) {
				message += `\n💡 Set \`OPENCLAW_URL\` and \`OPENCLAW_SERVICE_KEY\` secrets to enable full AI features.`;
			}

			return { message, format: 'markdown' };
		} catch (error) {
			return errorResponse('Failed to get AI status', error);
		}
	}
};
