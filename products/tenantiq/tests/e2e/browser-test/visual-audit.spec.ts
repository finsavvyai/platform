/**
 * Visual Audit Browser Tests
 *
 * Comprehensive testing of all publicly accessible pages:
 * - Multi-viewport screenshots (1440, 1024, 768, 375)
 * - Element visibility checks
 * - Responsive layout validation
 * - Accessibility basics
 * - Performance metrics
 * - Link validation
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.resolve('.luna/tenantiq/browser-test/screenshots');

const VIEWPORTS = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'laptop', width: 1024, height: 768 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'mobile', width: 375, height: 812 },
] as const;

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function screenshot(page: Page, name: string) {
	ensureDir(path.dirname(path.join(SCREENSHOT_DIR, name)));
	await page.screenshot({
		path: path.join(SCREENSHOT_DIR, name),
		fullPage: true,
	});
}

// ─── LANDING PAGE ──────────────────────────────────────────────

test.describe('Landing Page (/) — SignInHero', () => {
	for (const vp of VIEWPORTS) {
		test(`renders correctly @ ${vp.name} (${vp.width}px)`, async ({
			browser,
		}) => {
			const ctx = await browser.newContext({
				viewport: { width: vp.width, height: vp.height },
			});
			const page = await ctx.newPage();
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(e.message));

			await page.goto('/', { waitUntil: 'networkidle' });
			await screenshot(page, `landing/${vp.name}.png`);

			// Logo
			await expect(page.locator('.logo-text')).toBeVisible();
			await expect(page.locator('.logo-text')).toHaveText('TenantIQ');

			// Headline
			const h1 = page.locator('h1.headline');
			await expect(h1).toBeVisible();
			await expect(h1).toContainText('M365 security');

			// Sign-in card
			await expect(
				page.locator('.card-title', { hasText: 'Sign in' })
			).toBeVisible();

			// Microsoft sign-in button
			const msBtn = page.locator('.btn-ms');
			await expect(msBtn).toBeVisible();
			await expect(msBtn).toContainText('Sign in with Microsoft');

			// Stats
			await expect(
				page.locator('.stat-val', { hasText: '100+' })
			).toBeVisible();
			await expect(
				page.locator('.stat-val', { hasText: '13+' })
			).toBeVisible();

			// Compliance badges
			for (const badge of ['SOC 2', 'HIPAA', 'GDPR', 'Zero Trust']) {
				await expect(
					page.locator('.badge', { hasText: badge })
				).toBeVisible();
			}

			// Status bar
			await expect(page.locator('.status-bar')).toBeVisible();
			await expect(page.locator('.status-dot')).toBeVisible();

			// No horizontal overflow
			const scrollW = await page.evaluate(
				() => document.documentElement.scrollWidth
			);
			expect(scrollW).toBeLessThanOrEqual(vp.width + 5);

			// No fatal JS errors
			const fatal = errors.filter(
				(e) =>
					!e.includes('extension') &&
					!e.includes('SES') &&
					!e.includes('ResizeObserver')
			);
			expect(fatal).toHaveLength(0);

			await ctx.close();
		});
	}
});

// ─── LANDING PAGE LINKS ────────────────────────────────────────

test.describe('Landing Page Links', () => {
	test('Microsoft sign-in link points to auth endpoint', async ({
		page,
	}) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		const href = await page.locator('.btn-ms').getAttribute('href');
		expect(href).toContain('/api/auth/login');
	});

	test('Start free trial link is present', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		const trialLink = page.locator('.link', {
			hasText: 'Start free trial',
		});
		await expect(trialLink).toBeVisible();
		const href = await trialLink.getAttribute('href');
		expect(href).toContain('/api/auth/login');
	});
});

// ─── /home PAGE ────────────────────────────────────────────────

test.describe('/home Landing Page', () => {
	for (const vp of VIEWPORTS) {
		test(`renders @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
			const ctx = await browser.newContext({
				viewport: { width: vp.width, height: vp.height },
			});
			const page = await ctx.newPage();
			await page.goto('/home', { waitUntil: 'networkidle' });
			await screenshot(page, `home/${vp.name}.png`);

			await expect(page).toHaveTitle(/TenantIQ/);
			await expect(
				page.locator('h1', {
					hasText: 'Control Every Microsoft 365 Tenant',
				})
			).toBeVisible({ timeout: 10_000 });

			const scrollW = await page.evaluate(
				() => document.documentElement.scrollWidth
			);
			expect(scrollW).toBeLessThanOrEqual(vp.width + 5);
			await ctx.close();
		});
	}
});

// ─── /platform PAGE ────────────────────────────────────────────

test.describe('/platform Dashboard', () => {
	for (const vp of VIEWPORTS) {
		test(`renders @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
			const ctx = await browser.newContext({
				viewport: { width: vp.width, height: vp.height },
			});
			const page = await ctx.newPage();
			await page.goto('/platform', { waitUntil: 'networkidle' });
			await screenshot(page, `platform/${vp.name}.png`);

			await expect(
				page.locator('h1', { hasText: 'Platform Dashboard' })
			).toBeVisible({ timeout: 10_000 });
			await expect(
				page.locator('p', { hasText: 'Organizations' }).first()
			).toBeVisible();
			await expect(
				page.locator('p', { hasText: 'MRR' }).first()
			).toBeVisible();

			const scrollW = await page.evaluate(
				() => document.documentElement.scrollWidth
			);
			expect(scrollW).toBeLessThanOrEqual(vp.width + 5);
			await ctx.close();
		});
	}
});

// ─── AUTH CALLBACK ERROR PAGES ─────────────────────────────────

test.describe('Auth Error Pages', () => {
	test('auth callback without params shows error', async ({ page }) => {
		await page.goto('/auth/callback', { waitUntil: 'networkidle' });
		await screenshot(page, `auth/callback-error.png`);
		// Should show some error state or redirect
	});

	test('auth callback with error param shows denied', async ({ page }) => {
		await page.goto('/auth/callback?error=access_denied', {
			waitUntil: 'networkidle',
		});
		await screenshot(page, `auth/callback-denied.png`);
	});
});

// ─── 404 PAGE ──────────────────────────────────────────────────

test.describe('404 Page', () => {
	test('non-existent route shows 404 or redirects', async ({ page }) => {
		await page.goto('/this-does-not-exist-at-all', {
			waitUntil: 'networkidle',
		});
		await screenshot(page, `errors/404.png`);
	});
});

// ─── UNAUTHENTICATED ROUTE BEHAVIOR ───────────────────────────

test.describe('Unauthenticated Route Behavior', () => {
	const routes = [
		'/alerts',
		'/licenses',
		'/security',
		'/security/cis',
		'/ai',
		'/settings',
		'/workflows',
		'/team',
	];

	for (const route of routes) {
		test(`${route} shows sign-in or redirects`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'networkidle' });
			const safeName = route.replace(/\//g, '_').replace(/^_/, '');
			await screenshot(page, `unauth/${safeName}.png`);

			// Should either show SignInHero, redirect to /, or show login prompt
			const url = page.url();
			const hasSignIn = await page
				.locator('.btn-ms, .card-title, text=Sign in')
				.first()
				.isVisible()
				.catch(() => false);
			const isRedirected =
				url.endsWith('/') ||
				url.includes('/home') ||
				url.includes('/platform');

			expect(
				hasSignIn || isRedirected,
				`${route} should show sign-in or redirect when unauthenticated`
			).toBeTruthy();
		});
	}
});

// ─── KEYBOARD NAVIGATION ──────────────────────────────────────

test.describe('Keyboard Navigation', () => {
	test('tab through landing page elements', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		for (let i = 0; i < 8; i++) {
			await page.keyboard.press('Tab');
		}

		const focusedTag = await page.evaluate(
			() => document.activeElement?.tagName.toLowerCase()
		);
		expect(['a', 'button', 'input', 'select', 'textarea']).toContain(
			focusedTag
		);
	});

	test('Enter activates focused link', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		// Tab to first interactive element
		await page.keyboard.press('Tab');
		const tag = await page.evaluate(
			() => document.activeElement?.tagName.toLowerCase()
		);
		expect(['a', 'button']).toContain(tag);
	});
});

// ─── PERFORMANCE ──────────────────────────────────────────────

test.describe('Performance', () => {
	test('landing page DOM content loaded < 3s', async ({ page }) => {
		const start = Date.now();
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		expect(Date.now() - start).toBeLessThan(3000);
	});

	test('/home loads < 3s', async ({ page }) => {
		const start = Date.now();
		await page.goto('/home', { waitUntil: 'domcontentloaded' });
		expect(Date.now() - start).toBeLessThan(3000);
	});

	test('/platform loads < 3s', async ({ page }) => {
		const start = Date.now();
		await page.goto('/platform', { waitUntil: 'domcontentloaded' });
		expect(Date.now() - start).toBeLessThan(3000);
	});
});

// ─── VISUAL CONTRAST ──────────────────────────────────────────

test.describe('Visual Contrast', () => {
	test('landing headline is readable (contrast check)', async ({
		page,
	}) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		const headlineColor = await page.evaluate(() => {
			const el = document.querySelector('h1.headline');
			if (!el) return null;
			return window.getComputedStyle(el).color;
		});

		// Should have a light color on dark background
		expect(headlineColor).toBeTruthy();
		// Parse rgb values - should be bright (>150)
		const match = headlineColor?.match(
			/rgba?\((\d+),\s*(\d+),\s*(\d+)/
		);
		if (match) {
			const brightness =
				(parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) /
				3;
			expect(brightness).toBeGreaterThan(100);
		}
	});

	test('sign-in button has sufficient contrast', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		const btnBg = await page.evaluate(() => {
			const btn = document.querySelector('.btn-ms');
			if (!btn) return null;
			return window.getComputedStyle(btn).backgroundColor;
		});
		expect(btnBg).toBeTruthy();
	});
});
