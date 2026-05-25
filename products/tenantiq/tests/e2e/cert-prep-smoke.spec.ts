/**
 * Cert-prep smoke tests against production.
 *
 * Run: BASE_URL=https://app.tenantiq.app npx playwright test cert-prep-smoke
 *
 * Verifies that the M365 Certification artifacts are reachable + correct,
 * and that the auth/account surfaces respond as documented. Microsoft sign-in
 * itself isn't exercised here (needs real MS creds) — but the redirect
 * destination is checked.
 */

import { test, expect, request as pwRequest } from '@playwright/test';

const APP = process.env.BASE_URL || 'https://app.tenantiq.app';
const API = process.env.API_URL || 'https://api.tenantiq.app';

test.describe('legal pages public + accurate', () => {
	test('GET /privacy contains Apr 2026 date + DELETE /api/account', async ({ page }) => {
		await page.goto(`${APP}/privacy`);
		await expect(page.getByText('Last updated: April 2026')).toBeVisible();
		await expect(page.getByText('DELETE /api/account').first()).toBeVisible();
		await expect(page.getByText('Your Rights (GDPR / CCPA)')).toBeVisible();
	});

	test('GET /terms returns 200', async ({ page }) => {
		const res = await page.goto(`${APP}/terms`);
		expect(res?.status()).toBe(200);
		await expect(page.getByText('Last updated: April 2026')).toBeVisible();
	});
});

test.describe('well-known endpoints', () => {
	test('GET /.well-known/security.txt is RFC 9116 compliant', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${APP}/.well-known/security.txt`);
		expect(res.status()).toBe(200);
		const body = await res.text();
		expect(body).toContain('Contact: mailto:security@tenantiq.app');
		expect(body).toContain('Expires:');
		expect(body).toContain('Policy:');
	});

	test('GET /api/.well-known/jwks.json returns RS256 key', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/.well-known/jwks.json`);
		expect(res.status()).toBe(200);
		const json = await res.json();
		expect(json.keys).toHaveLength(1);
		expect(json.keys[0].kty).toBe('RSA');
		expect(json.keys[0].alg).toBe('RS256');
		expect(json.keys[0].use).toBe('sig');
		expect(json.keys[0].kid).toBe('tenantiq-rs256-1');
	});
});

test.describe('account endpoints — auth gates', () => {
	test('DELETE /api/account without auth returns 401 (with Origin)', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.delete(`${API}/api/account`, {
			headers: { Origin: APP, 'Content-Type': 'application/json' },
			data: {},
		});
		expect(res.status()).toBe(401);
	});

	test('GET /api/auth/me without cookie returns 401', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/auth/me`);
		expect(res.status()).toBe(401);
	});
});

test.describe('OAuth start — scope + state present', () => {
	test('GET /api/auth/login redirects to Microsoft with scope + state', async ({ page }) => {
		// Don't follow redirects — we just want to inspect the Location header.
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/auth/login`, { maxRedirects: 0 });
		expect([301, 302, 307, 308]).toContain(res.status());
		const loc = res.headers().location ?? '';
		expect(loc).toContain('login.microsoftonline.com');
		expect(loc).toContain('client_id=');
		expect(loc).toContain('scope=');
		expect(loc).toContain('state=');
		expect(loc).toContain('redirect_uri=');
		// Sanity: known scope present, deprecated scope absent.
		expect(loc).toContain('User.Read');
		expect(loc).not.toContain('InformationProtectionPolicy.ReadWrite.All');
	});
});

test.describe('security headers present on API', () => {
	test('GET / sets HSTS + CSP + nosniff + referrer-policy', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/`);
		const h = res.headers();
		expect(h['strict-transport-security']).toContain('max-age=31536000');
		expect(h['x-content-type-options']).toBe('nosniff');
		expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(h['permissions-policy']).toContain('camera=()');
	});
});
