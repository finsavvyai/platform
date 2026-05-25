import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assessCopilotReadiness } from './readiness-engine';

vi.mock('./readiness-checks', () => ({
	checkLicensing: vi.fn(),
	checkIdentityAccess: vi.fn(),
	checkDataProtection: vi.fn(),
	checkCompliance: vi.fn(),
	checkSecurity: vi.fn(),
	checkCollaboration: vi.fn(),
	checkDataQuality: vi.fn(),
}));

import {
	checkLicensing, checkIdentityAccess, checkDataProtection,
	checkCompliance, checkSecurity, checkCollaboration, checkDataQuality,
} from './readiness-checks';

const pass = (name: string) => ({ name, status: 'pass' as const, detail: 'OK' });
const fail = (name: string) => ({ name, status: 'fail' as const, detail: 'Bad' });
const warn = (name: string) => ({ name, status: 'warning' as const, detail: 'Meh' });
const err = (name: string) => ({ name, status: 'error' as const, detail: 'Err', errorMessage: 'API error' });

function mockAll(checks: any[], recs: any[] = []) {
	return { checks, recs };
}

describe('Copilot Readiness Engine', () => {
	const graphFetch = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 100% when all checks pass', async () => {
		const allPass = mockAll([pass('Test')]);
		(checkLicensing as any).mockResolvedValue(allPass);
		(checkIdentityAccess as any).mockResolvedValue(allPass);
		(checkDataProtection as any).mockResolvedValue(allPass);
		(checkCompliance as any).mockResolvedValue(allPass);
		(checkSecurity as any).mockResolvedValue(allPass);
		(checkCollaboration as any).mockResolvedValue(allPass);
		(checkDataQuality as any).mockResolvedValue(allPass);

		const result = await assessCopilotReadiness(graphFetch);
		expect(result.overallScore).toBe(100);
		expect(result.categories.licensing.score).toBe(100);
		// Default "ready" recommendation when no recs
		expect(result.recommendations).toHaveLength(1);
		expect(result.recommendations[0].title).toContain('Ready');
	});

	it('returns 0% when all checks fail', async () => {
		const allFail = mockAll([fail('Test')]);
		(checkLicensing as any).mockResolvedValue(allFail);
		(checkIdentityAccess as any).mockResolvedValue(allFail);
		(checkDataProtection as any).mockResolvedValue(allFail);
		(checkCompliance as any).mockResolvedValue(allFail);
		(checkSecurity as any).mockResolvedValue(allFail);
		(checkCollaboration as any).mockResolvedValue(allFail);
		(checkDataQuality as any).mockResolvedValue(allFail);

		const result = await assessCopilotReadiness(graphFetch);
		expect(result.overallScore).toBe(0);
	});

	it('scores warnings at 50%', async () => {
		const allWarn = mockAll([warn('Test')]);
		(checkLicensing as any).mockResolvedValue(allWarn);
		(checkIdentityAccess as any).mockResolvedValue(allWarn);
		(checkDataProtection as any).mockResolvedValue(allWarn);
		(checkCompliance as any).mockResolvedValue(allWarn);
		(checkSecurity as any).mockResolvedValue(allWarn);
		(checkCollaboration as any).mockResolvedValue(allWarn);
		(checkDataQuality as any).mockResolvedValue(allWarn);

		const result = await assessCopilotReadiness(graphFetch);
		expect(result.overallScore).toBe(50);
	});

	it('excludes error checks from scoring', async () => {
		const withError = mockAll([pass('Good'), err('Broken')]);
		(checkLicensing as any).mockResolvedValue(withError);
		(checkIdentityAccess as any).mockResolvedValue(withError);
		(checkDataProtection as any).mockResolvedValue(withError);
		(checkCompliance as any).mockResolvedValue(withError);
		(checkSecurity as any).mockResolvedValue(withError);
		(checkCollaboration as any).mockResolvedValue(withError);
		(checkDataQuality as any).mockResolvedValue(withError);

		const result = await assessCopilotReadiness(graphFetch);
		// Error checks excluded, only pass remains -> 100
		expect(result.overallScore).toBe(100);
	});

	it('returns 0 when all checks are errors', async () => {
		const allErr = mockAll([err('Broken')]);
		(checkLicensing as any).mockResolvedValue(allErr);
		(checkIdentityAccess as any).mockResolvedValue(allErr);
		(checkDataProtection as any).mockResolvedValue(allErr);
		(checkCompliance as any).mockResolvedValue(allErr);
		(checkSecurity as any).mockResolvedValue(allErr);
		(checkCollaboration as any).mockResolvedValue(allErr);
		(checkDataQuality as any).mockResolvedValue(allErr);

		const result = await assessCopilotReadiness(graphFetch);
		expect(result.overallScore).toBe(0);
	});

	it('sorts recommendations by priority', async () => {
		const recs = [
			{ category: 'licensing', priority: 'low', title: 'Low', description: '' },
			{ category: 'security', priority: 'critical', title: 'Crit', description: '' },
			{ category: 'compliance', priority: 'medium', title: 'Med', description: '' },
		];
		const withRecs = { checks: [pass('X')], recs };
		const noRecs = mockAll([pass('Y')]);
		(checkLicensing as any).mockResolvedValue(withRecs);
		(checkIdentityAccess as any).mockResolvedValue(noRecs);
		(checkDataProtection as any).mockResolvedValue(noRecs);
		(checkCompliance as any).mockResolvedValue(noRecs);
		(checkSecurity as any).mockResolvedValue(noRecs);
		(checkCollaboration as any).mockResolvedValue(noRecs);
		(checkDataQuality as any).mockResolvedValue(noRecs);

		const result = await assessCopilotReadiness(graphFetch);
		expect(result.recommendations[0].priority).toBe('critical');
		expect(result.recommendations[1].priority).toBe('medium');
		expect(result.recommendations[2].priority).toBe('low');
	});

	it('includes assessedAt timestamp', async () => {
		const allPass = mockAll([pass('T')]);
		(checkLicensing as any).mockResolvedValue(allPass);
		(checkIdentityAccess as any).mockResolvedValue(allPass);
		(checkDataProtection as any).mockResolvedValue(allPass);
		(checkCompliance as any).mockResolvedValue(allPass);
		(checkSecurity as any).mockResolvedValue(allPass);
		(checkCollaboration as any).mockResolvedValue(allPass);
		(checkDataQuality as any).mockResolvedValue(allPass);

		const result = await assessCopilotReadiness(graphFetch);
		expect(result.assessedAt).toBeDefined();
		expect(new Date(result.assessedAt).getTime()).not.toBeNaN();
	});

	it('applies weighted scoring across categories', async () => {
		// licensing (weight 20) = 100, rest = 0
		(checkLicensing as any).mockResolvedValue(mockAll([pass('T')]));
		const failResult = mockAll([fail('T')]);
		(checkIdentityAccess as any).mockResolvedValue(failResult);
		(checkDataProtection as any).mockResolvedValue(failResult);
		(checkCompliance as any).mockResolvedValue(failResult);
		(checkSecurity as any).mockResolvedValue(failResult);
		(checkCollaboration as any).mockResolvedValue(failResult);
		(checkDataQuality as any).mockResolvedValue(failResult);

		const result = await assessCopilotReadiness(graphFetch);
		// licensing weight = 20 out of 100 total -> 20%
		expect(result.overallScore).toBe(20);
	});
});
