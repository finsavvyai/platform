import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { configExportRoutes } from './config-export';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare } as unknown,
	KV: { get: vi.fn().mockResolvedValue('mock-graph-token'), put: vi.fn() } as unknown,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as unknown;

async function createToken(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Config Export Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		global.fetch = vi.fn().mockResolvedValue({
			ok: true, json: () => Promise.resolve({ value: [] }),
		}) as unknown as typeof fetch;
		app = new Hono<AppEnv>();
		app.route('/api/config', configExportRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@t.com', name: 'Admin',
			orgId: 'org1', tenantIds: ['t1'], role: 'admin',
		});
	});

	describe('POST /api/config/export', () => {
		it('exports config for tenant', async () => {
			mockFirst.mockResolvedValueOnce({ id: 't1', display_name: 'Test' });
			const res = await app.request('/api/config/export', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ categories: ['securityDefaults'] }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json = (await res.json()) as { export: { version: string } };
			expect(json.export.version).toBe('1.0.0');
		});
	});

	describe('POST /api/config/diff', () => {
		it('diffs two exports', async () => {
			const base = { version: '1.0.0', exportedAt: '', tenant: { id: 't1', displayName: 'T' }, categories: { securityDefaults: { enabled: true } } };
			const changed = { ...base, categories: { securityDefaults: { enabled: false } } };
			const res = await app.request('/api/config/diff', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ oldExport: base, newExport: changed }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json = (await res.json()) as { diffs: unknown[]; count: number };
			expect(json.count).toBeGreaterThan(0);
		});

		it('rejects invalid payload', async () => {
			const res = await app.request('/api/config/diff', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(422);
		});
	});
});
