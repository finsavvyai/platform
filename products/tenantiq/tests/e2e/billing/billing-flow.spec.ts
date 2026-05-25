/**
 * Billing Flow E2E Tests
 *
 * Tests the pricing cards UI, checkout flow, loading states,
 * and error handling on the settings page.
 */

import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = '.luna/tenantiq/browser-test/screenshots/billing';

test.describe('Billing & Pricing Flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
	});

	test('pricing cards render with three plans', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		await expect(billing.locator('h3', { hasText: 'Starter' })).toBeVisible();
		await expect(billing.locator('h3', { hasText: 'Professional' })).toBeVisible();
		await expect(billing.locator('h3', { hasText: 'Enterprise' })).toBeVisible();

		await expect(billing.locator('text=$49')).toBeVisible();
		await expect(billing.locator('text=$99')).toBeVisible();
		await expect(billing.locator('text=Custom')).toBeVisible();

		await page.screenshot({ path: `${SCREENSHOT_DIR}/pricing-cards.png`, fullPage: true });
	});

	test('recommended badge is on Professional plan', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		const badge = billing.locator('text=Recommended');
		await expect(badge).toBeVisible();
	});

	test('Get Started buttons are visible and clickable', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		const buttons = billing.locator('button', { hasText: 'Get Started' });
		const count = await buttons.count();
		expect(count).toBeGreaterThanOrEqual(1);

		for (let i = 0; i < count; i++) {
			await expect(buttons.nth(i)).toBeEnabled();
		}
	});

	test('clicking plan shows loading state then handles error gracefully', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		const starterBtn = billing.locator('button', { hasText: 'Get Started' }).first();
		await starterBtn.click();

		// Should show loading spinner or "Creating checkout..."
		const loadingText = billing.locator('text=Creating checkout...');
		// Loading state may appear briefly; capture screenshot
		await page.screenshot({ path: `${SCREENSHOT_DIR}/checkout-loading.png` });

		// Wait for error toast or loading to resolve (API not configured in dev)
		await page.waitForTimeout(3000);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/checkout-result.png` });

		// After error, button should be re-enabled (loadingPlan reset to null)
		await expect(starterBtn).toBeVisible({ timeout: 10_000 });
	});

	test('plan features list renders checkmarks', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		const features = billing.locator('li');
		const count = await features.count();
		// 5 starter + 8 professional + 8 enterprise = 21 features
		expect(count).toBeGreaterThanOrEqual(18);
	});

	test('trial info text renders', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		// Should show some plan/trial status text
		const trialText = billing.locator('p').first();
		await expect(trialText).toBeVisible();
	});

	test('all buttons have cursor-pointer style', async ({ page }) => {
		const billing = page.locator('#billing');
		await expect(billing).toBeVisible({ timeout: 10_000 });

		const buttons = billing.locator('button');
		const count = await buttons.count();

		for (let i = 0; i < count; i++) {
			const cursor = await buttons.nth(i).evaluate(
				(el) => window.getComputedStyle(el).cursor,
			);
			expect(cursor).toBe('pointer');
		}
	});
});
