import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('../lib/tenant-selector', () => ({
	getSelectedTenant: vi.fn(() => 'tenant-1'),
}));

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn(() => ({ fetch: vi.fn(async () => ({ value: [] })) })),
}));

import { copilotUsageRoutes } from './copilot-usage';

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

describe('Copilot Usage Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/copilot-usage', copilotUsageRoutes);
		authToken = await createTestToken({
			sub: 'user-1', email: 'admin@test.com', orgId: 'org-1', tenantIds: ['tenant-1'], role: 'admin',
		});
	});

	describe('GET /api/copilot-usage', () => {
		it('should return cached usage data when available', async () => {
			const cached = { usage: { totalLicensed: 10, activeUsers: 5 } };
			mockKV.get.mockResolvedValueOnce(JSON.stringify(cached));
			const res = await app.request('/api/copilot-usage', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('should return null usage when no cached data', async () => {
			mockKV.get.mockResolvedValueOnce(null);
			const res = await app.request('/api/copilot-usage', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.usage).toBeNull();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/copilot-usage', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/copilot-usage/scan', () => {
		it('should return 404 when tenant not found', async () => {
			mockFirst.mockResolvedValueOnce(null);
			const res = await app.request('/api/copilot-usage/scan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('should return 403 when no Graph token', async () => {
			mockFirst.mockResolvedValueOnce({ azure_tenant_id: 'az-1' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/copilot-usage/scan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/copilot-usage/scan', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
