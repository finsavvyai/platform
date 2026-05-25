import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._a: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

// Mock db module
vi.mock('../lib/db', () => ({
	getDb: () => ({}),
	schema: {},
}));

// Mock tenant lookup
vi.mock('@tenantiq/db', () => ({
	getTenantById: vi.fn(),
}));

// Mock graph-client
const mockGraphFetch = vi.fn();
const mockGetSecurityAlerts = vi.fn();
vi.mock('../lib/graph-client', () => ({
	createGraphClient: vi.fn(() => ({
		fetch: mockGraphFetch,
		getSecurityAlerts: mockGetSecurityAlerts,
	})),
}));

// Mock graph-client-extended
vi.mock('../lib/graph-client-extended', () => ({
	getRiskyUsers: vi.fn().mockResolvedValue([]),
	getConditionalAccessPolicies: vi.fn().mockResolvedValue([]),
	getMfaRegistrationDetails: vi.fn().mockResolvedValue([]),
}));

// Mock security-helpers
vi.mock('../lib/security-helpers', () => ({
	analyzeSecurityPosture: vi.fn().mockResolvedValue({
		mfaStatus: 'good', passwordPolicy: 'strong', conditionalAccess: 'configured',
	}),
}));

import { getTenantById } from '@tenantiq/db';
import security from './security';

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

describe('Security Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/security', security);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /security/dashboard', () => {
		it('returns security dashboard data', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({
				value: [{ currentScore: 60, maxScore: 100 }],
			});
			mockGetSecurityAlerts.mockResolvedValue([]);

			const res = await app.request('/security/dashboard', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.securityScore).toBeDefined();
			expect(json.riskLevel).toBeDefined();
			expect(json.mfa).toBeDefined();
			expect(json.timestamp).toBeDefined();
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);

			const res = await app.request('/security/dashboard', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/security/dashboard', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /security/posture', () => {
		it('returns security posture analysis', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);

			const res = await app.request('/security/posture', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.mfaStatus).toBe('good');
			expect(json.timestamp).toBeDefined();
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);

			const res = await app.request('/security/posture', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/security/posture', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
