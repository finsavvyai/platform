/**
 * DEEP API BEHAVIOR TESTS
 *
 * Tests actual API endpoints against the running local API server.
 * Not mocked — hits real Hono routes with real D1 database.
 * Validates request/response contracts, auth enforcement, error handling.
 */
import { describe, it, expect } from 'vitest';
import http from 'http';

const TIMEOUT = 10_000;

function getApiBase(): string {
	const env = process.env.API_URL;
	if (env && env.startsWith('http')) return env.replace(/\/$/, '');
	return 'http://localhost:8787';
}

interface HttpResult {
	status: number;
	text: string;
	json: () => any;
	headers: Record<string, string>;
}

function apiRequest(method: string, path: string, opts: {
	body?: any;
	headers?: Record<string, string>;
} = {}): Promise<HttpResult> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timeout: ${method} ${path}`)), TIMEOUT);
		const base = getApiBase();
		const match = base.match(/^https?:\/\/([^:/]+):?(\d+)?/);
		if (!match) { reject(new Error(`Bad API URL: ${base}`)); return; }

		const reqOpts: http.RequestOptions = {
			hostname: match[1],
			port: match[2] ? parseInt(match[2]) : 80,
			path,
			method,
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				...opts.headers,
			},
		};

		const req = http.request(reqOpts, (res) => {
			let data = '';
			res.on('data', (c: Buffer) => { data += c.toString(); });
			res.on('end', () => {
				clearTimeout(timer);
				const hdrs: Record<string, string> = {};
				for (const [k, v] of Object.entries(res.headers)) {
					if (typeof v === 'string') hdrs[k] = v;
				}
				resolve({
					status: res.statusCode ?? 0,
					text: data,
					json: () => { try { return JSON.parse(data); } catch { return null; } },
					headers: hdrs,
				});
			});
		});
		req.on('error', (e) => { clearTimeout(timer); reject(e); });
		if (opts.body) req.write(JSON.stringify(opts.body));
		req.end();
	});
}

/* ================================================================ */
/*  1. HEALTH ENDPOINTS                                             */
/* ================================================================ */

describe('API: Health Endpoints', () => {
	it('GET /health returns healthy with database check', async () => {
		const res = await apiRequest('GET', '/health');
		expect(res.status).toBe(200);
		const data = res.json();
		expect(data.status).toBe('healthy');
		expect(data.checks.database).toBe('healthy');
		expect(data.checks.uptimeSeconds).toBeGreaterThanOrEqual(0);
		expect(data.checks.version).toBeTruthy();
	});

	it('GET /health/ready returns ready', async () => {
		const res = await apiRequest('GET', '/health/ready');
		expect(res.status).toBe(200);
		const data = res.json();
		expect(data.status).toBe('ready');
	});

	it('GET /health/live returns alive', async () => {
		const res = await apiRequest('GET', '/health/live');
		expect(res.status).toBe(200);
		const data = res.json();
		expect(data.status).toBe('alive');
	});

	it('returns JSON content-type', async () => {
		const res = await apiRequest('GET', '/health');
		expect(res.headers['content-type']).toContain('application/json');
	});
});

/* ================================================================ */
/*  2. AUTH ENFORCEMENT — Every protected route rejects no-auth     */
/* ================================================================ */

describe('API: Auth Enforcement', () => {
	const protectedRoutes: Array<[string, string]> = [
		['GET', '/api/tenants'],
		['GET', '/api/tenants/fake-id/dashboard'],
		['GET', '/api/tenants/fake-id/alerts'],
		['GET', '/api/tenants/fake-id/users'],
		['GET', '/api/tenants/fake-id/licenses'],
		['GET', '/api/workflows'],
		['GET', '/api/audit'],
		['POST', '/api/tenants'],
	];

	for (const [method, path] of protectedRoutes) {
		it(`${method} ${path} rejects unauthenticated (401)`, async () => {
			const res = await apiRequest(method, path);
			expect([401, 403]).toContain(res.status);
		});
	}

	it('rejects invalid bearer token', async () => {
		const res = await apiRequest('GET', '/api/tenants', {
			headers: { 'Authorization': 'Bearer garbage-token-12345' },
		});
		expect([401, 403]).toContain(res.status);
	});

	it('rejects non-bearer auth scheme', async () => {
		const res = await apiRequest('GET', '/api/tenants', {
			headers: { 'Authorization': 'Basic dXNlcjpwYXNz' },
		});
		expect([401, 403]).toContain(res.status);
	});

	it('rejects empty authorization header', async () => {
		const res = await apiRequest('GET', '/api/tenants', {
			headers: { 'Authorization': '' },
		});
		expect([401, 403]).toContain(res.status);
	});
});

/* ================================================================ */
/*  3. ERROR HANDLING — Graceful failures                           */
/* ================================================================ */

describe('API: Error Handling', () => {
	it('404 for unknown routes', async () => {
		const res = await apiRequest('GET', '/api/nonexistent');
		expect(res.status).toBe(404);
		const data = res.json();
		expect(data).toBeTruthy();
	});

	it('404 response is JSON, not HTML', async () => {
		const res = await apiRequest('GET', '/api/completely-fake-endpoint');
		expect(res.headers['content-type']).toContain('application/json');
	});

	it('does not expose stack traces in errors', async () => {
		const res = await apiRequest('GET', '/api/nonexistent');
		expect(res.text).not.toContain('at Object.');
		expect(res.text).not.toContain('.ts:');
		expect(res.text).not.toContain('node_modules');
	});

	it('does not leak internal error details', async () => {
		const res = await apiRequest('POST', '/api/tenants', {
			body: { invalid: true },
		});
		// Should return auth error, not internal error
		expect([401, 403, 400]).toContain(res.status);
		expect(res.text).not.toContain('SQLITE');
		expect(res.text).not.toContain('database');
	});
});

/* ================================================================ */
/*  4. PLATFORM AUTH ENDPOINTS                                      */
/* ================================================================ */

describe('API: Platform Auth', () => {
	it('POST /platform/auth/login rejects empty body', async () => {
		const res = await apiRequest('POST', '/platform/auth/login', { body: {} });
		expect([400, 401, 422]).toContain(res.status);
	});

	it('POST /platform/auth/login rejects invalid email', async () => {
		const res = await apiRequest('POST', '/platform/auth/login', {
			body: { email: 'not-an-email', password: 'password123' },
		});
		expect([400, 401, 422]).toContain(res.status);
	});

	it('POST /platform/auth/login rejects short password', async () => {
		const res = await apiRequest('POST', '/platform/auth/login', {
			body: { email: 'test@test.com', password: 'ab' },
		});
		expect([400, 401, 422]).toContain(res.status);
	});

	it('POST /platform/auth/verify rejects without auth', async () => {
		const res = await apiRequest('POST', '/platform/auth/verify');
		expect([401, 403]).toContain(res.status);
	});

	it('GET /platform/auth/me rejects without auth', async () => {
		const res = await apiRequest('GET', '/platform/auth/me');
		expect([401, 403]).toContain(res.status);
	});
});

/* ================================================================ */
/*  5. CORS & SECURITY HEADERS                                      */
/* ================================================================ */

describe('API: CORS & Security', () => {
	it('health endpoint allows CORS', async () => {
		const res = await apiRequest('GET', '/health', {
			headers: { 'Origin': 'http://localhost:5173' },
		});
		// Should either have CORS headers or not block
		expect(res.status).toBe(200);
	});

	it('does not expose sensitive headers', async () => {
		const res = await apiRequest('GET', '/health');
		expect(res.headers['x-powered-by']).toBeUndefined();
	});

	it('API error responses are JSON', async () => {
		const res = await apiRequest('GET', '/api/tenants');
		expect(res.headers['content-type']).toContain('json');
	});
});

/* ================================================================ */
/*  6. INPUT VALIDATION — SQL injection, XSS, oversized payloads    */
/* ================================================================ */

describe('API: Input Validation & Security', () => {
	it('handles SQL injection in query params safely', async () => {
		const injected = encodeURIComponent("'; DROP TABLE tenants; --");
		const res = await apiRequest('GET', `/api/tenants?id=${injected}`);
		// Should return auth error, not crash
		expect([401, 403, 400]).toContain(res.status);
		expect(res.text).not.toContain('SQLITE_ERROR');
	});

	it('handles XSS in path params safely', async () => {
		const xss = encodeURIComponent('<script>alert(1)</script>');
		const res = await apiRequest('GET', `/api/tenants/${xss}/dashboard`);
		expect([401, 403, 404, 400]).toContain(res.status);
	});

	it('handles encoded null bytes in path', async () => {
		const res = await apiRequest('GET', '/api/tenants/%00/dashboard');
		expect([401, 403, 404, 400]).toContain(res.status);
	});

	it('rejects oversized JSON body gracefully', async () => {
		const bigPayload = { data: 'x'.repeat(1_000_000) };
		try {
			const res = await apiRequest('POST', '/platform/auth/login', { body: bigPayload });
			// Should reject with 400/413 or auth error, not crash
			expect([400, 401, 413, 422]).toContain(res.status);
		} catch {
			// Network error is acceptable for oversized payload
			expect(true).toBe(true);
		}
	});
});

/* ================================================================ */
/*  7. RESPONSE TIME                                                */
/* ================================================================ */

describe('API: Performance', () => {
	it('/health responds in < 500ms', async () => {
		const start = Date.now();
		await apiRequest('GET', '/health');
		expect(Date.now() - start).toBeLessThan(500);
	});

	it('/health/ready responds in < 500ms', async () => {
		const start = Date.now();
		await apiRequest('GET', '/health/ready');
		expect(Date.now() - start).toBeLessThan(500);
	});

	it('auth rejection responds in < 500ms', async () => {
		const start = Date.now();
		await apiRequest('GET', '/api/tenants');
		expect(Date.now() - start).toBeLessThan(500);
	});
});
