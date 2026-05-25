/**
 * ISO/IEC 27001:2022 Annex A compliance engine.
 *
 * Annex A has 93 controls in 4 themes (organisational, people, physical,
 * technological). Out of those 93, ~30 map to evidence we can derive from
 * Microsoft 365 telemetry — the rest require organisational evidence
 * (policies, training, contracts) that lives outside Graph.
 *
 * This engine maps the 30 we *can* evaluate. Each maps to specific
 * TenantSecurityData fields so the verdict is deterministic and the
 * evidence string cites the underlying signal.
 *
 * For the remaining 63 controls, treat them as out-of-scope at the
 * tooling layer; surface them in a separate "evidence-required" view.
 *
 * Source: ISO/IEC 27001:2022 Annex A. Control IDs use the official 8.x
 * (technological), 5.x (organisational), 6.x (people) numbering.
 */

import type { ControlResult, ComplianceResult, TenantSecurityDataNullable } from './types';
import { THRESHOLDS, errorControl, buildResult } from './types';

const FRAMEWORK = 'ISO 27001';

interface IsoControl {
	id: string;
	name: string;
	check: (d: TenantSecurityDataNullable) => { status: ControlResult['status']; evidence: string } | null;
}

const ISO_CONTROLS: IsoControl[] = [
	// 5.x — Organisational controls (subset that maps to telemetry)
	{
		id: 'A.5.7', name: 'Threat intelligence',
		check: (d) => d.riskyUsers === null ? null : {
			status: d.riskyUsers <= THRESHOLDS.RISKY_USERS_WARN ? 'pass' : 'partial',
			evidence: `${d.riskyUsers} users currently flagged at risk by Identity Protection`,
		},
	},
	{
		id: 'A.5.10', name: 'Acceptable use of information & assets',
		check: (d) => d.dlpPolicies === null ? null : {
			status: d.dlpPolicies >= THRESHOLDS.DLP_PASS ? 'pass' : d.dlpPolicies > 0 ? 'partial' : 'fail',
			evidence: `${d.dlpPolicies} DLP policy(ies) configured`,
		},
	},
	{
		id: 'A.5.13', name: 'Labelling of information',
		check: (d) => d.sensitivityLabels === null ? null : {
			status: d.sensitivityLabels >= THRESHOLDS.LABELS_PASS ? 'pass' : d.sensitivityLabels > 0 ? 'partial' : 'fail',
			evidence: `${d.sensitivityLabels} sensitivity label(s) published`,
		},
	},
	{
		id: 'A.5.15', name: 'Access control',
		check: (d) => d.caEnabled === null ? null : {
			status: d.caEnabled >= THRESHOLDS.CA_STRONG ? 'pass' : d.caEnabled > 0 ? 'partial' : 'fail',
			evidence: `${d.caEnabled} Conditional Access policy(ies) enforcing access`,
		},
	},
	{
		id: 'A.5.16', name: 'Identity management',
		check: (d) => d.mfaRate === null ? null : {
			status: d.mfaRate >= THRESHOLDS.MFA_PASS ? 'pass' : d.mfaRate >= THRESHOLDS.MFA_PARTIAL ? 'partial' : 'fail',
			evidence: `${Math.round(d.mfaRate * 100)}% MFA registration rate`,
		},
	},
	{
		id: 'A.5.17', name: 'Authentication information',
		check: (d) => d.mfaRate === null ? null : {
			status: d.mfaRate >= THRESHOLDS.MFA_PASS ? 'pass' : 'partial',
			evidence: 'Microsoft Authenticator + FIDO2 keys are first-party MFA methods; check number-matching enforcement separately',
		},
	},
	{
		id: 'A.5.18', name: 'Access rights',
		check: (d) => d.caEnabled === null ? null : {
			status: d.caEnabled >= 1 ? 'partial' : 'fail',
			evidence: 'PIM eligibility / access reviews require Entra P2; this is a partial signal',
		},
	},
	{
		id: 'A.5.23', name: 'Information security for use of cloud services',
		check: (d) => d.secureScore === null ? null : {
			status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'pass' : d.secureScore >= THRESHOLDS.SECURE_SCORE_PARTIAL ? 'partial' : 'fail',
			evidence: `Microsoft Secure Score: ${d.secureScore}%`,
		},
	},
	{
		id: 'A.5.30', name: 'ICT readiness for business continuity',
		check: (d) => d.backupConfigured === null ? null : {
			status: d.backupConfigured ? 'pass' : 'fail',
			evidence: d.backupConfigured ? 'Backup is configured for tenant' : 'No backup configuration detected',
		},
	},
	{
		id: 'A.5.34', name: 'Privacy and protection of PII',
		check: (d) => d.sensitivityLabels === null || d.dlpPolicies === null ? null : {
			status: d.sensitivityLabels >= THRESHOLDS.LABELS_PASS && d.dlpPolicies >= THRESHOLDS.DLP_PASS ? 'pass'
				: (d.sensitivityLabels > 0 || d.dlpPolicies > 0) ? 'partial' : 'fail',
			evidence: `${d.sensitivityLabels} label(s), ${d.dlpPolicies} DLP polic(ies)`,
		},
	},

	// 8.x — Technological controls (heavy mapping)
	{
		id: 'A.8.2', name: 'Privileged access rights',
		check: (d) => d.caEnabled === null ? null : {
			status: d.caEnabled >= THRESHOLDS.CA_STRONG ? 'partial' : 'fail',
			evidence: 'PIM evidence requires Entra P2 + role-assignment query; CA count is a proxy signal only',
		},
	},
	{
		id: 'A.8.3', name: 'Information access restriction',
		check: (d) => d.caEnabled === null ? null : {
			status: d.caEnabled >= 1 ? 'pass' : 'fail',
			evidence: `${d.caEnabled} CA policies restricting application access`,
		},
	},
	{
		id: 'A.8.5', name: 'Secure authentication',
		check: (d) => d.mfaRate === null ? null : {
			status: d.mfaRate >= THRESHOLDS.MFA_PASS ? 'pass' : d.mfaRate >= THRESHOLDS.MFA_PARTIAL ? 'partial' : 'fail',
			evidence: `${Math.round(d.mfaRate * 100)}% users have MFA registered`,
		},
	},
	{
		id: 'A.8.7', name: 'Protection against malware',
		check: (d) => d.secureScore === null ? null : {
			status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'partial' : 'fail',
			evidence: 'Defender for Office anti-malware coverage requires direct policy inspection',
		},
	},
	{
		id: 'A.8.8', name: 'Management of technical vulnerabilities',
		check: (d) => d.secureScore === null ? null : {
			status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'pass' : d.secureScore >= THRESHOLDS.SECURE_SCORE_PARTIAL ? 'partial' : 'fail',
			evidence: `Microsoft Secure Score (Defender Vulnerability Management proxy): ${d.secureScore}%`,
		},
	},
	{
		id: 'A.8.10', name: 'Information deletion',
		check: (d) => d.dlpPolicies === null ? null : {
			status: 'partial',
			evidence: 'Retention/disposal evidence in Purview retention labels — reviewed in CIS retention_* controls',
		},
	},
	{
		id: 'A.8.12', name: 'Data leakage prevention',
		check: (d) => d.dlpPolicies === null ? null : {
			status: d.dlpPolicies >= THRESHOLDS.DLP_PASS ? 'pass' : d.dlpPolicies > 0 ? 'partial' : 'fail',
			evidence: `${d.dlpPolicies} active DLP polic(ies)`,
		},
	},
	{
		id: 'A.8.15', name: 'Logging',
		check: (d) => d.auditEnabled === null ? null : {
			status: d.auditEnabled ? 'pass' : 'fail',
			evidence: d.auditEnabled ? 'Unified audit logging enabled' : 'Audit logging not enabled',
		},
	},
	{
		id: 'A.8.16', name: 'Monitoring activities',
		check: (d) => d.auditEnabled === null || d.riskyUsers === null ? null : {
			status: d.auditEnabled && d.riskyUsers <= THRESHOLDS.RISKY_USERS_WARN ? 'pass'
				: d.auditEnabled ? 'partial' : 'fail',
			evidence: `audit=${d.auditEnabled}, riskyUsers=${d.riskyUsers}`,
		},
	},
	{
		id: 'A.8.20', name: 'Networks security',
		check: (d) => d.caEnabled === null ? null : {
			status: d.caEnabled >= 1 ? 'partial' : 'fail',
			evidence: 'CA named locations + Defender for Cloud Apps required for full evaluation',
		},
	},
	{
		id: 'A.8.22', name: 'Segregation of networks',
		check: (d) => d.caEnabled === null ? null : {
			status: d.caEnabled >= THRESHOLDS.CA_STRONG ? 'partial' : 'fail',
			evidence: 'Cross-tenant access policy review required (audited separately by cross-tenant-auditor)',
		},
	},
	{
		id: 'A.8.23', name: 'Web filtering',
		check: (d) => d.secureScore === null ? null : {
			status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'partial' : 'fail',
			evidence: 'Defender for Office Safe Links + MDCA evidence required',
		},
	},
	{
		id: 'A.8.24', name: 'Use of cryptography',
		check: (d) => d.encryptionEnabled === null ? null : {
			status: d.encryptionEnabled ? 'pass' : 'partial',
			evidence: 'M365 enforces TLS 1.2 + at-rest encryption by default; verify customer-managed keys if required',
		},
	},
	{
		id: 'A.8.26', name: 'Application security requirements',
		check: (d) => d.secureScore === null ? null : {
			status: d.secureScore >= THRESHOLDS.SECURE_SCORE_PASS ? 'partial' : 'fail',
			evidence: 'Application-level evidence (consent grants, app permissions) covered by CIS apps_* controls',
		},
	},
	{
		id: 'A.8.32', name: 'Change management',
		check: (d) => d.auditEnabled === null ? null : {
			status: d.auditEnabled ? 'partial' : 'fail',
			evidence: 'Config snapshot tracking + drift detection cover this; full evidence requires linking change tickets',
		},
	},
];

export type ISO27001Result = ComplianceResult;

export function evaluateISO27001(tenantData: TenantSecurityDataNullable): ISO27001Result {
	const controls: ControlResult[] = ISO_CONTROLS.map((ctrl) => {
		const result = ctrl.check(tenantData);
		if (!result) {
			return errorControl(ctrl.id, ctrl.name, FRAMEWORK, 'Required tenant data unavailable');
		}
		return {
			id: ctrl.id,
			name: ctrl.name,
			framework: FRAMEWORK,
			status: result.status,
			evidence: result.evidence,
			remediation: getRemediation(ctrl.id),
		};
	});
	return buildResult(FRAMEWORK, controls);
}

const REMEDIATIONS: Record<string, string> = {
	'A.5.7': 'Resolve risky users in Entra Identity Protection; remediate risk events.',
	'A.5.10': 'Configure DLP policies covering PII, financial, and health data.',
	'A.5.13': 'Publish at least 3 sensitivity labels (Public, Internal, Confidential).',
	'A.5.15': 'Add at least 3 Conditional Access policies covering MFA, legacy auth, and risk.',
	'A.5.16': 'Drive MFA registration above 90%.',
	'A.5.18': 'Adopt PIM (Entra P2) for just-in-time admin role activation.',
	'A.5.23': 'Improve Microsoft Secure Score above 70%.',
	'A.5.30': 'Configure tenant backup (TenantIQ backup integration or third-party).',
	'A.5.34': 'Combine sensitivity labels with DLP policies to protect PII.',
	'A.8.2': 'Implement PIM with approval workflow for privileged roles.',
	'A.8.5': 'Drive MFA above 90%; enable phishing-resistant methods (FIDO2).',
	'A.8.8': 'Increase Secure Score; review Defender Vulnerability Management findings.',
	'A.8.12': 'Add at least 2 active DLP policies.',
	'A.8.15': 'Enable unified audit logging in Microsoft Purview.',
	'A.8.16': 'Resolve open risky-user findings; ensure audit log retention.',
};

function getRemediation(id: string): string {
	return REMEDIATIONS[id] ?? 'Refer to ISO/IEC 27001:2022 Annex A control text';
}

/** Annex A controls *not* covered by this engine (organisational evidence). */
export const ISO_27001_OUT_OF_SCOPE_CONTROLS = 93 - ISO_CONTROLS.length;
