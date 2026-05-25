/**
 * Authenticated Navigation E2E Tests
 *
 * Tests sidebar navigation and page loading for authenticated users.
 * Uses localStorage injection + API route interception to simulate auth.
 */

import { test, expect, type Page } from '@playwright/test';

async function setupAuthenticatedPage(page: Page) {
	// Intercept the /tenants API call to return mock data
	await page.route('**/api/tenants', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				tenants: [
					{
						id: 'tenant-1',
						displayName: 'E2E Test Tenant',
						domain: 'e2etest.onmicrosoft.com',
						status: 'active',
						lastSyncAt: new Date().toISOString(),
					},
				],
			}),
		});
	});

	// Also intercept dashboard API calls
	await page.route('**/api/tenants/*/dashboard', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				secureScore: 72,
				totalUsers: 150,
				totalAlerts: 5,
				licenseCost: 12500,
				complianceScore: 85,
				mfaAdoption: 94,
				riskScore: 'medium',
			}),
		});
	});

	await page.route('**/api/tenants/*/alerts*', (route) => {
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ alerts: [], total: 0 }),
		});
	});

	await page.goto('/');
	await page.evaluate(() => {
		localStorage.setItem('tenantiq_token', 'e2e-test-token');
		localStorage.setItem(
			'tenantiq_user',
			JSON.stringify({
				id: 'user-e2e',
				email: 'e2e@tenantiq.test',
				name: 'E2E User',
				organizationId: 'org-1',
				tenantIds: ['tenant-1'],
				role: 'admin',
			})
		);
	});
	await page.reload();
}

test.describe('Authenticated User - Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuthenticatedPage(page);
	});

	test('sidebar renders with quick access and management nav items', async ({ page }) => {
		await expect(
			page.locator('text=TenantIQ').first()
		).toBeVisible({ timeout: 10_000 });

		// Quick access items (always visible)
		await expect(
			page.locator('a[href="/"]', { hasText: 'Dashboard' })
		).toBeVisible();
		await expect(page.locator('a[href="/security"]')).toBeVisible();
		await expect(page.locator('a[href="/skills"]')).toBeVisible();

		// Management group (open by default)
		await expect(page.locator('a[href="/alerts"]')).toBeVisible();
		await expect(page.locator('a[href="/licenses"]')).toBeVisible();
		await expect(page.locator('a[href="/workflows"]')).toBeVisible();
		await expect(page.locator('a[href="/audit"]')).toBeVisible();
	});

	test('user info displays in sidebar', async ({ page }) => {
		await expect(page.locator('text=E2E User')).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			page.locator('text=e2e@tenantiq.test')
		).toBeVisible();
	});

	test('dashboard page loads content', async ({ page }) => {
		// With mocked API, dashboard should show content or connect prompt
		await expect(
			page.locator('text=Dashboard').first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('navigate to alerts page', async ({ page }) => {
		await page.click('a[href="/alerts"]');
		await expect(page).toHaveURL(/\/alerts/);
	});

	test('navigate to licenses page', async ({ page }) => {
		await page.click('a[href="/licenses"]');
		await expect(page).toHaveURL(/\/licenses/);
	});

	test('navigate to security page', async ({ page }) => {
		await page.click('a[href="/security"]');
		await expect(page).toHaveURL(/\/security/);
	});

	test('navigate to AI agent page via direct URL', async ({ page }) => {
		await page.goto('/ai');
		await expect(page).toHaveURL(/\/ai/);
		// Verify the AI page loaded (sidebar should auto-expand Analytics)
		await expect(page.locator('a[href="/ai"]')).toBeVisible({ timeout: 5_000 });
	});

	test('navigate to workflows page', async ({ page }) => {
		await page.click('a[href="/workflows"]');
		await expect(page).toHaveURL(/\/workflows/);
	});

	test('navigate to audit page', async ({ page }) => {
		await page.click('a[href="/audit"]');
		await expect(page).toHaveURL(/\/audit/);
	});

	test('navigate to MSP page via direct URL', async ({ page }) => {
		await page.goto('/msp');
		await expect(page).toHaveURL(/\/msp/);
		// Verify sidebar auto-expanded Enterprise group
		await expect(page.locator('a[href="/msp"]')).toBeVisible({ timeout: 5_000 });
	});

	test('navigate to settings page via direct URL', async ({ page }) => {
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.locator('a[href="/settings"]')).toBeVisible({ timeout: 5_000 });
	});
});
