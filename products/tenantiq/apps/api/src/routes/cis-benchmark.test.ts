import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { cisBenchmarkRoutes } from './cis-benchmark';

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn().mockImplementation(() => ({
		fetch: vi.fn().mockResolvedValue({ value: [] }),
	})),
}));

vi.mock('../lib/cis/scanner', () => ({
	fetchGraphData: vi.fn().mockResolvedValue({}),
	runEvaluation: vi.fn().mockReturnValue({
		overallScore: 72, passCount: 60, failCount: 20, partialCount: 5,
		totalControls: 85, scanDurationMs: 1200, controls: [],
	}),
}));

vi.mock('../lib/cis/control-definitions', () => ({
	CIS_CONTROLS: [{ id: 'c1', title: 'MFA' }],
	CIS_SECTIONS: [{ id: 's1', name: 'Account' }],
}));

vi.mock('../lib/cis/control-registry', () => ({
	ALL_CIS_CONTROLS: [{ id: 'c1', title: 'MFA', section: 'Identity', severity: 'critical' }],
	ALL_CIS_SECTIONS: ['Identity'],
	CONTROLS_BY_SECTION: { Identity: [{ id: 'c1', title: 'MFA' }] },
	CONTROL_COUNTS: { total: 1, critical: 1, high: 0, medium: 0, low: 0, autoRemediable: 0, sections: 1 },
}));

vi.mock('../lib/notifications', () => ({
	addNotification: vi.fn().mockResolvedValue(undefined),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
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

describe('CIS Benchmark Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/cis-benchmark', cisBenchmarkRoutes);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/cis-benchmark/controls', () => {
		it('returns control catalog', async () => {
			const res = await app.request('/api/cis-benchmark/controls', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.controls).toHaveLength(1);
			expect(json.sections).toHaveLength(1);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/cis-benchmark/controls', {
				method: 'GET',
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/cis-benchmark/latest', () => {
		it('returns cached scan result', async () => {
			mockKV.get.mockResolvedValue({ overallScore: 72, controls: [] });
			const res = await app.request('/api/cis-benchmark/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBe(72);
		});

		it('returns placeholder when no scan exists', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/cis-benchmark/latest', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.overallScore).toBeNull();
		});
	});

	describe('GET /api/cis-benchmark/history', () => {
		it('returns scan history', async () => {
			mockAll.mockResolvedValue({ results: [{ id: 's1', overall_score: 70 }] });
			const res = await app.request('/api/cis-benchmark/history', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.scans).toHaveLength(1);
		});

		it('returns empty when no tenant', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/cis-benchmark/history', {
				method: 'GET', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.scans).toEqual([]);
		});
	});

	describe('POST /api/cis-benchmark/scan', () => {
		it('requires auth', async () => {
			const res = await app.request('/api/cis-benchmark/scan', {
				method: 'POST',
			}, mockEnv);
			expect(res.status).toBe(401);
		});

		it('returns 400 when no tenant connected', async () => {
			const noTenantToken = await createToken({
				sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin',
			});
			const res = await app.request('/api/cis-benchmark/scan', {
				method: 'POST', headers: { Authorization: `Bearer ${noTenantToken}` },
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});
});
