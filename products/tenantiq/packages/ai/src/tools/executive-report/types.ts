/**
 * Executive Report Types
 *
 * All interfaces for the AI Executive Report Generator.
 */

import type { HealthScore } from '../health-score';

// ── Types ──────────────────────────────────────────────────────────

export interface ReportConfig {
	tenantName: string;
	tenantDomain?: string;
	reportPeriod: 'weekly' | 'monthly' | 'quarterly';
	periodStart: string;
	periodEnd: string;
	recipientName?: string;
	recipientEmail?: string;
	includeFinancials: boolean;
	includeSecurity: boolean;
	includeCompliance: boolean;
	includeRecommendations: boolean;
}

export interface ReportKPI {
	label: string;
	value: string;
	previousValue?: string;
	change?: number; // percentage
	changeDirection: 'up' | 'down' | 'stable';
	isPositive: boolean; // is the change direction good?
	icon: string;
}

export interface ReportSection {
	title: string;
	icon: string;
	summary: string;
	kpis: ReportKPI[];
	highlights: string[];
	risks: string[];
	chartData?: {
		type: 'bar' | 'line' | 'pie' | 'gauge';
		labels: string[];
		values: number[];
		colors?: string[];
	};
}

export interface ExecutiveReport {
	id: string;
	title: string;
	subtitle: string;
	generatedAt: string;
	period: string;
	config: ReportConfig;
	executiveSummary: string;
	overallGrade: string;
	overallScore: number;
	sections: ReportSection[];
	keyActions: ReportAction[];
	financialSummary?: FinancialSummary;
	benchmarkSummary: string;
	shareSnippet: string;
	htmlEmail: string;
	shareToken: string;
}

export interface ReportAction {
	priority: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	description: string;
	estimatedSavings?: number;
	deadline?: string;
	assignee?: string;
}

export interface FinancialSummary {
	totalSpend: number;
	wastedSpend: number;
	savingsRealized: number;
	projectedSavings: number;
	costPerUser: number;
	industryAvgCostPerUser: number;
	roi: number; // percentage
}

export interface ReportMetrics {
	totalUsers: number;
	activeUsers: number;
	newUsersThisPeriod: number;
	departedsThisPeriod: number;
	totalLicenses: number;
	assignedLicenses: number;
	monthlyLicenseCost: number;
	wastedLicenseCost: number;
	savingsRealized: number;
	mfaAdoptionRate: number;
	secureScore: number;
	previousSecureScore: number;
	alertsGenerated: number;
	alertsResolved: number;
	remediationsExecuted: number;
	complianceScore: number;
	previousComplianceScore: number;
	onboardingsCompleted: number;
	avgOnboardingTime: number; // minutes
	healthScore?: HealthScore;
}
