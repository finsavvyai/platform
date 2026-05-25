/**
 * Accessibility audit via axe-core.
 *
 * Scans pages for WCAG 2.1 AA violations using the same engine as Lighthouse
 * + browser DevTools. Fails the suite when issues are found.
 *
 * Run:
 *   BASE_URL=https://app.tenantiq.app npx playwright test tests/e2e/pwa-a11y.spec.ts --project=chromium
 *
 * To allow specific known violations: add their rule ID to the disable list.
 * Don't disable a rule unless you've documented WHY (e.g. third-party iframe).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL || 'https://app.tenantiq.app';

test.describe('a11y — WCAG 2.1 AA', () => {
	test('landing page has no critical/serious violations', async ({ page }) => {
		await page.goto(BASE, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500); // hydration

		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		const blocking = results.violations.filter((v) =>
			v.impact === 'critical' || v.impact === 'serious',
		);

		if (blocking.length > 0) {
			console.log('=== a11y violations ===');
			for (const v of blocking) {
				console.log(`[${v.impact}] ${v.id}: ${v.description}`);
				console.log(`  affects ${v.nodes.length} node(s)`);
				console.log(`  help: ${v.helpUrl}`);
			}
		}

		expect(blocking, blocking.map((v) => `${v.id}: ${v.description}`).join('\n')).toEqual([]);
	});

	test('offline page has no critical/serious violations', async ({ page }) => {
		await page.goto(`${BASE}/offline/`, { waitUntil: 'domcontentloaded' });
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa'])
			.analyze();

		const blocking = results.violations.filter((v) =>
			v.impact === 'critical' || v.impact === 'serious',
		);
		expect(blocking, blocking.map((v) => `${v.id}: ${v.description}`).join('\n')).toEqual([]);
	});
});
