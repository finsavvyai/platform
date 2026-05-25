import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Hono } from 'hono';
import * as jose from 'jose';
import type { AppEnv } from '../app/types';
import { kaseyaRoutes } from './integrations-kaseya';
import { AppError } from '../lib/errors';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
let authToken: string;

function makeApp() {
	const app = new Hono<AppEnv>();
	app.onError((err, c) => {
		if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
		return c.json({ error: err.message }, 500);
	});
	app.route('/kaseya', kaseyaRoutes);
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

describe('Kaseya Integration Routes', () => {
	it('POST /kaseya/connect — saves integration', async () => {
		const db = createMockDB();
		const app = makeApp();
		const res = await app.request('/kaseya/connect', {
			method: 'POST', headers: authHeaders(),
			body: JSON.stringify({
				apiUrl: 'https://bms.kaseya.com', apiKey: 'key-123', tenantId: 'tenant-1',
			}),
		}, makeEnv(db));
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.success).toBe(true);
	});

	it('POST /kaseya/connect — rejects invalid creds', async () => {
		const db = createMockDB();
		const app = makeApp();
		const res = await app.request('/kaseya/connect', {
			method: 'POST', headers: authHeaders(),
			body: JSON.stringify({ apiUrl: 'not-a-url' }),
		}, makeEnv(db));
		expect(res.status).toBe(422);
	});

	it('GET /kaseya/status — returns status', async () => {
		const db = createMockDB([
			{ id: 'int-k1', status: 'active', last_sync_at: '2026-04-01', config_encrypted: '{}', created_at: '2026-03-01' },
			{ count: 2 },
		]);
		const app = makeApp();
		const res = await app.request('/kaseya/status', { headers: authHeaders() }, makeEnv(db));
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.mappedTenants).toBe(2);
	});

	it('GET /kaseya/status — 404 when not connected', async () => {
		const db = createMockDB([null]);
		const app = makeApp();
		const res = await app.request('/kaseya/status', { headers: authHeaders() }, makeEnv(db));
		expect(res.status).toBe(404);
	});

	it('DELETE /kaseya/disconnect — removes integration', async () => {
		const db = createMockDB([{ id: 'int-k1', status: 'active' }]);
		const app = makeApp();
		const res = await app.request('/kaseya/disconnect', {
			method: 'DELETE', headers: authHeaders(),
		}, makeEnv(db));
		expect(res.status).toBe(200);
	});
});
