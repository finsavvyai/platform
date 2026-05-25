import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SeverityBadge from './SeverityBadge.svelte';

describe('SeverityBadge', () => {
	it('should render the severity text', () => {
		render(SeverityBadge, { props: { severity: 'critical' } });
		expect(screen.getByText('critical')).toBeTruthy();
	});

	it('should render all severity levels', () => {
		const severities = ['critical', 'high', 'medium', 'low'] as const;
		for (const severity of severities) {
			const { unmount } = render(SeverityBadge, { props: { severity } });
			expect(screen.getByText(severity)).toBeTruthy();
			unmount();
		}
	});

	it('should have role="status" for accessibility', () => {
		render(SeverityBadge, { props: { severity: 'high' } });
		expect(screen.getByRole('status')).toBeTruthy();
	});

	it('should apply red classes for critical severity', () => {
		const { container } = render(SeverityBadge, {
			props: { severity: 'critical' }
		});
		const badge = container.querySelector('span');
		expect(badge?.className).toContain('red');
	});

	it('should apply amber classes for high severity', () => {
		const { container } = render(SeverityBadge, {
			props: { severity: 'high' }
		});
		const badge = container.querySelector('span');
		expect(badge?.className).toContain('amber');
	});

	it('should apply blue classes for low severity', () => {
		const { container } = render(SeverityBadge, {
			props: { severity: 'low' }
		});
		const badge = container.querySelector('span');
		expect(badge?.className).toContain('blue');
	});

	it('should include a dot indicator', () => {
		const { container } = render(SeverityBadge, {
			props: { severity: 'critical' }
		});
		const dot = container.querySelector('span span');
		expect(dot).toBeTruthy();
		expect(dot?.className).toContain('rounded-full');
	});

	it('critical severity dot should have pulse animation class', () => {
		const { container } = render(SeverityBadge, {
			props: { severity: 'critical' }
		});
		const dot = container.querySelector('span span');
		expect(dot?.className).toContain('pulse-critical');
	});

	it('non-critical severity dots should not pulse', () => {
		const { container } = render(SeverityBadge, {
			props: { severity: 'medium' }
		});
		const dot = container.querySelector('span span');
		expect(dot?.className).not.toContain('pulse-critical');
	});
});
