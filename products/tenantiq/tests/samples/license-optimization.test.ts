/**
 * Sample Project 4: License Cost Optimization
 *
 * Simulates: TenantIQ analyzing M365 license allocations for waste,
 * downgrade opportunities, and cost savings across different tenant sizes.
 */
import { describe, it, expect } from 'vitest';
import { LICENSE_COSTS } from '@tenantiq/shared';
import {
	makeActiveUsers, makeInactiveUsers, makeE5Users,
	makeDisabledUsers, makeLicenses,
	healthyTenant, riskyTenant, freeTierTenant,
} from './fixtures/tenant-profiles';

// ── License analysis functions (mirrors TenantIQ business logic) ─

interface LicenseAnalysis {
	totalMonthlyCost: number;
	totalAnnualCost: number;
	wastedMonthlyCost: number;
	utilizationRate: number;
	recommendations: Recommendation[];
}

interface Recommendation {
	type: 'downgrade' | 'remove' | 'reallocate';
	userCount: number;
	monthlySavings: number;
	description: string;
}

function analyzeLicenseCosts(
	licenses: ReturnType<typeof makeLicenses>,
	users: ReturnType<typeof makeActiveUsers>
): LicenseAnalysis {
	let totalMonthlyCost = 0;
	let wastedMonthlyCost = 0;
	const recommendations: Recommendation[] = [];

	for (const lic of licenses) {
		const cost = lic.total * (lic.costPerUnit ?? 0);
		const wastedUnits = lic.total - lic.assigned;
		const wasted = wastedUnits * (lic.costPerUnit ?? 0);
		totalMonthlyCost += cost;
		wastedMonthlyCost += wasted;

		if (wastedUnits > 0) {
			recommendations.push({
				type: 'remove',
				userCount: wastedUnits,
				monthlySavings: wasted,
				description: `Remove ${wastedUnits} unassigned ${lic.skuName} licenses`,
			});
		}
	}

	// Check for E5 users who could be downgraded
	const e5Users = users.filter((u) =>
		u.assignedLicenses.some((l) => l.includes('E5'))
	);
	const inactiveE5 = e5Users.filter((u) => {
		if (!u.lastNonInteractiveSignIn) return true;
		const daysSince = (Date.now() - new Date(u.lastNonInteractiveSignIn).getTime()) / 86_400_000;
		return daysSince > 30;
	});

	if (inactiveE5.length > 0) {
		const savings = inactiveE5.length * (LICENSE_COSTS['Microsoft 365 E5'] - LICENSE_COSTS['Microsoft 365 E3']);
		recommendations.push({
			type: 'downgrade',
			userCount: inactiveE5.length,
			monthlySavings: savings,
			description: `Downgrade ${inactiveE5.length} underutilized E5 users to E3`,
		});
	}

	// Check for disabled users still holding licenses
	const disabledWithLicenses = users.filter(
		(u) => !u.accountEnabled && u.assignedLicenses.length > 0
	);
	if (disabledWithLicenses.length > 0) {
		const savings = disabledWithLicenses.reduce((sum: number, u) => {
			return sum + u.assignedLicenses.reduce((s: number, l: string) => s + (LICENSE_COSTS[l] ?? 0), 0);
		}, 0);
		recommendations.push({
			type: 'remove',
			userCount: disabledWithLicenses.length,
			monthlySavings: savings,
			description: `Remove licenses from ${disabledWithLicenses.length} disabled accounts`,
		});
	}

	const totalAssigned = licenses.reduce((s, l) => s + l.assigned, 0);
	const totalSeats = licenses.reduce((s, l) => s + l.total, 0);
	const utilizationRate = totalSeats > 0 ? totalAssigned / totalSeats : 0;

	return {
		totalMonthlyCost,
		totalAnnualCost: totalMonthlyCost * 12,
		wastedMonthlyCost,
		utilizationRate,
		recommendations,
	};
}

describe('License Cost Optimization Scenarios', () => {
	describe('Large Enterprise (500 users, mixed licenses)', () => {
		const licenses = makeLicenses(healthyTenant.id, {
			e5Total: 100, e5Assigned: 70,
			e3Total: 350, e3Assigned: 320,
			e1Total: 100, e1Assigned: 80,
		});
		const users = [
			...makeActiveUsers(300, healthyTenant.id),
			...makeInactiveUsers(50, healthyTenant.id),
			...makeE5Users(70, healthyTenant.id, false),
			...makeE5Users(30, healthyTenant.id, true), // inactive E5 users
			...makeDisabledUsers(20, healthyTenant.id),
		];

		const analysis = analyzeLicenseCosts(licenses, users);

		it('should calculate total monthly cost', () => {
			// 100*57 + 350*36 + 100*10 = 5700 + 12600 + 1000 = 19300
			expect(analysis.totalMonthlyCost).toBe(19_300);
		});

		it('should calculate annual cost', () => {
			expect(analysis.totalAnnualCost).toBe(19_300 * 12);
		});

		it('should detect unassigned license waste', () => {
			// 30 E5 + 30 E3 + 20 E1 unassigned
			// 30*57 + 30*36 + 20*10 = 1710 + 1080 + 200 = 2990
			expect(analysis.wastedMonthlyCost).toBe(2_990);
		});

		it('should recommend removing unassigned licenses', () => {
			const removeRecs = analysis.recommendations.filter((r) => r.type === 'remove');
			expect(removeRecs.length).toBeGreaterThan(0);
			const totalRemoveSavings = removeRecs.reduce((s, r) => s + r.monthlySavings, 0);
			expect(totalRemoveSavings).toBeGreaterThan(0);
		});

		it('should recommend E5 to E3 downgrades', () => {
			const downgrades = analysis.recommendations.filter((r) => r.type === 'downgrade');
			expect(downgrades.length).toBeGreaterThan(0);
			const savings = downgrades[0].monthlySavings;
			expect(savings).toBeGreaterThan(0);
		});

		it('should recommend removing licenses from disabled accounts', () => {
			const disabled = analysis.recommendations.filter((r) =>
				r.description.includes('disabled')
			);
			expect(disabled.length).toBeGreaterThan(0);
		});

		it('should calculate utilization rate', () => {
			// (70+320+80)/(100+350+100) = 470/550 = 85.5%
			expect(analysis.utilizationRate).toBeCloseTo(470 / 550, 2);
		});

		it('total potential savings should be significant', () => {
			const totalSavings = analysis.recommendations.reduce(
				(s, r) => s + r.monthlySavings, 0
			);
			expect(totalSavings).toBeGreaterThan(1000); // >$1k/month
		});
	});

	describe('Mid-Size Company (100 users, E3 only)', () => {
		const licenses = makeLicenses(riskyTenant.id, {
			e3Total: 120, e3Assigned: 100,
		});
		// Use active users only (makeInactiveUsers assigns E5 by default)
		const users = makeActiveUsers(100, riskyTenant.id);

		const analysis = analyzeLicenseCosts(licenses, users);

		it('should identify 20 unassigned E3 licenses', () => {
			const removeRecs = analysis.recommendations.filter(
				(r) => r.type === 'remove' && r.description.includes('E3')
			);
			expect(removeRecs.length).toBe(1);
			expect(removeRecs[0].userCount).toBe(20);
		});

		it('monthly waste should be $720 (20 * $36)', () => {
			expect(analysis.wastedMonthlyCost).toBe(720);
		});

		it('should not recommend downgrades (no E5)', () => {
			const downgrades = analysis.recommendations.filter((r) => r.type === 'downgrade');
			expect(downgrades.length).toBe(0);
		});
	});

	describe('Small Startup (10 users, E1)', () => {
		const licenses = makeLicenses(freeTierTenant.id, {
			e1Total: 15, e1Assigned: 10,
		});
		const users = makeActiveUsers(10, freeTierTenant.id);

		const analysis = analyzeLicenseCosts(licenses, users);

		it('should have low total cost', () => {
			expect(analysis.totalMonthlyCost).toBe(150); // 15 * $10
		});

		it('should flag 5 unassigned E1 licenses ($50/mo)', () => {
			expect(analysis.wastedMonthlyCost).toBe(50);
		});

		it('should have utilization rate of 66.7%', () => {
			expect(analysis.utilizationRate).toBeCloseTo(10 / 15, 2);
		});
	});

	describe('License Cost Constants', () => {
		it('should have known M365 SKU prices', () => {
			expect(LICENSE_COSTS['Microsoft 365 E5']).toBe(57);
			expect(LICENSE_COSTS['Microsoft 365 E3']).toBe(36);
			expect(LICENSE_COSTS['Microsoft 365 E1']).toBe(10);
			expect(LICENSE_COSTS['Microsoft 365 Business Premium']).toBe(22);
		});

		it('E5 should be most expensive, E1 cheapest', () => {
			expect(LICENSE_COSTS['Microsoft 365 E5']).toBeGreaterThan(
				LICENSE_COSTS['Microsoft 365 E3']
			);
			expect(LICENSE_COSTS['Microsoft 365 E3']).toBeGreaterThan(
				LICENSE_COSTS['Microsoft 365 E1']
			);
		});

		it('E5-to-E3 downgrade saves $21/user/month', () => {
			const savings = LICENSE_COSTS['Microsoft 365 E5'] - LICENSE_COSTS['Microsoft 365 E3'];
			expect(savings).toBe(21);
		});
	});

	describe('ROI Calculation', () => {
		it('should calculate annualized savings', () => {
			const monthlySavings = 2990;
			const annualSavings = monthlySavings * 12;
			expect(annualSavings).toBe(35_880);
		});

		it('should calculate savings as percentage of spend', () => {
			const totalSpend = 19_300;
			const wasted = 2_990;
			const wastePercent = (wasted / totalSpend) * 100;
			expect(wastePercent).toBeCloseTo(15.49, 1);
		});

		it('should project 3-year savings', () => {
			const monthlySavings = 2990;
			const threeYearSavings = monthlySavings * 36;
			expect(threeYearSavings).toBe(107_640);
		});
	});
});
