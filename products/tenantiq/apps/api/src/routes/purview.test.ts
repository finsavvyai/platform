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

import { getTenantById } from '@tenantiq/db';
import purview from './purview';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test' } as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Purview Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/purview', purview);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /purview/dlp', () => {
		it('returns DLP policies and compliance score', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({
				value: [
					{ id: '1', displayName: 'PII Policy', isEnabled: true, sensitiveTypeIds: ['SSN'], locations: ['Exchange'], actions: ['BlockAccess'] },
					{ id: '2', displayName: 'Finance Policy', state: 'disabled', sensitiveTypeIds: [], locations: [], actions: [] },
				],
			});

			const res = await app.request('/purview/dlp', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.policies).toHaveLength(2);
			expect(json.compliance.score).toBeDefined();
			expect(json.compliance.enforced).toBe(1);
			expect(json.timestamp).toBeDefined();
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);
			const res = await app.request('/purview/dlp', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/purview/dlp', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /purview/labels', () => {
		it('returns sensitivity labels and adoption data', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({
				value: [
					{ id: '1', name: 'Public', isActive: true, isEncryptionEnabled: false },
					{ id: '2', name: 'Confidential', isActive: true, isEncryptionEnabled: true, isAutoLabelingEnabled: true },
				],
			});

			const res = await app.request('/purview/labels', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.labels).toHaveLength(2);
			expect(json.adoption.totalLabels).toBe(2);
			expect(json.adoption.adoptionScore).toBeGreaterThan(0);
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);
			const res = await app.request('/purview/labels', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('GET /purview/overview', () => {
		it('returns combined purview dashboard data', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockResolvedValue({ value: [] });

			const res = await app.request('/purview/overview', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.dlpScore).toBeDefined();
			expect(json.labelAdoptionScore).toBeDefined();
			expect(json.overallScore).toBeDefined();
			expect(json.recommendations).toBeDefined();
		});

		it('returns 400 when tenant not configured', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: null } as any);
			const res = await app.request('/purview/overview', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('handles Graph API errors gracefully', async () => {
			vi.mocked(getTenantById).mockResolvedValue({ azureTenantId: 'az1' } as any);
			mockGraphFetch.mockRejectedValue(new Error('Graph unavailable'));

			const res = await app.request('/purview/overview', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBe(0);
		});

		it('requires auth', async () => {
			const res = await app.request('/purview/overview', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
