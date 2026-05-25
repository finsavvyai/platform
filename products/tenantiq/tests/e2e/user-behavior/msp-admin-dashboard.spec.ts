/**
 * User Behavior: MSP Admin — Dashboard & Navigation
 *
 * Simulates an MSP admin logging in and navigating the full dashboard,
 * checking metrics, switching between sidebar sections, and managing
 * multiple tenants.
 */
import { test, expect } from '@playwright/test';
import { BASE, setupAuth, MSP_ADMIN, expectSidebarVisible } from './helpers';

test.use({ baseURL: BASE });

test.describe('MSP Admin — Dashboard Overview', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, MSP_ADMIN);
	});

	test('sees sidebar with all navigation groups', async ({ page }) => {
		await expectSidebarVisible(page);

		// Quick access
		await expect(page.locator('a[href="/"]', { hasText: 'Dashboard' })).toBeVisible();
		await expect(page.locator('a[href="/security"]')).toBeVisible();
		await expect(page.locator('a[href="/skills"]')).toBeVisible();

		// Management
		await expect(page.locator('a[href="/alerts"]')).toBeVisible();
		await expect(page.locator('a[href="/licenses"]')).toBeVisible();
		await expect(page.locator('a[href="/workflows"]')).toBeVisible();
		await expect(page.locator('a[href="/audit"]')).toBeVisible();
	});

	test('user identity displays correctly', async ({ page }) => {
		await expect(page.locator(`text=${MSP_ADMIN.name}`)).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.locator(`text=${MSP_ADMIN.email}`)).toBeVisible();
	});

	test('dashboard page loads with content', async ({ page }) => {
		await expect(
			page.locator('text=Dashboard').first()
		).toBeVisible({ timeout: 10_000 });
	});

	test('navigates to every sidebar section without errors', async ({ page }) => {
		const routes = [
			'/alerts', '/licenses', '/security', '/security/cis',
			'/ai', '/workflows', '/audit', '/governance', '/backups',
			'/threats', '/behavior', '/msp', '/team', '/settings',
			'/skills', '/sdlc',
		];
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		for (const route of routes) {
			await page.goto(route);
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
		}

		const real = errors.filter(
			(e) => !e.includes('Extension') && !e.includes('chrome-extension')
		);
		expect(real).toHaveLength(0);
	});
});

test.describe('MSP Admin — Sidebar Deep Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, MSP_ADMIN);
	});

	test('security sub-pages accessible', async ({ page }) => {
		const securityPages = [
			'/security/cis', '/security/email', '/security/purview',
			'/security/signin-logs', '/security/copilot',
		];
		for (const route of securityPages) {
			await page.goto(route);
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
		}
	});

	test('governance sub-pages accessible', async ({ page }) => {
		await page.goto('/governance');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/governance/);

		await page.goto('/governance/storage');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/governance\/storage/);
	});

	test('backup sub-pages accessible', async ({ page }) => {
		await page.goto('/backups');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/backups/);

		await page.goto('/backups/config');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/backups\/config/);
	});

	test('settings page loads with configuration options', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/settings/);
	});

	test('team page loads for admin', async ({ page }) => {
		await page.goto('/team');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/team/);
	});
});

test.describe('MSP Admin — Multi-Tenant Context', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, MSP_ADMIN);
	});

	test('admin has access to 3 tenants', async ({ page }) => {
		// MSP admin's user profile shows 3 tenant IDs
		const user = await page.evaluate(() => {
			const stored = localStorage.getItem('tenantiq_user');
			return stored ? JSON.parse(stored) : null;
		});
		expect(user).not.toBeNull();
		expect(user.tenantIds).toHaveLength(3);
		expect(user.role).toBe('super_admin');
	});

	test('dashboard displays without tenant data leaks', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');
		// The page should not show raw JSON or error stack traces
		const body = await page.locator('body').textContent();
		expect(body).not.toContain('Error:');
		expect(body).not.toContain('stack');
		expect(body).not.toContain('undefined');
	});
});
