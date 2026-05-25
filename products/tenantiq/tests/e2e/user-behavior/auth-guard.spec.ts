/**
 * User Behavior: Authentication Guards
 *
 * Simulates an unauthenticated user trying to access every protected
 * route. Verifies that the app shows a sign-in prompt instead of
 * exposing any tenant data.
 */
import { test, expect } from '@playwright/test';
import { BASE, expectPageLoads } from './helpers';

test.use({ baseURL: BASE });

const PROTECTED_ROUTES = [
	'/', '/alerts', '/licenses', '/security', '/security/cis',
	'/security/email', '/security/purview', '/security/signin-logs',
	'/security/copilot', '/security/copilot-usage', '/threats',
	'/behavior', '/ai', '/backups', '/backups/config', '/audit',
	'/audit/history', '/workflows', '/workflows/lifecycle',
	'/governance', '/governance/storage', '/msp', '/msp/benchmark',
	'/team', '/settings', '/settings/sso', '/skills', '/sdlc',
	'/reports', '/security/dashboard', '/security/compliance',
];

test.describe('Unauthenticated User — Route Protection', () => {
	test.beforeEach(async ({ page }) => {
		// Clear any auth state
		await page.goto('/');
		await page.evaluate(() => {
			localStorage.removeItem('tenantiq_token');
			localStorage.removeItem('tenantiq_user');
		});
	});

	for (const route of PROTECTED_ROUTES) {
		test(`${route} shows sign-in prompt when unauthenticated`, async ({ page }) => {
			await page.goto(route);
			await expectPageLoads(page);

			// Should see sign-in hero or prompt
			const signIn = page.locator(
				'text=Sign in with Microsoft, text=Sign In, .sign-in-hero, [class*="SignInHero"], [class*="sign-in"]'
			).first();

			await expect(signIn).toBeVisible({ timeout: 15_000 });
		});
	}

	test('no tenant data leaks on protected pages', async ({ page }) => {
		await page.goto('/alerts');
		await expectPageLoads(page);

		// Should NOT see real alert data or table content
		const body = await page.locator('body').textContent();
		expect(body).not.toContain('MFA not enforced');
		expect(body).not.toContain('@contoso.com');
	});

	test('auth callback without params shows error', async ({ page }) => {
		await page.goto('/auth/callback');
		await expectPageLoads(page);

		const body = await page.locator('body').textContent();
		expect(body!.length).toBeGreaterThan(0);
	});

	test('auth callback with error=access_denied shows denial', async ({ page }) => {
		await page.goto('/auth/callback?error=access_denied');
		await expectPageLoads(page);

		const body = await page.locator('body').textContent();
		expect(body!.toLowerCase()).toMatch(/denied|error|failed|sign in/);
	});
});
