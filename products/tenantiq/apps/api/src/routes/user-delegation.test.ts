import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { userDelegationRoutes } from './user-delegation';

const kvStore = new Map<string, string>();
const mockKV = {
	get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
	put: vi.fn((key: string, val: string) => { kvStore.set(key, val); return Promise.resolve(); }),
	delete: vi.fn((key: string) => { kvStore.delete(key); return Promise.resolve(); }),
};
const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockEnv = { DB: {} as any, KV: mockKV as any, REMEDIATION_QUEUE: { send: vi.fn() } as any, JWT_SECRET };

vi.mock('../lib/graph-client', () => ({
	createGraphClient: () => ({
		getUser: vi.fn().mockResolvedValue({ id: 'u1', displayName: 'Test' }),
		request: vi.fn().mockResolvedValue({ value: [] }),
	}),
}));

async function token(payload: any) {
	const s = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(s);
}

describe('User Delegation Routes', () => {
	let app: Hono; let adminToken: string; let viewerToken: string;

	beforeEach(async () => {
		vi.clearAllMocks(); kvStore.clear();
		app = new Hono<AppEnv>();
		app.route('/api/users', userDelegationRoutes);
		app.route('/api/delegations', userDelegationRoutes);
		adminToken = await token({ sub: 'admin-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		viewerToken = await token({ sub: 'viewer-1', email: 'viewer@test.com', tenantId: 'tenant-1', role: 'viewer' });
		mockKV.get.mockImplementation((k: string) => Promise.resolve(kvStore.get(k) ?? null));
		mockKV.put.mockImplementation((k: string, v: string) => { kvStore.set(key(k), v); return Promise.resolve(); });

		function key(k: string) { return k; }
		mockKV.put.mockImplementation((k: string, v: string) => { kvStore.set(k, v); return Promise.resolve(); });
	});

	const post = (userId: string, body: any, tok?: string) =>
		app.request(`/api/users/${userId}/delegate`, {
			method: 'POST', headers: { Authorization: `Bearer ${tok ?? adminToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}, mockEnv);

	it('creates a delegation successfully', async () => {
		const res = await post('u1', { delegateId: 'u2', scope: ['mailbox'] });
		expect(res.status).toBe(201);
		const json: any = await res.json();
		expect(json.delegationId).toBeDefined();
		expect(json.scope).toEqual(['mailbox']);
		expect(json.userId).toBe('u1');
	});

	it('rejects missing delegateId', async () => {
		const res = await post('u1', { scope: ['mailbox'] });
		expect(res.status).toBe(400);
	});

	it('rejects invalid scope', async () => {
		const res = await post('u1', { delegateId: 'u2', scope: ['invalid'] });
		expect(res.status).toBe(400);
	});

	it('requires admin role', async () => {
		const res = await post('u1', { delegateId: 'u2', scope: ['mailbox'] }, viewerToken);
		expect(res.status).toBe(403);
	});

	it('lists delegations for a user', async () => {
		await post('u1', { delegateId: 'u2', scope: ['mailbox'] });
		const res = await app.request('/api/users/u1/delegations', { headers: { Authorization: `Bearer ${adminToken}` } }, mockEnv);
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.delegations.length).toBeGreaterThanOrEqual(1);
	});

	it('deletes a delegation', async () => {
		const createRes = await post('u1', { delegateId: 'u2', scope: ['onedrive'] });
		const { delegationId } = (await createRes.json()) as any;
		const res = await app.request(`/api/users/u1/delegations/${delegationId}`, {
			method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.success).toBe(true);
	});

	it('returns 404 when deleting non-existent delegation', async () => {
		const res = await app.request('/api/users/u1/delegations/nonexistent', {
			method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(404);
	});

	it('lists all delegations for tenant', async () => {
		await post('u1', { delegateId: 'u2', scope: ['mailbox'] });
		await post('u3', { delegateId: 'u4', scope: ['onedrive'] });
		const res = await app.request('/api/delegations', { headers: { Authorization: `Bearer ${adminToken}` } }, mockEnv);
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.delegations.length).toBe(2);
	});

	it('requires auth for listing', async () => {
		const res = await app.request('/api/delegations', {}, mockEnv);
		expect(res.status).toBe(401);
	});
});
