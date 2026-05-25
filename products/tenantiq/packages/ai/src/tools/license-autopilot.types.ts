/**
 * License Reclamation Autopilot — Type Definitions
 */

export interface LicenseCandidate {
	userId: string;
	userEmail: string;
	displayName: string;
	currentLicense: string;
	currentLicenseCost: number;
	lastActiveDate: string | null;
	inactiveDays: number;
	usageScore: number; // 0-100
	action: ReclamationAction;
	suggestedLicense?: string;
	suggestedLicenseCost?: number;
	monthlySavings: number;
	annualSavings: number;
	confidence: number; // 0-100
	reason: string;
	riskLevel: 'none' | 'low' | 'medium' | 'high';
	riskNote?: string;
}

export type ReclamationAction = 'remove' | 'downgrade' | 'reassign' | 'keep' | 'flag_for_review';

export interface ReclamationPlan {
	id: string;
	tenantId: string;
	tenantName: string;
	generatedAt: string;
	candidates: LicenseCandidate[];
	summary: ReclamationSummary;
	approvalRequired: boolean;
	approver?: string;
	status: 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'cancelled';
	executionLog: ExecutionStep[];
	beforeSnapshot: LicenseSnapshot;
	afterSnapshot?: LicenseSnapshot;
}

export interface ReclamationSummary {
	totalCandidates: number;
	removals: number;
	downgrades: number;
	reassignments: number;
	flaggedForReview: number;
	monthlySavings: number;
	annualSavings: number;
	avgConfidence: number;
	riskBreakdown: { none: number; low: number; medium: number; high: number };
}

export interface ExecutionStep {
	step: number;
	action: string;
	target: string;
	status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
	startedAt?: string;
	completedAt?: string;
	error?: string;
	rollbackAvailable: boolean;
}

export interface LicenseSnapshot {
	timestamp: string;
	totalLicenses: number;
	assignedLicenses: number;
	monthlyCost: number;
	utilizationRate: number;
	breakdown: { sku: string; name: string; total: number; assigned: number; cost: number }[];
}

export interface AutopilotConfig {
	enabled: boolean;
	inactivityThreshold: number; // days
	usageScoreThreshold: number; // 0-100
	autoApproveBelow: number; // auto-approve savings below this amount
	notifyOnReclamation: boolean;
	excludedUsers: string[]; // emails to never touch
	excludedSkus: string[]; // SKUs to never reclaim
	maxActionsPerRun: number;
	dryRunMode: boolean;
	schedule: 'daily' | 'weekly' | 'monthly';
}

export interface UserLicenseData {
	userId: string;
	email: string;
	displayName: string;
	licenses: string[];
	lastSignIn: string | null;
	lastNonInteractiveSignIn: string | null;
	accountEnabled: boolean;
}
