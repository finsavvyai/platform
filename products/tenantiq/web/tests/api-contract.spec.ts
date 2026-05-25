import { test, expect, request as pwRequest } from '@playwright/test';

const API = process.env.API_URL || 'https://api.tenantiq.app';
const APP = process.env.BASE_URL || 'http://localhost:5173';

test.describe('API health + security headers', () => {
	test('GET /health returns 200', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/health`);
		expect(res.status()).toBe(200);
	});

	test('API returns security headers', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/health`);
		const h = res.headers();
		expect(h['x-content-type-options']).toBe('nosniff');
		expect(h['x-frame-options']).toBe('DENY');
		expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(h['permissions-policy']).toContain('camera=()');
		// x-api-version may not be set on /health (lightweight path)
		if (h['x-api-version']) expect(h['x-api-version']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	test('GET /api/.well-known/jwks.json returns RS256 key', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/.well-known/jwks.json`);
		expect(res.status()).toBe(200);
		const json = await res.json();
		expect(json.keys).toHaveLength(1);
		expect(json.keys[0].kty).toBe('RSA');
		expect(json.keys[0].alg).toBe('RS256');
	});
});

test.describe('API auth gates', () => {
	test('GET /api/auth/me without cookie returns 401', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/auth/me`);
		expect(res.status()).toBe(401);
	});

	test('DELETE /api/account without auth returns 401', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.delete(`${API}/api/account`, {
			headers: { Origin: APP, 'Content-Type': 'application/json' },
			data: {},
		});
		expect(res.status()).toBe(401);
	});

	test('GET /api/tenants without auth returns 401', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/tenants`);
		expect(res.status()).toBe(401);
	});
});

test.describe('OAuth redirect', () => {
	test('GET /api/auth/login redirects to Microsoft', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/auth/login`, { maxRedirects: 0 });
		expect([301, 302, 307, 308]).toContain(res.status());
		const loc = res.headers().location ?? '';
		expect(loc).toContain('login.microsoftonline.com');
		expect(loc).toContain('client_id=');
		expect(loc).toContain('scope=');
		expect(loc).toContain('state=');
	});

	test('personal login also redirects to Microsoft', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/auth/login/personal`, { maxRedirects: 0 });
		expect([301, 302, 307, 308]).toContain(res.status());
		const loc = res.headers().location ?? '';
		expect(loc).toContain('login.microsoftonline.com');
	});
});

test.describe('error envelope format', () => {
	test('404 returns standard error JSON', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${API}/api/nonexistent-route-xyz`);
		expect(res.status()).toBe(404);
		const body = await res.json();
		expect(body.error).toBeDefined();
		expect(body.error.code).toBe('NOT_FOUND');
		expect(body.error.message).toBeTruthy();
	});
});

test.describe('prospect scan (public, no auth)', () => {
	test('POST /api/prospect/scan with valid domain returns 200', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.post(`${API}/api/prospect/scan`, {
			headers: { 'Content-Type': 'application/json', Origin: APP },
			data: { domain: 'microsoft.com' },
		});
		// 200 or 429 (rate-limited) are both acceptable
		expect([200, 429]).toContain(res.status());
	});
});
