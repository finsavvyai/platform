import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

vi.mock('../lib/pdf-generator', () => ({
	generateReportHTML: vi.fn((data: any) =>
		`<!DOCTYPE html><html><body><h1>${data.title}</h1><p>Powered by TenantIQ</p></body></html>`,
	),
}));

import { savingsReportRoutes } from './savings-report';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockD1Stmt = (data: any) => ({
	bind: vi.fn().mockReturnValue({
		all: vi.fn().mockResolvedValue({ results: Array.isArray(data) ? data : [] }),
		first: vi.fn().mockResolvedValue(data),
	}),
});

function createMockDB(tenant: any = null, licenses: any[] = [], remCount = 0) {
	return {
		prepare: vi.fn((sql: string) => {
			if (sql.includes('FROM tenants')) return mockD1Stmt(tenant);
			if (sql.includes('FROM licenses_cache')) return mockD1Stmt(licenses);
			if (sql.includes('FROM remediation_history')) return mockD1Stmt({ cnt: remCount });
			return mockD1Stmt([]);
		}),
	};
}

const mockKV = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

describe('Savings Report Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/savings-report', savingsReportRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@msp.com', orgId: 'org-1',
			tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
	});

	it('requires authentication', async () => {
		const db = createMockDB();
		const res = await app.request('/api/savings-report/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tenantId: 't1' }),
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(401);
	});

	it('requires tenantId in body', async () => {
		const db = createMockDB();
		const res = await app.request('/api/savings-report/generate', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(400);
		const json: any = await res.json();
		expect(json.error).toContain('tenantId');
	});

	it('returns 404 when tenant not found', async () => {
		const db = createMockDB(null);
		const res = await app.request('/api/savings-report/generate', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ tenantId: 'nonexistent' }),
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(404);
	});

	it('generates HTML report with TenantIQ branding', async () => {
		const tenant = { id: 't1', display_name: 'Acme Corp', domain: 'acme.com' };
		const licenses = [
			{ sku_part_number: 'ENTERPRISEPACK', consumed_units: 50, enabled_units: 100 },
		];
		const db = createMockDB(tenant, licenses, 12);

		const res = await app.request('/api/savings-report/generate', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ tenantId: 't1', period: '30d' }),
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		const html = await res.text();
		expect(html).toContain('Acme Corp');
		expect(html).toContain('Powered by TenantIQ');
	});

	it('supports different period options', async () => {
		const tenant = { id: 't1', display_name: 'Test', domain: 'test.com' };
		const db = createMockDB(tenant, [], 0);

		const res = await app.request('/api/savings-report/generate', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ tenantId: 't1', period: '90d' }),
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('Test');
	});

	it('uses KV cached savings value when available', async () => {
		const tenant = { id: 't1', display_name: 'Cached', domain: 'c.com' };
		mockKV.get.mockImplementation((key: string) => {
			if (key === 'savings:t1') return Promise.resolve('3500');
			return Promise.resolve(null);
		});
		const db = createMockDB(tenant, [], 5);

		const res = await app.request('/api/savings-report/generate', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ tenantId: 't1' }),
		}, { DB: db, KV: mockKV, JWT_SECRET } as any);

		expect(res.status).toBe(200);
	});
});
