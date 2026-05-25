import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Hono } from 'hono';
import * as jose from 'jose';
import type { AppEnv } from '../app/types';
import { dattoRoutes } from './integrations-datto';
import { AppError } from '../lib/errors';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
let authToken: string;

function makeApp() {
	const app = new Hono<AppEnv>();
	app.onError((err, c) => {
		if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
		return c.json({ error: err.message }, 500);
	});
	app.route('/datto', dattoRoutes);
	return app;
}

function createMockDB(firstResults: any[] = []) {
	let firstIdx = 0;
	const mockRun = vi.fn().mockResolvedValue({ success: true });
	const mockFirst = vi.fn().mockImplementation(() => Promise.resolve(firstResults[firstIdx++] ?? null));
	const mockAll = vi.fn().mockResolvedValue({ results: [] });
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
		.setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
});

describe('Datto Integration Routes', () => {
	it('POST /datto/connect — saves integration', async () => {
		const db = createMockDB();
		const app = makeApp();
		const res = await app.request('/datto/connect', {
			method: 'POST', headers: authHeaders(),
			body: JSON.stringify({
				apiUser: 'user@test.com', apiSecret: 'secret123',
				trackingId: 'track-1', zoneUrl: 'https://webservices2.autotask.net',
			}),
		}, makeEnv(db));
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.success).toBe(true);
	});

	it('POST /datto/connect — rejects invalid creds', async () => {
		const db = createMockDB();
		const app = makeApp();
		const res = await app.request('/datto/connect', {
			method: 'POST', headers: authHeaders(),
			body: JSON.stringify({ apiUser: '' }),
		}, makeEnv(db));
		expect(res.status).toBe(422);
	});

	it('GET /datto/status — returns status', async () => {
		const db = createMockDB([
			{ id: 'int-d1', status: 'active', last_sync_at: '2026-04-01', config_encrypted: '{}', created_at: '2026-03-01' },
			{ count: 3 },
		]);
		const app = makeApp();
		const res = await app.request('/datto/status', { headers: authHeaders() }, makeEnv(db));
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.status).toBe('active');
	});

	it('GET /datto/status — 404 when not connected', async () => {
		const db = createMockDB([null]);
		const app = makeApp();
		const res = await app.request('/datto/status', { headers: authHeaders() }, makeEnv(db));
		expect(res.status).toBe(404);
	});

	it('DELETE /datto/disconnect — removes integration', async () => {
		const db = createMockDB([{ id: 'int-d1', status: 'active' }]);
		const app = makeApp();
		const res = await app.request('/datto/disconnect', {
			method: 'DELETE', headers: authHeaders(),
		}, makeEnv(db));
		expect(res.status).toBe(200);
	});
});
