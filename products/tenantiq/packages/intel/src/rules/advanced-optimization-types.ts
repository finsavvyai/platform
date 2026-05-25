/**
 * Shared type definitions for advanced optimization rules
 */

export interface LicenseUser {
	userPrincipalName: string;
	displayName: string;
	assignedLicenses?: Array<{ skuId: string; skuName: string }>;
}

export interface SeasonalUser {
	userPrincipalName: string;
	displayName: string;
	lastSignIn?: string;
	createdDateTime?: string;
	userType?: string;
	assignedLicenses?: Array<{ skuName: string }>;
}

export interface SignInEntry {
	userPrincipalName: string;
	createdDateTime: string;
}

export interface StorageEntry {
	userEmail: string;
	allocated: number; // in GB
	used: number; // in GB
	percentUsed: number;
}

export interface TeamsActivityEntry {
	userEmail: string;
	lastActivityDate?: string;
	meetingsCount?: number;
	messagesCount?: number;
}

/**
 * License combinations where one supersedes the other
 */
export const REDUNDANT_LICENSE_COMBOS: [string, string][] = [
	['Microsoft 365 E5', 'Office 365 E5'],
	['Microsoft 365 E3', 'Office 365 E3'],
	['Microsoft 365 E5', 'Microsoft 365 E3'],
	['Power BI Pro', 'Microsoft 365 E5'],
	['Exchange Online Plan 2', 'Microsoft 365 E3'],
];

/**
 * Estimate monthly cost by license name (simplified)
 */
export function estimateLicenseCost(licenseName: string): number {
	if (licenseName.includes('E5')) return 57;
	if (licenseName.includes('E3')) return 36;
	if (licenseName.includes('Teams')) return 12;
	return 20;
}
