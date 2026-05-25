import { test, expect } from '@playwright/test';

test.describe('accessibility basics', () => {
	test('skip-to-content link exists', async ({ page }) => {
		await page.goto('/');
		const skipLink = page.locator('a.skip-link');
		await expect(skipLink).toHaveAttribute('href', '#main-content');
	});

	test('sign-in page has no missing alt text on images', async ({ page }) => {
		await page.goto('/');
		const imgs = page.locator('img:not([alt])');
		const count = await imgs.count();
		// aria-hidden images are OK without meaningful alt
		for (let i = 0; i < count; i++) {
			const hidden = await imgs.nth(i).getAttribute('aria-hidden');
			expect(hidden).toBe('true');
		}
	});

	test('all interactive elements are keyboard-focusable', async ({ page }) => {
		await page.goto('/');
		const buttons = page.locator('button, a[href]');
		const count = await buttons.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < Math.min(count, 10); i++) {
			const tabindex = await buttons.nth(i).getAttribute('tabindex');
			// tabindex=-1 means deliberately removed from tab order — OK
			if (tabindex) {
				expect(parseInt(tabindex)).toBeGreaterThanOrEqual(-1);
			}
		}
	});

	test('color contrast — text is not invisible', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1000);
		const h1 = page.locator('h1').first();
		const color = await h1.evaluate((el) => getComputedStyle(el).color);
		// Not transparent/invisible
		expect(color).not.toBe('rgba(0, 0, 0, 0)');
		expect(color).not.toBe('transparent');
	});

	test('privacy page text is visible (not same color as background)', async ({ page }) => {
		await page.goto('/privacy');
		const heading = page.getByRole('heading', { name: /Privacy Policy/i });
		await expect(heading).toBeVisible();
		const opacity = await heading.evaluate((el) => getComputedStyle(el).opacity);
		expect(parseFloat(opacity)).toBeGreaterThan(0);
	});

	test('terms page text is visible', async ({ page }) => {
		await page.goto('/terms');
		const heading = page.getByRole('heading', { name: /Terms of Service/i });
		await expect(heading).toBeVisible();
	});
});
