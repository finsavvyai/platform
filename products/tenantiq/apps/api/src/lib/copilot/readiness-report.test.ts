import { describe, expect, it } from 'vitest';
import { generateReadinessReportHtml } from './readiness-report';
import type { ReadinessResult } from './readiness-types';

function makeResult(overrides: Partial<ReadinessResult> = {}): ReadinessResult {
	return {
		overallScore: 72,
		categories: {
			licensing: { score: 100, checks: [] },
			identityAccess: { score: 80, checks: [] },
			dataProtection: { score: 60, checks: [] },
			compliance: { score: 50, checks: [] },
			security: { score: 70, checks: [] },
			collaboration: { score: 90, checks: [] },
			dataQuality: { score: 55, checks: [] },
		},
		recommendations: [
			{ category: 'security', priority: 'high', title: 'Improve score', description: 'Raise it' },
			{ category: 'licensing', priority: 'low', title: 'Buy more', description: 'Get extra' },
		],
		assessedAt: '2026-03-15T10:00:00.000Z',
		...overrides,
	};
}

describe('Readiness Report HTML Generator', () => {
	it('generates valid HTML with score', () => {
		const html = generateReadinessReportHtml(makeResult(), 'Tenant A', 'Acme Corp');
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('72%');
		expect(html).toContain('Acme Corp');
		expect(html).toContain('Tenant A');
	});

	it('shows Ready label for score >= 70', () => {
		const html = generateReadinessReportHtml(makeResult({ overallScore: 75 }), 'T', 'O');
		expect(html).toContain('Ready');
	});

	it('shows Needs Work label for score 40-69', () => {
		const html = generateReadinessReportHtml(makeResult({ overallScore: 55 }), 'T', 'O');
		expect(html).toContain('Needs Work');
	});

	it('shows Not Ready label for score < 40', () => {
		const html = generateReadinessReportHtml(makeResult({ overallScore: 20 }), 'T', 'O');
		expect(html).toContain('Not Ready');
	});

	it('includes all category rows', () => {
		const html = generateReadinessReportHtml(makeResult(), 'T', 'O');
		expect(html).toContain('Licensing');
		expect(html).toContain('Identity & Access');
		expect(html).toContain('Data Protection');
		expect(html).toContain('Compliance');
		expect(html).toContain('Security');
		expect(html).toContain('Collaboration');
		expect(html).toContain('Data Quality');
	});

	it('includes recommendations', () => {
		const html = generateReadinessReportHtml(makeResult(), 'T', 'O');
		expect(html).toContain('Improve score');
		expect(html).toContain('Buy more');
		expect(html).toContain('Raise it');
	});

	it('renders priority badges with correct colors', () => {
		const html = generateReadinessReportHtml(makeResult(), 'T', 'O');
		expect(html).toContain('#ea580c'); // high color
		expect(html).toContain('#16a34a'); // low color
	});

	it('includes date in footer', () => {
		const html = generateReadinessReportHtml(makeResult(), 'T', 'O');
		expect(html).toContain('March');
		expect(html).toContain('2026');
	});

	it('handles empty recommendations', () => {
		const result = makeResult({ recommendations: [] });
		const html = generateReadinessReportHtml(result, 'T', 'O');
		expect(html).toContain('Recommendations (0)');
	});

	it('uses green color for high scores', () => {
		const result = makeResult({ overallScore: 85 });
		const html = generateReadinessReportHtml(result, 'T', 'O');
		expect(html).toContain('#16a34a'); // green
	});

	it('uses red color for low scores', () => {
		const result = makeResult({ overallScore: 20 });
		const html = generateReadinessReportHtml(result, 'T', 'O');
		expect(html).toContain('#dc2626'); // red
	});
});
