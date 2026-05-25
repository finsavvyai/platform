/**
 * PWA rendering tests — real browser, real network.
 *
 * Verifies the things that HTTP probes can't:
 *  - Service worker actually registers in the browser
 *  - Manifest is parseable and has expected fields
 *  - Offline page renders the polished UI when accessed directly
 *  - Network status toast appears on offline → online transition
 *  - "Sign in with passkey" button shows on landing when WebAuthn supported
 *  - iOS install hint shows when Safari user agent + iOS detected
 *
 * Cannot test:
 *  - Real biometric prompts (TouchID/FaceID can't be scripted)
 *  - Push delivery (needs real APNs/FCM round-trip)
 *  - Android beforeinstallprompt (Chromium fires it after engagement heuristics
 *    that headless Playwright doesn't satisfy)
 *
 * Run:
 *   BASE_URL=https://app.tenantiq.app npx playwright test tests/e2e/pwa-rendering.spec.ts
 *   # or local: npm run dev (web) → BASE_URL=http://localhost:5173 npx playwright test ...
 */
import { test, expect, devices } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://app.tenantiq.app';

test.describe('PWA — manifest', () => {
	test('manifest.json reachable and has required fields', async ({ request }) => {
		const res = await request.get(`${BASE}/manifest.json`);
		expect(res.status()).toBe(200);
		const m = await res.json();
		expect(m.name).toBeTruthy();
		expect(m.short_name).toBeTruthy();
		expect(m.start_url).toBeTruthy();
		expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(m.display);
		expect(m.theme_color).toMatch(/^#[0-9a-f]{3,8}$/i);
		expect(Array.isArray(m.icons)).toBe(true);
		expect(m.icons.length).toBeGreaterThan(0);
		// Maskable icon required for Android adaptive icon
		const hasMaskable = m.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable'));
		expect(hasMaskable).toBe(true);
	});
});

test.describe('PWA — service worker', () => {
	test('sw.js reachable with v3 markers + push handler + sync handler', async ({ request }) => {
		const res = await request.get(`${BASE}/sw.js`);
		expect(res.status()).toBe(200);
		const body = await res.text();
		expect(body).toContain("VERSION = 'tenantiq-v3");
		expect(body).toContain("addEventListener('push'");
		expect(body).toContain("addEventListener('sync'");
		expect(body).toContain('tenantiq-action-queue');
	});

	test('SW registers in browser', async ({ page }) => {
		await page.goto(BASE);
		// SW registration is async; wait up to 5s.
		const registered = await page.waitForFunction(async () => {
			if (!('serviceWorker' in navigator)) return false;
			const reg = await navigator.serviceWorker.getRegistration();
			return reg !== undefined && reg.active !== null;
		}, { timeout: 10_000 }).then(() => true).catch(() => false);
		expect(registered).toBe(true);
	});
});

test.describe('PWA — offline page', () => {
	test('/offline/ returns polished UI', async ({ page }) => {
		await page.goto(`${BASE}/offline/`);
		await expect(page.locator('h1')).toContainText("offline", { ignoreCase: true });
		await expect(page.locator('button.btn-primary')).toBeVisible();
		await expect(page.locator('button.btn-secondary')).toBeVisible();
		// Queue info hidden by default (no queued actions in fresh test)
		const queueDisplay = await page.locator('#queue-info').evaluate((el) => getComputedStyle(el).display);
		expect(queueDisplay).toBe('none');
	});

	test('retry button reloads page', async ({ page }) => {
		await page.goto(`${BASE}/offline/`);
		const retry = page.locator('button.btn-primary');
		await expect(retry).toBeVisible();
		// Click → should attempt navigation. We can't easily assert reload but we can verify the click is wired.
		await expect(retry).toHaveAttribute('onclick', /retry\(\)/);
	});
});

test.describe('PWA — network status toast', () => {
	test('shows offline toast when context is offline', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(BASE, { waitUntil: 'domcontentloaded' });
		// Give Svelte time to hydrate + onMount handlers to attach.
		await page.waitForTimeout(2_000);
		await context.setOffline(true);
		await page.evaluate(() => window.dispatchEvent(new Event('offline')));
		const toast = page.locator('.net-toast-offline');
		await expect(toast).toBeVisible({ timeout: 5_000 });
		await expect(toast).toContainText(/offline/i);
		await context.close();
	});

	test('shows reconnected toast on online transition', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(BASE, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(2_000);
		await page.evaluate(() => window.dispatchEvent(new Event('online')));
		const toast = page.locator('.net-toast-online');
		await expect(toast).toBeVisible({ timeout: 5_000 });
		await expect(toast).toContainText(/online/i);
		await context.close();
	});
});

test.describe('PWA — landing page passkey button', () => {
	test('shows when WebAuthn supported', async ({ page }) => {
		// Most modern browsers (incl Chromium) support WebAuthn. The component
		// also calls platformAuthenticatorIsAvailable() which CAN return false
		// in headless. Override to true so the button renders deterministically.
		await page.addInitScript(() => {
			(window as { PublicKeyCredential?: unknown }).PublicKeyCredential = class {
				static isUserVerifyingPlatformAuthenticatorAvailable() { return Promise.resolve(true); }
			};
		});
		await page.goto(BASE);
		const passkey = page.locator('button.btn-passkey');
		await expect(passkey).toBeVisible({ timeout: 5_000 });
		await expect(passkey).toContainText(/passkey/i);
	});
});

test.describe('PWA — iOS install hint', () => {
	test('shows on iOS Safari user agent (not standalone)', async ({ browser }) => {
		const context = await browser.newContext({
			...devices['iPhone 14 Pro'],
			// iPhone Pro device descriptor uses Mobile Safari UA — ideal for our isIos+isSafari check.
		});
		const page = await context.newPage();
		await page.goto(BASE);
		// IosInstallHint has a 2.5s delay before showing.
		const hint = page.getByText('Install TenantIQ for a better experience');
		await expect(hint).toBeVisible({ timeout: 8_000 });
		await context.close();
	});

	test('hidden on desktop Chrome', async ({ page }) => {
		await page.goto(BASE);
		// Wait past the 2.5s show delay
		await page.waitForTimeout(3_500);
		const hint = page.getByText('Install TenantIQ for a better experience');
		await expect(hint).not.toBeVisible();
	});
});
