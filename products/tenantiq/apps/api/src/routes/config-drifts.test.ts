import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { configDriftRoutes } from './config-drifts';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn((..._a: any[]) => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare } as any,
	KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn() } as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Config Drift Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/config-drifts', configDriftRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
	});

	describe('GET /api/config-drifts', () => {
		it('returns drifts for tenant', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ id: 'd1', severity: 'critical', acknowledged: 0 }],
			});
			const res = await app.request('/api/config-drifts', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.drifts).toHaveLength(1);
		});

		it('returns empty when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/config-drifts', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.drifts).toEqual([]);
		});

		it('filters by severity', async () => {
			mockAll.mockResolvedValueOnce({ results: [{ id: 'd1', severity: 'critical' }] });
			const res = await app.request('/api/config-drifts?severity=critical', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('filters by acknowledged status', async () => {
			mockAll.mockResolvedValueOnce({ results: [] });
			const res = await app.request('/api/config-drifts?acknowledged=0', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/config-drifts', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/config-drifts/summary', () => {
		it('returns summary counts', async () => {
			mockFirst
				.mockResolvedValueOnce({ c: 10 })
				.mockResolvedValueOnce({ c: 3 })
				.mockResolvedValueOnce({ c: 4 })
				.mockResolvedValueOnce({ c: 3 })
				.mockResolvedValueOnce({ c: 7 });
			const res = await app.request('/api/config-drifts/summary', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.total).toBe(10);
			expect(json.critical).toBe(3);
			expect(json.unacknowledged).toBe(7);
		});

		it('returns zeros when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/config-drifts/summary', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			const json: any = await res.json();
			expect(json.total).toBe(0);
		});
	});

	describe('PATCH /api/config-drifts/:id/acknowledge', () => {
		it('acknowledges a drift', async () => {
			mockRun.mockResolvedValueOnce({ success: true });
			const res = await app.request('/api/config-drifts/d1/acknowledge', {
				method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('returns error when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/config-drifts/d1/acknowledge', {
				method: 'PATCH', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('PATCH /api/config-drifts/acknowledge-all', () => {
		it('acknowledges all drifts', async () => {
			mockRun.mockResolvedValueOnce({ success: true });
			const res = await app.request('/api/config-drifts/acknowledge-all', {
				method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});

		it('returns error when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/config-drifts/acknowledge-all', {
				method: 'PATCH', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});
});
