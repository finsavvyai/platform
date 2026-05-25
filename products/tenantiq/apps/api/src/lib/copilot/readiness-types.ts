/**
 * Copilot Readiness Assessment types — 7 categories per M365 Copilot deployment guide.
 */

export type CheckStatus = 'pass' | 'fail' | 'warning' | 'error';
export type AssessmentStatus = 'pending' | 'running' | 'completed' | 'failed';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface Check {
	name: string;
	status: CheckStatus;
	detail: string;
	errorMessage?: string;
}

export interface CategoryResult {
	score: number;
	checks: Check[];
}

export type CategoryKey =
	| 'licensing'
	| 'identityAccess'
	| 'dataProtection'
	| 'compliance'
	| 'security'
	| 'collaboration'
	| 'dataQuality';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
	licensing: 'Licensing',
	identityAccess: 'Identity & Access',
	dataProtection: 'Data Protection',
	compliance: 'Compliance',
	security: 'Security',
	collaboration: 'Collaboration',
	dataQuality: 'Data Quality',
};

export interface Recommendation {
	category: CategoryKey;
	priority: Priority;
	title: string;
	description: string;
}

export interface ReadinessResult {
	overallScore: number;
	categories: Record<CategoryKey, CategoryResult>;
	recommendations: Recommendation[];
	assessedAt: string;
}

export interface AssessmentRecord {
	id: string;
	orgId: string;
	tenantId: string;
	overallScore: number;
	categoryScores: string;
	recommendations: string;
	status: AssessmentStatus;
	startedAt: string;
	completedAt: string | null;
	createdAt: string;
}

export interface HistoryEntry {
	id: string;
	score: number;
	categoryScores: Record<CategoryKey, number>;
	assessedAt: string;
}
