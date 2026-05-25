/**
 * Comprehensive Screenshot Browser Tests
 *
 * Captures every page at 4 viewports (mobile, tablet, laptop, desktop)
 * in both light and dark mode. Validates basic rendering.
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.resolve('.luna/tenantiq/browser-test/screenshots');

const VIEWPORTS = [
	{ name: 'mobile', width: 375, height: 812 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'laptop', width: 1024, height: 768 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

// Public pages (no auth required)
const PUBLIC_PAGES = [
	{ path: '/home', name: 'landing' },
	{ path: '/platform', name: 'platform' },
	{ path: '/auth/callback', name: 'auth-error' },
	{ path: '/auth/callback?error=access_denied', name: 'auth-denied' },
];

// Authenticated pages (with mocked auth)
const AUTH_PAGES = [
	{ path: '/', name: 'dashboard' },
	{ path: '/alerts', name: 'alerts' },
	{ path: '/licenses', name: 'licenses' },
	{ path: '/security', name: 'security' },
	{ path: '/security/cis', name: 'cis-benchmark' },
	{ path: '/security/email', name: 'email-security' },
	{ path: '/security/purview', name: 'compliance' },
	{ path: '/security/signin-logs', name: 'signin-logs' },
	{ path: '/security/copilot', name: 'copilot-readiness' },
	{ path: '/security/copilot-usage', name: 'copilot-usage' },
	{ path: '/threats', name: 'threats' },
	{ path: '/behavior', name: 'behavior' },
	{ path: '/ai', name: 'ai-agent' },
	{ path: '/backups', name: 'backups' },
	{ path: '/backups/config', name: 'config-snapshots' },
	{ path: '/audit', name: 'audit' },
	{ path: '/audit/history', name: 'config-history' },
	{ path: '/workflows', name: 'workflows' },
	{ path: '/workflows/lifecycle', name: 'user-lifecycle' },
	{ path: '/governance', name: 'governance' },
	{ path: '/governance/storage', name: 'storage-analytics' },
	{ path: '/msp', name: 'msp-benchmark' },
	{ path: '/team', name: 'team' },
	{ path: '/settings', name: 'settings' },
	{ path: '/skills', name: 'skills' },
	{ path: '/sdlc', name: 'ai-compliance' },
];

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

async function setupAuth(page: Page) {
	// Intercept API calls to api.tenantiq.app (production API domain)
	await page.route('https://api.tenantiq.app/**', (route) => {
		const url = route.request().url();

		if (url.match(/\/api\/tenants\/[^/]+\/dashboard/)) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					secureScore: 72, totalUsers: 150, totalAlerts: 5,
					licenseCost: 12500, complianceScore: 85, mfaAdoption: 94,
					riskScore: 'medium', activeAlerts: 5, resolvedAlerts: 42,
					totalLicenses: 200, unusedLicenses: 23,
				}),
			});
		}

		// Block SSE streams to prevent hanging
		if (url.includes('/events/stream') || url.includes('/notifications')) {
			return route.abort();
		}

		if (url.match(/\/api\/tenants\/[^/]+\/alerts/)) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ alerts: [], total: 0 }),
			});
		}

		if (url.match(/\/api\/tenants$/) || url.match(/\/api\/tenants\?/)) {
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					tenants: [{
						id: 'tenant-1',
						displayName: 'Demo Corp',
						domain: 'democorp.onmicrosoft.com',
						status: 'active',
						lastSyncAt: new Date().toISOString(),
					}],
				}),
			});
		}

		// Default: return empty data
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: [] }),
		});
	});

	await page.goto('/');
	await page.evaluate(() => {
		localStorage.setItem('tenantiq_token', 'e2e-screenshot-token');
		localStorage.setItem('tenantiq_user', JSON.stringify({
			id: 'user-screenshot',
			email: 'screenshot@tenantiq.test',
			name: 'Screenshot User',
			organizationId: 'org-1',
			tenantIds: ['tenant-1'],
			role: 'admin',
		}));
	});
	await page.reload();
	// Wait for sidebar to appear
	await page.waitForSelector('text=TenantIQ', { timeout: 10_000 }).catch(() => {});
}

async function setDarkMode(page: Page) {
	await page.evaluate(() => {
		document.documentElement.setAttribute('data-theme', 'dark');
		localStorage.setItem('tenantiq-theme', 'dark');
	});
	// Wait for theme to apply
	await page.waitForTimeout(300);
}

async function setLightMode(page: Page) {
	await page.evaluate(() => {
		document.documentElement.setAttribute('data-theme', 'light');
		localStorage.setItem('tenantiq-theme', 'light');
	});
	await page.waitForTimeout(300);
}

async function takeScreenshot(page: Page, pageName: string, viewport: string, theme: string) {
	const dir = path.join(SCREENSHOT_DIR, pageName);
	ensureDir(dir);
	const filename = theme === 'dark' ? `dark-${viewport}.png` : `${viewport}.png`;
	await page.screenshot({
		path: path.join(dir, filename),
		fullPage: true,
	});
}

// ─── PUBLIC PAGES ───────────────────────────────────────────────

test.describe('Public Pages - Screenshots', () => {
	for (const pg of PUBLIC_PAGES) {
		for (const vp of VIEWPORTS) {
			test(`${pg.name} @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
				const context = await browser.newContext({
					viewport: { width: vp.width, height: vp.height },
				});
				const page = await context.newPage();

				const errors: string[] = [];
				page.on('pageerror', (err) => errors.push(err.message));

				await page.goto(pg.path, { waitUntil: 'load' });
				await page.waitForTimeout(500);

				await takeScreenshot(page, pg.name, vp.name, 'light');

				// Dark mode screenshot
				await setDarkMode(page);
				await takeScreenshot(page, pg.name, vp.name, 'dark');

				// No fatal JS errors
				const fatalErrors = errors.filter(e =>
					!e.includes('extension') && !e.includes('SES') && !e.includes('ResizeObserver')
				);
				expect(fatalErrors).toHaveLength(0);

				await context.close();
			});
		}
	}
});

// ─── AUTHENTICATED PAGES ────────────────────────────────────────

test.describe('Authenticated Pages - Screenshots', () => {
	for (const pg of AUTH_PAGES) {
		for (const vp of VIEWPORTS) {
			test(`${pg.name} @ ${vp.name} (${vp.width}px)`, async ({ browser }) => {
				const context = await browser.newContext({
					viewport: { width: vp.width, height: vp.height },
				});
				const page = await context.newPage();

				await setupAuth(page);

				const errors: string[] = [];
				page.on('pageerror', (err) => errors.push(err.message));

				await page.goto(pg.path, { waitUntil: 'load' });
				await page.waitForTimeout(500);

				// Light mode
				await setLightMode(page);
				await takeScreenshot(page, pg.name, vp.name, 'light');

				// Dark mode
				await setDarkMode(page);
				await takeScreenshot(page, pg.name, vp.name, 'dark');

				await context.close();
			});
		}
	}
});

// ─── RESPONSIVE CHECKS ─────────────────────────────────────────

test.describe('Responsive Layout Validation', () => {
	test('no horizontal scroll on mobile (375px)', async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 375, height: 812 },
		});
		const page = await context.newPage();

		for (const pg of ['/home', '/platform', '/']) {
			await page.goto(pg, { waitUntil: 'networkidle' });
			await page.waitForTimeout(300);

			const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
			const viewportWidth = await page.evaluate(() => window.innerWidth);
			expect(scrollWidth, `Horizontal overflow on ${pg}`).toBeLessThanOrEqual(viewportWidth + 5);
		}

		await context.close();
	});
});

// ─── ERROR PAGES ────────────────────────────────────────────────

test.describe('Error Pages', () => {
	test('404 page renders correctly', async ({ page }) => {
		await page.goto('/this-page-does-not-exist', { waitUntil: 'networkidle' });
		ensureDir(path.join(SCREENSHOT_DIR, 'errors'));
		await page.screenshot({
			path: path.join(SCREENSHOT_DIR, 'errors', '404.png'),
			fullPage: true,
		});
	});
});

// ─── KEYBOARD NAVIGATION ────────────────────────────────────────

test.describe('Keyboard Navigation', () => {
	test('tab navigates through landing page interactive elements', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		// Press Tab multiple times and verify focus moves
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Tab');
		}

		// A focused element should exist
		const focusedTag = await page.evaluate(() =>
			document.activeElement?.tagName.toLowerCase()
		);
		expect(['a', 'button', 'input', 'select', 'textarea']).toContain(focusedTag);
	});
});

// ─── PERFORMANCE ────────────────────────────────────────────────

test.describe('Performance', () => {
	test('landing page loads within 5s', async ({ page }) => {
		const start = Date.now();
		await page.goto('/home', { waitUntil: 'domcontentloaded' });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(5000);
	});

	test('dashboard loads within 5s', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await setupAuth(page);

		const start = Date.now();
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		const loadTime = Date.now() - start;
		expect(loadTime).toBeLessThan(5000);

		await context.close();
	});
});
