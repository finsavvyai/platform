/**
 * Shared types for compliance framework engines (SOC 2, HIPAA, GDPR).
 * Used by all framework evaluators and the compliance-posture route.
 */

export interface TenantSecurityData {
	mfaRate: number;
	caEnabled: number;
	caTotal: number;
	auditEnabled: boolean;
	dlpPolicies: number;
	sensitivityLabels: number;
	secureScore: number;
	riskyUsers: number;
	backupConfigured: boolean;
	encryptionEnabled: boolean;
}

export type ControlStatus = 'pass' | 'fail' | 'partial' | 'error';

export interface ControlResult {
	id: string;
	name: string;
	framework: string;
	status: ControlStatus;
	evidence: string;
	remediation?: string;
	errorMessage?: string;
}

export interface ComplianceResult {
	framework: string;
	score: number;
	controls: ControlResult[];
	passCount: number;
	failCount: number;
	partialCount: number;
	errorCount: number;
}

/** Nullable variant — fields are null when Graph API call failed */
export type TenantSecurityDataNullable = {
	[K in keyof TenantSecurityData]: TenantSecurityData[K] | null;
};

/** Return error ControlResult when input data is unavailable */
export function errorControl(id: string, name: string, framework: string, msg: string): ControlResult {
	return { id, name, framework, status: 'error', evidence: 'Unable to assess', errorMessage: msg };
}

/** Threshold constants shared across engines */
export const THRESHOLDS = {
	MFA_PASS: 0.9,
	MFA_PARTIAL: 0.5,
	MFA_HIPAA_PASS: 0.95,
	MFA_HIPAA_PARTIAL: 0.7,
	SECURE_SCORE_PASS: 70,
	SECURE_SCORE_PARTIAL: 50,
	CA_STRONG: 3,
	DLP_PASS: 2,
	LABELS_PASS: 3,
	RISKY_USERS_WARN: 0,
} as const;

/** Calculate compliance score from control results (excludes error-status controls) */
export function calculateScore(controls: ControlResult[]): number {
	const scorable = controls.filter((c) => c.status !== 'error');
	if (scorable.length === 0) return 0;
	const points = scorable.reduce((sum, c) => {
		if (c.status === 'pass') return sum + 1;
		if (c.status === 'partial') return sum + 0.5;
		return sum;
	}, 0);
	return Math.round((points / scorable.length) * 100);
}

/** Build a ComplianceResult from controls and framework name */
export function buildResult(framework: string, controls: ControlResult[]): ComplianceResult {
	return {
		framework,
		score: calculateScore(controls),
		controls,
		passCount: controls.filter((c) => c.status === 'pass').length,
		failCount: controls.filter((c) => c.status === 'fail').length,
		partialCount: controls.filter((c) => c.status === 'partial').length,
		errorCount: controls.filter((c) => c.status === 'error').length,
	};
}
