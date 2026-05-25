/**
 * Storage Analytics Types — OneDrive and SharePoint usage data models.
 */

export interface OneDriveUser {
	userId: string;
	displayName: string;
	email: string;
	usedBytes: number;
	allocatedBytes: number;
	usedGB: number;
	allocatedGB: number;
	utilizationPct: number;
	lastActivityDate: string | null;
}

export interface SharePointSite {
	siteId: string;
	name: string;
	url: string;
	usedBytes: number;
	allocatedBytes: number;
	usedGB: number;
	allocatedGB: number;
	utilizationPct: number;
	lastActivityDate: string | null;
}

export interface StorageOverview {
	totalUsedGB: number;
	totalAllocatedGB: number;
	utilizationPct: number;
	oneDriveUsedGB: number;
	oneDriveAllocatedGB: number;
	sharePointUsedGB: number;
	sharePointAllocatedGB: number;
	userCount: number;
	siteCount: number;
	scannedAt: string;
}

export interface StorageRecommendation {
	id: string;
	type: 'cleanup' | 'quota' | 'license' | 'archive' | 'optimization';
	severity: 'low' | 'medium' | 'high';
	title: string;
	description: string;
	potentialSavingsGB: number;
	affectedItems: number;
}

export interface UnusedLicense {
	userId: string;
	displayName: string;
	email: string;
	licenseSku: string;
	licenseName: string;
	allocatedGB: number;
	usedGB: number;
	utilizationPct: number;
	lastActivityDate: string | null;
	monthlyInactive: boolean;
}

export interface StorageScanResult {
	oneDriveUsers: OneDriveUser[];
	sharePointSites: SharePointSite[];
	overview: StorageOverview;
	recommendations: StorageRecommendation[];
	unusedLicenses: UnusedLicense[];
}

export type ScanType = 'onedrive' | 'sharepoint';

export interface StorageAnalyticsRow {
	id: string;
	org_id: string;
	tenant_id: string;
	scan_type: string;
	data: string | null;
	total_used_gb: number;
	total_allocated_gb: number;
	top_consumers: string | null;
	recommendations: string | null;
	scanned_at: number;
	created_at: number;
}
