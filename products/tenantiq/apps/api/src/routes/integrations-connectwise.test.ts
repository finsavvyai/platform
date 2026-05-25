import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Hono } from 'hono';
import * as jose from 'jose';
import type { AppEnv } from '../app/types';
import { connectwiseRoutes } from './integrations-connectwise';
import { AppError } from '../lib/errors';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
let authToken: string;

function makeApp() {
	const app = new Hono<AppEnv>();
	app.onError((err, c) => {
		if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
		return c.json({ error: err.message }, 500);
	});
	app.route('/connectwise', connectwiseRoutes);
	return app;
}

function createMockDB(firstResults: any[] = [], allResults: any[][] = []) {
	let firstIdx = 0;
	let allIdx = 0;
	const mockRun = vi.fn().mockResolvedValue({ success: true });
	const mockFirst = vi.fn().mockImplementation(() => Promise.resolve(firstResults[firstIdx++] ?? null));
	const mockAll = vi.fn().mockImplementation(() => Promise.resolve({ results: allResults[allIdx++] ?? [] }));
	const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst, all: mockAll });
	return { prepare: vi.fn().mockReturnValue({ bind: mockBind, run: mockRun, first: mockFirst, all: mockAll }) };
}

function makeEnv(db: any) {
	return { DB: db, JWT_SECRET, KV: { get: vi.fn(), put: vi.fn() } } as any;
}

function authHeaders() {
	return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

beforeAll(async () => {
	const secret = new TextEncoder().encode(JWT_SECRET);
	authToken = await new jose.SignJWT({ sub: 'u1', orgId: 'org-1', name: 'Test', email: 'test@test.com' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
});

describe('ConnectWise Integration Routes', () => {
	describe('POST /connectwise/connect', () => {
		it('saves integration and returns ID', async () => {
			const db = createMockDB();
			const app = makeApp();
			const res = await app.request('/connectwise/connect', {
				method: 'POST',
				headers: authHeaders(),
				body: JSON.stringify({
					companyId: 'acme', publicKey: 'pub123', privateKey: 'priv456',
					siteUrl: 'https://api-na.myconnectwise.net', clientId: 'client789',
				}),
			}, makeEnv(db));

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.integrationId).toBeDefined();
		});

		it('rejects invalid credentials', async () => {
			const db = createMockDB();
			const app = makeApp();
			const res = await app.request('/connectwise/connect', {
				method: 'POST',
				headers: authHeaders(),
				body: JSON.stringify({ companyId: '' }),
			}, makeEnv(db));
			expect(res.status).toBe(422);
		});
	});

	describe('GET /connectwise/status', () => {
		it('returns integration status', async () => {
			const db = createMockDB([
				{ id: 'int-1', status: 'active', last_sync_at: '2026-04-01', config_encrypted: '{}', created_at: '2026-03-01' },
				{ count: 5 },
			]);
			const app = makeApp();
			const res = await app.request('/connectwise/status', { headers: authHeaders() }, makeEnv(db));

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.status).toBe('active');
			expect(json.mappedTenants).toBe(5);
		});

		it('returns 404 when not connected', async () => {
			const db = createMockDB([null]);
			const app = makeApp();
			const res = await app.request('/connectwise/status', { headers: authHeaders() }, makeEnv(db));
			expect(res.status).toBe(404);
		});
	});

	describe('DELETE /connectwise/disconnect', () => {
		it('removes integration and mappings', async () => {
			const db = createMockDB([{ id: 'int-1', status: 'active' }]);
			const app = makeApp();
			const res = await app.request('/connectwise/disconnect', {
				method: 'DELETE', headers: authHeaders(),
			}, makeEnv(db));

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});
	});

	describe('POST /connectwise/mappings', () => {
		it('saves tenant-company mapping', async () => {
			const db = createMockDB([{ id: 'int-1', status: 'active' }]);
			const app = makeApp();
			const res = await app.request('/connectwise/mappings', {
				method: 'POST',
				headers: authHeaders(),
				body: JSON.stringify({ tenantId: 't1', cwCompanyId: '100', cwCompanyName: 'Acme Corp' }),
			}, makeEnv(db));

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});
	});

	describe('GET /connectwise/mappings', () => {
		it('returns tenant mappings', async () => {
			const db = createMockDB(
				[{ id: 'int-1', status: 'active' }],
				[[{ id: 'm1', local_id: 't1', remote_id: '100', remote_name: 'Acme', synced_at: '2026-04-01' }]],
			);
			const app = makeApp();
			const res = await app.request('/connectwise/mappings', { headers: authHeaders() }, makeEnv(db));

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.mappings).toHaveLength(1);
		});
	});
});
