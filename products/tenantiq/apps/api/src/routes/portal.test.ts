import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { portalRoutes } from './portal';

const kvStore = new Map<string, string>();
const mockKV = {
	get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
	put: vi.fn((key: string, val: string) => { kvStore.set(key, val); return Promise.resolve(); }),
	delete: vi.fn((key: string) => { kvStore.delete(key); return Promise.resolve(); }),
};

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

// Mock D1 DB with prepare/bind/first/all chain
const mockDb = {
	prepare: vi.fn().mockReturnValue({
		bind: vi.fn().mockReturnValue({
			first: vi.fn().mockResolvedValue({
				id: 'u1', email: 'test@co.com', display_name: 'Test User',
				role: 'admin', status: 'active', organization_id: 'org-1',
			}),
			all: vi.fn().mockResolvedValue({ results: [] }),
		}),
	}),
};

const mockEnv = { DB: mockDb as any, KV: mockKV as any, REMEDIATION_QUEUE: { send: vi.fn() } as any, JWT_SECRET };

async function token(payload: any) {
	const s = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(s);
}

describe('Portal Routes', () => {
	let app: Hono; let userToken: string;

	beforeEach(async () => {
		vi.clearAllMocks(); kvStore.clear();
		app = new Hono<AppEnv>();
		app.route('/api/portal', portalRoutes);
		userToken = await token({ sub: 'u1', email: 'test@co.com', tenantId: 'tenant-1', tenantIds: ['tenant-1'], orgId: 'org-1', role: 'viewer' });
	});

	const get = (path: string, tok?: string) =>
		app.request(`/api/portal${path}`, { headers: { Authorization: `Bearer ${tok ?? userToken}` } }, mockEnv);

	it('returns current user profile', async () => {
		const res = await get('/me');
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.user).toBeDefined();
		expect(json.user.displayName).toBe('Test User');
		expect(json.user.mail).toBe('test@co.com');
	});

	it('returns user licenses', async () => {
		const res = await get('/me/licenses');
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.licenses).toBeDefined();
		expect(Array.isArray(json.licenses)).toBe(true);
	});

	it('returns sign-in activity', async () => {
		const res = await get('/me/activity');
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.signIns).toBeDefined();
		expect(Array.isArray(json.signIns)).toBe(true);
	});

	it('submits license request', async () => {
		const res = await app.request('/api/portal/me/license-request', {
			method: 'POST',
			headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ skuId: 'SPE_E5', reason: 'Need E5 for compliance features' }),
		}, mockEnv);
		expect(res.status).toBe(201);
		const json: any = await res.json();
		expect(json.requestId).toBeDefined();
		expect(json.status).toBe('pending');
	});

	it('rejects license request without reason', async () => {
		const res = await app.request('/api/portal/me/license-request', {
			method: 'POST',
			headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ skuId: 'SPE_E5' }),
		}, mockEnv);
		expect(res.status).toBe(400);
	});

	it('requires authentication', async () => {
		const res = await app.request('/api/portal/me', {}, mockEnv);
		expect(res.status).toBe(401);
	});

	it('returns empty licenses array', async () => {
		const res = await get('/me/licenses');
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(Array.isArray(json.licenses)).toBe(true);
	});
});
