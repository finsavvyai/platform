import { test, expect } from '@playwright/test';

const PROTECTED_ROUTES = [
	'/alerts',
	'/audit',
	'/audit/history',
	'/backups',
	'/backups/config',
	'/governance',
	'/governance/storage',
	'/licenses',
	'/msp',
	'/msp/benchmark',
	'/reports',
	'/security',
	'/security/cis',
	'/security/email',
	'/security/copilot',
	'/security/signin-logs',
	'/settings',
	'/settings/sso',
	'/skills',
	'/team',
	'/threats',
	'/workflows',
	'/workflows/lifecycle',
];

test.describe('auth guard — protected routes redirect to sign-in', () => {
	for (const route of PROTECTED_ROUTES) {
		test(`${route} shows sign-in when unauthenticated`, async ({ page }) => {
			await page.goto(route);
			// Layout waits for /auth/me (401 → clear), then shows SignInHero
			await expect(
				page.getByRole('heading', { name: /sign in/i })
			).toBeVisible({ timeout: 12_000 });
		});
	}
});
