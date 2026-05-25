/**
 * User Behavior: Security Analyst — Alert Triage & Response
 *
 * Simulates a security analyst reviewing alerts, triaging by severity,
 * navigating to detailed security views, and exploring remediation options.
 */
import { test, expect } from '@playwright/test';
import { BASE, setupAuth, SECURITY_ANALYST } from './helpers';

test.use({ baseURL: BASE });

test.describe('Security Analyst — Alert Review Workflow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, SECURITY_ANALYST);
	});

	test('navigates to alerts page', async ({ page }) => {
		await page.goto('/alerts');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/alerts/);
	});

	test('alerts page renders without JS errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		await page.goto('/alerts');
		await page.waitForLoadState('domcontentloaded');

		const real = errors.filter(
			(e) => !e.includes('Extension') && !e.includes('chrome-extension')
		);
		expect(real).toHaveLength(0);
	});

	test('security health check page loads', async ({ page }) => {
		await page.goto('/security');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security/);
	});

	test('CIS benchmark page loads', async ({ page }) => {
		await page.goto('/security/cis');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/cis/);
	});

	test('email security page loads', async ({ page }) => {
		await page.goto('/security/email');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/email/);
	});

	test('sign-in logs page loads', async ({ page }) => {
		await page.goto('/security/signin-logs');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/signin-logs/);
	});

	test('threats page loads', async ({ page }) => {
		await page.goto('/threats');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/threats/);
	});

	test('behavior analysis page loads', async ({ page }) => {
		await page.goto('/behavior');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/behavior/);
	});
});

test.describe('Security Analyst — Investigation Flow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, SECURITY_ANALYST);
	});

	test('can navigate security section sequentially', async ({ page }) => {
		// Analyst flow: Health Check → CIS → Email → Sign-in Logs
		const securityPages = [
			'/security',
			'/security/cis',
			'/security/email',
			'/security/signin-logs',
		];

		for (const route of securityPages) {
			await page.goto(route);
			await page.waitForLoadState('domcontentloaded');
			await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')));
		}
	});

	test('can pivot from alerts to threats', async ({ page }) => {
		await page.goto('/alerts');
		await page.waitForLoadState('domcontentloaded');

		// Navigate to threats for deeper investigation
		await page.goto('/threats');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/threats/);
	});

	test('can check Copilot readiness', async ({ page }) => {
		await page.goto('/security/copilot');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/copilot/);
	});

	test('compliance/Purview page loads', async ({ page }) => {
		await page.goto('/security/purview');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/purview/);
	});

	test('all security pages free of console errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		const pages = [
			'/security', '/security/cis', '/security/email',
			'/security/purview', '/security/signin-logs',
			'/security/copilot', '/threats', '/behavior',
		];

		for (const route of pages) {
			await page.goto(route);
			await page.waitForLoadState('domcontentloaded');
		}

		const real = errors.filter(
			(e) => !e.includes('Extension') && !e.includes('chrome-extension')
		);
		expect(real).toHaveLength(0);
	});
});
