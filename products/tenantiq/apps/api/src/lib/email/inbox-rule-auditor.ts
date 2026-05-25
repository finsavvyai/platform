/**
 * Inbox Rule Auditor — flags risky mail-flow rules per user.
 *
 * Common attacker pattern: compromise a mailbox, set up a forwarding rule,
 * exfiltrate replies + trigger Business Email Compromise. The rule often
 * has names like " ", "..", "a", "Z", or attempts to be hidden via legacy
 * MAPI properties Graph doesn't always surface.
 *
 * Pure functions over Graph payloads — easy to test, no side effects.
 */

export interface InboxRule {
	id: string;
	displayName?: string;
	sequence?: number;
	isEnabled?: boolean;
	hasError?: boolean;
	conditions?: Record<string, unknown>;
	exceptions?: Record<string, unknown>;
	actions?: {
		moveToFolder?: string;
		copyToFolder?: string;
		delete?: boolean;
		forwardTo?: Array<{ emailAddress?: { address?: string; name?: string } }>;
		forwardAsAttachmentTo?: Array<{ emailAddress?: { address?: string; name?: string } }>;
		redirectTo?: Array<{ emailAddress?: { address?: string; name?: string } }>;
		markAsRead?: boolean;
		markImportance?: string;
		permanentDelete?: boolean;
		assignCategories?: string[];
		stopProcessingRules?: boolean;
	};
}

export type RuleRiskType =
	| 'external_forwarding'
	| 'external_redirect'
	| 'auto_delete'
	| 'permanent_delete'
	| 'suspicious_name'
	| 'forward_and_delete';

export interface RuleFinding {
	userId: string;
	userPrincipalName?: string;
	ruleId: string;
	ruleName: string;
	enabled: boolean;
	riskType: RuleRiskType;
	severity: 'critical' | 'high' | 'medium' | 'low';
	detail: string;
	externalDomains: string[];
	remediation: string;
}

/** Names commonly used by attackers to make rules less visible. */
const SUSPICIOUS_NAMES = new Set([
	'', ' ', '  ', '.', '..', '...',
	'a', 'aa', 'z', 'zz',
	'rule', 'system', 'admin',
]);

function isExternal(address: string, internalDomains: Set<string>): boolean {
	const at = address.lastIndexOf('@');
	if (at < 0) return false;
	const domain = address.slice(at + 1).toLowerCase();
	return !internalDomains.has(domain);
}

function recipientAddresses(
	list: Array<{ emailAddress?: { address?: string } }> | undefined,
): string[] {
	if (!list) return [];
	return list
		.map(r => r.emailAddress?.address?.toLowerCase())
		.filter((a): a is string => !!a);
}

function externalRecipients(
	list: Array<{ emailAddress?: { address?: string } }> | undefined,
	internalDomains: Set<string>,
): string[] {
	return recipientAddresses(list).filter(addr => isExternal(addr, internalDomains));
}

function uniqueDomains(addresses: string[]): string[] {
	const set = new Set<string>();
	for (const addr of addresses) {
		const at = addr.lastIndexOf('@');
		if (at >= 0) set.add(addr.slice(at + 1));
	}
	return [...set];
}

/**
 * Audit a single user's inbox rules. Returns 0..N findings.
 */
export function auditUserInboxRules(
	userId: string,
	userPrincipalName: string | undefined,
	rules: InboxRule[],
	internalDomains: Set<string>,
): RuleFinding[] {
	const findings: RuleFinding[] = [];

	for (const rule of rules) {
		const ruleName = (rule.displayName ?? '').trim();
		const enabled = rule.isEnabled ?? false;
		const a = rule.actions ?? {};

		const fwdExternal = externalRecipients(a.forwardTo, internalDomains);
		const fwdAttachExternal = externalRecipients(a.forwardAsAttachmentTo, internalDomains);
		const redirectExternal = externalRecipients(a.redirectTo, internalDomains);

		const allForwardExternal = [...fwdExternal, ...fwdAttachExternal];

		if (allForwardExternal.length > 0) {
			findings.push({
				userId,
				userPrincipalName,
				ruleId: rule.id,
				ruleName,
				enabled,
				riskType: 'external_forwarding',
				severity: enabled ? 'high' : 'medium',
				detail: `Rule forwards mail to external address(es): ${allForwardExternal.join(', ')}`,
				externalDomains: uniqueDomains(allForwardExternal),
				remediation: 'Disable the rule and confirm with the user; if unauthorized, treat as a compromised-account incident.',
			});
		}

		if (redirectExternal.length > 0) {
			findings.push({
				userId,
				userPrincipalName,
				ruleId: rule.id,
				ruleName,
				enabled,
				riskType: 'external_redirect',
				severity: enabled ? 'critical' : 'high',
				detail: `Rule redirects mail to external address(es): ${redirectExternal.join(', ')} (sender does not see recipient).`,
				externalDomains: uniqueDomains(redirectExternal),
				remediation: 'Redirect-to-external is a strong BEC indicator. Disable, audit recent sign-ins, force password reset, revoke sessions.',
			});
		}

		if (a.delete && (allForwardExternal.length > 0 || redirectExternal.length > 0)) {
			findings.push({
				userId,
				userPrincipalName,
				ruleId: rule.id,
				ruleName,
				enabled,
				riskType: 'forward_and_delete',
				severity: 'critical',
				detail: 'Rule forwards/redirects to external recipients AND deletes the original — classic stealth-exfiltration pattern.',
				externalDomains: uniqueDomains([...allForwardExternal, ...redirectExternal]),
				remediation: 'Treat as confirmed compromise. Disable rule, revoke all user sessions, force password reset, full mailbox audit.',
			});
		}

		if (a.permanentDelete) {
			findings.push({
				userId,
				userPrincipalName,
				ruleId: rule.id,
				ruleName,
				enabled,
				riskType: 'permanent_delete',
				severity: enabled ? 'high' : 'medium',
				detail: 'Rule permanently deletes matching mail (bypasses Recoverable Items).',
				externalDomains: [],
				remediation: 'Confirm intent with the user; permanent delete bypasses retention and is rarely legitimate.',
			});
		}

		if (a.delete && !a.permanentDelete && allForwardExternal.length === 0 && redirectExternal.length === 0) {
			findings.push({
				userId,
				userPrincipalName,
				ruleId: rule.id,
				ruleName,
				enabled,
				riskType: 'auto_delete',
				severity: 'low',
				detail: 'Rule auto-deletes matching mail.',
				externalDomains: [],
				remediation: 'Review with the user — common for unsubscribe automation but worth confirming.',
			});
		}

		// Only flag if the rule explicitly has a suspicious name; absent
		// displayName is just missing Graph data, not an attacker signal.
		const explicitName = typeof rule.displayName === 'string' ? rule.displayName.trim() : null;
		if (explicitName !== null && SUSPICIOUS_NAMES.has(explicitName.toLowerCase())) {
			findings.push({
				userId,
				userPrincipalName,
				ruleId: rule.id,
				ruleName,
				enabled,
				riskType: 'suspicious_name',
				severity: enabled ? 'medium' : 'low',
				detail: `Rule has a suspicious low-visibility name (${JSON.stringify(ruleName)}); attackers use these to hide rules.`,
				externalDomains: [],
				remediation: 'Review the rule contents; rename or remove if not intentional.',
			});
		}
	}

	return findings;
}

export interface AuditSummary {
	usersAudited: number;
	usersWithRules: number;
	totalRules: number;
	totalFindings: number;
	findingsBySeverity: Record<RuleFinding['severity'], number>;
	findingsByType: Record<RuleRiskType, number>;
}

export function summarize(findings: RuleFinding[], usersAudited: number, usersWithRules: number, totalRules: number): AuditSummary {
	const findingsBySeverity: Record<RuleFinding['severity'], number> = { critical: 0, high: 0, medium: 0, low: 0 };
	const findingsByType: Record<RuleRiskType, number> = {
		external_forwarding: 0, external_redirect: 0, auto_delete: 0,
		permanent_delete: 0, suspicious_name: 0, forward_and_delete: 0,
	};
	for (const f of findings) {
		findingsBySeverity[f.severity]++;
		findingsByType[f.riskType]++;
	}
	return { usersAudited, usersWithRules, totalRules, totalFindings: findings.length, findingsBySeverity, findingsByType };
}
