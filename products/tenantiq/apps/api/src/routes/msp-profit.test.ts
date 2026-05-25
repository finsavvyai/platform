import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { mspProfitRoutes } from './msp-profit';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockD1Stmt = (data: any) => ({
	bind: vi.fn().mockReturnValue({
		all: vi.fn().mockResolvedValue({ results: Array.isArray(data) ? data : [] }),
		first: vi.fn().mockResolvedValue(data),
	}),
});

function createMockDB(tenants: any[] = [], licenses: any[] = []) {
	return {
		prepare: vi.fn((sql: string) => {
			if (sql.includes('FROM tenants')) return mockD1Stmt(tenants);
			if (sql.includes('FROM licenses_cache')) return mockD1Stmt(licenses);
			return mockD1Stmt([]);
		}),
	};
}

const mockKV = { get: vi.fn(), put: vi.fn() };

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

describe('MSP Profit Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/msp-profit', mspProfitRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@msp.com', orgId: 'org-1',
			tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	it('requires authentication', async () => {
		const res = await app.request('/api/msp-profit/overview', {
			method: 'GET',
		}, { DB: createMockDB(), KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(401);
	});

	it('returns empty array when no orgId', async () => {
		const noOrgToken = await createToken({
			sub: 'u1', email: 'a@b.com', tenantIds: [], role: 'admin',
		});
		const res = await app.request('/api/msp-profit/overview', {
			method: 'GET',
			headers: { Authorization: `Bearer ${noOrgToken}` },
		}, { DB: createMockDB(), KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.tenants).toEqual([]);
	});

	it('returns profit data for tenants with license waste', async () => {
		const tenants = [
			{ id: 't1', display_name: 'Acme Corp', domain: 'acme.com', status: 'active' },
		];
		const licenses = [
			{ sku_part_number: 'ENTERPRISEPACK', consumed_units: 50, enabled_units: 100 },
		];
		const db = createMockDB(tenants, licenses);
		const res = await app.request('/api/msp-profit/overview', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.tenants).toHaveLength(1);
		expect(json.tenants[0].savings).toBeGreaterThan(0);
		expect(json.tenants[0].name).toBe('Acme Corp');
		expect(json.period).toBe('30d');
	});

	it('uses KV cached savings when available', async () => {
		const tenants = [
			{ id: 't1', display_name: 'Cached Inc', domain: 'cached.com', status: 'active' },
		];
		mockKV.get.mockResolvedValue('2500');
		const db = createMockDB(tenants, []);
		const res = await app.request('/api/msp-profit/overview', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.tenants[0].savings).toBe(2500);
	});

	it('calculates correct totals across multiple tenants', async () => {
		const tenants = [
			{ id: 't1', display_name: 'Tenant A', domain: 'a.com', status: 'active' },
			{ id: 't2', display_name: 'Tenant B', domain: 'b.com', status: 'active' },
		];
		const licenses = [
			{ sku_part_number: 'ENTERPRISEPACK', consumed_units: 20, enabled_units: 50 },
		];
		const db = createMockDB(tenants, licenses);
		const res = await app.request('/api/msp-profit/overview', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.tenants).toHaveLength(2);
		expect(json.totals.totalCost).toBe(49 * 2);
		expect(json.totals.totalSavings).toBeGreaterThan(0);
		expect(json.totals.totalMargin).toBe(json.totals.totalSavings - json.totals.totalCost);
	});

	it('sorts tenants by ROI descending', async () => {
		const tenants = [
			{ id: 't1', display_name: 'Low ROI', domain: 'low.com', status: 'active' },
			{ id: 't2', display_name: 'High ROI', domain: 'high.com', status: 'active' },
		];
		// t2 gets cached high savings, t1 uses license calc (lower)
		mockKV.get.mockImplementation((key: string) => {
			if (key === 'savings:t2') return Promise.resolve('5000');
			return Promise.resolve(null);
		});
		const db = createMockDB(tenants, []);
		const res = await app.request('/api/msp-profit/overview', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		const json: any = await res.json();
		expect(json.tenants[0].name).toBe('High ROI');
	});
});
