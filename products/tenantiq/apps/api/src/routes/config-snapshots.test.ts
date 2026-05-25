import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { configSnapshotRoutes } from './config-snapshots';
import { AppError } from '../lib/errors';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetch: vi.fn().mockResolvedValue({ value: [] }),
	})),
}));

vi.mock('../lib/snapshots/capture', () => ({
	captureSnapshot: vi.fn().mockResolvedValue({ id: 'snap1', categories: ['auth'] }),
	getSnapshotManifest: vi.fn(),
	getSnapshotCategory: vi.fn(),
}));

vi.mock('../lib/snapshots/diff', () => ({
	diffSnapshots: vi.fn().mockReturnValue([{ categoryId: 'auth', changeCount: 2 }]),
}));

vi.mock('../lib/snapshots/config-reader', () => ({
	CONFIG_CATEGORIES: [{ id: 'auth', name: 'Authentication' }],
}));

import { getSnapshotManifest, getSnapshotCategory } from '../lib/snapshots/capture';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll }));
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

describe('Config Snapshot Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/config-snapshots', configSnapshotRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	describe('GET /api/config-snapshots', () => {
		it('returns snapshot list', async () => {
			mockAll.mockResolvedValue({ results: [{ id: 'snap1' }] });
			const res = await app.request('/api/config-snapshots', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.snapshots).toHaveLength(1);
		});

		it('returns empty when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/config-snapshots', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.snapshots).toEqual([]);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/config-snapshots', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/config-snapshots/:id', () => {
		it('returns snapshot manifest', async () => {
			vi.mocked(getSnapshotManifest).mockResolvedValue({ id: 'snap1', categories: ['auth'] } as any);
			const res = await app.request('/api/config-snapshots/snap1', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.snapshot.id).toBe('snap1');
			expect(json.categories).toBeDefined();
		});

		it('returns 404 for missing snapshot', async () => {
			vi.mocked(getSnapshotManifest).mockResolvedValue(null as any);
			const res = await app.request('/api/config-snapshots/missing', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /api/config-snapshots/:id/category/:cat', () => {
		it('returns category data', async () => {
			vi.mocked(getSnapshotCategory).mockResolvedValue({ data: { policies: [] } } as any);
			const res = await app.request('/api/config-snapshots/snap1/category/auth', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('returns 404 for missing category', async () => {
			vi.mocked(getSnapshotCategory).mockResolvedValue(null as any);
			const res = await app.request('/api/config-snapshots/snap1/category/nope', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /api/config-snapshots/:id/diff/:otherId', () => {
		it('returns diff between two snapshots', async () => {
			vi.mocked(getSnapshotManifest).mockResolvedValue({ id: 's1', categories: ['auth'] } as any);
			vi.mocked(getSnapshotCategory).mockResolvedValue({ data: {} } as any);
			const res = await app.request('/api/config-snapshots/s1/diff/s2', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.diffs).toBeDefined();
			expect(json.totalChanges).toBeDefined();
		});

		it('returns 404 when snapshot missing', async () => {
			vi.mocked(getSnapshotManifest).mockResolvedValueOnce(null as any);
			vi.mocked(getSnapshotManifest).mockResolvedValueOnce({ id: 's2', categories: [] } as any);
			const res = await app.request('/api/config-snapshots/bad/diff/s2', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('POST /api/config-snapshots/capture', () => {
		it('requires auth', async () => {
			const res = await app.request('/api/config-snapshots/capture', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/config-snapshots/capture', {
				method: 'POST', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});
});
