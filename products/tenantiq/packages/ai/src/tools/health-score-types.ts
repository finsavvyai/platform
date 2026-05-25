/**
 * Types for Tenant Health Score & Benchmarking Engine
 */

export interface HealthDimension {
	name: string;
	score: number; // 0-100
	weight: number; // 0-1
	grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
	trend: 'improving' | 'stable' | 'declining';
	trendDelta: number; // change vs last period
	factors: HealthFactor[];
}

export interface HealthFactor {
	id: string;
	label: string;
	score: number;
	maxScore: number;
	status: 'excellent' | 'good' | 'needs_attention' | 'critical';
	recommendation?: string;
}

export interface HealthScore {
	overall: number;
	grade: string;
	percentile: number; // vs other tenants (simulated benchmark)
	dimensions: HealthDimension[];
	topWins: string[];
	topRisks: string[];
	improvementPlan: ImprovementAction[];
	shareableCard: ShareableCard;
	generatedAt: string;
}

export interface ImprovementAction {
	id: string;
	title: string;
	impact: 'high' | 'medium' | 'low';
	effort: 'low' | 'medium' | 'high';
	estimatedScoreGain: number;
	category: string;
	description: string;
}

export interface ShareableCard {
	title: string;
	subtitle: string;
	score: number;
	grade: string;
	dimensions: { name: string; score: number; emoji: string }[];
	callToAction: string;
	shareUrl: string;
}

export interface TenantMetrics {
	totalUsers: number;
	activeUsers: number;
	guestUsers: number;
	mfaEnabledCount: number;
	totalLicenses: number;
	assignedLicenses: number;
	activeAlerts: number;
	criticalAlerts: number;
	resolvedAlertsLast30d: number;
	compliancePolicies: number;
	remediationsExecuted: number;
	lastSyncHoursAgo: number;
	adminCount: number;
	groupsWithNoOwner: number;
	inactiveUsers30d: number;
	monthlyLicenseCost: number;
	wastedLicenseCost: number;
}
