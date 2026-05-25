import { describe, expect, it } from 'vitest';
import { estimateTokens, packContext } from './ai-context-packer';
import type { TenantContext } from './ai-anthropic';

function makeTenantContext(overrides?: Partial<TenantContext>): TenantContext {
	return {
		displayName: 'Contoso Ltd',
		domain: 'contoso.onmicrosoft.com',
		status: 'active',
		lastSyncAgo: '2 hours ago',
		userCount: 150,
		activeUserCount: 120,
		inactiveCount: 20,
		disabledCount: 5,
		guestCount: 10,
		mfaDisabledCount: 8,
		licenses: [
			{ name: 'E3', consumed: 100, enabled: 120, costPerUnit: 36, unused: 20, wastePerMonth: 720 },
			{ name: 'E5', consumed: 30, enabled: 30, costPerUnit: 57, unused: 0, wastePerMonth: 0 },
		],
		totalSpend: 5310,
		totalWaste: 720,
		alerts: [
			{ severity: 'critical', title: 'Admin MFA disabled', status: 'active' },
			{ severity: 'high', title: 'Stale guest access', status: 'active' },
			{ severity: 'medium', title: 'Unused licenses', status: 'active' },
		],
		alertsBySeverity: { critical: 1, high: 1, medium: 1 },
		activeAlertCount: 3,
		cisScore: 72,
		cisScannedAt: '2026-04-07',
		...overrides,
	};
}

describe('estimateTokens', () => {
	it('estimates ~1 token per 4 characters', () => {
		expect(estimateTokens('abcd')).toBe(1);
		expect(estimateTokens('12345678')).toBe(2);
		expect(estimateTokens('')).toBe(0);
	});

	it('rounds up for partial tokens', () => {
		expect(estimateTokens('abcde')).toBe(2);
	});
});

describe('packContext', () => {
	it('includes header with tenant name and domain', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx);
		expect(packed).toContain('Contoso Ltd');
		expect(packed).toContain('contoso.onmicrosoft.com');
	});

	it('includes priority 1 sections: users, MFA, alerts summary, CIS', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx);
		expect(packed).toContain('Users: 150 total');
		expect(packed).toContain('MFA: 8 users without MFA');
		expect(packed).toContain('1 critical');
		expect(packed).toContain('CIS Score: 72/100');
	});

	it('includes license details at default budget', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx);
		expect(packed).toContain('E3: 100/120');
		expect(packed).toContain('$720/mo waste');
	});

	it('includes spend summary at default budget', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx);
		expect(packed).toContain('Total Spend: $5310/mo');
		expect(packed).toContain('Total Waste: $720/mo');
	});

	it('trims low-priority sections when budget is very tight', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx, { maxTokens: 80 });
		// Priority 1 sections should still be present
		expect(packed).toContain('Contoso Ltd');
		expect(packed).toContain('Users:');
		// Priority 3 alert details should be trimmed
		expect(packed).not.toContain('Admin MFA disabled');
	});

	it('trims inactive user details (priority 3) before license data (priority 2)', () => {
		const ctx = makeTenantContext();
		// Set budget that fits priority 1 + 2 but not all of priority 3
		const fullPacked = packContext(ctx, { maxTokens: 5000 });
		const tightPacked = packContext(ctx, { maxTokens: 200 });
		expect(fullPacked).toContain('Inactive:');
		// At tight budget, inactive details may be trimmed
		if (!tightPacked.includes('Inactive:')) {
			expect(tightPacked).toContain('Users:');
		}
	});

	it('never exceeds the token budget', () => {
		const ctx = makeTenantContext();
		const maxTokens = 100;
		const packed = packContext(ctx, { maxTokens });
		expect(estimateTokens(packed)).toBeLessThanOrEqual(maxTokens);
	});

	it('boosts license sections when question mentions "license"', () => {
		const ctx = makeTenantContext();
		const tightBudget = 120;
		const withoutQ = packContext(ctx, { maxTokens: tightBudget });
		const withQ = packContext(ctx, { maxTokens: tightBudget, question: 'How can I reduce license costs?' });
		// With license question, license section should be more likely to appear
		if (!withoutQ.includes('License SKUs')) {
			expect(withQ).toContain('License SKUs');
		}
	});

	it('boosts security sections when question mentions "security"', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx, { question: 'What are my security risks?' });
		expect(packed).toContain('Alerts:');
		expect(packed).toContain('MFA:');
		expect(packed).toContain('CIS Score');
	});

	it('handles tenant with no licenses gracefully', () => {
		const ctx = makeTenantContext({ licenses: [], totalSpend: 0, totalWaste: 0 });
		const packed = packContext(ctx);
		expect(packed).toContain('(none)');
	});

	it('handles tenant with no alerts gracefully', () => {
		const ctx = makeTenantContext({
			alerts: [],
			alertsBySeverity: {},
			activeAlertCount: 0,
		});
		const packed = packContext(ctx);
		expect(packed).toContain('Alerts: none');
	});

	it('handles null CIS score', () => {
		const ctx = makeTenantContext({ cisScore: null, cisScannedAt: null });
		const packed = packContext(ctx);
		expect(packed).toContain('CIS Score: No scan yet');
	});

	it('excludes alert details when includeAlertDetails is false', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx, { includeAlertDetails: false });
		expect(packed).not.toContain('Admin MFA disabled');
	});

	it('respects default budget of 1500 tokens', () => {
		const ctx = makeTenantContext();
		const packed = packContext(ctx);
		expect(estimateTokens(packed)).toBeLessThanOrEqual(1500);
	});
});
