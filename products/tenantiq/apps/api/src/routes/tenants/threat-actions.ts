/**
 * Type-specific suggested actions for threat findings.
 * Returns labels with optional deep-link hrefs so the UI can drive the
 * operator to the right remediation page rather than showing dead pills.
 */

export interface ThreatAction {
	label: string;
	href?: string;
	kind?: 'primary' | 'danger' | 'secondary';
}

export function suggestActions(type: string, severity?: string, hasUser?: boolean): ThreatAction[] {
	const t = (type || '').toLowerCase();
	if (t.includes('group') || t.includes('cleanup'))
		return [
			{ label: 'Review groups', href: '/governance', kind: 'primary' },
			{ label: 'Run cleanup workflow', href: '/workflows', kind: 'secondary' },
			{ label: 'Export list', kind: 'secondary' },
		];
	if (t.includes('guest'))
		return [
			{ label: 'Review guest list', href: '/governance', kind: 'primary' },
			{ label: 'Remove stale guests', href: '/workflows/lifecycle', kind: 'danger' },
			{ label: 'Export list', kind: 'secondary' },
		];
	if (t.includes('license') || t.includes('cost'))
		return [
			{ label: 'View licenses', href: '/licenses', kind: 'primary' },
			{ label: 'Reclaim unused', href: '/licenses', kind: 'secondary' },
			{ label: 'Run optimization', href: '/workflows', kind: 'secondary' },
		];
	if (t.includes('email') || t.includes('phish') || t.includes('malware') || t.includes('spoof'))
		return [
			{ label: 'View quarantine', href: '/security/email', kind: 'primary' },
			{ label: 'Review mail auth', href: '/security/email', kind: 'secondary' },
			{ label: 'Run phishing scan', href: '/security/email', kind: 'secondary' },
		];
	if (t.includes('signin') || t.includes('auth') || t.includes('mfa') || t.includes('risk'))
		return [
			{ label: 'Review sign-ins', href: '/security/signin-logs', kind: 'primary' },
			{ label: 'Enforce MFA', href: '/workflows', kind: 'secondary' },
			...(hasUser ? [{ label: 'Block user', kind: 'danger' as const }] : []),
		];
	if (t.includes('config') || t.includes('drift'))
		return [
			{ label: 'View drift', href: '/audit/history', kind: 'primary' },
			{ label: 'Snapshot now', href: '/backups/config', kind: 'secondary' },
		];
	if (severity === 'critical' || severity === 'high')
		return [
			{ label: 'Investigate', kind: 'primary' },
			...(hasUser ? [{ label: 'Disable account', kind: 'danger' as const }] : []),
			{ label: 'Escalate', kind: 'secondary' },
		];
	return [
		{ label: 'Investigate', kind: 'primary' },
		{ label: 'Review details', kind: 'secondary' },
	];
}
