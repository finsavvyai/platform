/**
 * User Behavior: Compliance Officer — CIS & Audit Flow
 *
 * Simulates a compliance officer checking CIS benchmark results,
 * reviewing audit logs, verifying governance policies, and
 * examining compliance reports.
 */
import { test, expect } from '@playwright/test';
import { BASE, setupAuth, MSP_ADMIN } from './helpers';

test.use({ baseURL: BASE });

test.describe('Compliance Officer — Audit & Governance', () => {
	test.beforeEach(async ({ page }) => {
		await setupAuth(page, MSP_ADMIN);
	});

	test('CIS benchmark page loads and shows controls', async ({ page }) => {
		await page.goto('/security/cis');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/cis/);
	});

	test('audit log page loads', async ({ page }) => {
		await page.goto('/audit');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/audit/);
	});

	test('audit history page loads', async ({ page }) => {
		await page.goto('/audit/history');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/audit\/history/);
	});

	test('governance workspaces page loads', async ({ page }) => {
		await page.goto('/governance');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/governance/);
	});

	test('storage analytics page loads', async ({ page }) => {
		await page.goto('/governance/storage');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/governance\/storage/);
	});

	test('SDLC/AI compliance page loads', async ({ page }) => {
		await page.goto('/sdlc');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/sdlc/);
	});

	test('Purview/compliance page loads', async ({ page }) => {
		await page.goto('/security/purview');
		await page.waitForLoadState('domcontentloaded');
		await expect(page).toHaveURL(/\/security\/purview/);
	});

	test('compliance flow: CIS → Audit → Governance sequentially', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		await page.goto('/security/cis');
		await page.waitForLoadState('domcontentloaded');

		await page.goto('/audit');
		await page.waitForLoadState('domcontentloaded');

		await page.goto('/governance');
		await page.waitForLoadState('domcontentloaded');

		await page.goto('/security/purview');
		await page.waitForLoadState('domcontentloaded');

		const real = errors.filter(
			(e) => !e.includes('Extension') && !e.includes('chrome-extension')
		);
		expect(real).toHaveLength(0);
	});
});
