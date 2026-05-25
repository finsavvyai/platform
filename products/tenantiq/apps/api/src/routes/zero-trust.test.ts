import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._a: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@tenantiq/db', () => ({ getTenantById: vi.fn() }));

const mockGraphFetch = vi.fn();
vi.mock('../lib/graph-client', () => ({
	createGraphClient: vi.fn(() => ({ fetch: mockGraphFetch })),
}));

vi.mock('../lib/graph-client-extended', () => ({
	getRiskyUsers: vi.fn().mockResolvedValue([]),
	getConditionalAccessPolicies: vi.fn().mockResolvedValue([
		{ state: 'enabled' }, { state: 'enabled' }, { state: 'disabled' },
	]),
	getMfaRegistrationDetails: vi.fn().mockResolvedValue([
		{ isMfaRegistered: true }, { isMfaRegistered: true }, { isMfaRegistered: false },
	]),
}));

import { getTenantById } from '@tenantiq/db';
import zeroTrust from './zero-trust';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test' } as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Zero Trust Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/zero-trust', zeroTrust);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin' });
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /zero-trust/assessment', () => {
		it('returns full Zero Trust assessment', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({ value: [{ currentScore: 60, maxScore: 100 }] });

			const res = await app.request('/zero-trust/assessment', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBeDefined();
			expect(json.maturityLevel).toBeDefined();
			expect(json.pillars).toHaveLength(6);
			expect(json.timestamp).toBeDefined();
		});

		it('returns cached assessment from KV', async () => {
			const cached = {
				overallScore: 75, maturityLevel: 'advanced',
				pillars: [], timestamp: '2026-03-26T00:00:00Z',
			};
			mockKV.get.mockResolvedValue(cached);

			const res = await app.request('/zero-trust/assessment', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBe(75);
			expect(mockGraphFetch).not.toHaveBeenCalled();
		});

		it('caches assessment in KV after computation', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({ value: [{ currentScore: 60, maxScore: 100 }] });

			await app.request('/zero-trust/assessment', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(mockKV.put).toHaveBeenCalledWith(
				expect.stringContaining('zero-trust:'),
				expect.any(String),
				expect.objectContaining({ expirationTtl: 86400 }),
			);
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);
			const res = await app.request('/zero-trust/assessment', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/zero-trust/assessment', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns all 6 pillar names', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({ value: [{ currentScore: 80, maxScore: 100 }] });

			const res = await app.request('/zero-trust/assessment', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			const json: any = await res.json();
			const names = json.pillars.map((p: any) => p.name);
			expect(names).toContain('Identity');
			expect(names).toContain('Devices');
			expect(names).toContain('Network');
			expect(names).toContain('Applications');
			expect(names).toContain('Data');
			expect(names).toContain('Infrastructure');
		});
	});

	describe('GET /zero-trust/roadmap', () => {
		it('returns improvement roadmap', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({ value: [{ currentScore: 40, maxScore: 100 }] });

			const res = await app.request('/zero-trust/roadmap', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.currentScore).toBeDefined();
			expect(json.roadmap).toBeDefined();
			expect(Array.isArray(json.roadmap)).toBe(true);
			expect(json.roadmap.length).toBeGreaterThan(0);
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);
			const res = await app.request('/zero-trust/roadmap', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});
});
