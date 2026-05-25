import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { siteLifecycleRoutes } from './site-lifecycle';

vi.mock('../lib/graph-client', () => {
	const mockFetch = (path: string) => {
		if (path.includes('reports')) return Promise.resolve([]);
		return Promise.resolve({ value: [
			{ id: 's1', displayName: 'Marketing', webUrl: 'https://sp/marketing', createdDateTime: '2025-01-01' },
		] });
	};
	return {
		GraphClient: class MockGraphClient {
			fetch = mockFetch;
			request = (_url: string, init?: any) => mockFetch(new URL(_url).pathname);
		},
	};
});

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
const mockKV = { get: vi.fn(), put: vi.fn() };

const mockEnv = {
	DB: { prepare: mockPrepare } as any,
	KV: mockKV as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Site Lifecycle Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/governance/sites', siteLifecycleRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	describe('GET /api/governance/sites', () => {
		it('returns site inventory', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			mockKV.get.mockResolvedValue('token123');
			const res = await app.request('/api/governance/sites', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.data).toBeDefined();
			expect(json.total).toBeGreaterThanOrEqual(0);
		});

		it('returns 403 when no Graph token', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/governance/sites', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/governance/sites', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/governance/sites/:id/archive', () => {
		it('returns 400 when no tenant', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/governance/sites/s1/archive', {
				method: 'POST', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('returns 404 when tenant not found', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/api/governance/sites/s1/archive', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});
});
