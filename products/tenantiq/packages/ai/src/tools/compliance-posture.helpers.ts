/**
 * Compliance Posture — Helper Functions
 *
 * Scoring, grading, and framework assessment logic.
 */

import type { ComplianceControl, ComplianceFramework } from './compliance-posture.types';
import type { ControlTemplate, ComplianceTenantMetrics } from './compliance-posture.controls';

// ── Scoring ───────────────────────────────────────────────────────

export function gradeFromScore(score: number): string {
	if (score >= 95) return 'A+';
	if (score >= 85) return 'A';
	if (score >= 75) return 'B';
	if (score >= 60) return 'C';
	if (score >= 40) return 'D';
	return 'F';
}

// ── Framework Assessment ──────────────────────────────────────────

export function assessFramework(
	frameworkId: string,
	frameworkName: string,
	version: string,
	description: string,
	templates: ControlTemplate[],
	metrics: ComplianceTenantMetrics
): ComplianceFramework {
	const controls: ComplianceControl[] = templates.map((t) => {
		const result = t.checkFn(metrics);
		return {
			id: `${frameworkId}-${t.controlNumber}`,
			frameworkId,
			controlNumber: t.controlNumber,
			title: t.title,
			description: t.title,
			category: t.category,
			status: result.status,
			severity: t.severity,
			evidence: result.evidence,
			remediationSteps: result.status !== 'passed' ? [`Review and remediate: ${t.title}`] : undefined,
			automatable: t.automatable,
			lastChecked: new Date().toISOString(),
		};
	});

	const applicable = controls.filter((c) => c.status !== 'not_applicable');
	const passed = applicable.filter((c) => c.status === 'passed').length;
	const partial = applicable.filter((c) => c.status === 'partial').length;
	const failed = applicable.filter((c) => c.status === 'failed').length;
	const score = applicable.length > 0
		? Math.round(((passed + partial * 0.5) / applicable.length) * 100)
		: 0;

	return {
		id: frameworkId,
		name: frameworkName,
		version,
		description,
		controlCount: controls.length,
		passedControls: passed,
		failedControls: failed,
		notApplicable: controls.filter((c) => c.status === 'not_applicable').length,
		score,
		grade: gradeFromScore(score),
		lastAssessedAt: new Date().toISOString(),
		controls,
	};
}
