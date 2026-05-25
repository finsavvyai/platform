/**
 * Production Site E2E Tests
 *
 * Runs against https://app.tenantiq.app to verify public pages,
 * auth guards, video assets, navigation, responsive design, and
 * performance on the live production site.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = 'https://app.tenantiq.app';
const SCREENSHOTS =
	'.luna/tenantiq/browser-test/screenshots/production';

test.use({ baseURL: BASE });

/* ------------------------------------------------------------------ */
/* 1. Public Pages — Content Verification                             */
/* ------------------------------------------------------------------ */

test.describe('1. Public Pages — Content Verification', () => {
	test('/ (Landing) — SignInHero with M365 security text', async ({
		page,
	}) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		await expect(
			page.getByText(/M365 security|Microsoft 365/i).first()
		).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByText(/Sign in/i).first()
		).toBeVisible();

		await page.setViewportSize({ width: 1440, height: 900 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'landing-1440.png'),
			fullPage: true,
		});
		await page.setViewportSize({ width: 375, height: 812 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'landing-375.png'),
			fullPage: true,
		});
	});

	test('/home (Marketing) — full marketing page', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveTitle(/TenantIQ/i);
		await expect(
			page.locator('text=TenantIQ').first()
		).toBeVisible({ timeout: 15_000 });

		// Nav links
		for (const label of ['Features', 'Demo', 'Pricing']) {
			await expect(
				page.getByText(label, { exact: false }).first()
			).toBeVisible();
		}

		await page.setViewportSize({ width: 1440, height: 900 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'home-1440.png'),
			fullPage: true,
		});
		await page.setViewportSize({ width: 375, height: 812 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'home-375.png'),
			fullPage: true,
		});
	});

	test('/terms — Terms heading', async ({ page }) => {
		await page.goto('/terms');
		await expect(
			page.getByText(/Terms/i).first()
		).toBeVisible({ timeout: 15_000 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'terms.png'),
			fullPage: true,
		});
	});

	test('/privacy — Privacy heading', async ({ page }) => {
		await page.goto('/privacy');
		await expect(
			page.getByText(/Privacy/i).first()
		).toBeVisible({ timeout: 15_000 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'privacy.png'),
			fullPage: true,
		});
	});

	test('/support — Support heading', async ({ page }) => {
		await page.goto('/support');
		await expect(
			page.getByText(/Support/i).first()
		).toBeVisible({ timeout: 15_000 });
		await page.screenshot({
			path: path.join(SCREENSHOTS, 'support.png'),
			fullPage: true,
		});
	});

	test('/demo — See TenantIQ in Action + 4 video cards', async ({
		page,
	}) => {
		await page.goto('/demo');
		await expect(
			page.getByText(/See TenantIQ in Action/i).first()
		).toBeVisible({ timeout: 15_000 });

		// Expect at least 4 video-related cards/iframes
		const cards = page.locator('iframe, video, [class*="video"], [class*="card"]');
		await expect(cards.first()).toBeVisible({ timeout: 10_000 });
		const count = await cards.count();
		expect(count).toBeGreaterThanOrEqual(4);

		await page.screenshot({
			path: path.join(SCREENSHOTS, 'demo.png'),
			fullPage: true,
		});
	});
});

/* ------------------------------------------------------------------ */
/* 2. Protected Pages — Auth Guard                                    */
/* ------------------------------------------------------------------ */

test.describe('2. Protected Pages — Auth Guard', () => {
	const protectedRoutes = [
		'/alerts',
		'/licenses',
		'/security',
		'/security/cis',
		'/ai',
		'/settings',
		'/workflows',
		'/team',
		'/governance',
		'/backups',
		'/threats',
		'/skills',
	];

	for (const route of protectedRoutes) {
		test(`${route} — redirects to SignInHero`, async ({ page }) => {
			await page.goto(route);
			await page.waitForLoadState('networkidle');

			const hasSignIn = await page
				.getByText(/Sign in|M365 security|Microsoft 365/i)
				.first()
				.isVisible({ timeout: 15_000 })
				.catch(() => false);

			expect(hasSignIn).toBeTruthy();

			await page.screenshot({
				path: path.join(
					SCREENSHOTS,
					`auth-guard${route.replace(/\//g, '-')}.png`
				),
			});
		});
	}
});

/* ------------------------------------------------------------------ */
/* 3. Video Assets                                                    */
/* ------------------------------------------------------------------ */

test.describe('3. Video Assets', () => {
	const videos = [
		'video-trailer.htm',
		'video-explainer.htm',
		'video-social.htm',
		'video-ad.htm',
	];

	for (const vid of videos) {
		test(`${vid} — returns 200 with content`, async ({
			request,
		}) => {
			const res = await request.get(`${BASE}/${vid}`);
			expect(res.status()).toBe(200);
			const body = await res.text();
			expect(body.length).toBeGreaterThan(100);
		});
	}
});

/* ------------------------------------------------------------------ */
/* 4. Navigation & Links                                              */
/* ------------------------------------------------------------------ */

test.describe('4. Navigation & Links', () => {
	test('Start Free Trial CTA links to auth', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		const cta = page
			.locator('a')
			.filter({ hasText: /Start Free Trial|Get Started|Try Free/i })
			.first();
		await expect(cta).toBeVisible({ timeout: 15_000 });

		const href = await cta.getAttribute('href');
		// CTA should link to root (sign-in) or auth URL
		expect(href).toBeTruthy();
		expect(href!).toMatch(
			/^\/($|sign|auth)|tenantiq\.app\/?$/i
		);
	});

	test('Demo nav link scrolls to demo section', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		const demoLink = page
			.locator('nav a, header a')
			.filter({ hasText: /Demo/i })
			.first();
		if (await demoLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
			await demoLink.click();
			await page.waitForTimeout(1000);
			const url = page.url();
			const hasDemoHash =
				url.includes('#demo') || url.includes('/demo');
			expect(hasDemoHash).toBeTruthy();
		}
	});

	test('Features nav link scrolls to features section', async ({
		page,
	}) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		const featLink = page
			.locator('nav a, header a')
			.filter({ hasText: /Features/i })
			.first();
		if (
			await featLink.isVisible({ timeout: 5_000 }).catch(() => false)
		) {
			await featLink.click();
			await page.waitForTimeout(1000);
			const url = page.url();
			expect(url).toMatch(/#features|\/features/);
		}
	});

	test('Footer links work', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		for (const href of ['/terms', '/privacy', '/demo']) {
			const link = page.locator(`footer a[href="${href}"]`).first();
			if (await link.isVisible({ timeout: 3_000 }).catch(() => false)) {
				const response = await page.request.get(`${BASE}${href}`);
				expect(response.status()).toBe(200);
			}
		}
	});
});

/* ------------------------------------------------------------------ */
/* 5. Responsive Design                                               */
/* ------------------------------------------------------------------ */

test.describe('5. Responsive Design', () => {
	const viewports = [
		{ w: 1440, h: 900, label: 'desktop-xl' },
		{ w: 1024, h: 768, label: 'desktop' },
		{ w: 768, h: 1024, label: 'tablet' },
		{ w: 375, h: 812, label: 'mobile' },
	];

	for (const vp of viewports) {
		test(`/home at ${vp.w}px — no overflow, readable`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: vp.w, height: vp.h });
			await page.goto('/home');
			await page.waitForLoadState('networkidle');

			// Check no horizontal overflow
			const bodyWidth = await page.evaluate(() => {
				return document.body.scrollWidth;
			});
			expect(bodyWidth).toBeLessThanOrEqual(vp.w + 5); // 5px tolerance

			await page.screenshot({
				path: path.join(
					SCREENSHOTS,
					`responsive-home-${vp.label}.png`
				),
				fullPage: true,
			});
		});
	}
});

/* ------------------------------------------------------------------ */
/* 6. Performance                                                     */
/* ------------------------------------------------------------------ */

test.describe('6. Performance', () => {
	const pages = ['/', '/home', '/terms', '/privacy', '/demo'];

	for (const pg of pages) {
		test(`${pg} loads under 3s`, async ({ page }) => {
			const start = Date.now();
			await page.goto(pg, { waitUntil: 'domcontentloaded' });
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(3000);
		});
	}
});
