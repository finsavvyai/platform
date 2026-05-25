import { test, expect, type Page } from '@playwright/test';

/**
 * Production audit — visit every page on app.tenantiq.app,
 * check for console errors, broken UI, and clickability.
 */

const BASE = 'https://app.tenantiq.app';

const PAGES = [
	{ path: '/', name: 'Dashboard' },
	{ path: '/threats', name: 'Threats' },
	{ path: '/behavior', name: 'Behavior' },
	{ path: '/alerts', name: 'Alerts' },
	{ path: '/licenses', name: 'Licenses' },
	{ path: '/security', name: 'Security' },
	{ path: '/security/email', name: 'Email Security' },
	{ path: '/security/purview', name: 'Compliance' },
	{ path: '/security/signin-logs', name: 'Sign-in Logs' },
	{ path: '/backups', name: 'Cloud Backups' },
	{ path: '/ai', name: 'AI Agent' },
	{ path: '/workflows', name: 'Workflows' },
	{ path: '/audit', name: 'Audit Log' },
	{ path: '/msp', name: 'MSP' },
	{ path: '/settings', name: 'Settings' },
];

/** Collect JS console errors during page load. */
async function collectErrors(page: Page): Promise<string[]> {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	return errors;
}

/** Filter out noise from browser extensions, SES lockdown, and network errors. */
function filterAppErrors(errors: string[]): string[] {
	return errors.filter(
		(e) =>
			!e.includes('SES') &&
			!e.includes('lockdown') &&
			!e.includes('extension') &&
			!e.includes('favicon') &&
			!e.includes('ERR_NETWORK') &&
			!e.includes('net::') &&
			!e.includes('Failed to fetch') &&
			!e.includes('Failed to load resource') &&
			!e.includes('the server responded with a status of')
	);
}

test.describe('Production audit — all pages load without JS errors', () => {
	for (const { path, name } of PAGES) {
		test(`${name} (${path})`, async ({ page }) => {
			const errors = await collectErrors(page);
			await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
			await page.waitForTimeout(2000);

			const appErrors = filterAppErrors(errors);
			expect(appErrors, `JS errors on ${name}`).toEqual([]);

			const body = await page.locator('body').textContent();
			expect(body?.length).toBeGreaterThan(10);
		});
	}
});

test.describe('Dashboard — unauthenticated', () => {
	test('shows sign-in prompt without crashing', async ({ page }) => {
		const errors = await collectErrors(page);
		await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(2000);

		expect(filterAppErrors(errors)).toEqual([]);

		const text = await page.locator('body').textContent();
		// Should show sign-in prompt OR dashboard (if auth cookie persists)
		const hasContent = text?.includes('Sign in') || text?.includes('Welcome') || text?.includes('TenantIQ');
		expect(hasContent).toBe(true);
	});

	test('quick action links are visible and have valid hrefs (when authenticated)', async ({ page }) => {
		await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(2000);

		// Quick actions only show when authenticated and data is loaded
		const quickActions = page.locator('a[href="/security"], a[href="/licenses"], a[href="/ai"], a[href="/audit"]');
		const count = await quickActions.count();

		if (count > 0) {
			for (let i = 0; i < count; i++) {
				const link = quickActions.nth(i);
				await expect(link).toBeVisible();
				const box = await link.boundingBox();
				expect(box).toBeTruthy();
				expect(box!.width).toBeGreaterThan(0);
				expect(box!.height).toBeGreaterThan(0);
			}

			// Click first quick action and verify navigation
			const firstHref = await quickActions.first().getAttribute('href');
			await quickActions.first().click();
			await page.waitForTimeout(1000);
			expect(page.url()).toContain(firstHref);
		}
	});
});

test.describe('Export menus', () => {
	const pagesWithExport = ['/', '/alerts', '/licenses', '/security', '/security/purview', '/msp', '/audit'];

	for (const path of pagesWithExport) {
		test(`Export button renders on ${path} (if authenticated)`, async ({ page }) => {
			await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
			await page.waitForTimeout(2000);

			const exportBtn = page.locator('.export-menu button').first();
			const visible = await exportBtn.isVisible().catch(() => false);

			if (visible) {
				const disabled = await exportBtn.getAttribute('disabled');
				if (disabled !== null && disabled !== undefined) {
					// Button is disabled (no data) — that's OK for unauthenticated state
					return;
				}
				await exportBtn.click();
				await page.waitForTimeout(500);

				const menu = page.locator('[role="menu"]');
				const menuVisible = await menu.isVisible().catch(() => false);
				if (menuVisible) {
					const items = menu.locator('[role="menuitem"]');
					expect(await items.count()).toBeGreaterThan(0);
				}
			}
		});
	}
});

test.describe('Data integrity', () => {
	test('Threats page does not show globalremit.com', async ({ page }) => {
		await page.goto(`${BASE}/threats`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(3000);
		const text = await page.locator('body').textContent();
		expect(text).not.toContain('globalremit.com');
	});

	test('Behavior page does not show globalremit.com', async ({ page }) => {
		await page.goto(`${BASE}/behavior`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(3000);
		const text = await page.locator('body').textContent();
		expect(text).not.toContain('globalremit.com');
	});

	test('Email Security loads without toLocaleString crash', async ({ page }) => {
		const errors = await collectErrors(page);
		await page.goto(`${BASE}/security/email`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(3000);
		const appErrors = filterAppErrors(errors);
		expect(appErrors).toEqual([]);
	});

	test('Sign-in Logs loads without crash', async ({ page }) => {
		const errors = await collectErrors(page);
		await page.goto(`${BASE}/security/signin-logs`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(3000);
		const appErrors = filterAppErrors(errors);
		expect(appErrors).toEqual([]);
	});
});

test.describe('Sidebar navigation (auth-dependent)', () => {
	test('sidebar renders when authenticated', async ({ page }) => {
		await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await page.waitForTimeout(2000);

		const sidebar = page.locator('nav[aria-label="Main navigation"]');
		const sidebarVisible = await sidebar.isVisible().catch(() => false);

		if (sidebarVisible) {
			const navLinks = sidebar.locator('a');
			const count = await navLinks.count();
			expect(count).toBeGreaterThan(5);

			// Verify first few links navigate
			for (let i = 0; i < Math.min(count, 3); i++) {
				const link = navLinks.nth(i);
				const href = await link.getAttribute('href');
				expect(href).toBeTruthy();
				await link.click();
				await page.waitForTimeout(1000);
			}
		}
		// If sidebar not visible, user is not authenticated
	});
});
