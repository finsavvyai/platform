import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

let queryResults: any[];

const chainMethods = ['select', 'from', 'where', 'orderBy', 'limit'];
const mockDbChain: any = {};
for (const method of chainMethods) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: any) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._a: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		intelligenceScans: { id: {}, tenantId: {}, startedAt: {} },
		userActivitySnapshots: { tenantId: {}, userId: {}, snapshotDate: {} },
	},
}));

import intelligence from './intelligence';

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

describe('Intelligence Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/intelligence', intelligence);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /intelligence/scans', () => {
		it('returns scan list', async () => {
			queryResults = [[{ id: 's1', type: 'security', status: 'completed' }]];
			const res = await app.request('/intelligence/scans', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.scans).toHaveLength(1);
		});

		it('returns empty when no scans', async () => {
			queryResults = [[]];
			const res = await app.request('/intelligence/scans', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.scans).toHaveLength(0);
		});

		it('requires auth', async () => {
			const res = await app.request('/intelligence/scans', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /intelligence/scans/:scanId', () => {
		it('returns scan detail', async () => {
			queryResults = [[{ id: 's1', type: 'security', findings: 5 }]];
			const res = await app.request('/intelligence/scans/s1', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.scan.id).toBe('s1');
		});

		it('returns 404 for unknown scan', async () => {
			queryResults = [[]];
			const res = await app.request('/intelligence/scans/missing', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /intelligence/user-activity', () => {
		it('returns activity snapshots', async () => {
			queryResults = [[{ userId: 'u1', snapshotDate: '2026-03-01' }]];
			const res = await app.request('/intelligence/user-activity', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.snapshots).toHaveLength(1);
		});
	});

	describe('GET /intelligence/user-activity/:userId', () => {
		it('returns user-specific activity', async () => {
			queryResults = [[{ userId: 'u2', snapshotDate: '2026-03-01' }]];
			const res = await app.request('/intelligence/user-activity/u2', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.userId).toBe('u2');
			expect(json.snapshots).toHaveLength(1);
		});
	});

	describe('POST /intelligence/trigger-scan', () => {
		it('rejects invalid scan type', async () => {
			const res = await app.request('/intelligence/trigger-scan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ scanType: 'invalid' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('queues valid unimplemented scan type', async () => {
			const res = await app.request('/intelligence/trigger-scan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ scanType: 'backup' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.status).toBe('queued');
		});

		it('rejects viewer role', async () => {
			const viewerToken = await createToken({
				sub: 'u2', email: 'v@t.com', tenantId: 't1', role: 'viewer',
			});
			const res = await app.request('/intelligence/trigger-scan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ scanType: 'security' }),
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/intelligence/trigger-scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scanType: 'security' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
