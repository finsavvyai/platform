/**
 * HIPAA compliance engine.
 * Evaluates tenant security posture against HIPAA safeguard requirements.
 */

import type { ControlResult, ComplianceResult, TenantSecurityData, TenantSecurityDataNullable } from './types';
import { buildResult, errorControl, THRESHOLDS } from './types';

const FRAMEWORK = 'HIPAA';
type NullableData = TenantSecurityData | TenantSecurityDataNullable;

interface HIPAAControl {
	id: string;
	safeguard: string;
	description: string;
	requires: (keyof TenantSecurityData)[];
	check: (data: TenantSecurityData) => { status: ControlResult['status']; evidence: string };
}

const HIPAA_CONTROLS: HIPAAControl[] = [
	{ id: '164.308(a)(3)', safeguard: 'Administrative — Workforce Security', description: 'Ensure workforce members have appropriate access to ePHI', requires: ['caEnabled'],
		check: (d) => ({ status: d.caEnabled >= THRESHOLDS.CA_STRONG ? 'pass' : d.caEnabled > 0 ? 'partial' : 'fail', evidence: `${d.caEnabled} conditional access policies enforce workforce access controls` }) },
	{ id: '164.308(a)(4)', safeguard: 'Administrative — Information Access Management', description: 'Policies to authorize access to ePHI', requires: ['dlpPolicies', 'sensitivityLabels'],
		check: (d) => { const hasDlp = d.dlpPolicies >= THRESHOLDS.DLP_PASS; const hasLabels = d.sensitivityLabels >= THRESHOLDS.LABELS_PASS; return { status: hasDlp && hasLabels ? 'pass' : hasDlp || hasLabels ? 'partial' : 'fail', evidence: `${d.dlpPolicies} DLP policies, ${d.sensitivityLabels} sensitivity labels configured` }; } },
	{ id: '164.308(a)(5)', safeguard: 'Administrative — Security Awareness Training', description: 'Security awareness and training program implemented', requires: ['secureScore'],
		check: (d) => ({ status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'pass' : 'partial', evidence: `Secure Score ${d.secureScore}/100 reflects security awareness posture` }) },
	{ id: '164.308(a)(7)', safeguard: 'Administrative — Contingency Plan', description: 'Data backup and disaster recovery procedures established', requires: ['backupConfigured'],
		check: (d) => ({ status: d.backupConfigured ? 'pass' : 'fail', evidence: d.backupConfigured ? 'Backup and recovery plan configured' : 'No backup configuration detected — contingency plan at risk' }) },
	{ id: '164.310(a)(1)', safeguard: 'Physical — Facility Access Controls', description: 'Limit physical access to electronic information systems', requires: [],
		check: () => ({ status: 'partial' as const, evidence: 'Cloud-hosted — physical security managed by Microsoft; verify tenant-side controls' }) },
	{ id: '164.310(b)', safeguard: 'Physical — Workstation Security', description: 'Physical safeguards for workstations accessing ePHI', requires: ['caEnabled'],
		check: (d) => ({ status: d.caEnabled > 0 ? 'partial' : 'fail', evidence: d.caEnabled > 0 ? 'Conditional access provides logical workstation controls' : 'No device-level access controls detected' }) },
	{ id: '164.310(d)(1)', safeguard: 'Physical — Device and Media Controls', description: 'Policies governing hardware and electronic media with ePHI', requires: ['encryptionEnabled'],
		check: (d) => ({ status: d.encryptionEnabled ? 'pass' : 'fail', evidence: d.encryptionEnabled ? 'Encryption enabled for data at rest on devices' : 'Device encryption not confirmed' }) },
	{ id: '164.312(a)(1)', safeguard: 'Technical — Access Control', description: 'Unique user identification and MFA for ePHI access', requires: ['mfaRate'],
		check: (d) => ({ status: d.mfaRate >= THRESHOLDS.MFA_HIPAA_PASS ? 'pass' : d.mfaRate >= THRESHOLDS.MFA_HIPAA_PARTIAL ? 'partial' : 'fail', evidence: `${Math.round(d.mfaRate * 100)}% MFA adoption (HIPAA requires 95%+)` }) },
	{ id: '164.312(b)', safeguard: 'Technical — Audit Controls', description: 'Record and examine activity in systems containing ePHI', requires: ['auditEnabled'],
		check: (d) => ({ status: d.auditEnabled ? 'pass' : 'fail', evidence: d.auditEnabled ? 'Audit logging enabled for ePHI access tracking' : 'Audit logging not enabled — compliance gap' }) },
	{ id: '164.312(c)(1)', safeguard: 'Technical — Integrity Controls', description: 'Protect ePHI from improper alteration or destruction', requires: ['dlpPolicies', 'auditEnabled'],
		check: (d) => ({ status: d.dlpPolicies > 0 && d.auditEnabled ? 'pass' : d.dlpPolicies > 0 || d.auditEnabled ? 'partial' : 'fail', evidence: `DLP policies: ${d.dlpPolicies}, Audit: ${d.auditEnabled ? 'on' : 'off'}` }) },
	{ id: '164.312(e)(1)', safeguard: 'Technical — Transmission Security', description: 'Guard against unauthorized access to ePHI during transmission', requires: ['encryptionEnabled'],
		check: (d) => ({ status: d.encryptionEnabled ? 'pass' : 'fail', evidence: d.encryptionEnabled ? 'Encryption in transit enabled (TLS enforced by M365)' : 'Encryption configuration not verified' }) },
];

export type HIPAAResult = ComplianceResult;

export function evaluateHIPAA(tenantData: NullableData): HIPAAResult {
	const controls: ControlResult[] = HIPAA_CONTROLS.map((ctrl) => {
		const missing = ctrl.requires.find((f) => (tenantData as any)[f] == null);
		if (missing) return errorControl(ctrl.id, ctrl.safeguard, FRAMEWORK, `${missing} data unavailable`);
		const result = ctrl.check(tenantData as TenantSecurityData);
		return {
			id: ctrl.id, name: ctrl.safeguard, framework: FRAMEWORK,
			status: result.status, evidence: result.evidence,
			remediation: result.status !== 'pass' ? getRemediation(ctrl.id) : undefined,
		};
	});
	return buildResult(FRAMEWORK, controls);
}

function getRemediation(controlId: string): string {
	const remediations: Record<string, string> = {
		'164.308(a)(3)': 'Enable conditional access policies to restrict workforce access',
		'164.308(a)(4)': 'Configure DLP policies and sensitivity labels for ePHI data',
		'164.308(a)(5)': 'Improve Secure Score by addressing recommended actions',
		'164.308(a)(7)': 'Configure backup and disaster recovery for ePHI systems',
		'164.310(a)(1)': 'Verify physical security controls for on-premises components',
		'164.310(b)': 'Enable device compliance policies via Conditional Access',
		'164.310(d)(1)': 'Enable BitLocker or equivalent encryption on all devices',
		'164.312(a)(1)': 'Enforce MFA for all users — HIPAA requires 95%+ adoption',
		'164.312(b)': 'Enable unified audit logging in M365 compliance center',
		'164.312(c)(1)': 'Enable DLP policies and audit logging for integrity controls',
		'164.312(e)(1)': 'Verify TLS encryption is enforced for all communications',
	};
	return remediations[controlId] || 'Review HIPAA safeguard requirements';
}
