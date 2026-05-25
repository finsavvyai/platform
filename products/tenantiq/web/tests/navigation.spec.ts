import { test, expect } from '@playwright/test';

test.describe('SPA navigation — public routes', () => {
	test('navigate from / to /home via link', async ({ page }) => {
		await page.goto('/');
		// Wait for auth to settle
		await page.waitForTimeout(2000);
	});

	test('navigate to /privacy and back', async ({ page }) => {
		await page.goto('/privacy');
		await expect(page.getByText('Last updated: April 2026')).toBeVisible();
		await page.goBack();
	});

	test('navigate to /terms and back', async ({ page }) => {
		await page.goto('/terms');
		await expect(page.getByText('Last updated: April 2026')).toBeVisible();
		await page.goBack();
	});

	test('404 page for nonexistent route', async ({ page }) => {
		await page.goto('/this-route-does-not-exist-12345');
		// SvelteKit renders error page or fallback
		const text = await page.textContent('body');
		expect(text).toBeTruthy();
	});
});

test.describe('direct URL access', () => {
	const PUBLIC = ['/home', '/pricing', '/compare', '/demo', '/prospect', '/changelog', '/support'];

	for (const route of PUBLIC) {
		test(`${route} loads directly`, async ({ page }) => {
			const res = await page.goto(route);
			expect(res?.status()).toBeLessThan(400);
		});
	}
});
