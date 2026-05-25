/**
 * Zero Trust pillar evaluators — Data, Infrastructure, and roadmap generation.
 * Split from zero-trust-engine.ts to stay under 200-line limit.
 */

import type { TenantSecurityData, TenantSecurityDataNullable } from '../compliance/types';
import type { ZeroTrustCheck, ZeroTrustPillar, ZeroTrustResult } from './zero-trust-engine';

export function pillarScore(checks: ZeroTrustCheck[]): number {
	const scorable = checks.filter((c) => c.status !== 'error');
	if (scorable.length === 0) return 0;
	const pts = scorable.reduce((s, c) => {
		if (c.status === 'pass') return s + 1;
		if (c.status === 'partial') return s + 0.5;
		return s;
	}, 0);
	return Math.round((pts / scorable.length) * 100);
}

function errCheck(name: string, msg: string): ZeroTrustCheck {
	return { name, status: 'error', evidence: 'Unable to assess', errorMessage: msg };
}

type NullableData = TenantSecurityData | TenantSecurityDataNullable;

export function evaluateNetwork(data: NullableData): ZeroTrustPillar {
	const checks: ZeroTrustCheck[] = [
		data.caEnabled == null ? errCheck('Named Locations Configured', 'CA data unavailable') : {
			name: 'Named Locations Configured',
			status: data.caEnabled >= 2 ? 'partial' : 'fail',
			evidence: 'Named locations inferred from CA policy count',
		},
		data.caEnabled == null ? errCheck('Trusted IP Ranges', 'CA data unavailable') : {
			name: 'Trusted IP Ranges',
			status: data.caEnabled >= 1 ? 'partial' : 'fail',
			evidence: 'IP-based access controls inferred from CA policies',
		},
	];
	const recs: string[] = [];
	recs.push('Define named locations for corporate offices');
	recs.push('Block sign-ins from high-risk countries');
	return { name: 'Network', score: pillarScore(checks), checks, recommendations: recs };
}

export function evaluateApplications(data: NullableData): ZeroTrustPillar {
	const checks: ZeroTrustCheck[] = [
		data.caEnabled == null ? errCheck('App Consent Policies', 'CA data unavailable') : {
			name: 'App Consent Policies',
			status: data.caEnabled >= 2 ? 'partial' : 'fail',
			evidence: 'App consent restrictions inferred from security posture',
		},
		data.secureScore == null ? errCheck('OAuth App Review', 'Secure Score unavailable') : {
			name: 'OAuth App Review',
			status: data.secureScore >= 70 ? 'pass' : data.secureScore >= 50 ? 'partial' : 'fail',
			evidence: `Secure score: ${data.secureScore}%`,
		},
	];
	const recs: string[] = [];
	if (data.secureScore != null && data.secureScore < 70) recs.push('Review third-party OAuth app permissions');
	recs.push('Restrict user consent to verified publishers only');
	return { name: 'Applications', score: pillarScore(checks), checks, recommendations: recs };
}

export function evaluateData(data: NullableData): ZeroTrustPillar {
	const checks: ZeroTrustCheck[] = [
		data.dlpPolicies == null ? errCheck('DLP Policies', 'DLP data unavailable') : {
			name: 'DLP Policies',
			status: data.dlpPolicies >= 2 ? 'pass' : data.dlpPolicies >= 1 ? 'partial' : 'fail',
			evidence: `${data.dlpPolicies} DLP policies configured`,
		},
		data.sensitivityLabels == null ? errCheck('Sensitivity Labels', 'Labels data unavailable') : {
			name: 'Sensitivity Labels',
			status: data.sensitivityLabels >= 3 ? 'pass' : data.sensitivityLabels >= 1 ? 'partial' : 'fail',
			evidence: `${data.sensitivityLabels} sensitivity labels defined`,
		},
		data.encryptionEnabled == null ? errCheck('Encryption', 'Encryption data unavailable') : {
			name: 'Encryption',
			status: data.encryptionEnabled ? 'pass' : 'fail',
			evidence: data.encryptionEnabled ? 'Encryption enabled' : 'Encryption not configured',
		},
	];
	const recs: string[] = [];
	if (data.dlpPolicies != null && data.dlpPolicies < 2) recs.push('Create DLP policies for PII and financial data');
	if (data.sensitivityLabels != null && data.sensitivityLabels < 3) recs.push('Define sensitivity labels for classification');
	if (data.encryptionEnabled != null && !data.encryptionEnabled) recs.push('Enable encryption on sensitive labels');
	return { name: 'Data', score: pillarScore(checks), checks, recommendations: recs };
}

export function evaluateInfrastructure(data: NullableData): ZeroTrustPillar {
	const checks: ZeroTrustCheck[] = [
		data.secureScore == null ? errCheck('Security Defaults', 'Secure Score unavailable') : {
			name: 'Security Defaults',
			status: data.secureScore >= 50 ? 'pass' : 'fail',
			evidence: `Secure score: ${data.secureScore}%`,
		},
		data.auditEnabled == null ? errCheck('Audit Logging', 'Audit data unavailable') : {
			name: 'Audit Logging',
			status: data.auditEnabled ? 'pass' : 'fail',
			evidence: data.auditEnabled ? 'Audit logging enabled' : 'Audit logging not configured',
		},
		data.backupConfigured == null ? errCheck('Backup Configuration', 'Backup data unavailable') : {
			name: 'Backup Configuration',
			status: data.backupConfigured ? 'pass' : 'fail',
			evidence: data.backupConfigured ? 'Backup configured' : 'No backup configuration',
		},
	];
	const recs: string[] = [];
	if (data.secureScore != null && data.secureScore < 50) recs.push('Enable security defaults in Azure AD');
	if (data.auditEnabled != null && !data.auditEnabled) recs.push('Enable unified audit logging');
	if (data.backupConfigured != null && !data.backupConfigured) recs.push('Configure backup for critical data');
	return { name: 'Infrastructure', score: pillarScore(checks), checks, recommendations: recs };
}

/** Generate ordered roadmap from assessment results */
export function generateRoadmap(
	result: ZeroTrustResult,
): Array<{ priority: number; pillar: string; action: string; impact: string }> {
	const items: Array<{ priority: number; pillar: string; action: string; impact: string }> = [];
	let priority = 1;

	const sorted = [...result.pillars].sort((a, b) => a.score - b.score);
	for (const pillar of sorted) {
		for (const rec of pillar.recommendations) {
			items.push({
				priority: priority++,
				pillar: pillar.name,
				action: rec,
				impact: pillar.score < 50 ? 'high' : 'medium',
			});
		}
	}
	return items;
}
