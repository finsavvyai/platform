import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { userBulkRoutes } from './user-bulk';

const kvStore = new Map<string, string>();
const mockKV = {
	get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
	put: vi.fn((key: string, val: string) => { kvStore.set(key, val); return Promise.resolve(); }),
	delete: vi.fn((key: string) => { kvStore.delete(key); return Promise.resolve(); }),
};
const mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockEnv = { DB: {} as any, KV: mockKV as any, REMEDIATION_QUEUE: mockQueue as any, JWT_SECRET };

async function token(payload: any) {
	const s = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(s);
}

describe('User Bulk Routes', () => {
	let app: Hono; let adminToken: string; let viewerToken: string;

	beforeEach(async () => {
		vi.clearAllMocks(); kvStore.clear();
		app = new Hono<AppEnv>();
		app.route('/api/users', userBulkRoutes);
		adminToken = await token({ sub: 'admin-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		viewerToken = await token({ sub: 'viewer-1', email: 'v@test.com', tenantId: 'tenant-1', role: 'viewer' });
		mockKV.put.mockImplementation((k: string, v: string) => { kvStore.set(k, v); return Promise.resolve(); });
		mockKV.get.mockImplementation((k: string) => Promise.resolve(kvStore.get(k) ?? null));
	});

	const bulkPost = (body: any, tok?: string) =>
		app.request('/api/users/bulk', {
			method: 'POST', headers: { Authorization: `Bearer ${tok ?? adminToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}, mockEnv);

	it('queues a bulk disable operation', async () => {
		const res = await bulkPost({ operation: 'disable', userIds: ['u1', 'u2'] });
		expect(res.status).toBe(202);
		const json: any = await res.json();
		expect(json.batchId).toBeDefined();
		expect(json.operationCount).toBe(2);
		expect(json.status).toBe('queued');
		expect(mockQueue.send).toHaveBeenCalledTimes(1);
	});

	it('rejects invalid operation', async () => {
		const res = await bulkPost({ operation: 'delete_all', userIds: ['u1'] });
		expect(res.status).toBe(400);
	});

	it('rejects empty userIds', async () => {
		const res = await bulkPost({ operation: 'disable', userIds: [] });
		expect(res.status).toBe(400);
	});

	it('rejects batch over 100 users', async () => {
		const ids = Array.from({ length: 101 }, (_, i) => `u${i}`);
		const res = await bulkPost({ operation: 'disable', userIds: ids });
		expect(res.status).toBe(400);
	});

	it('requires skuId for license operations', async () => {
		const res = await bulkPost({ operation: 'assign_license', userIds: ['u1'] });
		expect(res.status).toBe(400);
	});

	it('requires groupId for add_to_group', async () => {
		const res = await bulkPost({ operation: 'add_to_group', userIds: ['u1'] });
		expect(res.status).toBe(400);
	});

	it('requires admin role', async () => {
		const res = await bulkPost({ operation: 'disable', userIds: ['u1'] }, viewerToken);
		expect(res.status).toBe(403);
	});

	it('returns batch status', async () => {
		const createRes = await bulkPost({ operation: 'disable', userIds: ['u1', 'u2'] });
		const { batchId } = (await createRes.json()) as any;
		const res = await app.request(`/api/users/bulk/${batchId}`, {
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.total).toBe(2);
		expect(json.status).toBe('queued');
	});

	it('returns 404 for unknown batch', async () => {
		const res = await app.request('/api/users/bulk/nonexistent', {
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(404);
	});

	describe('CSV import', () => {
		const importPost = (csv: string, tok?: string) =>
			app.request('/api/users/import', {
				method: 'POST', headers: { Authorization: `Bearer ${tok ?? adminToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ csv }),
			}, mockEnv);

		it('parses valid CSV and queues import', async () => {
			const csv = 'email,displayName,department,jobTitle,licenses\njohn@test.com,John,IT,Dev,E5';
			const res = await importPost(csv);
			expect(res.status).toBe(202);
			const json: any = await res.json();
			expect(json.validRows).toBe(1);
			expect(json.importId).toBeDefined();
			expect(mockQueue.send).toHaveBeenCalled();
		});

		it('returns invalid rows for bad emails', async () => {
			const csv = 'email,displayName,department,jobTitle,licenses\nbademail,John,IT,Dev,E5';
			const res = await importPost(csv);
			const json: any = await res.json();
			expect(json.invalidRows.length).toBe(1);
		});

		it('rejects empty csv field', async () => {
			const res = await importPost('');
			expect(res.status).toBe(400);
		});
	});
});
