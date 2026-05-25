import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import OversharingPanel from './OversharingPanel.svelte';

describe('OversharingPanel', () => {
	it('renders overshareRiskCount value', () => {
		const { getByText } = render(OversharingPanel, {
			props: { overshareRiskCount: 7, labelGapCount: 2 },
		});
		expect(getByText('7')).toBeTruthy();
	});

	it('shows Review badge when overshareRiskCount > 0 and Low Risk when 0', () => {
		const { getByText, rerender } = render(OversharingPanel, {
			props: { overshareRiskCount: 3, labelGapCount: 2 },
		});
		expect(getByText(/Review/i)).toBeTruthy();

		rerender({ overshareRiskCount: 0, labelGapCount: 2 });
		expect(getByText(/Low Risk/i)).toBeTruthy();
	});
});
