/**
 * AI Ask & Recommend commands — general Q&A with the AI assistant
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

/**
 * Ask AI a question
 */
export const askCommand: Command = {
	name: 'ask',
	description: 'Ask the AI assistant a question about your tenant',
	category: 'ai',
	aliases: ['question', 'query'],
	examples: [
		'tenantiq ask what security issues should I prioritize?',
		'tenantiq ask how can I reduce license costs?',
		'tenantiq ask show me users who cost the most',
		'tenantiq ask help me enable MFA for all admins'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const resolved = resolveClientAndTenant(ctx);
		if (isErrorResult(resolved)) return resolved.error;
		const { client, tenantId } = resolved;

		if (ctx.args.length === 0) {
			return {
				message: `Usage: tenantiq ask <your question>

**Examples:**
• tenantiq ask what security issues should I prioritize?
• tenantiq ask how can I reduce license costs?
• tenantiq ask show me users who haven't logged in for 90 days
• tenantiq ask help me enable MFA for all admins
• tenantiq ask what's the most expensive license waste?
• tenantiq ask how do I remove stale guest accounts?

💡 **Tip:** The AI can access all your tenant data and provide personalized recommendations!`,
				error: true
			};
		}

		const question = ctx.args.join(' ');

		try {
			const aiResponse = await client.askAI(tenantId, question);

			let message = `🤖 **AI Assistant**\n\n`;
			message += `**Your Question:** ${question}\n\n`;
			message += `**Answer:**\n${aiResponse}\n\n`;
			message += `💡 **Follow-up:** You can ask more questions or request specific actions based on this analysis.`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{ label: 'Ask Follow-up', command: 'tenantiq ask ' }
				]
			};
		} catch (error) {
			return errorResponse('Failed to get AI response', error);
		}
	}
};

/**
 * Get AI recommendations
 */
export const recommendCommand: Command = {
	name: 'recommend',
	description: 'Get AI-powered recommendations for your tenant',
	category: 'ai',
	aliases: ['recommendations', 'suggest', 'suggestions'],
	examples: [
		'tenantiq recommend',
		'tenantiq recommendations'
	],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const resolved = resolveClientAndTenant(ctx);
		if (isErrorResult(resolved)) return resolved.error;
		const { client, tenantId } = resolved;

		try {
			const question = `Analyze my current tenant status and provide:
1. Top 5 security recommendations with priority levels
2. Top 3 cost optimization opportunities with savings estimates
3. Compliance improvements needed
4. Operational efficiency suggestions

Format each recommendation with:
- Priority (Critical/High/Medium/Low)
- Impact (cost savings or security improvement)
- Effort required (Easy/Medium/Hard)
- Specific action steps`;

			const aiResponse = await client.askAI(tenantId, question);

			let message = `🎯 **AI-Powered Recommendations**\n\n`;
			message += aiResponse;
			message += `\n\n💡 **Next Steps:** Review these recommendations and ask me to help implement any of them!`;

			return {
				message,
				format: 'markdown',
				suggestedActions: [
					{ label: 'Check Security Status', command: 'tenantiq security status' },
					{ label: 'View License Waste', command: 'tenantiq license waste' },
					{ label: 'Ask Specific Question', command: 'tenantiq ask ' }
				]
			};
		} catch (error) {
			return errorResponse('Failed to get recommendations', error);
		}
	}
};
