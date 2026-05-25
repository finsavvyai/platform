import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import securityCompliance from './security-compliance';

let queryResults: unknown[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({ getDb: () => mockDbChain }));

vi.mock('@tenantiq/db', () => ({
	getTenantById: vi.fn(async () => ({ id: 't1', displayName: 'Acme', azureTenantId: 'az-1' })),
}));

vi.mock('../lib/graph-client', () => ({
	createGraphClient: vi.fn(() => ({})),
}));

vi.mock('../lib/graph-client-extended', () => ({
	getConditionalAccessPolicies: vi.fn(async () => [
		{ id: 'p1', state: 'enabled' }, { id: 'p2', state: 'disabled' },
	]),
	getMfaRegistrationDetails: vi.fn(async () => [
		{ id: 'u1', isMfaRegistered: true }, { id: 'u2', isMfaRegistered: false },
	]),
	getRiskyUsers: vi.fn(async () => [{ id: 'ru1', riskLevel: 'high' }]),
	getRiskDetections: vi.fn(async () => [
		{ id: 'd1', detectedDateTime: new Date().toISOString() },
	]),
	getAppRegistrations: vi.fn(async () => []),
}));

vi.mock('../lib/compliance-frameworks', () => ({
	buildGdprFramework: vi.fn(() => ({ id: 'gdpr', name: 'GDPR', score: 72, controls: [] })),
	buildHipaaFramework: vi.fn(() => ({ id: 'hipaa', name: 'HIPAA', score: 65, controls: [] })),
	buildSoc2Framework: vi.fn(() => ({ id: 'soc2', name: 'SOC 2', score: 80, controls: [] })),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Security Compliance Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/security', securityCompliance);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/security/compliance', () => {
		it('returns compliance frameworks data', async () => {
			const res = await app.request('/api/security/compliance', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.frameworks).toHaveLength(3);
			expect(json.frameworks[0].id).toBe('gdpr');
			expect(json.timestamp).toBeDefined();
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/security/compliance', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/security/risks', () => {
		it('returns risk assessment data', async () => {
			const res = await app.request('/api/security/risks', {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.risks).toBeDefined();
			expect(json.summary).toBeDefined();
			expect(json.summary).toHaveProperty('total');
			expect(json.summary).toHaveProperty('critical');
			expect(json.timestamp).toBeDefined();
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/security/risks', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
