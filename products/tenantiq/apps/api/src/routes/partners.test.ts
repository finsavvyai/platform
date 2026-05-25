import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { partnerRoutes } from './partners';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare } as any,
	KV: { get: vi.fn(), put: vi.fn() } as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Partner Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/partners', partnerRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@t.com', name: 'Admin',
			orgId: 'org1', tenantIds: ['t1'], role: 'admin',
		});
	});

	describe('POST /api/partners/register', () => {
		it('registers a partner', async () => {
			mockRun.mockResolvedValue(undefined);
			const res = await app.request('/api/partners/register', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Acme', website: 'https://acme.com', contactEmail: 'a@acme.com' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.data.name).toBe('Acme');
			expect(json.data.status).toBe('active');
		});

		it('rejects invalid input', async () => {
			const res = await app.request('/api/partners/register', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'A' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('GET /api/partners', () => {
		it('lists partners', async () => {
			mockAll.mockResolvedValue({ results: [{ id: 'p1', name: 'Acme' }] });
			const res = await app.request('/api/partners', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.data).toHaveLength(1);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/partners', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/partners/api-keys', () => {
		it('generates API key', async () => {
			mockFirst.mockResolvedValue({ id: 'p1' });
			mockRun.mockResolvedValue(undefined);
			const res = await app.request('/api/partners/api-keys', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ partnerId: 'p1' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.data.key).toMatch(/^tiq_pk_/);
			expect(json.data.prefix).toBeDefined();
		});
	});
});
