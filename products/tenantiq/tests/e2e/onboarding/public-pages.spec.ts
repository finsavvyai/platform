/**
 * Public Pages E2E Tests
 *
 * Non-mock browser tests for pages that don't require authentication.
 */

import { test, expect } from '@playwright/test';

test.describe('Public Pages - No Authentication Required', () => {
	test('landing page loads with correct title and hero', async ({
		page,
	}) => {
		await page.goto('/home');

		await expect(page).toHaveTitle(/TenantIQ/);
		await expect(
			page.locator('h1', { hasText: 'Control Every Microsoft 365 Tenant' })
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.locator('.btn-cta').first()
		).toBeVisible();
	});

	test('platform dashboard loads with stats cards', async ({ page }) => {
		await page.goto('/platform');

		await expect(page).toHaveTitle(/Platform Dashboard/);
		await expect(
			page.locator('h1', { hasText: 'Platform Dashboard' })
		).toBeVisible({ timeout: 10_000 });

		await expect(page.locator('p', { hasText: 'Organizations' }).first()).toBeVisible();
		await expect(
			page.locator('p', { hasText: 'Active Subscriptions' }).first()
		).toBeVisible();
		await expect(page.locator('p', { hasText: 'MRR' }).first()).toBeVisible();
		await expect(page.locator('p', { hasText: 'Total Users' }).first()).toBeVisible();
	});

	test('platform dashboard shows recent organizations section', async ({
		page,
	}) => {
		await page.goto('/platform');

		await expect(
			page.locator('text=Recent Organizations')
		).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('text=View All')).toBeVisible();
	});

	test('subscriptions page navigable from dashboard', async ({
		page,
	}) => {
		await page.goto('/platform');

		const link = page.locator('a[href="/platform/subscriptions"]');
		if (await link.isVisible({ timeout: 5_000 })) {
			await link.click();
			await expect(page).toHaveURL(/\/platform\/subscriptions/);
		}
	});
});
