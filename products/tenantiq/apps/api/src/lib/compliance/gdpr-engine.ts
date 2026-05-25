/**
 * GDPR compliance engine.
 * Evaluates tenant security posture against GDPR article requirements.
 */

import type { ControlResult, ComplianceResult, TenantSecurityData, TenantSecurityDataNullable } from './types';
import { buildResult, errorControl, THRESHOLDS } from './types';

const FRAMEWORK = 'GDPR';
type NullableData = TenantSecurityData | TenantSecurityDataNullable;

interface GDPRControl {
	id: string;
	article: string;
	description: string;
	requires: (keyof TenantSecurityData)[];
	check: (data: TenantSecurityData) => { status: ControlResult['status']; evidence: string };
}

const GDPR_CONTROLS: GDPRControl[] = [
	{ id: 'Art-5', article: 'Article 5 — Data Processing Principles', description: 'Data classification labels applied to ensure lawful processing', requires: ['sensitivityLabels'],
		check: (d) => ({ status: d.sensitivityLabels >= THRESHOLDS.LABELS_PASS ? 'pass' : d.sensitivityLabels > 0 ? 'partial' : 'fail', evidence: `${d.sensitivityLabels} sensitivity label(s) configured for data classification` }) },
	{ id: 'Art-25', article: 'Article 25 — Data Protection by Design and Default', description: 'DLP policies enforce privacy by design principles', requires: ['dlpPolicies'],
		check: (d) => ({ status: d.dlpPolicies >= THRESHOLDS.DLP_PASS ? 'pass' : d.dlpPolicies > 0 ? 'partial' : 'fail', evidence: `${d.dlpPolicies} DLP ${d.dlpPolicies === 1 ? 'policy' : 'policies'} active for data protection` }) },
	{ id: 'Art-30', article: 'Article 30 — Records of Processing Activities', description: 'Audit logging maintains records of data processing', requires: ['auditEnabled'],
		check: (d) => ({ status: d.auditEnabled ? 'pass' : 'fail', evidence: d.auditEnabled ? 'Audit logging enabled — processing activities recorded' : 'Audit logging disabled — no processing records maintained' }) },
	{ id: 'Art-32-MFA', article: 'Article 32 — Security of Processing (Authentication)', description: 'MFA and access controls protect personal data', requires: ['mfaRate'],
		check: (d) => ({ status: d.mfaRate >= THRESHOLDS.MFA_PASS ? 'pass' : d.mfaRate >= THRESHOLDS.MFA_PARTIAL ? 'partial' : 'fail', evidence: `${Math.round(d.mfaRate * 100)}% MFA adoption for access security` }) },
	{ id: 'Art-32-ENC', article: 'Article 32 — Security of Processing (Encryption)', description: 'Encryption protects personal data at rest and in transit', requires: ['encryptionEnabled'],
		check: (d) => ({ status: d.encryptionEnabled ? 'pass' : 'fail', evidence: d.encryptionEnabled ? 'Encryption enabled for data at rest and in transit' : 'Encryption not verified — data protection gap' }) },
	{ id: 'Art-32-CA', article: 'Article 32 — Security of Processing (Access Control)', description: 'Conditional access policies enforce data access boundaries', requires: ['caEnabled'],
		check: (d) => ({ status: d.caEnabled >= THRESHOLDS.CA_STRONG ? 'pass' : d.caEnabled > 0 ? 'partial' : 'fail', evidence: `${d.caEnabled} conditional access ${d.caEnabled === 1 ? 'policy' : 'policies'} enforce access boundaries` }) },
	{ id: 'Art-33', article: 'Article 33 — Breach Notification', description: 'Incident response plan with notification capability', requires: ['auditEnabled', 'secureScore'],
		check: (d) => { const ok = d.auditEnabled && d.secureScore >= THRESHOLDS.SECURE_SCORE_PARTIAL; return { status: ok ? 'partial' : 'fail', evidence: ok ? 'Monitoring active; verify 72-hour breach notification procedures' : 'Monitoring gaps — breach detection and notification at risk' }; } },
	{ id: 'Art-35', article: 'Article 35 — Data Protection Impact Assessment', description: 'Risk assessments documented for high-risk processing', requires: ['riskyUsers', 'secureScore'],
		check: (d) => ({ status: d.riskyUsers === 0 && d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'pass' : 'partial', evidence: `Risk posture: ${d.riskyUsers} risky users, Secure Score ${d.secureScore}/100` }) },
];

export type GDPRResult = ComplianceResult;

export function evaluateGDPR(tenantData: NullableData): GDPRResult {
	const controls: ControlResult[] = GDPR_CONTROLS.map((ctrl) => {
		const missing = ctrl.requires.find((f) => (tenantData as any)[f] == null);
		if (missing) return errorControl(ctrl.id, ctrl.article, FRAMEWORK, `${missing} data unavailable`);
		const result = ctrl.check(tenantData as TenantSecurityData);
		return {
			id: ctrl.id, name: ctrl.article, framework: FRAMEWORK,
			status: result.status, evidence: result.evidence,
			remediation: result.status !== 'pass' ? getRemediation(ctrl.id) : undefined,
		};
	});
	return buildResult(FRAMEWORK, controls);
}

function getRemediation(controlId: string): string {
	const remediations: Record<string, string> = {
		'Art-5': 'Configure sensitivity labels to classify personal data assets',
		'Art-25': 'Enable DLP policies to enforce privacy by design principles',
		'Art-30': 'Enable unified audit logging for processing activity records',
		'Art-32-MFA': 'Enforce MFA for all users to secure access to personal data',
		'Art-32-ENC': 'Enable encryption at rest and verify TLS for data in transit',
		'Art-32-CA': 'Configure conditional access policies for data access boundaries',
		'Art-33': 'Establish incident response plan with 72-hour notification procedures',
		'Art-35': 'Document DPIA for high-risk processing and address risky users',
	};
	return remediations[controlId] || 'Review GDPR article requirements';
}
