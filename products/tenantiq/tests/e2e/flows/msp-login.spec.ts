import { test, expect, type Page } from '@playwright/test';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function setupAuthenticatedAdmin(page: Page, overrides: Record<string, unknown> = {}) {
	const user = {
		id: 'user-e2e', email: 'admin@e2e.test', name: 'E2E Admin',
		organizationId: 'org-e2e', tenantIds: ['tenant-e2e'],
		role: 'admin', status: 'active', ...overrides,
	};
	await page.route('**/api/auth/me', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) })
	);
	await page.route('**/api/tenants', (route) =>
		route.fulfill({
			status: 200, contentType: 'application/json',
			body: JSON.stringify({ tenants: [{ id: 'tenant-e2e', displayName: 'E2E Tenant', domain: 'e2e.onmicrosoft.com', status: 'active', lastSyncAt: '2026-01-01T00:00:00Z' }] }),
		})
	);
	// Catch-all registered FIRST (Playwright LIFO: specific routes registered later take priority)
	await page.route('**/api/tenants/**', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerts: [], tenants: [] }) })
	);
	await page.route('**/api/tenants/*/dashboard', (route) =>
		route.fulfill({
			status: 200, contentType: 'application/json',
			body: JSON.stringify({ secureScore: 72, totalUsers: 50, totalLicenseSpend: 5000, licenseWaste: 500, activeAlerts: { critical: 0, high: 1, medium: 1, low: 0 }, userBreakdown: { total: 50, active: 45, inactive: 5, disabled: 0 }, topRiskyUsers: [], licenseBreakdown: [], licenseUtilization: 90, recentAlerts: [] }),
		})
	);
}

// ─── MSP Login Flow (E2E-02) ──────────────────────────────────────────────────

test.describe('MSP Login Flow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedAdmin(page);
	});

	test('dashboard loads with tenant data after MSP login', async ({ page }) => {
		await page.goto('/');
		// RED: data-testid="secure-score" may not exist yet on the dashboard page
		await expect(page.locator('[data-testid="secure-score"]')).toBeVisible({ timeout: 10_000 });
	});

	test('tenant display name is visible in sidebar or header', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('text=E2E Tenant').first()).toBeVisible({ timeout: 10_000 });
	});

	test('unauthenticated redirect to sign-in', async ({ page }) => {
		await page.route('**/api/auth/me', (route) =>
			route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
		);
		await page.goto('/');
		await expect(
			page.locator('text=Sign in').or(page.locator('text=Sign In')).or(page.locator('text=Log in')).first()
		).toBeVisible({ timeout: 10_000 });
	});
});
