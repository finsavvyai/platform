import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/health-score', () => ({
	computeHealthScore: vi.fn((_metrics, _name) => ({
		overallScore: 72,
		dimensions: { security: 80, licensing: 65, identity: 70, operations: 75, compliance: 68, cost: 74 },
		grade: 'B',
	})),
	generateHealthScorePrompt: vi.fn(() => 'AI health score prompt'),
}));

vi.mock('@tenantiq/db', () => ({
	getTenantById: vi.fn(() => ({ id: 'tenant-1', displayName: 'Test Tenant', azureTenantId: null, lastSyncAt: null })),
	getUsersByTenant: vi.fn(() => [
		{ id: 'u1', lastSignIn: new Date().toISOString(), userType: 'member', assignedLicenses: ['sku-1'] },
	]),
	getLicensesByTenant: vi.fn(() => [
		{ skuId: 'sku-1', skuName: 'E3', total: 100, assigned: 80, costPerUnit: 36 },
	]),
}));

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));
vi.mock('../lib/graph-client', () => ({ createGraphClient: vi.fn() }));
vi.mock('../lib/graph-client-extended', () => ({
	getMfaRegistrationDetails: vi.fn(() => []),
	getDirectoryRoles: vi.fn(() => []),
}));

import healthScore from './health-score';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Health Score Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/health-score', healthScore);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/health-score', () => {
		it('should return health score data', async () => {
			const res = await app.request('/api/health-score', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.overallScore).toBe(72);
			expect(json.data.grade).toBe('B');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/health-score', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/health-score/ai-analysis', () => {
		it('should return AI analysis with prompt', async () => {
			const res = await app.request('/api/health-score/ai-analysis', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					metrics: { totalUsers: 50, activeUsers: 40, mfaEnabledCount: 30, totalLicenses: 100, assignedLicenses: 80 },
					tenantName: 'Test Tenant',
				}),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.score).toBeDefined();
			expect(json.data.aiPrompt).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/health-score/ai-analysis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
