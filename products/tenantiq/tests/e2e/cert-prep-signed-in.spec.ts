/**
 * Authenticated cert-prep checks — drives a real Microsoft sign-in.
 *
 * Run *headed* and complete the sign-in interactively when the page opens.
 * The script saves the resulting cookie session to .auth/tenantiq.json so
 * subsequent runs reuse it (until cookie expiry).
 *
 *   PLAYWRIGHT_HEADED=1 npx playwright test cert-prep-signed-in --project=chromium
 *
 * Reuse a saved session:
 *   npx playwright test cert-prep-signed-in --project=chromium
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP = process.env.BASE_URL || 'https://app.tenantiq.app';
const API = process.env.API_URL || 'https://api.tenantiq.app';
const AUTH_STATE = path.resolve('.auth/tenantiq.json');

test.describe.configure({ mode: 'serial' });

test('F1 — sign in with Microsoft, land on dashboard', async ({ browser }) => {
	test.setTimeout(6 * 60_000); // user needs time to complete MS flow + MFA
	const ctx = fs.existsSync(AUTH_STATE)
		? await browser.newContext({ storageState: AUTH_STATE })
		: await browser.newContext();
	const page = await ctx.newPage();

	await page.goto(`${APP}/`);

	// Definitive signed-in check: the API session-aware endpoint.
	const meRes = await page.request.get(`${API}/api/auth/me`);
	const alreadySignedIn = meRes.status() === 200;

	if (!alreadySignedIn) {
		console.log('\n>>> Not signed in. Click "Sign in with Microsoft" in the open browser');
		console.log('>>> Complete the Microsoft flow. Test waits up to 5 min.\n');
		// Wait until /api/auth/me returns 200 (cookie set by /api/auth/exchange).
		await expect
			.poll(async () => (await page.request.get(`${API}/api/auth/me`)).status(), {
				message: 'waiting for sign-in to complete',
				intervals: [2000, 3000, 5000],
				timeout: 5 * 60_000,
			})
			.toBe(200);
	}

	// F1 PASS criteria from regression plan:
	// - URL has no `?error=`
	// - Page is the dashboard, not the "Sign-in Failed" view
	const url = new URL(page.url());
	expect(url.searchParams.get('error'), 'F1: no error in callback URL').toBeNull();
	await expect(page.getByText(/Sign-in Failed/i)).toHaveCount(0);

	// Persist the session for re-use.
	fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });
	await ctx.storageState({ path: AUTH_STATE });

	await ctx.close();
});

test('authenticated — /api/auth/me returns user', async ({ browser }) => {
	test.skip(!fs.existsSync(AUTH_STATE), 'previous test must have saved a session');
	const ctx = await browser.newContext({ storageState: AUTH_STATE });
	const page = await ctx.newPage();

	const res = await page.request.get(`${API}/api/auth/me`);
	expect(res.status(), '/api/auth/me with session cookie').toBe(200);
	const body = await res.json();
	expect(body.user?.id ?? body.id).toBeTruthy();

	await ctx.close();
});

test('WS ticket — endpoint reissues fresh JWT, ~60s expiry', async ({ browser }) => {
	test.skip(!fs.existsSync(AUTH_STATE), 'previous test must have saved a session');
	const ctx = await browser.newContext({ storageState: AUTH_STATE });
	const page = await ctx.newPage();

	const r1 = await page.request.get(`${API}/api/auth/ws-ticket`);
	expect(r1.status()).toBe(200);
	const t1 = (await r1.json()).ticket as string;
	expect(t1).toMatch(/^eyJ/);

	// JWT structure: header.payload.signature — payload is base64url JSON.
	const decode = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
	const claims = decode(t1);
	expect(claims.scope, 'WS ticket scope=ws').toBe('ws');
	const ttl = claims.exp - claims.iat;
	expect(ttl, 'WS ticket TTL ~60s').toBeGreaterThanOrEqual(60);
	expect(ttl, 'WS ticket TTL ~60s').toBeLessThanOrEqual(120);

	// After waiting >1s, a refetch produces a fresh ticket (different iat → different JWT).
	await page.waitForTimeout(1100);
	const r2 = await page.request.get(`${API}/api/auth/ws-ticket`);
	expect(r2.status()).toBe(200);
	const t2 = (await r2.json()).ticket as string;
	expect(t2).not.toBe(t1);

	await ctx.close();
});

test('account export endpoint returns JSON (data-portability)', async ({ browser }) => {
	test.skip(!fs.existsSync(AUTH_STATE), 'previous test must have saved a session');
	const ctx = await browser.newContext({ storageState: AUTH_STATE });
	const page = await ctx.newPage();

	const res = await page.request.get(`${API}/api/account/export`);
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.organization).toBeTruthy();
	expect(Array.isArray(body.platformUsers)).toBe(true);
	expect(Array.isArray(body.tenants)).toBe(true);

	await ctx.close();
});
