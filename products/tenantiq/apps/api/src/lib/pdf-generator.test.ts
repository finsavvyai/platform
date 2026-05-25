import { describe, expect, it } from 'vitest';
import { generateReportHTML, type ReportData } from './pdf-generator';

const sampleReport: ReportData = {
	title: 'Security Assessment',
	subtitle: 'Monthly compliance report for Contoso Ltd',
	generatedAt: '2026-03-15T10:30:00Z',
	sections: [
		{
			heading: 'Executive Summary',
			content: 'Overall security posture is strong.',
			metrics: [
				{ label: 'Secure Score', value: '87%' },
				{ label: 'MFA Adoption', value: '95%' },
			],
		},
		{
			heading: 'CIS Benchmark Results',
			content: '92 of 100 controls passing.',
		},
	],
};

describe('PDF Generator — generateReportHTML', () => {
	it('returns a valid HTML string', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('<html');
		expect(html).toContain('</html>');
	});

	it('contains the report title', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('Security Assessment');
	});

	it('contains the subtitle', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('Monthly compliance report for Contoso Ltd');
	});

	it('contains formatted generatedAt date', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('March');
		expect(html).toContain('2026');
	});

	it('contains section headings', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('Executive Summary');
		expect(html).toContain('CIS Benchmark Results');
	});

	it('contains section content', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('Overall security posture is strong.');
		expect(html).toContain('92 of 100 controls passing.');
	});

	it('contains metric values and labels', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('87%');
		expect(html).toContain('Secure Score');
		expect(html).toContain('95%');
		expect(html).toContain('MFA Adoption');
	});

	it('has TenantIQ branding', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('TenantIQ');
	});

	it('includes print styles', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('@media print');
	});

	it('has correct page title with TenantIQ suffix', () => {
		const html = generateReportHTML(sampleReport);
		expect(html).toContain('<title>Security Assessment — TenantIQ</title>');
	});

	it('works with no metrics in sections', () => {
		const data: ReportData = {
			title: 'Minimal Report',
			subtitle: 'No metrics',
			generatedAt: '2026-01-01T00:00:00Z',
			sections: [{ heading: 'Heading', content: 'Body text' }],
		};
		const html = generateReportHTML(data);
		expect(html).toContain('Heading');
		expect(html).toContain('Body text');
	});

	it('works with empty sections array', () => {
		const data: ReportData = {
			title: 'Empty',
			subtitle: 'Nothing here',
			generatedAt: '2026-01-01T00:00:00Z',
			sections: [],
		};
		const html = generateReportHTML(data);
		expect(html).toContain('Empty');
		expect(html).toContain('<!DOCTYPE html>');
	});
});
