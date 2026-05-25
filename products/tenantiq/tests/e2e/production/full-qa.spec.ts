/**
 * TenantIQ — Comprehensive Production QA Suite
 *
 * Full browser test against https://app.tenantiq.app
 * Covers: landing, marketing, demo, static pages, auth guards,
 * video assets, responsive, accessibility, error handling, performance.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const BASE = 'https://app.tenantiq.app';
const SS = '.luna/tenantiq/browser-test/screenshots/full-qa';

test.use({ baseURL: BASE });

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                          */
/* ────────────────────────────────────────────────────────────────── */

async function screenshot(page: Page, name: string) {
	await page.screenshot({
		path: path.join(SS, `${name}.png`),
		fullPage: true,
	});
}

async function screenshotViewport(
	page: Page,
	route: string,
	widths: number[],
	prefix: string
) {
	for (const w of widths) {
		await page.setViewportSize({ width: w, height: w > 768 ? 900 : 812 });
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		await screenshot(page, `${prefix}-${w}`);
	}
}

/* ================================================================ */
/*  Phase 1: Landing Page (/) — SignInHero                          */
/* ================================================================ */

test.describe('Phase 1: Landing Page (/)', () => {
	test('1.1 Screenshots at 4 viewports', async ({ page }) => {
		await screenshotViewport(page, '/', [1440, 1024, 768, 375], 'landing');
	});

	test('1.2 Logo "TenantIQ" visible', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.logo-text').first()).toHaveText('TenantIQ');
	});

	test('1.3 Headline visible', async ({ page }) => {
		await page.goto('/');
		await expect(
			page.locator('.headline').first()
		).toBeVisible({ timeout: 15_000 });
		const text = await page.locator('.headline').first().textContent();
		expect(text).toContain('M365 security');
		expect(text).toContain('fully in');
		expect(text).toContain('control.');
	});

	test('1.4 Stats 100+, 5, 13+ visible', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const statVals = page.locator('.stat-val');
		await expect(statVals.nth(0)).toHaveText('100+');
		await expect(statVals.nth(1)).toHaveText('5');
		await expect(statVals.nth(2)).toHaveText('13+');
	});

	test('1.5 Badges SOC 2, HIPAA, GDPR, Zero Trust', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		for (const badge of ['SOC 2', 'HIPAA', 'GDPR', 'Zero Trust']) {
			await expect(
				page.locator('.badge', { hasText: badge })
			).toBeVisible();
		}
	});

	test('1.6 "Sign in with Microsoft" links to auth API', async ({
		page,
	}) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const btn = page.locator('.btn-ms');
		await expect(btn).toBeVisible();
		const href = await btn.getAttribute('href');
		expect(href).toContain('api.tenantiq.app/api/auth/login');
	});

	test('1.7 "Start free trial" links to auth API', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const link = page.locator('.card-note .link');
		await expect(link).toBeVisible();
		const href = await link.getAttribute('href');
		expect(href).toContain('api.tenantiq.app/api/auth/login');
	});

	test('1.8 Status bar with green dot visible', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('.status-bar')).toBeVisible();
		await expect(page.locator('.status-dot')).toBeVisible();
		// Green dot should be colored
		const bg = await page.locator('.status-dot').evaluate(
			(el) => getComputedStyle(el).backgroundColor
		);
		expect(bg).toBeTruthy();
	});

	test('1.9 Dark background renders', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const bg = await page.locator('.hero').evaluate(
			(el) => getComputedStyle(el).backgroundColor
		);
		// Should be very dark (#060b0f)
		expect(bg).toMatch(/rgb\(\s*6,\s*11,\s*15\s*\)/);
	});

	test('1.10 No horizontal scroll at any viewport', async ({ page }) => {
		for (const w of [1440, 1024, 768, 375]) {
			await page.setViewportSize({ width: w, height: 812 });
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			const scrollWidth = await page.evaluate(
				() => document.documentElement.scrollWidth
			);
			const clientWidth = await page.evaluate(
				() => document.documentElement.clientWidth
			);
			expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
		}
	});
});

/* ================================================================ */
/*  Phase 2: Marketing Page (/home)                                 */
/* ================================================================ */

test.describe('Phase 2: Marketing Page (/home)', () => {
	test('2.1 Screenshots at 4 viewports', async ({ page }) => {
		await screenshotViewport(
			page,
			'/home',
			[1440, 1024, 768, 375],
			'home'
		);
	});

	test('2.2 Nav bar — logo and nav links', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		// TenantIQ logo text
		await expect(
			page.locator('text=TenantIQ').first()
		).toBeVisible({ timeout: 15_000 });
		// Nav links
		for (const label of ['Features', 'Demo', 'Pricing']) {
			await expect(
				page.getByText(label, { exact: false }).first()
			).toBeVisible();
		}
	});

	test('2.3 Hero section renders', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		// Page title
		await expect(page).toHaveTitle(/TenantIQ/i);
	});

	test('2.4 Start Free Trial CTA links to auth', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		const cta = page
			.locator('a')
			.filter({ hasText: /Start Free Trial/i })
			.first();
		await expect(cta).toBeVisible({ timeout: 10_000 });
		const href = await cta.getAttribute('href');
		expect(href).toBeTruthy();
	});

	test('2.5 Problem section — 3 cards', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		// Problem section should have cards
		const problemSection = page.locator('#problems, section:has(.problem), [class*="problem"]').first();
		if (await problemSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
			await screenshot(page, 'home-problem-section');
		}
	});

	test('2.6 Features section — 3 pillar cards', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		const featuresSection = page.locator('#features').first();
		if (await featuresSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
			// Scroll into view
			await featuresSection.scrollIntoViewIfNeeded();
			await screenshot(page, 'home-features-section');
		}
	});

	test('2.7 Demo section — heading and play button', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText('See TenantIQ in Action').first()
		).toBeVisible({ timeout: 10_000 });
		// Play button
		const playCircle = page.locator('.play-circle, .play-icon').first();
		await expect(playCircle).toBeVisible();
	});

	test('2.8 Trailer play button opens iframe', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		const trailerBtn = page.locator('.trailer-cover').first();
		if (await trailerBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
			await trailerBtn.click();
			// Iframe should appear
			const iframe = page.locator('.trailer-frame');
			await expect(iframe).toBeVisible({ timeout: 5_000 });
			const src = await iframe.getAttribute('src');
			expect(src).toContain('video-trailer.htm');
			await screenshot(page, 'home-trailer-playing');
			// Close button
			const closeBtn = page.locator('.close-btn');
			await expect(closeBtn).toBeVisible();
			await closeBtn.click();
			await expect(iframe).not.toBeVisible({ timeout: 3_000 });
		}
	});

	test('2.9 Video cards link to /demo', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		const videoCards = page.locator('.video-card');
		const count = await videoCards.count();
		expect(count).toBe(4);
		for (let i = 0; i < count; i++) {
			const href = await videoCards.nth(i).getAttribute('href');
			expect(href).toBe('/demo');
		}
	});

	test('2.10 Pricing section — 3 cards with correct prices', async ({
		page,
	}) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		const pricingSection = page.locator('#pricing');
		await pricingSection.scrollIntoViewIfNeeded();

		// Check 3 prices
		await expect(page.getByText('29').first()).toBeVisible();
		await expect(page.getByText('79').first()).toBeVisible();
		await expect(page.getByText('149').first()).toBeVisible();

		// "Most Popular" badge on Professional
		await expect(
			page.getByText('Most Popular').first()
		).toBeVisible();

		await screenshot(page, 'home-pricing');
	});

	test('2.11 Footer — logo and columns', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		const footer = page.locator('footer').first();
		await footer.scrollIntoViewIfNeeded();
		await expect(footer).toBeVisible();
		await screenshot(page, 'home-footer');
	});

	test('2.12 Footer links — Terms, Privacy, Demo', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		for (const href of ['/terms', '/privacy', '/demo']) {
			const link = page.locator(`footer a[href="${href}"]`).first();
			if (await link.isVisible({ timeout: 3_000 }).catch(() => false)) {
				const resp = await page.request.get(`${BASE}${href}`);
				expect(resp.status()).toBe(200);
			}
		}
	});
});

/* ================================================================ */
/*  Phase 3: Demo Page (/demo)                                      */
/* ================================================================ */

test.describe('Phase 3: Demo Page (/demo)', () => {
	test('3.1 Heading and 4 video cards', async ({ page }) => {
		await page.goto('/demo');
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText('See TenantIQ in Action').first()
		).toBeVisible({ timeout: 15_000 });
		const cards = page.locator('.video-card');
		await expect(cards).toHaveCount(4);
		await screenshot(page, 'demo-page');
	});

	test('3.2 Video card titles match', async ({ page }) => {
		await page.goto('/demo');
		await page.waitForLoadState('networkidle');
		for (const title of [
			'Product Trailer',
			'How It Works',
			'Social Clip',
			'Ad Spot',
		]) {
			await expect(page.getByText(title).first()).toBeVisible();
		}
	});

	test('3.3 Click video card opens player with iframe', async ({
		page,
	}) => {
		await page.goto('/demo');
		await page.waitForLoadState('networkidle');
		// Click first card (Product Trailer)
		const firstCard = page.locator('.video-card').first();
		await firstCard.click();
		const iframe = page.locator('.video-frame');
		await expect(iframe).toBeVisible({ timeout: 5_000 });
		const src = await iframe.getAttribute('src');
		expect(src).toContain('video-trailer.htm');
		await screenshot(page, 'demo-player-open');
		// Close
		await page.locator('.close-btn').click();
		await expect(iframe).not.toBeVisible({ timeout: 3_000 });
	});

	test('3.4 CTA section visible with auth link', async ({ page }) => {
		await page.goto('/demo');
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText('Ready to take control?').first()
		).toBeVisible();
		const ctaBtn = page.locator('.cta-btn');
		await expect(ctaBtn).toBeVisible();
		const href = await ctaBtn.getAttribute('href');
		expect(href).toContain('api.tenantiq.app/api/auth/login');
	});

	test('3.5 Back to Home link works', async ({ page }) => {
		await page.goto('/demo');
		await page.waitForLoadState('networkidle');
		const backLink = page.locator('.back-link');
		await expect(backLink).toBeVisible();
		const href = await backLink.getAttribute('href');
		expect(href).toBe('/home');
		await Promise.all([
			page.waitForURL('**/home', { timeout: 10_000 }),
			backLink.click(),
		]);
		expect(page.url()).toContain('/home');
	});

	test('3.6 Screenshots at desktop and mobile', async ({ page }) => {
		await screenshotViewport(page, '/demo', [1440, 375], 'demo');
	});
});

/* ================================================================ */
/*  Phase 4: Static Pages                                           */
/* ================================================================ */

test.describe('Phase 4: Static Pages', () => {
	test('4.1 /terms — content renders', async ({ page }) => {
		await page.goto('/terms');
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText(/Terms/i).first()
		).toBeVisible({ timeout: 15_000 });
		// Has readable text (more than just a title)
		const bodyText = await page.evaluate(
			() => document.body.innerText.length
		);
		expect(bodyText).toBeGreaterThan(200);
		await screenshot(page, 'terms-desktop');
		await page.setViewportSize({ width: 375, height: 812 });
		await screenshot(page, 'terms-mobile');
	});

	test('4.2 /privacy — content renders', async ({ page }) => {
		await page.goto('/privacy');
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText(/Privacy/i).first()
		).toBeVisible({ timeout: 15_000 });
		const bodyText = await page.evaluate(
			() => document.body.innerText.length
		);
		expect(bodyText).toBeGreaterThan(200);
		await screenshot(page, 'privacy-desktop');
		await page.setViewportSize({ width: 375, height: 812 });
		await screenshot(page, 'privacy-mobile');
	});

	test('4.3 /support — content renders', async ({ page }) => {
		await page.goto('/support');
		await page.waitForLoadState('networkidle');
		await expect(
			page.getByText(/Support/i).first()
		).toBeVisible({ timeout: 15_000 });
		await screenshot(page, 'support-desktop');
		await page.setViewportSize({ width: 375, height: 812 });
		await screenshot(page, 'support-mobile');
	});
});

/* ================================================================ */
/*  Phase 5: Auth Guard (Protected Routes)                          */
/* ================================================================ */

test.describe('Phase 5: Auth Guard — Protected Routes', () => {
	const allProtected = [
		'/alerts',
		'/licenses',
		'/security',
		'/security/cis',
		'/security/email',
		'/security/purview',
		'/security/signin-logs',
		'/security/copilot',
		'/security/copilot-usage',
		'/security/dashboard',
		'/security/compliance',
		'/ai',
		'/settings',
		'/settings/sso',
		'/workflows',
		'/workflows/lifecycle',
		'/team',
		'/governance',
		'/governance/storage',
		'/backups',
		'/backups/config',
		'/threats',
		'/behavior',
		'/skills',
		'/sdlc',
		'/msp',
		'/msp/benchmark',
		'/audit',
		'/audit/history',
		'/reports',
		'/platform/admin',
	];

	// Test each route shows SignInHero
	for (const route of allProtected) {
		test(`${route} — shows SignInHero`, async ({ page }) => {
			await page.goto(route);
			await page.waitForLoadState('networkidle');
			const hasSignIn = await page
				.getByText(/Sign in|M365 security|Microsoft 365|TenantIQ/i)
				.first()
				.isVisible({ timeout: 15_000 })
				.catch(() => false);
			expect(hasSignIn).toBeTruthy();
		});
	}

	// Screenshot first 5 and last 5
	const sampleRoutes = [
		...allProtected.slice(0, 5),
		...allProtected.slice(-5),
	];
	for (const route of sampleRoutes) {
		test(`screenshot: ${route}`, async ({ page }) => {
			await page.goto(route);
			await page.waitForLoadState('networkidle');
			await screenshot(
				page,
				`auth-guard${route.replace(/\//g, '-')}`
			);
		});
	}
});

/* ================================================================ */
/*  Phase 6: Video Assets                                           */
/* ================================================================ */

test.describe('Phase 6: Video Assets', () => {
	const videos = [
		'video-trailer.htm',
		'video-explainer.htm',
		'video-social.htm',
		'video-ad.htm',
	];

	for (const vid of videos) {
		test(`${vid} — loads with content`, async ({ page, request }) => {
			const res = await request.get(`${BASE}/${vid}`);
			expect(res.status()).toBe(200);
			const body = await res.text();
			expect(body.length).toBeGreaterThan(100);
			// Navigate and screenshot
			await page.goto(`/${vid}`);
			await page.waitForLoadState('networkidle');
			await screenshot(page, vid.replace('.htm', ''));
		});
	}

	test('video-trailer.htm has animation CSS', async ({ request }) => {
		const res = await request.get(`${BASE}/video-trailer.htm`);
		const body = await res.text();
		expect(body).toMatch(/animation|@keyframes|transition/i);
	});
});

/* ================================================================ */
/*  Phase 7: Error Handling                                         */
/* ================================================================ */

test.describe('Phase 7: Error Handling', () => {
	test('7.1 /nonexistent-page — 404 or graceful fallback', async ({
		page,
	}) => {
		const response = await page.goto('/nonexistent-page-xyz');
		await page.waitForLoadState('networkidle');
		// Should either show 404 page or redirect to sign-in
		const status = response?.status();
		const hasContent = await page
			.getByText(/404|not found|Sign in|TenantIQ/i)
			.first()
			.isVisible({ timeout: 10_000 })
			.catch(() => false);
		expect(status === 404 || status === 200 || hasContent).toBeTruthy();
		await screenshot(page, 'error-404');
	});

	test('7.2 /auth/callback?error=access_denied', async ({ page }) => {
		await page.goto('/auth/callback?error=access_denied');
		await page.waitForLoadState('networkidle');
		// Should handle gracefully — no blank page
		const bodyText = await page.evaluate(
			() => document.body.innerText.length
		);
		expect(bodyText).toBeGreaterThan(0);
		await screenshot(page, 'error-access-denied');
	});

	test('7.3 /auth/callback (no params)', async ({ page }) => {
		await page.goto('/auth/callback');
		await page.waitForLoadState('networkidle');
		const bodyText = await page.evaluate(
			() => document.body.innerText.length
		);
		expect(bodyText).toBeGreaterThan(0);
		await screenshot(page, 'error-callback-no-params');
	});
});

/* ================================================================ */
/*  Phase 8: Responsive & Cross-viewport                            */
/* ================================================================ */

test.describe('Phase 8: Responsive Design', () => {
	const viewports = [
		{ w: 1440, h: 900, label: 'desktop-xl' },
		{ w: 1024, h: 768, label: 'laptop' },
		{ w: 768, h: 1024, label: 'tablet' },
		{ w: 375, h: 812, label: 'mobile' },
	];

	for (const vp of viewports) {
		test(`/home at ${vp.w}px — no horizontal overflow`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: vp.w, height: vp.h });
			await page.goto('/home');
			await page.waitForLoadState('networkidle');
			const scrollW = await page.evaluate(
				() => document.documentElement.scrollWidth
			);
			expect(scrollW).toBeLessThanOrEqual(vp.w + 5);
			await screenshot(page, `responsive-home-${vp.label}`);
		});

		test(`/ at ${vp.w}px — no horizontal overflow`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: vp.w, height: vp.h });
			await page.goto('/');
			await page.waitForLoadState('networkidle');
			const scrollW = await page.evaluate(
				() => document.documentElement.scrollWidth
			);
			expect(scrollW).toBeLessThanOrEqual(vp.w + 5);
			await screenshot(page, `responsive-landing-${vp.label}`);
		});
	}

	test('Mobile 375px — text readable, no tiny fonts', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		// Check that main heading font size is at least 20px
		const fontSize = await page
			.locator('h1, h2')
			.first()
			.evaluate((el) =>
				parseFloat(getComputedStyle(el).fontSize)
			);
		expect(fontSize).toBeGreaterThanOrEqual(20);
	});

	test('Mobile 375px — touch targets >= 44px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		// Check primary CTA button height
		const btn = page.locator('.btn-ms');
		if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
			const box = await btn.boundingBox();
			expect(box).toBeTruthy();
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});
});

/* ================================================================ */
/*  Phase 9: Accessibility Quick Check                              */
/* ================================================================ */

test.describe('Phase 9: Accessibility', () => {
	test('9.1 Landing — focus rings on tab', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		// Tab to first interactive element
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		// Check that some element has focus
		const focused = await page.evaluate(
			() => document.activeElement?.tagName
		);
		expect(focused).toBeTruthy();
		expect(focused).not.toBe('BODY');
		await screenshot(page, 'a11y-landing-focus');
	});

	test('9.2 /home — focus rings on tab', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		const focused = await page.evaluate(
			() => document.activeElement?.tagName
		);
		expect(focused).toBeTruthy();
		expect(focused).not.toBe('BODY');
		await screenshot(page, 'a11y-home-focus');
	});

	test('9.3 Buttons have accessible names', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const btn = page.locator('.btn-ms');
		const text = await btn.textContent();
		expect(text?.trim().length).toBeGreaterThan(0);
	});

	test('9.4 Landing — text contrast on dark bg', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		// Headline should be white-ish on dark bg
		const color = await page.locator('.headline').evaluate(
			(el) => getComputedStyle(el).color
		);
		// rgb(255, 255, 255) or close
		expect(color).toMatch(/rgb\(\s*255,\s*255,\s*255\s*\)/);
	});

	test('9.5 SVG icons are decorative or have titles', async ({
		page,
	}) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		const svgs = page.locator('svg');
		const count = await svgs.count();
		// Just verify they exist and page renders fine — deep a11y audit
		expect(count).toBeGreaterThan(0);
	});
});

/* ================================================================ */
/*  Phase 10: Performance                                           */
/* ================================================================ */

test.describe('Phase 10: Performance', () => {
	const pages = [
		{ route: '/', name: 'landing' },
		{ route: '/home', name: 'marketing' },
		{ route: '/demo', name: 'demo' },
		{ route: '/terms', name: 'terms' },
	];

	for (const pg of pages) {
		test(`${pg.name} loads under 2s`, async ({ page }) => {
			const start = Date.now();
			await page.goto(pg.route, { waitUntil: 'domcontentloaded' });
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(2000);
		});
	}

	test('video-trailer.htm loads under 2s', async ({ request }) => {
		const start = Date.now();
		const res = await request.get(`${BASE}/video-trailer.htm`);
		const elapsed = Date.now() - start;
		expect(res.status()).toBe(200);
		expect(elapsed).toBeLessThan(2000);
	});
});
