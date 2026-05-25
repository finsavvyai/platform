/**
 * Shared helpers for user behavior E2E tests.
 * Provides mock auth setup, API interception, and common assertions.
 */
import { type Page, expect } from '@playwright/test';

export const BASE = 'https://app.tenantiq.app';

// ── Mock user profiles ──────────────────────────────────────────

export const MSP_ADMIN = {
	id: 'user-msp-admin',
	email: 'admin@cloudguard-msp.com',
	name: 'Sarah Chen',
	organizationId: 'org-msp-1',
	tenantIds: ['tenant-healthy', 'tenant-risky', 'tenant-new'],
	role: 'super_admin',
};

export const SECURITY_ANALYST = {
	id: 'user-analyst',
	email: 'analyst@contoso.com',
	name: 'James Park',
	organizationId: 'org-direct-1',
	tenantIds: ['tenant-contoso'],
	role: 'operator',
};

export const VIEWER = {
	id: 'user-viewer',
	email: 'viewer@contoso.com',
	name: 'Lisa Read',
	organizationId: 'org-direct-1',
	tenantIds: ['tenant-contoso'],
	role: 'viewer',
};

// ── Mock API data ───────────────────────────────────────────────

const MOCK_TENANTS = [
	{
		id: 'tenant-healthy',
		displayName: 'Healthy Corp',
		domain: 'healthycorp.onmicrosoft.com',
		status: 'active',
		lastSyncAt: new Date().toISOString(),
	},
	{
		id: 'tenant-risky',
		displayName: 'Risky Industries',
		domain: 'risky.onmicrosoft.com',
		status: 'active',
		lastSyncAt: new Date(Date.now() - 7200000).toISOString(),
	},
	{
		id: 'tenant-new',
		displayName: 'New Startup',
		domain: 'newstartup.onmicrosoft.com',
		status: 'active',
		lastSyncAt: null,
	},
];

const MOCK_DASHBOARD = {
	secureScore: 72,
	totalUsers: 150,
	totalAlerts: 8,
	licenseCost: 12500,
	complianceScore: 85,
	mfaAdoption: 94,
	riskScore: 'medium',
	activeAlerts: 5,
	resolvedAlerts: 42,
	totalLicenses: 200,
	unusedLicenses: 23,
};

const MOCK_ALERTS = {
	alerts: [
		{
			id: 'alert-1', ruleId: 'SEC-001', severity: 'critical',
			category: 'security', title: 'MFA not enforced for admin accounts',
			status: 'active', createdAt: new Date().toISOString(),
		},
		{
			id: 'alert-2', ruleId: 'OPT-001', severity: 'high',
			category: 'optimization', title: '23 inactive users detected',
			status: 'active', createdAt: new Date().toISOString(),
		},
		{
			id: 'alert-3', ruleId: 'CMP-001', severity: 'medium',
			category: 'compliance', title: '8 stale guest users',
			status: 'acknowledged', createdAt: new Date().toISOString(),
		},
	],
	total: 3,
};

// ── Auth & API setup ────────────────────────────────────────────

export async function setupAuth(page: Page, user = MSP_ADMIN) {
	await interceptAPIs(page);

	await page.goto('/');
	await page.evaluate((u) => {
		localStorage.setItem('tenantiq_token', 'e2e-behavior-token');
		localStorage.setItem('tenantiq_user', JSON.stringify(u));
	}, user);
	await page.reload();
}

export async function interceptAPIs(page: Page) {
	// Intercept tenant list
	await page.route('**/api/tenants', (route) => {
		if (route.request().method() === 'GET') {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ tenants: MOCK_TENANTS }),
			});
		}
		return route.continue();
	});

	// Intercept dashboard
	await page.route('**/api/tenants/*/dashboard', (route) => {
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(MOCK_DASHBOARD),
		});
	});

	// Intercept alerts
	await page.route('**/api/tenants/*/alerts*', (route) => {
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(MOCK_ALERTS),
		});
	});

	// Block SSE/notification streams to prevent hanging
	await page.route('**/events/stream', (route) => route.abort());
	await page.route('**/notifications', (route) => route.abort());
}

// ── Common assertions ───────────────────────────────────────────

export async function expectPageLoads(page: Page, timeout = 15_000) {
	await page.waitForLoadState('domcontentloaded', { timeout });
}

export async function expectNoJsErrors(page: Page, action: () => Promise<void>) {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));
	await action();
	const real = errors.filter(
		(e) => !e.includes('Extension') && !e.includes('chrome-extension')
	);
	expect(real).toHaveLength(0);
}

export async function expectSidebarVisible(page: Page) {
	await expect(
		page.locator('text=TenantIQ').first()
	).toBeVisible({ timeout: 10_000 });
}
