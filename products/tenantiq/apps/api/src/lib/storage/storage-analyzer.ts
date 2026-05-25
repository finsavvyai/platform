/**
 * Storage Analyzer — generates recommendations and detects unused licenses.
 */

import type {
	OneDriveUser,
	SharePointSite,
	StorageOverview,
	StorageRecommendation,
	UnusedLicense,
	StorageScanResult,
} from './storage-types';

const BYTES_PER_GB = 1024 ** 3;
const LOW_USAGE_PCT = 5;
const HIGH_USAGE_PCT = 85;
const INACTIVE_THRESHOLD_GB = 0.1;

function toGB(bytes: number): number {
	return Number((bytes / BYTES_PER_GB).toFixed(2));
}

function utilPct(used: number, total: number): number {
	return total > 0 ? Math.round((used / total) * 100) : 0;
}

export function buildOverview(
	users: OneDriveUser[],
	sites: SharePointSite[]
): StorageOverview {
	const odUsed = users.reduce((s, u) => s + u.usedBytes, 0);
	const odAlloc = users.reduce((s, u) => s + u.allocatedBytes, 0);
	const spUsed = sites.reduce((s, si) => s + si.usedBytes, 0);
	const spAlloc = sites.reduce((s, si) => s + si.allocatedBytes, 0);

	const totalUsed = odUsed + spUsed;
	const totalAlloc = odAlloc + spAlloc;

	return {
		totalUsedGB: toGB(totalUsed),
		totalAllocatedGB: toGB(totalAlloc),
		utilizationPct: utilPct(totalUsed, totalAlloc),
		oneDriveUsedGB: toGB(odUsed),
		oneDriveAllocatedGB: toGB(odAlloc),
		sharePointUsedGB: toGB(spUsed),
		sharePointAllocatedGB: toGB(spAlloc),
		userCount: users.length,
		siteCount: sites.length,
		scannedAt: new Date().toISOString(),
	};
}

export function generateRecommendations(
	users: OneDriveUser[],
	sites: SharePointSite[]
): StorageRecommendation[] {
	const recs: StorageRecommendation[] = [];

	const lowUsageUsers = users.filter(
		(u) => u.allocatedGB > 1 && u.utilizationPct < LOW_USAGE_PCT
	);
	if (lowUsageUsers.length > 0) {
		const savingsGB = lowUsageUsers.reduce(
			(s, u) => s + (u.allocatedGB - u.usedGB) * 0.5,
			0
		);
		recs.push({
			id: 'rec-low-usage-users',
			type: 'quota',
			severity: 'medium',
			title: 'Reduce quotas for low-usage OneDrive accounts',
			description: `${lowUsageUsers.length} users use less than ${LOW_USAGE_PCT}% of their allocated OneDrive storage.`,
			potentialSavingsGB: Math.round(savingsGB),
			affectedItems: lowUsageUsers.length,
		});
	}

	const highUsageSites = sites.filter(
		(s) => s.utilizationPct > HIGH_USAGE_PCT
	);
	if (highUsageSites.length > 0) {
		recs.push({
			id: 'rec-high-usage-sites',
			type: 'optimization',
			severity: 'high',
			title: 'SharePoint sites nearing quota limits',
			description: `${highUsageSites.length} sites exceed ${HIGH_USAGE_PCT}% utilization and may need quota increases or archival.`,
			potentialSavingsGB: 0,
			affectedItems: highUsageSites.length,
		});
	}

	const inactiveUsers = users.filter(
		(u) => u.usedGB < INACTIVE_THRESHOLD_GB && u.allocatedGB > 1
	);
	if (inactiveUsers.length > 0) {
		const savingsGB = inactiveUsers.reduce((s, u) => s + u.allocatedGB, 0);
		recs.push({
			id: 'rec-inactive-storage',
			type: 'license',
			severity: 'high',
			title: 'Reclaim storage from inactive OneDrive accounts',
			description: `${inactiveUsers.length} users have storage licenses but use less than ${INACTIVE_THRESHOLD_GB} GB.`,
			potentialSavingsGB: Math.round(savingsGB),
			affectedItems: inactiveUsers.length,
		});
	}

	const largeSites = sites.filter((s) => s.usedGB > 50);
	if (largeSites.length > 0) {
		recs.push({
			id: 'rec-large-sites-archive',
			type: 'archive',
			severity: 'low',
			title: 'Consider archiving large SharePoint sites',
			description: `${largeSites.length} sites use over 50 GB. Review for archival opportunities.`,
			potentialSavingsGB: 0,
			affectedItems: largeSites.length,
		});
	}

	return recs;
}

export function detectUnusedLicenses(
	users: OneDriveUser[]
): UnusedLicense[] {
	return users
		.filter((u) => u.usedGB < INACTIVE_THRESHOLD_GB && u.allocatedGB > 1)
		.map((u) => ({
			userId: u.userId,
			displayName: u.displayName,
			email: u.email,
			licenseSku: 'ONEDRIVE_STORAGE',
			licenseName: 'OneDrive for Business',
			allocatedGB: u.allocatedGB,
			usedGB: u.usedGB,
			utilizationPct: u.utilizationPct,
			lastActivityDate: u.lastActivityDate,
			monthlyInactive: true,
		}));
}

export function buildFullScanResult(
	users: OneDriveUser[],
	sites: SharePointSite[]
): StorageScanResult {
	return {
		oneDriveUsers: users,
		sharePointSites: sites,
		overview: buildOverview(users, sites),
		recommendations: generateRecommendations(users, sites),
		unusedLicenses: detectUnusedLicenses(users),
	};
}
