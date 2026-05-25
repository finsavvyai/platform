import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import LicenseSummaryPanel from './LicenseSummaryPanel.svelte';

describe('LicenseSummaryPanel', () => {
	it('renders adoption percentage bar with correct width', () => {
		const { container } = render(LicenseSummaryPanel, {
			props: { copilotLicensed: 50, totalLicensed: 100 },
		});
		// Expect a div with a style containing width: 50%
		const bar = Array.from(container.querySelectorAll('div')).find(
			(el) => el.getAttribute('style')?.includes('50%'),
		);
		expect(bar).toBeTruthy();
	});

	it('renders copilotLicensed and totalLicensed counts', () => {
		const { getByText } = render(LicenseSummaryPanel, {
			props: { copilotLicensed: 45, totalLicensed: 120 },
		});
		expect(getByText(/45/)).toBeTruthy();
		expect(getByText(/120/)).toBeTruthy();
	});
});
