import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';
import { securityHeaders } from './security-headers';

// NOTE: The existing security-headers.ts accesses c.env.ENVIRONMENT without
// optional chaining. A minimal env object is passed to app.request() to avoid
// crashing. When c.env.ENVIRONMENT !== 'development', HSTS is set (production mode).
function makeEnv(environment = 'production'): any {
	return { ENVIRONMENT: environment } as any;
}

function makeApp() {
	const app = new Hono();
	app.use('*', securityHeaders);
	app.get('/ok', (c) => c.json({ ok: true }));
	app.get('/error', (c) => c.json({ error: 'not found' }, 404));
	app.get('/with-custom-header', (c) => {
		c.header('X-Frame-Options', 'SAMEORIGIN');
		return c.json({ ok: true });
	});
	return app;
}

describe('securityHeaders middleware', () => {
	it('sets Content-Security-Policy with default-src self', async () => {
		const app = makeApp();
		const res = await app.request('/ok', {}, makeEnv());
		const csp = res.headers.get('content-security-policy');
		expect(csp).toBeTruthy();
		expect(csp).toContain("default-src 'self'");
	});

	it('sets X-Frame-Options: DENY', async () => {
		const app = makeApp();
		const res = await app.request('/ok', {}, makeEnv());
		expect(res.headers.get('x-frame-options')).toBe('DENY');
	});

	it('sets X-Content-Type-Options: nosniff', async () => {
		const app = makeApp();
		const res = await app.request('/ok', {}, makeEnv());
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('sets Strict-Transport-Security with max-age=31536000 in production', async () => {
		const app = makeApp();
		const res = await app.request('/ok', {}, makeEnv('production'));
		const hsts = res.headers.get('strict-transport-security');
		expect(hsts).toBeTruthy();
		expect(hsts).toContain('max-age=31536000');
	});

	it('sets all security headers on 4xx responses', async () => {
		const app = makeApp();
		const res = await app.request('/error', {}, makeEnv());
		expect(res.status).toBe(404);
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('x-frame-options')).toBe('DENY');
		expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
		expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
	});

	it('middleware overwrites X-Frame-Options set by route handler (post-next() wins)', async () => {
		// Because securityHeaders runs c.header() AFTER next(), it overwrites route-set values.
		// This test documents the current behavior: middleware wins (DENY over SAMEORIGIN).
		const app = makeApp();
		const res = await app.request('/with-custom-header', {}, makeEnv());
		expect(res.headers.get('x-frame-options')).toBe('DENY');
	});
});
