import { test, expect } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile', width: 375, height: 812 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
	test.describe(`responsive @ ${vp.name} (${vp.width}px)`, () => {
		test.use({ viewport: { width: vp.width, height: vp.height } });

		test('landing page renders without horizontal overflow', async ({ page }) => {
			await page.goto('/');
			const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
			expect(bodyWidth).toBeLessThanOrEqual(vp.width + 1);
		});

		test('sign-in card visible', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
		});

		test('home page renders without overflow', async ({ page }) => {
			await page.goto('/home');
			const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
			expect(bodyWidth).toBeLessThanOrEqual(vp.width + 1);
		});
	});
}
