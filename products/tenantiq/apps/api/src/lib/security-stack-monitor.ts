/**
 * Security Stack snapshot capture and drift detection.
 * Uses GraphClient.fetch() for all Graph API calls.
 */
import type { GraphClient } from './graph-client';

export interface SecurityStackSnapshot {
	conditionalAccess: {
		policyCount: number;
		mfaEnabled: boolean;
		legacyBlocked: boolean;
	};
	dlp: {
		policyCount: number;
		labelsCount: number;
	};
	identity: {
		mfaCoverage: number;
		riskyUsers: number;
		signInRiskPolicy: boolean;
	};
	email: {
		safeLinks: boolean;
		safeAttachments: boolean;
		antiPhishing: boolean;
	};
	timestamp: string;
}

export interface SecurityDrift {
	product: string;
	field: string;
	previousValue: unknown;
	currentValue: unknown;
	severity: 'critical' | 'high' | 'medium' | 'low';
	recommendation: string;
}

export async function captureSecuritySnapshot(
	graph: GraphClient,
	_tenantId: string
): Promise<SecurityStackSnapshot> {
	// Fetch CA policies
	let caPolicies: any[] = [];
	try {
		const caResponse = await graph.fetch('/identity/conditionalAccessPolicies');
		caPolicies = caResponse?.value ?? [];
	} catch { /* CA may require specific license */ }

	const mfaEnabled = caPolicies.some(
		(p: any) => p.grantControls?.builtInControls?.includes('mfa')
	);
	const legacyBlocked = caPolicies.some(
		(p: any) =>
			p.conditions?.clientAppTypes?.includes('exchangeActiveSync') &&
			p.grantControls?.builtInControls?.includes('block')
	);

	// Fetch risky users
	let riskyUsers: any[] = [];
	try {
		const riskyResponse = await graph.fetch('/identityProtection/riskyUsers?$top=50');
		riskyUsers = riskyResponse?.value ?? [];
	} catch { /* identity protection may not be licensed */ }

	// MFA coverage — count users with MFA registered
	let mfaCoverage = 0;
	try {
		const usersResponse = await graph.fetch(
			'/reports/credentialUserRegistrationDetails?$filter=isMfaRegistered eq true&$top=999'
		);
		const mfaUsers = usersResponse?.value ?? [];
		const totalResponse = await graph.fetch('/users/$count');
		const total = typeof totalResponse === 'number' ? totalResponse : 0;
		mfaCoverage = total > 0 ? Math.round((mfaUsers.length / total) * 100) : 0;
	} catch { /* report API may not be available */ }

	// Check for sign-in risk policy in CA
	const signInRiskPolicy = caPolicies.some(
		(p: any) => (p.conditions?.signInRiskLevels?.length ?? 0) > 0
	);

	return {
		conditionalAccess: {
			policyCount: caPolicies.length,
			mfaEnabled,
			legacyBlocked,
		},
		dlp: {
			policyCount: 0, // DLP requires Security & Compliance PowerShell
			labelsCount: 0,
		},
		identity: {
			mfaCoverage,
			riskyUsers: riskyUsers.length,
			signInRiskPolicy,
		},
		email: {
			safeLinks: false, // Requires Exchange Online cmdlets
			safeAttachments: false,
			antiPhishing: false,
		},
		timestamp: new Date().toISOString(),
	};
}

export function detectSecurityDrifts(
	current: SecurityStackSnapshot,
	previous: SecurityStackSnapshot | null
): SecurityDrift[] {
	if (!previous) return [];

	const drifts: SecurityDrift[] = [];

	if (current.conditionalAccess.policyCount !== previous.conditionalAccess.policyCount) {
		drifts.push({
			product: 'Conditional Access',
			field: 'policyCount',
			previousValue: previous.conditionalAccess.policyCount,
			currentValue: current.conditionalAccess.policyCount,
			severity: 'high',
			recommendation: 'Review CA policy changes to ensure security posture is maintained.',
		});
	}

	if (current.conditionalAccess.mfaEnabled !== previous.conditionalAccess.mfaEnabled) {
		drifts.push({
			product: 'Conditional Access',
			field: 'mfaEnabled',
			previousValue: previous.conditionalAccess.mfaEnabled,
			currentValue: current.conditionalAccess.mfaEnabled,
			severity: 'critical',
			recommendation: 'MFA requirement has changed. Verify MFA is enabled for critical users.',
		});
	}

	if (current.conditionalAccess.legacyBlocked !== previous.conditionalAccess.legacyBlocked) {
		drifts.push({
			product: 'Conditional Access',
			field: 'legacyBlocked',
			previousValue: previous.conditionalAccess.legacyBlocked,
			currentValue: current.conditionalAccess.legacyBlocked,
			severity: 'high',
			recommendation: 'Legacy auth blocking status changed. Ensure legacy clients are blocked.',
		});
	}

	if (current.dlp.policyCount !== previous.dlp.policyCount) {
		drifts.push({
			product: 'Data Loss Prevention',
			field: 'policyCount',
			previousValue: previous.dlp.policyCount,
			currentValue: current.dlp.policyCount,
			severity: 'high',
			recommendation: 'Review DLP policy changes to maintain data protection.',
		});
	}

	if (current.identity.signInRiskPolicy !== previous.identity.signInRiskPolicy) {
		drifts.push({
			product: 'Identity Protection',
			field: 'signInRiskPolicy',
			previousValue: previous.identity.signInRiskPolicy,
			currentValue: current.identity.signInRiskPolicy,
			severity: 'high',
			recommendation: 'Sign-in risk policy status changed. Verify risk-based enforcement is active.',
		});
	}

	if (current.identity.mfaCoverage < previous.identity.mfaCoverage) {
		drifts.push({
			product: 'Identity Protection',
			field: 'mfaCoverage',
			previousValue: `${previous.identity.mfaCoverage}%`,
			currentValue: `${current.identity.mfaCoverage}%`,
			severity: 'medium',
			recommendation: 'MFA coverage declined. Enforce MFA for all users.',
		});
	}

	if (current.email.safeLinks !== previous.email.safeLinks) {
		drifts.push({
			product: 'Email Security',
			field: 'safeLinks',
			previousValue: previous.email.safeLinks,
			currentValue: current.email.safeLinks,
			severity: 'high',
			recommendation: 'Safe Links status changed. Ensure it remains enabled.',
		});
	}

	if (current.email.safeAttachments !== previous.email.safeAttachments) {
		drifts.push({
			product: 'Email Security',
			field: 'safeAttachments',
			previousValue: previous.email.safeAttachments,
			currentValue: current.email.safeAttachments,
			severity: 'high',
			recommendation: 'Safe Attachments status changed. Ensure it remains enabled.',
		});
	}

	if (current.email.antiPhishing !== previous.email.antiPhishing) {
		drifts.push({
			product: 'Email Security',
			field: 'antiPhishing',
			previousValue: previous.email.antiPhishing,
			currentValue: current.email.antiPhishing,
			severity: 'critical',
			recommendation: 'Anti-phishing protection status changed. Enable immediately.',
		});
	}

	return drifts;
}
