import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import DriftSummaryWidget from './DriftSummaryWidget.svelte';

const baseSummary = { total: 5, critical: 2, warning: 2, info: 1, unacknowledged: 3 };

describe('DriftSummaryWidget', () => {
	it('renders total drift count', () => {
		const { getByText } = render(DriftSummaryWidget, { props: { summary: baseSummary, href: '/backups/config' } });
		expect(getByText(/5/)).toBeTruthy();
	});
	it('renders critical severity badge', () => {
		const { getByText } = render(DriftSummaryWidget, { props: { summary: baseSummary, href: '/backups/config' } });
		expect(getByText(/2.*critical/i)).toBeTruthy();
	});
	it('renders navigation link to /backups/config', () => {
		const { container } = render(DriftSummaryWidget, { props: { summary: baseSummary, href: '/backups/config' } });
		expect(container.querySelector('a[href="/backups/config"]')).toBeTruthy();
	});
	it('renders nothing when total is 0', () => {
		const { container } = render(DriftSummaryWidget, { props: { summary: { ...baseSummary, total: 0 }, href: '/backups/config' } });
		expect(container.textContent?.trim()).toBe('');
	});
});
