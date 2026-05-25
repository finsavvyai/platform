/**
 * Intelligence Engine Types & Constants
 */

export interface InactiveUserAlert {
	userId: string;
	userPrincipalName: string;
	displayName: string;
	daysSinceLastSignIn: number;
	severity: 'low' | 'medium' | 'high' | 'critical';
	estimatedMonthlyCost: number;
	assignedLicenses: string[];
}

export interface ActivitySnapshot {
	userId: string;
	lastSignIn: string | null;
	lastExchangeActivity: string | null;
	lastTeamsActivity: string | null;
	lastSharePointActivity: string | null;
	activityScore: number;
	assignedLicenses: string[];
	licenseCostMonthly: number;
}

// License SKU pricing (in cents per month)
export const LICENSE_PRICING: Record<string, number> = {
	'ENTERPRISEPACK': 2000, // E3 - $20/month
	'ENTERPRISEPREMIUM': 5700, // E5 - $57/month
	'SPE_E3': 3600, // Microsoft 365 E3 - $36/month
	'SPE_E5': 5700, // Microsoft 365 E5 - $57/month
	'EXCHANGESTANDARD': 400, // Exchange Online Plan 1 - $4/month
	'EXCHANGEENTERPRISE': 800, // Exchange Online Plan 2 - $8/month
	'SHAREPOINTSTANDARD': 500, // SharePoint Online Plan 1 - $5/month
	'MCOMEETADV': 400, // Audio Conferencing - $4/month
	'POWER_BI_PRO': 1000, // Power BI Pro - $10/month
};
