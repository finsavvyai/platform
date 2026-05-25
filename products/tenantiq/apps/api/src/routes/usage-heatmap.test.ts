import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/usage-heatmap', () => ({
	generateUsageHeatmap: vi.fn((_tid, _name, _input, _period) => ({
		heatmap: [],
		adoptionScore: 65,
		insights: ['Low Teams adoption'],
		shareableCard: 'card-html',
	})),
}));

vi.mock('@tenantiq/db', () => ({
	getUsersByTenant: vi.fn(() => [
		{ id: 'u1', displayName: 'Test User' },
	]),
}));

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));

import usageHeatmap from './usage-heatmap';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Usage Heatmap Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/usage-heatmap', usageHeatmap);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/usage-heatmap', () => {
		it('should return heatmap data', async () => {
			const res = await app.request('/api/usage-heatmap', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.adoptionScore).toBe(65);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/usage-heatmap', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/usage-heatmap/custom', () => {
		it('should generate custom heatmap', async () => {
			const res = await app.request('/api/usage-heatmap/custom', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: { totalUsers: 50, serviceAdoption: { Teams: 40 } } }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('should return 400 when input missing totalUsers', async () => {
			const res = await app.request('/api/usage-heatmap/custom', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: {} }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/usage-heatmap/custom', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: { totalUsers: 50 } }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/usage-heatmap/adoption-score', () => {
		it('should return adoption score summary', async () => {
			const res = await app.request('/api/usage-heatmap/adoption-score', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.adoptionScore).toBeDefined();
			expect(json.data.insights).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/usage-heatmap/adoption-score', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
