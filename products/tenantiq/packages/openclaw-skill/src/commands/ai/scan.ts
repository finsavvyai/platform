/**
 * AI Scan & Optimize commands — security posture and license analysis
 */

import type { Command, CommandContext, CommandResponse } from '../../types';
import { resolveClientAndTenant, isErrorResult, errorResponse } from './helpers';

/**
 * AI Security Scan command
 */
export const aiScanCommand: Command = {
	name: 'ai scan',
	description: 'Run a full AI-powered security posture analysis on the active tenant',
	category: 'ai',
	aliases: ['scan ai', 'security scan ai'],
	examples: ['tenantiq ai scan'],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const resolved = resolveClientAndTenant(ctx);
		if (isErrorResult(resolved)) return resolved.error;
		const { client, tenantId } = resolved;

		try {
			const result = await client.aiSecurityScan(tenantId);
			const a = result.analysis;
			const emoji = a.riskScore >= 70 ? '🔴' : a.riskScore >= 40 ? '🟡' : '🟢';

			let message = `${emoji} **AI Security Scan** _(powered by ${result.source})_\n\n`;
			message += `**Risk Score:** ${a.riskScore}/100\n\n`;

			if (a.criticalFindings.length > 0) {
				message += `🚨 **Critical Findings** (${a.criticalFindings.length})\n`;
				a.criticalFindings.slice(0, 5).forEach(f => { message += `• ${f}\n`; });
				message += '\n';
			}

			if (a.recommendations.length > 0) {
				message += `✅ **Recommendations**\n`;
				a.recommendations.slice(0, 5).forEach(r => { message += `• ${r}\n`; });
				message += '\n';
			}

			if (a.complianceGaps.length > 0) {
				message += `📋 **Compliance Gaps**\n`;
				a.complianceGaps.slice(0, 3).forEach(g => { message += `• ${g}\n`; });
				message += '\n';
			}

			message += `⏱️ Estimated remediation: **${a.estimatedRemediationHours}h**`;

			return { message, format: 'markdown' };
		} catch (error) {
			return errorResponse('AI security scan failed', error);
		}
	}
};

/**
 * AI License Optimization command
 */
export const aiOptimizeCommand: Command = {
	name: 'ai optimize',
	description: 'Run AI-powered license waste analysis and cost optimization',
	category: 'ai',
	aliases: ['optimize ai', 'license ai'],
	examples: ['tenantiq ai optimize'],
	requiresAuth: true,
	handler: async (ctx: CommandContext): Promise<CommandResponse> => {
		const resolved = resolveClientAndTenant(ctx);
		if (isErrorResult(resolved)) return resolved.error;
		const { client, tenantId } = resolved;

		try {
			const result = await client.aiLicenseOptimize(tenantId);
			const a = result.analysis;
			const savingsEmoji = a.estimatedMonthlySavings > 500 ? '💰💰' : '💰';

			let message = `${savingsEmoji} **AI License Optimization** _(powered by ${result.source})_\n\n`;
			message += `**Wasted Licenses:** ${a.wastedLicenses}\n`;
			message += `**Estimated Monthly Savings:** $${a.estimatedMonthlySavings.toFixed(0)}\n\n`;

			if (a.recommendations.length > 0) {
				message += `📋 **Top Actions**\n`;
				a.recommendations.slice(0, 5).forEach(r => {
					message += `• [${r.priority.toUpperCase()}] ${r.action}\n`;
				});
			}

			return { message, format: 'markdown' };
		} catch (error) {
			return errorResponse('AI license optimization failed', error);
		}
	}
};
