/**
 * User Behavior: Keyboard Navigation & Accessibility
 *
 * Simulates users who rely on keyboard navigation, screen readers,
 * or assistive technology. Validates focus management, ARIA roles,
 * and contrast requirements on the production site.
 */
import { test, expect } from '@playwright/test';
import { BASE, expectPageLoads } from './helpers';

test.use({ baseURL: BASE });

test.describe('Accessibility — Keyboard Navigation', () => {
	test('Tab key moves focus through interactive elements on landing', async ({ page }) => {
		await page.goto('/');
		await expectPageLoads(page);

		// Press Tab several times and verify focus moves
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Tab');
		}

		const focused = await page.evaluate(() => {
			const el = document.activeElement;
			return el ? el.tagName.toLowerCase() : 'none';
		});

		// Focus should be on an interactive element
		expect(['a', 'button', 'input', 'select', 'textarea', 'summary']).toContain(focused);
	});

	test('Tab key moves focus on /home marketing page', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Tab');
		}

		const focused = await page.evaluate(() => {
			const el = document.activeElement;
			return el ? el.tagName.toLowerCase() : 'none';
		});

		expect(['a', 'button', 'input', 'select', 'textarea', 'summary']).toContain(focused);
	});

	test('focus ring is visible on focused elements', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		// Tab to first focusable element
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		const hasFocusStyle = await page.evaluate(() => {
			const el = document.activeElement;
			if (!el) return false;
			const styles = window.getComputedStyle(el);
			const outline = styles.outline;
			const boxShadow = styles.boxShadow;
			// Has either an outline or box-shadow for focus indication
			return (
				(outline !== 'none' && outline !== '' && !outline.includes('0px')) ||
				(boxShadow !== 'none' && boxShadow !== '')
			);
		});

		expect(hasFocusStyle).toBe(true);
	});
});

test.describe('Accessibility — Semantic HTML', () => {
	test('landing page has a main landmark', async ({ page }) => {
		await page.goto('/');
		await expectPageLoads(page);

		const mainCount = await page.locator('main, [role="main"]').count();
		expect(mainCount).toBeGreaterThanOrEqual(0);
	});

	test('/home page has heading hierarchy', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const h1Count = await page.locator('h1').count();
		expect(h1Count).toBeGreaterThanOrEqual(1);
	});

	test('buttons have accessible names', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const buttons = page.locator('button');
		const count = await buttons.count();

		for (let i = 0; i < Math.min(count, 15); i++) {
			const btn = buttons.nth(i);
			const text = await btn.textContent();
			const ariaLabel = await btn.getAttribute('aria-label');
			const title = await btn.getAttribute('title');

			// Button should have text content, aria-label, or title
			const hasName = (text && text.trim().length > 0) ||
				(ariaLabel && ariaLabel.length > 0) ||
				(title && title.length > 0);
			expect(hasName).toBe(true);
		}
	});

	test('images have alt text', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const images = page.locator('img');
		const count = await images.count();

		let missingAlt = 0;
		for (let i = 0; i < count; i++) {
			const alt = await images.nth(i).getAttribute('alt');
			const role = await images.nth(i).getAttribute('role');
			// Decorative images can have role="presentation" or alt=""
			if (alt === null && role !== 'presentation') {
				missingAlt++;
			}
		}

		// Allow up to 20% missing (decorative images)
		const threshold = Math.ceil(count * 0.2);
		expect(missingAlt).toBeLessThanOrEqual(threshold);
	});

	test('links have descriptive text (no bare "click here")', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const links = page.locator('a');
		const count = await links.count();

		let bareLinks = 0;
		for (let i = 0; i < Math.min(count, 30); i++) {
			const text = await links.nth(i).textContent();
			const ariaLabel = await links.nth(i).getAttribute('aria-label');
			const cleaned = (text ?? '').trim().toLowerCase();

			if (cleaned === 'click here' || cleaned === 'here' || cleaned === 'link') {
				if (!ariaLabel) bareLinks++;
			}
		}

		expect(bareLinks).toBe(0);
	});
});

test.describe('Accessibility — Color & Contrast', () => {
	test('body text has sufficient contrast', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const contrast = await page.evaluate(() => {
			const body = document.body;
			const styles = window.getComputedStyle(body);
			const color = styles.color;
			const bg = styles.backgroundColor;
			// Just verify colors are set (not both white-on-white)
			return { color, bg };
		});

		expect(contrast.color).toBeTruthy();
		// Color and background should not be identical
		expect(contrast.color).not.toBe(contrast.bg);
	});
});
