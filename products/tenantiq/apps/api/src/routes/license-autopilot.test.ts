import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/license-autopilot', () => ({
	analyzeReclamationCandidates: vi.fn(() => []),
	generateReclamationPlan: vi.fn(() => ({
		tenantId: 'tenant-1',
		candidates: [],
		totalSavings: 0,
		summary: 'No candidates found',
	})),
	getDefaultAutopilotConfig: vi.fn(() => ({
		inactivityThresholdDays: 60,
		dryRunMode: false,
		maxActionsPerRun: 50,
		excludedSkus: [],
	})),
}));

vi.mock('@tenantiq/db', () => ({
	getUsersByTenant: vi.fn(() => [
		{
			azureUserId: 'az-1', email: 'u@t.com', displayName: 'User',
			assignedLicenses: ['sku-1'], lastSignIn: new Date().toISOString(),
			lastNonInteractiveSignIn: null, accountEnabled: true,
		},
	]),
	getLicensesByTenant: vi.fn(() => [
		{ skuId: 'sku-1', skuName: 'E3', total: 100, assigned: 80, costPerUnit: 36 },
	]),
}));

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));
vi.mock('../lib/workflows/approval-engine', () => ({
	createApprovalRequest: vi.fn(() => ({ id: 'approval-1', status: 'pending', items: [] })),
	saveApproval: vi.fn(async () => {}),
}));

import licenseAutopilot from './license-autopilot';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('License Autopilot Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/license-autopilot', licenseAutopilot);
		authToken = await createTestToken({
			sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin', orgId: 'org-1',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/license-autopilot/analyze', () => {
		it('should analyze and return reclamation plan', async () => {
			const res = await app.request('/api/license-autopilot/analyze', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/license-autopilot/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/license-autopilot/config', () => {
		it('should return default autopilot config', async () => {
			const res = await app.request('/api/license-autopilot/config', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.inactivityThresholdDays).toBe(60);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/license-autopilot/config', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/license-autopilot/preview', () => {
		it('should return preview in dry-run mode', async () => {
			const res = await app.request('/api/license-autopilot/preview', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data.candidateCount).toBeDefined();
			expect(json.data.breakdown).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/license-autopilot/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
