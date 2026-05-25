import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('../lib/tenant-selector', () => ({
	getSelectedTenant: vi.fn(() => 'tenant-1'),
}));

import { mspBenchmarkRoutes } from './msp-benchmark';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockAll = vi.fn(() => Promise.resolve({ results: [] }));
const mockFirst = vi.fn(() => Promise.resolve(null));
const mockBind = vi.fn(() => ({ all: mockAll, first: mockFirst }));
const mockDB = { prepare: vi.fn(() => ({ bind: mockBind })) };
const mockKV = { get: vi.fn(), put: vi.fn() };

const mockEnv = { DB: mockDB as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('MSP Benchmark Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/msp-benchmark', mspBenchmarkRoutes);
		authToken = await createTestToken({
			sub: 'user-1', email: 'admin@test.com', orgId: 'org-1', tenantIds: ['tenant-1'], role: 'admin',
		});
	});

	describe('GET /api/msp-benchmark', () => {
		it('should return tenants and benchmarks for org', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ id: 't1', display_name: 'Tenant 1', domain: 't1.com', status: 'active', last_sync_at: null }],
			});
			// Per-tenant queries: userCount, licenseData, alertCount
			mockFirst.mockResolvedValue({ total: 10, active: 8, consumed: 80, enabled: 100 });
			mockKV.get.mockResolvedValue(null);

			const res = await app.request('/api/msp-benchmark', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toBeDefined();
			expect(json.benchmarks).toBeDefined();
		});

		it('should return empty when no orgId', async () => {
			const noOrgToken = await createTestToken({
				sub: 'user-1', email: 'admin@test.com', tenantIds: ['tenant-1'], role: 'admin',
			});
			const res = await app.request('/api/msp-benchmark', {
				method: 'GET',
				headers: { Authorization: `Bearer ${noOrgToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toEqual([]);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/msp-benchmark', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
