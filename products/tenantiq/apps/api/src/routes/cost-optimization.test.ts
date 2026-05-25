import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/cost-optimizer', () => ({
	analyzeCostOptimization: vi.fn(() => ({
		totalMonthlyCost: 5000,
		potentialSavings: 1200,
		recommendations: [],
	})),
	generateCostOptimizationPrompt: vi.fn(() => 'Test prompt'),
}));

vi.mock('@tenantiq/db', () => ({
	getLicensesByTenant: vi.fn(() => [
		{ skuId: 'sku-1', skuName: 'E3', total: 100, assigned: 80, costPerUnit: 36 },
	]),
	getUsersByTenant: vi.fn(() => [
		{ id: 'u1', displayName: 'Test', email: 'test@t.com', lastSignIn: new Date().toISOString(), assignedLicenses: ['sku-1'] },
	]),
	getTenantById: vi.fn(() => ({ id: 'tenant-1', displayName: 'Test Tenant', domain: 'test.com' })),
}));

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));

import costOptimization from './cost-optimization';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET, ANTHROPIC_API_KEY: 'test-key' } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Cost Optimization Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/cost-optimization', costOptimization);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/cost-optimization', () => {
		it('should return optimization analysis', async () => {
			const res = await app.request('/api/cost-optimization', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data).toBeDefined();
			expect(json.timestamp).toBeDefined();
		});

		it('should accept inactivityThreshold query param', async () => {
			const res = await app.request('/api/cost-optimization?inactivityThreshold=90', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/cost-optimization', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/cost-optimization/summary', () => {
		it('should return cost summary', async () => {
			const res = await app.request('/api/cost-optimization/summary', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.totalMonthlyCost).toBeDefined();
			expect(json.data.totalAnnualCost).toBeDefined();
			expect(json.data.utilizationRate).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/cost-optimization/summary', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/cost-optimization/ai-recommendations', () => {
		it('should require authentication', async () => {
			const res = await app.request('/api/cost-optimization/ai-recommendations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
