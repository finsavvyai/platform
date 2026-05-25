import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { storageAnalyticsRoutes } from './storage-analytics';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetch: vi.fn().mockResolvedValue({ value: [] }),
	})),
}));

vi.mock('../lib/storage/storage-scanner', () => ({
	scanOneDriveUsage: vi.fn().mockResolvedValue([]),
	scanSharePointUsage: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/storage/storage-analyzer', () => ({
	buildFullScanResult: vi.fn().mockReturnValue({
		oneDriveUsers: [],
		sharePointSites: [],
		overview: { totalUsedGB: 10, totalAllocatedGB: 100, utilizationPct: 10 },
		recommendations: [],
		unusedLicenses: [],
	}),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockRun = vi.fn().mockResolvedValue({ success: true });
const mockBind = vi.fn(() => ({ first: vi.fn(), run: mockRun, bind: mockBind }));
const mockFirst = vi.fn();
const mockPrepare = vi.fn(() => ({ bind: (...args: any[]) => ({ first: mockFirst, run: mockRun }) }));

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

describe('Storage Analytics Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/storage-analytics', storageAnalyticsRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin', orgId: 'org1',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/storage-analytics', () => {
		it('returns cached storage data', async () => {
			const cached = { overview: { totalUsedGB: 10 }, oneDriveUsers: [{ userId: 'u1' }], sharePointSites: [], recommendations: [], unusedLicenses: [] };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/storage-analytics', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.oneDriveUsers).toHaveLength(1);
		});

		it('returns empty when no cache', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/storage-analytics', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overview).toBeNull();
		});

		it('returns empty when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/storage-analytics', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/storage-analytics', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/storage-analytics/scan', () => {
		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/storage-analytics/scan', {
				method: 'POST', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('returns 404 when tenant not found', async () => {
			mockFirst.mockResolvedValue(null);
			const res = await app.request('/api/storage-analytics/scan', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('returns 403 when no Graph token', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'az1' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/storage-analytics/scan', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/storage-analytics/scan', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/storage-analytics/onedrive', () => {
		it('returns cached onedrive data', async () => {
			const cached = { oneDriveUsers: [{ userId: 'u1', displayName: 'Test' }] };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/storage-analytics/onedrive', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.users).toHaveLength(1);
		});

		it('returns empty when no cache', async () => {
			const res = await app.request('/api/storage-analytics/onedrive', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			const json: any = await res.json();
			expect(json.users).toEqual([]);
		});
	});

	describe('GET /api/storage-analytics/sharepoint', () => {
		it('returns cached sharepoint data', async () => {
			const cached = { sharePointSites: [{ siteId: 's1' }] };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/storage-analytics/sharepoint', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.sites).toHaveLength(1);
		});
	});

	describe('GET /api/storage-analytics/recommendations', () => {
		it('returns cached recommendations', async () => {
			const cached = { recommendations: [{ id: 'r1', title: 'Test' }] };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/storage-analytics/recommendations', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			const json: any = await res.json();
			expect(json.recommendations).toHaveLength(1);
		});
	});

	describe('GET /api/storage-analytics/unused-licenses', () => {
		it('returns cached unused licenses', async () => {
			const cached = { unusedLicenses: [{ userId: 'u1' }] };
			mockKV.get.mockResolvedValue(cached);
			const res = await app.request('/api/storage-analytics/unused-licenses', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			const json: any = await res.json();
			expect(json.licenses).toHaveLength(1);
		});
	});
});
