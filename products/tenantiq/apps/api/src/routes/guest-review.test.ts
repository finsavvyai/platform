import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { guestReviewRoutes } from './guest-review';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetchAll: vi.fn().mockResolvedValue([]),
		request: vi.fn().mockResolvedValue({}),
	})),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockQueue = { send: vi.fn() };
const mockEnv = {
	DB: { prepare: mockPrepare } as any,
	KV: mockKV as any,
	REMEDIATION_QUEUE: mockQueue as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Guest Review Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/guest-review', guestReviewRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	describe('GET /api/guest-review/results', () => {
		it('returns null when no review data exists', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/guest-review/results', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.results).toBeNull();
		});

		it('returns cached review results', async () => {
			const cached = { tenantId: 't1', total: 5, stale: 2 };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/guest-review/results', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.results.total).toBe(5);
		});

		it('returns 400 when no tenant', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/guest-review/results', {
				method: 'GET', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/guest-review/results', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/guest-review/run', () => {
		it('returns 404 when tenant not found', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/api/guest-review/run', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('returns 403 when no Graph token', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/guest-review/run', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/guest-review/run', {
				method: 'POST',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/guest-review/approve', () => {
		it('returns 400 when no guest IDs', async () => {
			const res = await app.request('/api/guest-review/approve', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ guestIds: [] }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('queues removal for approved guests', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			const res = await app.request('/api/guest-review/approve', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ guestIds: ['g1', 'g2'] }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.queued).toBe(2);
			expect(mockQueue.send).toHaveBeenCalledTimes(2);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/guest-review/approve', {
				method: 'POST',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/guest-review/history', () => {
		it('returns history list', async () => {
			mockAll.mockResolvedValue({ results: [{ id: 'h1', run_at: '2026-01-01' }] });
			const res = await app.request('/api/guest-review/history', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.history).toHaveLength(1);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/guest-review/history', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
