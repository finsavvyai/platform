import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { federatedIdentityRoutes } from './federated-identity';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetch: vi.fn().mockResolvedValue({ value: [] }),
	})),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst }));
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

describe('Federated Identity Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/federated-identity', federatedIdentityRoutes);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin' });
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/federated-identity/latest', () => {
		it('returns cached result', async () => {
			mockKV.get.mockResolvedValue({ score: 80, findings: [] });
			const res = await app.request('/api/federated-identity/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.score).toBe(80);
		});

		it('returns placeholder when no audit', async () => {
			const res = await app.request('/api/federated-identity/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.score).toBeNull();
		});

		it('requires auth', async () => {
			const res = await app.request('/api/federated-identity/latest', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/federated-identity/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('POST /api/federated-identity/audit', () => {
		it('requires auth', async () => {
			const res = await app.request('/api/federated-identity/audit', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/federated-identity/audit', {
				method: 'POST', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});
});
