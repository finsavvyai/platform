import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('@tenantiq/ai/tools/executive-report', () => ({
	generateExecutiveReport: vi.fn((_config, _metrics) => ({
		title: 'Executive Report',
		sections: [],
		htmlEmail: '<html><body>Report</body></html>',
		generatedAt: new Date().toISOString(),
	})),
}));

vi.mock('@tenantiq/db', () => ({
	getTenantById: vi.fn(() => ({ id: 'tenant-1', displayName: 'Test Tenant', domain: 'test.com', azureTenantId: null })),
	getUsersByTenant: vi.fn(() => [
		{ id: 'u1', displayName: 'Test', lastSignIn: new Date().toISOString() },
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

import executiveReport from './executive-report';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Executive Report Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/executive-report', executiveReport);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/executive-report/generate', () => {
		it('should generate executive report', async () => {
			const res = await app.request('/api/executive-report/generate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ reportPeriod: 'monthly' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.data).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/executive-report/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/executive-report/email-preview', () => {
		it('should return HTML email preview', async () => {
			const res = await app.request('/api/executive-report/email-preview', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					config: { tenantName: 'Test', reportPeriod: 'monthly', periodStart: '2026-01-01', periodEnd: '2026-01-31' },
					metrics: { totalUsers: 10, activeUsers: 8, totalLicenses: 20, assignedLicenses: 15 },
				}),
			}, mockEnv);
			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toContain('Report');
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/executive-report/email-preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
