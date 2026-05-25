import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { copilotReadinessRoutes } from './copilot-readiness';
import { AppError } from '../lib/errors';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetch: vi.fn().mockResolvedValue({ value: [] }),
	})),
}));

vi.mock('../lib/copilot-readiness', () => ({
	assessCopilotReadiness: vi.fn().mockResolvedValue({
		overallScore: 68, dimensions: { licensing: 80, security: 60 },
		recommendations: ['Enable MFA'],
	}),
}));

vi.mock('../lib/copilot-history', () => ({
	appendReadinessHistory: vi.fn().mockResolvedValue(undefined),
	getReadinessHistory: vi.fn().mockResolvedValue({
		entries: [{ score: 68, date: '2026-03-01' }],
	}),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockFirst = vi.fn();
const mockAll = vi.fn();
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

describe('Copilot Readiness Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/copilot-readiness', copilotReadinessRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/copilot-readiness/latest', () => {
		it('returns cached assessment', async () => {
			mockKV.get.mockResolvedValue({ overallScore: 68, dimensions: {} });
			const res = await app.request('/api/copilot-readiness/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBe(68);
		});

		it('returns placeholder when no assessment', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/copilot-readiness/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBeNull();
			expect(json.message).toBe('No assessment yet');
		});

		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/copilot-readiness/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/copilot-readiness/latest', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/copilot-readiness/history', () => {
		it('returns readiness history', async () => {
			mockAll.mockResolvedValueOnce({
				results: [{ id: 'a1', overall_score: 68, category_scores: '{}', completed_at: '2026-03-01' }],
			});
			const res = await app.request('/api/copilot-readiness/history', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json).toHaveLength(1);
			expect(json[0].score).toBe(68);
		});

		it('returns empty array when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/copilot-readiness/history', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json).toEqual([]);
		});
	});

	describe('POST /api/copilot-readiness/assess', () => {
		it('requires auth', async () => {
			const res = await app.request('/api/copilot-readiness/assess', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/copilot-readiness/assess', {
				method: 'POST', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('GET /api/copilot-readiness/license-summary', () => {
		it('returns 200 with license summary fields when tenant has cached assessment', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'azure-t1', display_name: 'Test Tenant' });
			mockKV.get.mockResolvedValue({
				overallScore: 72,
				categories: {
					collaboration: { score: 60, checks: [{ id: 'public_groups', status: 'warning', detail: '3 public groups found' }] },
					dataProtection: { score: 55, checks: [{ id: 'sensitivity_labels', status: 'warning', detail: '2 labels published' }] },
					licensing: { score: 80, checks: [{ id: 'copilot_licenses', status: 'pass', detail: 'Copilot licenses available (45 seats)' }] },
				},
				recommendations: [],
				assessedAt: '2026-04-22T00:00:00Z',
			});
			const res = await app.request('/api/copilot-readiness/license-summary', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(typeof json.copilotLicensed).toBe('number');
			expect(typeof json.totalLicensed).toBe('number');
			expect(typeof json.overshareRiskCount).toBe('number');
			expect(typeof json.labelGapCount).toBe('number');
		});

		it('returns 400 when no tenant in JWT', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/copilot-readiness/license-summary', {
				method: 'GET', headers: { Authorization: `Bearer ${noT}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('returns 401 when no Authorization header', async () => {
			const res = await app.request('/api/copilot-readiness/license-summary', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns 404 when no KV cache entry for tenant', async () => {
			mockFirst.mockResolvedValue({ azure_tenant_id: 'azure-t1', display_name: 'Test Tenant' });
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/copilot-readiness/license-summary', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});
});
