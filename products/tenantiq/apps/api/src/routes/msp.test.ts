import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { mspRoutes } from './msp';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };

const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockAll = vi.fn();
const mockFirst = vi.fn();

const mockDB = {
	prepare: mockPrepare,
} as any;

function setupDbChain(results: any[]) {
	mockPrepare.mockReturnValue({ bind: mockBind });
	let callIdx = 0;
	mockBind.mockImplementation(() => ({
		all: () => {
			const r = results[callIdx] ?? { results: [] };
			callIdx++;
			return Promise.resolve(r);
		},
		first: () => {
			const r = results[callIdx] ?? null;
			callIdx++;
			return Promise.resolve(r);
		},
	}));
}

const mockEnv = { DB: mockDB, KV: mockKV as any, JWT_SECRET } as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

vi.mock('../lib/constants', () => ({
	getSkuCost: vi.fn(() => 12),
}));

describe('MSP Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/msp', mspRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantId: 't1', orgId: 'org-1', role: 'admin',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/msp/overview', () => {
		it('returns MSP overview with tenants and summary', async () => {
			setupDbChain([
				{ results: [{ id: 't1', display_name: 'Acme', domain: 'acme.com', status: 'active', last_sync_at: new Date().toISOString() }] },
				{ total: 10 },
				{ results: [{ sku_part_number: 'E3', consumed_units: 8, enabled_units: 10 }] },
				{ results: [{ severity: 'high', cnt: 2 }] },
			]);

			const res = await app.request('/api/msp/overview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toBeDefined();
			expect(json.summary).toBeDefined();
			expect(json.summary).toHaveProperty('totalTenants');
		});

		it('returns empty tenants when org has no tenants', async () => {
			setupDbChain([{ results: [] }]);

			const res = await app.request('/api/msp/overview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toHaveLength(0);
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/msp/overview', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns empty when no orgId', async () => {
			const noOrgToken = await createToken({
				sub: 'u1', email: 'a@test.com', tenantId: 't1', role: 'admin',
			});
			setupDbChain([]);

			const res = await app.request('/api/msp/overview', {
				method: 'GET',
				headers: { Authorization: `Bearer ${noOrgToken}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.tenants).toHaveLength(0);
		});
	});
});
