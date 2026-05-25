import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { approvalRoutes } from './approvals';

const kvStore = new Map<string, string>();
const mockKV = {
	get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
	put: vi.fn((key: string, val: string) => { kvStore.set(key, val); return Promise.resolve(); }),
	delete: vi.fn((key: string) => { kvStore.delete(key); return Promise.resolve(); }),
};
const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockEnv = { DB: {} as any, KV: mockKV as any, REMEDIATION_QUEUE: mockQueue as any, JWT_SECRET };

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn((..._a: any[]) => ({})), desc: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({ getDb: () => ({}), schema: {} }));

async function token(payload: any) {
	const s = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(s);
}

async function seed(tenantId: string, overrides: any = {}) {
	const id = overrides.id ?? crypto.randomUUID();
	const items = [
		{ id: 'item-1', description: 'Remove license', impact: 'Save $10/mo', approved: false },
		{ id: 'item-2', description: 'Downgrade license', impact: 'Save $5/mo', approved: false },
	];
	const approval = { id, type: 'license_optimization', items, requestedBy: 'user-1', requestedAt: new Date().toISOString(), status: 'pending', ...overrides };
	kvStore.set(`approval:${tenantId}:${id}`, JSON.stringify(approval));
	const idxKey = `approval-index:${tenantId}:${approval.status}`;
	const ids = JSON.parse(kvStore.get(idxKey) ?? '[]');
	ids.unshift(id);
	kvStore.set(idxKey, JSON.stringify(ids));
	return approval;
}

describe('Approvals Routes', () => {
	let app: Hono; let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks(); kvStore.clear();
		app = new Hono<AppEnv>();
		app.route('/api/approvals', approvalRoutes);
		authToken = await token({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', orgId: 'org-1', role: 'admin' });
		mockKV.get.mockImplementation((k: string) => Promise.resolve(kvStore.get(k) ?? null));
		mockKV.put.mockImplementation((k: string, v: string) => { kvStore.set(k, v); return Promise.resolve(); });
	});

	describe('GET /api/approvals', () => {
		it('returns empty list when no pending approvals', async () => {
			const res = await app.request('/api/approvals', { headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.approvals).toHaveLength(0);
		});

		it('returns pending approvals', async () => {
			await seed('tenant-1');
			const res = await app.request('/api/approvals', { headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			const json: any = await res.json();
			expect(json.approvals).toHaveLength(1);
			expect(json.approvals[0].status).toBe('pending');
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/approvals', {}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/approvals/:id', () => {
		it('returns approval detail', async () => {
			await seed('tenant-1', { id: 'test-id' });
			const res = await app.request('/api/approvals/test-id', { headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.approval.id).toBe('test-id');
		});

		it('returns 404 for missing approval', async () => {
			const res = await app.request('/api/approvals/nope', { headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('POST /api/approvals/:id/decide', () => {
		const decide = (id: string, decisions: any[], tok?: string) =>
			app.request(`/api/approvals/${id}/decide`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${tok ?? authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ decisions }),
			}, mockEnv);

		it('approves all items and queues execution', async () => {
			await seed('tenant-1', { id: 'd1' });
			const res = await decide('d1', [{ itemId: 'item-1', approved: true }, { itemId: 'item-2', approved: true }]);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.result.status).toBe('approved');
			expect(mockQueue.send).toHaveBeenCalledTimes(1);
		});

		it('denies all items', async () => {
			await seed('tenant-1', { id: 'd2' });
			const res = await decide('d2', [{ itemId: 'item-1', approved: false }, { itemId: 'item-2', approved: false }]);
			const json: any = await res.json();
			expect(json.result.status).toBe('denied');
			expect(mockQueue.send).not.toHaveBeenCalled();
		});

		it('handles partial approval', async () => {
			await seed('tenant-1', { id: 'd3' });
			const res = await decide('d3', [{ itemId: 'item-1', approved: true }, { itemId: 'item-2', approved: false }]);
			const json: any = await res.json();
			expect(json.result.status).toBe('partial');
		});

		it('rejects already-decided approval', async () => {
			await seed('tenant-1', { id: 'd4', status: 'approved' });
			const res = await decide('d4', [{ itemId: 'item-1', approved: true }]);
			expect(res.status).toBe(400);
		});

		it('requires admin role', async () => {
			const vt = await token({ sub: 'u2', email: 'v@t.com', tenantId: 'tenant-1', orgId: 'org-1', role: 'viewer' });
			const res = await decide('d1', [{ itemId: 'item-1', approved: true }], vt);
			expect(res.status).toBe(403);
		});
	});

	describe('GET /api/approvals/history', () => {
		it('returns past decisions', async () => {
			await seed('tenant-1', { id: 'h1', status: 'approved', decidedAt: new Date().toISOString() });
			const res = await app.request('/api/approvals/history', { headers: { Authorization: `Bearer ${authToken}` } }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.approvals.length).toBeGreaterThanOrEqual(1);
		});
	});
});
