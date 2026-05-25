/** Shared types for Defender ATP coverage audit. */

export type DefenderControlStatus = 'covered' | 'partial' | 'missing' | 'not-applicable';
export type DefenderControlCategory = 'office' | 'endpoint' | 'identity' | 'cloud-apps' | 'general';
export type DefenderFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DefenderControl {
	id: string;
	displayName: string;
	category: DefenderControlCategory;
	currentScore: number;
	maxScore: number;
	implementationStatus: string; // raw Microsoft status
	status: DefenderControlStatus;
	actionUrl: string | null;
	remediation: string;
}

export interface DefenderFinding {
	id: string;
	severity: DefenderFindingSeverity;
	category: DefenderControlCategory;
	title: string;
	detail: string;
	remediation: string;
	controlId: string;
	currentScore: number;
	maxScore: number;
}

export interface DefenderSummary {
	totalControls: number;
	covered: number;
	partial: number;
	missing: number;
	notApplicable: number;
	byCategory: Record<DefenderControlCategory, { covered: number; total: number; scoreEarned: number; scoreMax: number }>;
	totalScoreEarned: number;
	totalScoreMax: number;
	coverageScore: number; // 0..100, scoreEarned/scoreMax * 100 weighted
	postureScore: number; // same weighted but with finding penalties
}

export interface DefenderScanResult {
	scannedAt: string;
	summary: DefenderSummary;
	findings: DefenderFinding[];
	controls: DefenderControl[];
}
