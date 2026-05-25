/**
 * User Behavior: Mobile & Responsive Experience
 *
 * Simulates users accessing TenantIQ from different devices —
 * phone, tablet, laptop, and desktop. Validates that layouts
 * don't break, content is reachable, and there's no horizontal overflow.
 */
import { test, expect } from '@playwright/test';
import { BASE, expectPageLoads } from './helpers';

test.use({ baseURL: BASE });

const VIEWPORTS = [
	{ name: 'mobile', width: 375, height: 812 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'laptop', width: 1024, height: 768 },
	{ name: 'desktop', width: 1440, height: 900 },
];

const PUBLIC_ROUTES = ['/', '/home', '/terms', '/privacy', '/demo'];

test.describe('Responsive Design — Public Pages', () => {
	for (const viewport of VIEWPORTS) {
		test.describe(`${viewport.name} (${viewport.width}px)`, () => {
			test.use({ viewport: { width: viewport.width, height: viewport.height } });

			test('landing page renders without horizontal scroll', async ({ page }) => {
				await page.goto('/');
				await expectPageLoads(page);

				const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
				const viewportWidth = await page.evaluate(() => window.innerWidth);
				expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
			});

			test('/home page renders without horizontal scroll', async ({ page }) => {
				await page.goto('/home');
				await expectPageLoads(page);

				const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
				const viewportWidth = await page.evaluate(() => window.innerWidth);
				expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
			});

			test('all public pages load without errors', async ({ page }) => {
				const errors: string[] = [];
				page.on('pageerror', (err) => errors.push(err.message));

				for (const route of PUBLIC_ROUTES) {
					await page.goto(route);
					await page.waitForLoadState('domcontentloaded');
				}

				const real = errors.filter(
					(e) => !e.includes('Extension') && !e.includes('chrome-extension')
				);
				expect(real).toHaveLength(0);
			});
		});
	}
});

test.describe('Responsive Design — Touch Targets', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('mobile buttons have minimum 44px touch target', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const buttons = page.locator('button, a.btn, a[class*="button"], [role="button"]');
		const count = await buttons.count();

		let smallTargets = 0;
		for (let i = 0; i < Math.min(count, 20); i++) {
			const box = await buttons.nth(i).boundingBox();
			if (box && box.height > 0 && box.width > 0) {
				if (box.height < 44 || box.width < 44) {
					smallTargets++;
				}
			}
		}

		// Allow up to 30% of buttons to be small (icons, etc.)
		const threshold = Math.ceil(Math.min(count, 20) * 0.3);
		expect(smallTargets).toBeLessThanOrEqual(threshold);
	});

	test('text is readable on mobile (min 12px)', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const bodyFontSize = await page.evaluate(() => {
			return parseFloat(window.getComputedStyle(document.body).fontSize);
		});
		expect(bodyFontSize).toBeGreaterThanOrEqual(12);
	});
});
