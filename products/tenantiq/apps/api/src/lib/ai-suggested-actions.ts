/**
 * AI Suggested Actions — parses AI response text and generates
 * contextual action buttons for the chat UI.
 */

export interface SuggestedAction {
	label: string;
	type: 'navigate' | 'remediate' | 'scan' | 'export';
	target: string;
	description: string;
}

interface ActionRule {
	keywords: string[];
	action: SuggestedAction;
}

const MAX_ACTIONS = 3;

const ACTION_RULES: ActionRule[] = [
	{
		keywords: ['security issue', 'security risk', 'cis benchmark', 'security posture', 'compliance gap', 'non-compliant'],
		action: {
			label: 'Run CIS Scan',
			type: 'scan',
			target: '/security/cis',
			description: 'Scan your tenant against CIS benchmarks to identify security gaps'
		}
	},
	{
		keywords: ['license waste', 'unused license', 'license cost', 'license optimization', 'over-licensed', 'wasted license'],
		action: {
			label: 'Optimize Licenses',
			type: 'navigate',
			target: '/licenses',
			description: 'Review and optimize license assignments to reduce costs'
		}
	},
	{
		keywords: ['risky user', 'suspicious sign-in', 'compromised account', 'impossible travel', 'anomalous behavior'],
		action: {
			label: 'View Risky Users',
			type: 'navigate',
			target: '/behavior',
			description: 'Review users flagged for risky or anomalous behavior'
		}
	},
	{
		keywords: ['mfa', 'multi-factor', 'two-factor', '2fa', 'authentication gap'],
		action: {
			label: 'Enable MFA',
			type: 'remediate',
			target: 'enable-mfa',
			description: 'Enable multi-factor authentication for unprotected users'
		}
	},
	{
		keywords: ['backup', 'data protection', 'recovery', 'disaster recovery'],
		action: {
			label: 'Run Backup',
			type: 'navigate',
			target: '/backups',
			description: 'Configure and run cloud backups for your tenant data'
		}
	},
	{
		keywords: ['email threat', 'phishing', 'spam', 'malware email', 'mail auth', 'dmarc', 'spf', 'dkim'],
		action: {
			label: 'Email Security',
			type: 'navigate',
			target: '/security/email',
			description: 'Review email security threats and authentication status'
		}
	},
	{
		keywords: ['config drift', 'configuration change', 'snapshot', 'config history'],
		action: {
			label: 'Config Snapshots',
			type: 'navigate',
			target: '/backups/config',
			description: 'Review configuration snapshots and detect drift'
		}
	},
	{
		keywords: ['inactive user', 'dormant account', 'stale account', 'unused account'],
		action: {
			label: 'User Lifecycle',
			type: 'navigate',
			target: '/workflows/lifecycle',
			description: 'Manage inactive and dormant user accounts'
		}
	},
	{
		keywords: ['copilot', 'copilot readiness', 'ai readiness'],
		action: {
			label: 'Copilot Readiness',
			type: 'navigate',
			target: '/security/copilot',
			description: 'Assess your tenant readiness for Microsoft Copilot'
		}
	},
	{
		keywords: ['alert', 'critical alert', 'high severity', 'security alert'],
		action: {
			label: 'View Alerts',
			type: 'navigate',
			target: '/alerts',
			description: 'Review and triage active security and compliance alerts'
		}
	}
];

/**
 * Generates suggested actions based on AI response content.
 * Scans the response for keyword matches and returns up to 3 relevant actions.
 */
export function generateSuggestedActions(response: string): SuggestedAction[] {
	if (!response || response.length < 10) return [];

	const lowerResponse = response.toLowerCase();
	const matched: SuggestedAction[] = [];
	const seenTargets = new Set<string>();

	for (const rule of ACTION_RULES) {
		if (matched.length >= MAX_ACTIONS) break;

		const hasMatch = rule.keywords.some((kw) => lowerResponse.includes(kw));
		if (hasMatch && !seenTargets.has(rule.action.target)) {
			matched.push(rule.action);
			seenTargets.add(rule.action.target);
		}
	}

	return matched;
}
