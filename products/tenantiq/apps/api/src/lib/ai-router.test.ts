import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { askAiRouted, type ComplianceTier } from './ai-router';
import type { TenantContext } from './ai-anthropic';

const fakeCtx: TenantContext = {
	domain: 'fake.example.com',
	displayName: 'Fake Inc',
	status: 'active',
	lastSyncAgo: '5m',
	userCount: 10,
	activeUserCount: 8,
	inactiveCount: 2,
	disabledCount: 0,
	guestCount: 1,
	mfaDisabledCount: 0,
	licenses: [],
	totalSpend: 0,
	totalWaste: 0,
	alerts: [],
	alertsBySeverity: {},
	activeAlertCount: 0,
	cisScore: 75,
	cisScannedAt: '2026-05-01',
};

describe('askAiRouted', () => {
	const realFetch = global.fetch;

	beforeEach(() => {
		// Default: stub fetch to return a sdlc.cc-shaped response so
		// the regulated path doesn't make real network calls.
		global.fetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					content: [{ type: 'text', text: 'mocked answer' }],
					model: 'claude-haiku',
					usage: { input_tokens: 10, output_tokens: 5 },
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		) as typeof fetch;
	});

	afterEach(() => {
		global.fetch = realFetch;
	});

	it('regulated tier routes to sdlc-cc', async () => {
		const result = await askAiRouted(fakeCtx, 'is MFA enabled?',
			{ SDLC_CC_API_KEY: 'sk-test' }, 'regulated');
		expect(result.source).toBe('sdlc-cc');
		expect(result.text).toBe('mocked answer');
		expect(global.fetch).toHaveBeenCalledOnce();
	});

	it('direct tier throws (internal-only, not router-wired)', async () => {
		await expect(
			askAiRouted(fakeCtx, 'q', {}, 'direct' as ComplianceTier),
		).rejects.toThrow(/direct tier is internal-only/);
	});

	it('regulated tier requires SDLC_CC_API_KEY', async () => {
		await expect(
			askAiRouted(fakeCtx, 'q', {}, 'regulated'),
		).rejects.toThrow(/SDLC_CC_API_KEY/);
	});
});
