/**
 * Tenant Comparison — Type Definitions
 *
 * Shared interfaces for cross-tenant benchmarking.
 */

export interface TenantSnapshot {
	tenantId: string;
	tenantName: string;
	domain: string;
	userCount: number;
	activeUserRate: number; // 0-100
	licenseCount: number;
	licenseUtilization: number; // 0-100
	monthlySpend: number;
	wastedSpend: number;
	costPerUser: number;
	secureScore: number;
	mfaAdoption: number; // 0-100
	complianceScore: number;
	healthScore: number;
	activeAlerts: number;
	criticalAlerts: number;
	lastSyncAt: string;
	onboardingsThisPeriod: number;
	remediationsThisPeriod: number;
}

export interface ComparisonResult {
	generatedAt: string;
	tenants: TenantSnapshot[];
	portfolioSummary: PortfolioSummary;
	rankings: TenantRanking[];
	standardizationScore: number;
	standardizationGaps: StandardizationGap[];
	bestPractices: BestPractice[];
	riskMatrix: RiskMatrixEntry[];
	recommendations: PortfolioRecommendation[];
	shareableReport: ShareablePortfolioReport;
}

export interface PortfolioSummary {
	totalTenants: number;
	totalUsers: number;
	totalMonthlySpend: number;
	totalWaste: number;
	avgHealthScore: number;
	avgSecureScore: number;
	avgMfaAdoption: number;
	avgLicenseUtilization: number;
	totalAlerts: number;
	totalCriticalAlerts: number;
	bestTenant: string;
	worstTenant: string;
}

export interface TenantRanking {
	category: string;
	icon: string;
	rankings: { rank: number; tenantName: string; value: string; score: number }[];
}

export interface StandardizationGap {
	area: string;
	metric: string;
	min: number;
	max: number;
	spread: number; // max - min
	recommendation: string;
	affectedTenants: string[];
}

export interface BestPractice {
	id: string;
	title: string;
	sourceTenant: string;
	metric: string;
	value: string;
	applicableTenants: string[];
	estimatedImpact: string;
}

export interface RiskMatrixEntry {
	tenantName: string;
	riskLevel: 'critical' | 'high' | 'medium' | 'low';
	riskScore: number;
	factors: string[];
}

export interface PortfolioRecommendation {
	priority: number;
	title: string;
	description: string;
	affectedTenants: string[];
	estimatedSavings?: number;
	category: 'security' | 'cost' | 'compliance' | 'operational';
}

export interface ShareablePortfolioReport {
	title: string;
	summary: string;
	totalTenants: number;
	totalUsers: number;
	totalSavingsOpportunity: string;
	avgHealthGrade: string;
	topRecommendation: string;
}
