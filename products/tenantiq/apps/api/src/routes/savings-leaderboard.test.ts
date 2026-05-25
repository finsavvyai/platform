import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/savings-leaderboard', () => ({
	generateLeaderboard: vi.fn((_entries, _tid, _period) => ({
		leaderboard: [],
		yourRank: 1,
		achievements: [{ name: 'First Save', progress: 0 }],
		shareableCard: 'card-html',
	})),
	computeROI: vi.fn(() => ({
		monthlyROI: 500,
		annualROI: 6000,
		paybackMonths: 2,
		roiPercentage: 150,
	})),
}));

vi.mock('@tenantiq/db', () => ({
	getLicensesByTenant: vi.fn(() => [
		{ skuId: 'sku-1', skuName: 'E3', total: 100, assigned: 80, costPerUnit: 36 },
	]),
	getUsersByTenant: vi.fn(() => []),
}));

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));

import savingsLeaderboard from './savings-leaderboard';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Savings Leaderboard Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/savings', savingsLeaderboard);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/savings/leaderboard', () => {
		it('should return leaderboard data', async () => {
			const res = await app.request('/api/savings/leaderboard', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.leaderboard).toBeDefined();
		});

		it('should accept period query param', async () => {
			const res = await app.request('/api/savings/leaderboard?period=quarterly', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/savings/leaderboard', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/savings/roi', () => {
		it('should return ROI metrics', async () => {
			const res = await app.request('/api/savings/roi', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.monthlyROI).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/savings/roi', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/savings/achievements', () => {
		it('should return achievements data', async () => {
			const res = await app.request('/api/savings/achievements', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.achievements).toBeDefined();
			expect(json.data.totalAchievements).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/savings/achievements', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
