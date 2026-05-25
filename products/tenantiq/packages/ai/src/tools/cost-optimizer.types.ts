/**
 * Cost Optimization Advisor — Type definitions
 */

export interface LicenseUsageData {
	skuId: string;
	skuName: string;
	total: number;
	assigned: number;
	costPerUnit: number;
	users: Array<{
		id: string;
		displayName: string;
		email: string;
		lastSignIn: string | null;
		assignedLicenses: string[];
		inactiveDays: number;
	}>;
}

export interface CostOptimizationResult {
	totalMonthlyCost: number;
	potentialMonthlySavings: number;
	potentialAnnualSavings: number;
	recommendations: CostRecommendation[];
	summary: string;
}

export interface CostRecommendation {
	id: string;
	category: 'unused_licenses' | 'inactive_users' | 'license_downgrade' | 'feature_utilization' | 'storage';
	severity: 'high' | 'medium' | 'low';
	title: string;
	description: string;
	monthlySavings: number;
	annualSavings: number;
	affectedUsers: number;
	actionItems: string[];
	riskLevel: 'low' | 'medium' | 'high';
	implementationEffort: 'easy' | 'moderate' | 'complex';
}
