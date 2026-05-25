import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { brandingRoutes } from './branding';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare } as unknown,
	KV: { get: vi.fn(), put: vi.fn() } as unknown,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as unknown;

async function createToken(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Branding Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/branding', brandingRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@t.com', name: 'Admin',
			orgId: 'org1', tenantIds: ['t1'], role: 'admin',
		});
	});

	describe('GET /api/branding', () => {
		it('returns branding for org', async () => {
			mockFirst.mockResolvedValueOnce({ id: 'b1', org_id: 'org1', primary_color: '#ff0000' });
			const res = await app.request('/api/branding', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json = (await res.json()) as { branding: unknown };
			expect(json.branding).toBeTruthy();
		});

		it('returns null when no branding exists', async () => {
			mockFirst.mockResolvedValueOnce(null);
			const res = await app.request('/api/branding', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json = (await res.json()) as { branding: null };
			expect(json.branding).toBeNull();
		});
	});

	describe('PUT /api/branding', () => {
		it('creates branding when none exists', async () => {
			mockFirst.mockResolvedValueOnce(null); // no existing
			mockRun.mockResolvedValueOnce({ meta: {} }); // insert
			mockFirst.mockResolvedValueOnce({ id: 'new', primary_color: '#00ff00' }); // re-fetch
			const res = await app.request('/api/branding', {
				method: 'PUT',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ primaryColor: '#00ff00', companyName: 'Acme' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json = (await res.json()) as { success: boolean };
			expect(json.success).toBe(true);
		});

		it('rejects invalid hex color', async () => {
			const res = await app.request('/api/branding', {
				method: 'PUT',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ primaryColor: 'red' }),
			}, mockEnv);
			expect(res.status).toBe(422);
		});
	});
});
