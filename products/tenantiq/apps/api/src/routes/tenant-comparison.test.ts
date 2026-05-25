import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/tenant-comparison', () => ({
	compareTenants: vi.fn((tenants) => ({
		tenantCount: tenants.length,
		comparison: [],
		insights: tenants.length < 2 ? [] : ['Tenant A has higher security score'],
	})),
}));

import tenantComparison from './tenant-comparison';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Tenant Comparison Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/tenant-comparison', tenantComparison);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/tenant-comparison/compare', () => {
		it('should compare multiple tenants', async () => {
			const tenants = [
				{ tenantId: 't1', tenantName: 'Tenant 1', totalUsers: 100, secureScore: 70 },
				{ tenantId: 't2', tenantName: 'Tenant 2', totalUsers: 200, secureScore: 85 },
			];
			const res = await app.request('/api/tenant-comparison/compare', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ tenants }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.tenantCount).toBe(2);
		});

		it('should return 400 when fewer than 2 tenants', async () => {
			const res = await app.request('/api/tenant-comparison/compare', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ tenants: [{ tenantId: 't1' }] }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenant-comparison/compare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tenants: [] }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/tenant-comparison/preview', () => {
		it('should return empty preview', async () => {
			const res = await app.request('/api/tenant-comparison/preview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.tenantCount).toBe(0);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/tenant-comparison/preview', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
