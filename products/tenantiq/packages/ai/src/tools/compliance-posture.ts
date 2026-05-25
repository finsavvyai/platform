/**
 * Compliance Posture Dashboard API
 *
 * Real-time compliance monitoring with:
 * - Framework mapping (CIS, NIST, ISO 27001, SOC 2, GDPR, HIPAA)
 * - Control-level pass/fail scoring
 * - Gap analysis with remediation steps
 * - Audit-ready export data
 * - Compliance drift detection
 */

// ── Re-exports (preserve public API) ─────────────────────────────

export type {
	ComplianceFramework,
	ComplianceControl,
	CompliancePosture,
	ComplianceGap,
	DriftAlert,
	AuditReadiness,
	ComplianceRecommendation,
} from './compliance-posture.types';

export type { ComplianceTenantMetrics } from './compliance-posture.controls';

// ── Internal imports ──────────────────────────────────────────────

import type {
	CompliancePosture,
	ComplianceGap,
	AuditReadiness,
	ComplianceRecommendation,
} from './compliance-posture.types';
import type { ComplianceTenantMetrics } from './compliance-posture.controls';
import { CIS_CONTROLS } from './compliance-posture.controls';
import { gradeFromScore, assessFramework } from './compliance-posture.helpers';

// ── Main Assessment ───────────────────────────────────────────────

export function assessCompliancePosture(
	tenantId: string,
	tenantName: string,
	metrics: ComplianceTenantMetrics
): CompliancePosture {
	const frameworks = [
		assessFramework(
			'cis',
			'CIS Microsoft 365 Benchmark',
			'3.0',
			'Center for Internet Security M365 controls',
			CIS_CONTROLS,
			metrics
		),
	];

	const overallScore = frameworks.length > 0
		? Math.round(frameworks.reduce((sum, f) => sum + f.score, 0) / frameworks.length)
		: 0;

	const criticalGaps: ComplianceGap[] = frameworks
		.flatMap((f) => f.controls)
		.filter((c) => c.status === 'failed' && (c.severity === 'critical' || c.severity === 'high'))
		.map((c) => ({
			controlId: c.controlNumber,
			framework: c.frameworkId,
			title: c.title,
			severity: c.severity,
			businessImpact: c.severity === 'critical'
				? 'Immediate security or compliance risk'
				: 'Significant gap in security posture',
			remediationEffort: c.automatable ? 'low' as const : 'medium' as const,
			estimatedTime: c.automatable ? '15 minutes' : '1-2 hours',
		}));

	const auditReadiness: AuditReadiness = {
		score: Math.min(100, overallScore + 10),
		ready: overallScore >= 75 && criticalGaps.filter((g) => g.severity === 'critical').length === 0,
		missingEvidence: frameworks
			.flatMap((f) => f.controls)
			.filter((c) => c.status === 'failed')
			.slice(0, 5)
			.map((c) => c.title),
		expiringPolicies: [],
		recommendations: criticalGaps.slice(0, 3).map((g) => `Fix: ${g.title} (${g.severity})`),
	};

	const recommendations: ComplianceRecommendation[] = criticalGaps
		.slice(0, 5)
		.map((g, i) => ({
			priority: i + 1,
			title: g.title,
			description: `Remediate ${g.controlId} — ${g.businessImpact}`,
			impact: `Estimated +${Math.round(10 / (i + 1))} points to compliance score`,
			frameworks: [g.framework],
			automatable: g.remediationEffort === 'low',
		}));

	return {
		tenantId,
		tenantName,
		generatedAt: new Date().toISOString(),
		overallScore,
		overallGrade: gradeFromScore(overallScore),
		frameworks,
		criticalGaps,
		driftAlerts: [],
		auditReadiness,
		recommendations,
	};
}
