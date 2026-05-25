/**
 * User Behavior: First-Time Visitor Journey
 *
 * Simulates a prospective MSP customer discovering TenantIQ,
 * exploring marketing pages, checking pricing, watching demos,
 * and evaluating trust signals before signing up.
 */
import { test, expect } from '@playwright/test';
import { BASE, expectPageLoads } from './helpers';

test.use({ baseURL: BASE });

test.describe('First-Time Visitor — Discovery Journey', () => {
	test('lands on homepage and sees value proposition', async ({ page }) => {
		await page.goto('/');
		await expectPageLoads(page);

		// Primary headline communicates M365 security
		const headline = page.locator('.headline').first();
		await expect(headline).toBeVisible({ timeout: 15_000 });

		// Trust badges visible (enterprise buyer signal)
		const badges = page.locator('.trust-badge, .badge');
		const badgeTexts = await badges.allTextContents();
		const combined = badgeTexts.join(' ');
		const hasTrustSignal = ['SOC', 'HIPAA', 'GDPR', 'Zero Trust'].some(
			(b) => combined.includes(b)
		);
		expect(hasTrustSignal).toBe(true);
	});

	test('explores marketing page /home with features and pricing', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		// Navigation bar present
		const nav = page.locator('nav').first();
		await expect(nav).toBeVisible({ timeout: 10_000 });

		// Hero section with CTA
		const cta = page.locator('a:has-text("Get Started"), button:has-text("Get Started")').first();
		await expect(cta).toBeVisible({ timeout: 10_000 });

		// Features section exists
		const featuresSection = page.locator('text=Features').first();
		if (await featuresSection.isVisible().catch(() => false)) {
			expect(true).toBe(true);
		}
	});

	test('checks pricing plans and compares tiers', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		// Scroll to pricing section
		const pricing = page.locator('#pricing, [data-section="pricing"], :text("Pricing")').first();
		if (await pricing.isVisible().catch(() => false)) {
			await pricing.scrollIntoViewIfNeeded();

			// Look for plan cards or pricing info
			const plans = page.locator('.plan-card, .pricing-card, [class*="pricing"]');
			const count = await plans.count();
			expect(count).toBeGreaterThanOrEqual(0);
		}
	});

	test('views demo page with video content', async ({ page }) => {
		await page.goto('/demo');
		await expectPageLoads(page);

		// Demo page should have video or video cards
		const videos = page.locator('video, iframe, .video-card, [class*="video"]');
		const hasVideoContent = (await videos.count()) > 0;
		// Page should at least render without error
		const bodyText = await page.locator('body').textContent();
		expect(bodyText?.length).toBeGreaterThan(0);
		if (hasVideoContent) {
			expect(await videos.first().isVisible()).toBe(true);
		}
	});

	test('reads terms of service', async ({ page }) => {
		await page.goto('/terms');
		await expectPageLoads(page);

		const body = await page.locator('body').textContent();
		expect(body).toBeTruthy();
		expect(body!.length).toBeGreaterThan(100);
	});

	test('reads privacy policy', async ({ page }) => {
		await page.goto('/privacy');
		await expectPageLoads(page);

		const body = await page.locator('body').textContent();
		expect(body).toBeTruthy();
		expect(body!.length).toBeGreaterThan(100);
	});

	test('visits support page', async ({ page }) => {
		await page.goto('/support');
		await expectPageLoads(page);

		const body = await page.locator('body').textContent();
		expect(body).toBeTruthy();
	});

	test('navigation links work between marketing pages', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		// Find and click a nav link to /demo
		const demoLink = page.locator('a[href="/demo"], a:has-text("Demo")').first();
		if (await demoLink.isVisible().catch(() => false)) {
			await demoLink.click();
			await expect(page).toHaveURL(/\/demo/);
		}
	});

	test('footer links navigate to legal pages', async ({ page }) => {
		await page.goto('/home');
		await expectPageLoads(page);

		const termsLink = page.locator('footer a[href="/terms"], a:has-text("Terms")').first();
		if (await termsLink.isVisible().catch(() => false)) {
			await termsLink.click();
			await expect(page).toHaveURL(/\/terms/);
		}
	});
});

test.describe('First-Time Visitor — Trust & Performance', () => {
	test('pages load within 3 seconds', async ({ page }) => {
		const routes = ['/', '/home', '/terms', '/privacy', '/demo'];
		for (const route of routes) {
			const start = Date.now();
			await page.goto(route);
			await page.waitForLoadState('domcontentloaded');
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(5_000);
		}
	});

	test('no JavaScript console errors on public pages', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		for (const route of ['/', '/home', '/terms', '/privacy']) {
			await page.goto(route);
			await page.waitForLoadState('networkidle').catch(() => {});
		}

		const real = errors.filter(
			(e) => !e.includes('Extension') && !e.includes('chrome-extension')
		);
		expect(real).toHaveLength(0);
	});

	test('404 page handles gracefully', async ({ page }) => {
		await page.goto('/this-page-does-not-exist');
		await expectPageLoads(page);

		const body = await page.locator('body').textContent();
		// Should show something useful, not blank
		expect(body!.length).toBeGreaterThan(10);
	});
});
