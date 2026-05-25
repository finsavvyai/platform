import { describe, expect, it } from 'vitest';
import {
	buildOverview,
	generateRecommendations,
	detectUnusedLicenses,
	buildFullScanResult,
} from './storage-analyzer';
import type { OneDriveUser, SharePointSite } from './storage-types';

const GB = 1024 ** 3;

function makeUser(overrides: Partial<OneDriveUser> = {}): OneDriveUser {
	return {
		userId: 'u1', displayName: 'Alice', email: 'alice@test.com',
		usedBytes: 5 * GB, allocatedBytes: 100 * GB,
		usedGB: 5, allocatedGB: 100, utilizationPct: 5,
		lastActivityDate: null, ...overrides,
	};
}

function makeSite(overrides: Partial<SharePointSite> = {}): SharePointSite {
	return {
		siteId: 's1', name: 'Team Site', url: 'https://sp.test/sites/team',
		usedBytes: 20 * GB, allocatedBytes: 50 * GB,
		usedGB: 20, allocatedGB: 50, utilizationPct: 40,
		lastActivityDate: null, ...overrides,
	};
}

describe('Storage Analyzer', () => {
	describe('buildOverview', () => {
		it('computes totals from users and sites', () => {
			const users = [makeUser({ usedBytes: 2 * GB, allocatedBytes: 10 * GB })];
			const sites = [makeSite({ usedBytes: 5 * GB, allocatedBytes: 25 * GB })];
			const result = buildOverview(users, sites);
			expect(result.totalUsedGB).toBeCloseTo(7, 0);
			expect(result.totalAllocatedGB).toBeCloseTo(35, 0);
			expect(result.userCount).toBe(1);
			expect(result.siteCount).toBe(1);
		});

		it('handles empty arrays', () => {
			const result = buildOverview([], []);
			expect(result.totalUsedGB).toBe(0);
			expect(result.utilizationPct).toBe(0);
		});
	});

	describe('generateRecommendations', () => {
		it('recommends quota reduction for low-usage users', () => {
			const users = [makeUser({ usedGB: 0.01, allocatedGB: 100, utilizationPct: 0 })];
			const recs = generateRecommendations(users, []);
			const quotaRec = recs.find(r => r.type === 'quota');
			expect(quotaRec).toBeDefined();
			expect(quotaRec!.affectedItems).toBe(1);
		});

		it('flags high-usage sharepoint sites', () => {
			const sites = [makeSite({ utilizationPct: 90 })];
			const recs = generateRecommendations([], sites);
			const highRec = recs.find(r => r.type === 'optimization');
			expect(highRec).toBeDefined();
		});

		it('detects inactive storage accounts', () => {
			const users = [makeUser({ usedGB: 0.01, allocatedGB: 50, utilizationPct: 0 })];
			const recs = generateRecommendations(users, []);
			const licRec = recs.find(r => r.type === 'license');
			expect(licRec).toBeDefined();
		});

		it('suggests archiving large sites', () => {
			const sites = [makeSite({ usedGB: 60 })];
			const recs = generateRecommendations([], sites);
			const archiveRec = recs.find(r => r.type === 'archive');
			expect(archiveRec).toBeDefined();
		});

		it('returns no recs for healthy usage', () => {
			const users = [makeUser({ usedGB: 50, allocatedGB: 100, utilizationPct: 50 })];
			const sites = [makeSite({ usedGB: 20, allocatedGB: 50, utilizationPct: 40 })];
			const recs = generateRecommendations(users, sites);
			expect(recs).toHaveLength(0);
		});
	});

	describe('detectUnusedLicenses', () => {
		it('flags users with low usage and high allocation', () => {
			const users = [makeUser({ usedGB: 0.01, allocatedGB: 100 })];
			const unused = detectUnusedLicenses(users);
			expect(unused).toHaveLength(1);
			expect(unused[0].monthlyInactive).toBe(true);
		});

		it('ignores active users', () => {
			const users = [makeUser({ usedGB: 50, allocatedGB: 100 })];
			const unused = detectUnusedLicenses(users);
			expect(unused).toHaveLength(0);
		});
	});

	describe('buildFullScanResult', () => {
		it('assembles complete scan result', () => {
			const users = [makeUser()];
			const sites = [makeSite()];
			const result = buildFullScanResult(users, sites);
			expect(result.oneDriveUsers).toHaveLength(1);
			expect(result.sharePointSites).toHaveLength(1);
			expect(result.overview).toBeDefined();
			expect(result.recommendations).toBeDefined();
			expect(result.unusedLicenses).toBeDefined();
		});
	});
});
