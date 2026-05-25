import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AlertCard from './AlertCard.svelte';
import type { Alert } from '$lib/types/shared';

const mockAlert: Alert = {
	id: 'alert-1',
	tenantId: 'tenant-1',
	ruleId: 'SEC-001',
	severity: 'critical',
	category: 'security',
	title: 'MFA not enforced for admins',
	description: 'Admin accounts without multi-factor authentication',
	businessImpact: 'High risk of account compromise',
	affectedResources: [],
	recommendedAction: 'Enable MFA for all admin accounts',
	remediationType: 'automatic',
	status: 'active',
	createdAt: '2026-03-28T12:00:00Z',
	resolvedAt: null,
	resolvedBy: null
};

describe('AlertCard', () => {
	it('should render alert title', () => {
		render(AlertCard, { props: { alert: mockAlert } });
		expect(screen.getByText('MFA not enforced for admins')).toBeTruthy();
	});

	it('should render alert description', () => {
		render(AlertCard, { props: { alert: mockAlert } });
		expect(
			screen.getByText('Admin accounts without multi-factor authentication')
		).toBeTruthy();
	});

	it('should render severity badge', () => {
		render(AlertCard, { props: { alert: mockAlert } });
		expect(screen.getByText('critical')).toBeTruthy();
	});

	it('should render business impact when provided', () => {
		render(AlertCard, { props: { alert: mockAlert } });
		expect(screen.getByText('High risk of account compromise')).toBeTruthy();
	});

	it('should not render business impact when null', () => {
		const alertNoBizImpact = { ...mockAlert, businessImpact: null };
		render(AlertCard, { props: { alert: alertNoBizImpact } });
		expect(
			screen.queryByText('High risk of account compromise')
		).toBeNull();
	});

	it('should be a button for accessibility', () => {
		const { container } = render(AlertCard, { props: { alert: mockAlert } });
		const btn = container.querySelector('button.alert-card');
		expect(btn).toBeTruthy();
		expect(btn?.getAttribute('type')).toBe('button');
	});

	it('should have accessible aria-label', () => {
		const { container } = render(AlertCard, { props: { alert: mockAlert } });
		const btn = container.querySelector('button.alert-card');
		expect(btn?.getAttribute('aria-label')).toContain(
			'MFA not enforced for admins'
		);
	});

	it('should render different severity levels', () => {
		const severities = ['critical', 'high', 'medium', 'low'] as const;
		for (const severity of severities) {
			const alert = { ...mockAlert, severity };
			const { unmount } = render(AlertCard, { props: { alert } });
			expect(screen.getByText(severity)).toBeTruthy();
			unmount();
		}
	});

	it('renders "View diff" link for config_drift alert with snapshotId', () => {
		const alert = {
			...mockAlert,
			alertType: 'config_drift',
			metadata: { snapshotId: 'snap-new', baselineId: 'snap-old' },
		} as any;
		const { container } = render(AlertCard, { props: { alert } });
		const link = container.querySelector('a[href*="backups/config/compare"]');
		expect(link).toBeTruthy();
		expect(link?.textContent?.toLowerCase()).toContain('diff');
	});

	it('does NOT render "View diff" link for non-drift alert', () => {
		const alert = {
			...mockAlert,
			alertType: 'anomaly',
			metadata: {},
		} as any;
		const { container } = render(AlertCard, { props: { alert } });
		const link = container.querySelector('a[href*="backups/config/compare"]');
		expect(link).toBeFalsy();
	});
});
