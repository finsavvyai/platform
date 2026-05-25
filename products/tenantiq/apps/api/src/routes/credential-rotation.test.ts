import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { credentialRotationRoutes } from './credential-rotation';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };

const mockEnv = {
	DB: {} as any,
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

describe('Credential Rotation Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/credential-rotation', credentialRotationRoutes);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin' });
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/credential-rotation/declare-breach', () => {
		it('creates rotation checklist', async () => {
			const credentials = [
				{ id: 'c1', type: 'app_secret', name: 'Secret', owner: 'admin', lastRotated: null, expiresAt: null },
			];
			const res = await app.request('/api/credential-rotation/declare-breach', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ credentials }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.totalCredentials).toBe(1);
		});

		it('rejects missing credentials', async () => {
			const res = await app.request('/api/credential-rotation/declare-breach', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/credential-rotation/declare-breach', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/credential-rotation/rotate', () => {
		it('returns 404 when no active breach', async () => {
			const res = await app.request('/api/credential-rotation/rotate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ credentialId: 'c1' }),
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /api/credential-rotation/report', () => {
		it('returns null when no active rotation', async () => {
			const res = await app.request('/api/credential-rotation/report', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.report).toBeNull();
		});
	});
});
