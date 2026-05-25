/**
 * TenantIQ + OpenHands AI Commands for OpenClaw
 *
 * These commands are sent from messaging platforms (Slack, Teams, etc.)
 * to TenantIQ via OpenClaw, and use the OpenHands AI engine for intelligent
 * responses powered by Luna agents.
 *
 * Commands:
 *   tenantiq ai scan <tenant>           — Full AI security posture scan
 *   tenantiq ai optimize <tenant>       — AI license waste analysis
 *   tenantiq ai ask <tenant> <question> — Natural language Q&A
 *   tenantiq ai chain <tenant> <preset> — Multi-agent analysis chain
 *   tenantiq ai status                  — OpenClaw AI engine status
 */

export interface TenantIQCommand {
	name: string;
	description: string;
	usage: string;
	examples: string[];
	requiresAI: boolean;
}

export const AI_COMMANDS: TenantIQCommand[] = [
	{
		name: 'ai scan',
		description: 'Run a full AI-powered security posture analysis on a Microsoft 365 tenant',
		usage: 'tenantiq ai scan <tenant-id>',
		examples: [
			'tenantiq ai scan acme-corp',
			'tenantiq ai scan all',
		],
		requiresAI: true,
	},
	{
		name: 'ai optimize',
		description: 'Identify license waste and cost savings using AI analysis',
		usage: 'tenantiq ai optimize <tenant-id>',
		examples: [
			'tenantiq ai optimize acme-corp',
			'tenantiq ai optimize --high-value-only',
		],
		requiresAI: true,
	},
	{
		name: 'ai ask',
		description: 'Ask a natural language question about any tenant',
		usage: 'tenantiq ai ask <tenant-id> <question>',
		examples: [
			'tenantiq ai ask acme-corp "which users are security risks?"',
			'tenantiq ai ask acme-corp "how much are we wasting on licenses?"',
			'tenantiq ai ask acme-corp "are we GDPR compliant?"',
		],
		requiresAI: true,
	},
	{
		name: 'ai chain',
		description: 'Run a multi-agent analysis chain for comprehensive insights',
		usage: 'tenantiq ai chain <tenant-id> <preset>',
		examples: [
			'tenantiq ai chain acme-corp security-audit',
			'tenantiq ai chain acme-corp compliance-check',
			'tenantiq ai chain acme-corp full-assessment',
		],
		requiresAI: true,
	},
	{
		name: 'ai status',
		description: 'Check the OpenHands AI engine connection status',
		usage: 'tenantiq ai status',
		examples: ['tenantiq ai status'],
		requiresAI: false,
	},
];

export interface CommandResult {
	success: boolean;
	message: string;
	data?: Record<string, unknown>;
	markdown?: string;
}

/**
 * Parse a raw command string from a messaging platform.
 */
export function parseCommand(raw: string): {
	command: string;
	tenantId?: string;
	args: string[];
} | null {
	const trimmed = raw.trim().replace(/^tenantiq\s+/i, '');
	const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

	if (parts.length === 0) return null;

	const command = parts.slice(0, 2).join(' ').toLowerCase();
	const remaining = parts.slice(2);

	return {
		command,
		tenantId: remaining[0]?.replace(/"/g, ''),
		args: remaining.slice(1).map((a) => a.replace(/"/g, '')),
	};
}

/**
 * Format an AI security scan result for a messaging platform.
 */
export function formatSecurityScanResult(analysis: {
	riskScore: number;
	criticalFindings: string[];
	recommendations: string[];
	complianceGaps: string[];
	estimatedRemediationHours: number;
	tenant: string;
}): string {
	const emoji = analysis.riskScore >= 70 ? '🔴' : analysis.riskScore >= 40 ? '🟡' : '🟢';

	return `
${emoji} **AI Security Scan — ${analysis.tenant}**
Risk Score: **${analysis.riskScore}/100**

🚨 **Critical Findings** (${analysis.criticalFindings.length})
${analysis.criticalFindings.slice(0, 5).map((f) => `• ${f}`).join('\n') || '• None found ✅'}

✅ **Recommendations**
${analysis.recommendations.slice(0, 5).map((r) => `• ${r}`).join('\n')}

📋 **Compliance Gaps**
${analysis.complianceGaps.slice(0, 3).map((g) => `• ${g}`).join('\n') || '• No gaps identified ✅'}

⏱️ Estimated remediation: **${analysis.estimatedRemediationHours}h**
_Powered by OpenHands Luna agents via TenantIQ_
`.trim();
}

/**
 * Format a license optimization result for a messaging platform.
 */
export function formatLicenseOptimizationResult(result: {
	wastedLicenses: number;
	estimatedMonthlySavings: number;
	recommendations: Array<{ action: string; priority: string }>;
	tenant: string;
}): string {
	const savingsEmoji = result.estimatedMonthlySavings > 500 ? '💰💰' : '💰';

	return `
${savingsEmoji} **License Optimization — ${result.tenant}**
Wasted Licenses: **${result.wastedLicenses}**
Estimated Monthly Savings: **$${result.estimatedMonthlySavings.toFixed(0)}**

📋 **Top Actions**
${result.recommendations
	.slice(0, 5)
	.map((r) => `• [${r.priority.toUpperCase()}] ${r.action}`)
	.join('\n') || '• No actions needed ✅'}

_Powered by OpenHands Luna agents via TenantIQ_
`.trim();
}

/**
 * Format a help message showing all AI commands.
 */
export function formatAIHelp(): string {
	return `
🤖 **TenantIQ AI Commands** (Powered by OpenHands)

${AI_COMMANDS.map((cmd) => `**\`${cmd.usage}\`**\n${cmd.description}\n_Example: ${cmd.examples[0]}_`).join('\n\n')}

Available chain presets: \`security-audit\`, \`compliance-check\`, \`cost-review\`, \`full-assessment\`
`.trim();
}
