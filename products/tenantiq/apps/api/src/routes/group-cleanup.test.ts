import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { groupCleanupRoutes } from './group-cleanup';

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

describe('Group Cleanup Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/group-cleanup', groupCleanupRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	describe('GET /api/group-cleanup/results', () => {
		it('returns null when no cleanup data exists', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/group-cleanup/results', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.results).toBeNull();
		});

		it('returns cached cleanup results', async () => {
			const cached = { tenantId: 't1', total: 10, empty: 3 };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/group-cleanup/results', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.results.total).toBe(10);
		});

		it('returns 400 when no tenant', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/group-cleanup/results', {
				method: 'GET', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/group-cleanup/results', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/group-cleanup/run', () => {
		it('returns 404 when tenant not found', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/api/group-cleanup/run', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('returns 403 when no Graph token', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/group-cleanup/run', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/group-cleanup/run', {
				method: 'POST',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/group-cleanup/archive', () => {
		it('returns 400 when no group IDs', async () => {
			const res = await app.request('/api/group-cleanup/archive', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ groupIds: [] }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('returns 404 when tenant not found', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/api/group-cleanup/archive', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ groupIds: ['g1'] }),
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/group-cleanup/archive', {
				method: 'POST',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/group-cleanup/history', () => {
		it('returns history list', async () => {
			mockAll.mockResolvedValue({ results: [{ id: 'h1', run_at: '2026-01-01' }] });
			const res = await app.request('/api/group-cleanup/history', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.history).toHaveLength(1);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/group-cleanup/history', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
