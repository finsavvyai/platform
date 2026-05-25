/**
 * User Behavior: Workflow Builder & Operations
 *
 * Simulates an operator creating workflows, managing licenses,
 * checking backups, and using the AI agent. Tests the operational
 * day-to-day usage of TenantIQ's management features.
 */
import { test, expect } from '@playwright/test';
import { BASE, setupAuth, MSP_ADMIN } from './helpers';

test.use({ baseURL: BASE });

test.describe('Operator — Workflow & License Management', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, MSP_ADMIN);
	});

	test('workflows page loads', async ({ page }) => {
		await page.goto('/workflows');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/workflows/);
	});

	test('user lifecycle page loads', async ({ page }) => {
		await page.goto('/workflows/lifecycle');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/workflows\/lifecycle/);
	});

	test('licenses page loads', async ({ page }) => {
		await page.goto('/licenses');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/licenses/);
	});

	test('AI agent page loads', async ({ page }) => {
		await page.goto('/ai');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/ai/);
	});

	test('backups page loads', async ({ page }) => {
		await page.goto('/backups');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/backups/);
	});

	test('config snapshots page loads', async ({ page }) => {
		await page.goto('/backups/config');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/backups\/config/);
	});

	test('skills hub page loads', async ({ page }) => {
		await page.goto('/skills');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/skills/);
	});

	test('MSP benchmark page loads', async ({ page }) => {
		await page.goto('/msp');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/msp/);
	});

	test('Copilot usage analytics page loads', async ({ page }) => {
		await page.goto('/security/copilot-usage');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/copilot-usage/);
	});
});

test.describe('Operator — Daily Operations Flow', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, MSP_ADMIN);
	});

	test('morning check: dashboard → alerts → security', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		// Start with dashboard
		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');

		// Check alerts
		await page.goto('/alerts');
		await page.waitForLoadState('domcontentloaded');

		// Review security posture
		await page.goto('/security');
		await page.waitForLoadState('domcontentloaded');

		// Check licenses
		await page.goto('/licenses');
		await page.waitForLoadState('domcontentloaded');

		const real = errors.filter(
			(e) => !e.includes('Extension') && !e.includes('chrome-extension')
		);
		expect(real).toHaveLength(0);
	});

	test('full page sweep: all 27 sidebar pages load', async ({ page }) => {
		const allPages = [
			'/', '/skills', '/security',
			'/alerts', '/licenses', '/audit', '/workflows',
			'/security/cis', '/threats', '/behavior',
			'/security/email', '/security/purview',
			'/security/signin-logs', '/sdlc',
			'/security/copilot',
			'/ai', '/backups', '/backups/config',
			'/audit/history',
			'/governance', '/governance/storage',
			'/workflows/lifecycle',
			'/security/copilot-usage',
			'/msp', '/team', '/settings',
		];

		let passed = 0;
		let failed = 0;

		for (const route of allPages) {
			try {
				await page.goto(route);
				await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
				passed++;
			} catch {
				failed++;
			}
		}

		// All pages should load
		expect(failed).toBe(0);
		expect(passed).toBe(allPages.length);
	});
});
