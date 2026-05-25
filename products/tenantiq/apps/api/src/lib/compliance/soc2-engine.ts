/**
 * SOC 2 Trust Service Criteria compliance engine.
 * Evaluates tenant security posture against SOC 2 controls.
 */

import type { ControlResult, ComplianceResult, TenantSecurityData, TenantSecurityDataNullable } from './types';
import { buildResult, errorControl, THRESHOLDS } from './types';

const FRAMEWORK = 'SOC 2';

type NullableData = TenantSecurityData | TenantSecurityDataNullable;

interface SOC2Control {
	id: string;
	criteria: string;
	description: string;
	/** Fields from TenantSecurityData required for this check */
	requires: (keyof TenantSecurityData)[];
	check: (data: TenantSecurityData) => { status: ControlResult['status']; evidence: string };
}

const SOC2_CONTROLS: SOC2Control[] = [
	{ id: 'CC1.1', criteria: 'CC1 — Control Environment', description: 'Organization security policies exist and are enforced', requires: ['caTotal'],
		check: (d) => ({ status: d.caTotal > 0 ? 'pass' : 'fail', evidence: d.caTotal > 0 ? `${d.caTotal} security policies defined` : 'No security policies configured' }) },
	{ id: 'CC2.1', criteria: 'CC2 — Communication and Information', description: 'Security awareness training tracked for workforce', requires: ['secureScore'],
		check: (d) => ({ status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'pass' : 'partial', evidence: `Secure Score ${d.secureScore}/100 indicates ${d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'strong' : 'moderate'} security posture awareness` }) },
	{ id: 'CC3.1', criteria: 'CC3 — Risk Assessment', description: 'Risk assessment processes documented and active', requires: ['riskyUsers'],
		check: (d) => ({ status: d.riskyUsers === THRESHOLDS.RISKY_USERS_WARN ? 'pass' : 'partial', evidence: d.riskyUsers === 0 ? 'No risky users detected — risk monitoring active' : `${d.riskyUsers} risky user(s) detected — risk assessment in progress` }) },
	{ id: 'CC5.1', criteria: 'CC5 — Control Activities', description: 'Access reviews and conditional access policies configured', requires: ['caEnabled', 'caTotal'],
		check: (d) => ({ status: d.caEnabled >= THRESHOLDS.CA_STRONG ? 'pass' : d.caEnabled > 0 ? 'partial' : 'fail', evidence: `${d.caEnabled}/${d.caTotal} conditional access policies enabled` }) },
	{ id: 'CC6.1', criteria: 'CC6 — Logical and Physical Access', description: 'MFA enforced, CA policies active, least privilege applied', requires: ['mfaRate', 'caEnabled'],
		check: (d) => { const mfaOk = d.mfaRate >= THRESHOLDS.MFA_PASS; const caOk = d.caEnabled >= THRESHOLDS.CA_STRONG; return { status: mfaOk && caOk ? 'pass' : mfaOk || caOk ? 'partial' : 'fail', evidence: `MFA adoption ${Math.round(d.mfaRate * 100)}%, ${d.caEnabled} CA policies active` }; } },
	{ id: 'CC7.1', criteria: 'CC7 — System Operations', description: 'Audit logging enabled and security monitoring active', requires: ['auditEnabled'],
		check: (d) => ({ status: d.auditEnabled ? 'pass' : 'fail', evidence: d.auditEnabled ? 'Audit logging enabled with active monitoring' : 'Audit logging not enabled' }) },
	{ id: 'CC8.1', criteria: 'CC8 — Change Management', description: 'Change approval process and configuration tracking', requires: ['secureScore'],
		check: (d) => ({ status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PARTIAL ? 'partial' : 'fail', evidence: 'Change management requires manual verification of approval workflows' }) },
	{ id: 'A1.1', criteria: 'A1 — Availability', description: 'Backup and recovery procedures tested', requires: ['backupConfigured'],
		check: (d) => ({ status: d.backupConfigured ? 'pass' : 'fail', evidence: d.backupConfigured ? 'Backup and recovery configuration verified' : 'Backup configuration not detected' }) },
];

export type SOC2Result = ComplianceResult;

export function evaluateSOC2(tenantData: NullableData): SOC2Result {
	const controls: ControlResult[] = SOC2_CONTROLS.map((ctrl) => {
		const missing = ctrl.requires.find((f) => (tenantData as any)[f] == null);
		if (missing) return errorControl(ctrl.id, ctrl.criteria, FRAMEWORK, `${missing} data unavailable`);
		const result = ctrl.check(tenantData as TenantSecurityData);
		return {
			id: ctrl.id, name: ctrl.criteria, framework: FRAMEWORK,
			status: result.status, evidence: result.evidence,
			remediation: result.status !== 'pass' ? getRemediation(ctrl.id) : undefined,
		};
	});
	return buildResult(FRAMEWORK, controls);
}

function getRemediation(controlId: string): string {
	const remediations: Record<string, string> = {
		'CC1.1': 'Define and publish organizational security policies via Conditional Access',
		'CC2.1': 'Improve Secure Score by addressing recommended security actions',
		'CC3.1': 'Investigate and remediate risky users flagged by Identity Protection',
		'CC5.1': 'Enable at least 3 Conditional Access policies for access control',
		'CC6.1': 'Enforce MFA for all users and enable additional CA policies',
		'CC7.1': 'Enable unified audit logging in Microsoft 365 compliance center',
		'CC8.1': 'Implement change approval workflows for configuration changes',
		'A1.1': 'Configure backup and disaster recovery for critical workloads',
	};
	return remediations[controlId] || 'Review control configuration';
}
