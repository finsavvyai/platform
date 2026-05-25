import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { alertAnalyticsRoutes } from './alert-analytics';

let queryResults: any[];
const chainMethods = ['select', 'from', 'where', 'orderBy', 'limit'];
const mockDbChain: any = {};
for (const m of chainMethods) mockDbChain[m] = vi.fn(() => mockDbChain);
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});
const mockKV = { get: vi.fn(), put: vi.fn() };
const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET };

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})), and: vi.fn((..._a: any[]) => ({})),
	gte: vi.fn(() => ({})), desc: vi.fn(() => ({})), sql: vi.fn(() => ({})),
}));
vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: { alerts: { tenantId: {}, severity: {}, type: {}, status: {}, createdAt: {}, resolvedAt: {}, resourceId: {}, source: {} } },
}));

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

const now = new Date();
const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(now); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const alerts3 = [
	{ severity: 'critical', type: 'security', source: 'intelligence_engine', status: 'resolved', createdAt: twoDaysAgo.toISOString(), resolvedAt: yesterday.toISOString(), resourceId: 'user-1' },
	{ severity: 'high', type: 'optimization', source: 'graph_api', status: 'active', createdAt: yesterday.toISOString(), resolvedAt: null, resourceId: 'license-1' },
	{ severity: 'medium', type: 'compliance', source: 'intelligence_engine', status: 'resolved', createdAt: now.toISOString(), resolvedAt: now.toISOString(), resourceId: 'policy-1' },
];
const authHeaders = (t: string) => ({ method: 'GET' as const, headers: { Authorization: `Bearer ${t}` } });

describe('Alert Analytics Routes', () => {
	let app: Hono; let token: string;
	beforeEach(async () => {
		vi.clearAllMocks(); queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/alert-analytics', alertAnalyticsRoutes);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin' });
		mockKV.get.mockResolvedValue('0'); mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /trends', () => {
		it('returns dataPoints with trend data', async () => {
			queryResults = [alerts3];
			const res = await app.request('/api/alert-analytics/trends', authHeaders(token), mockEnv);
			expect(res.status).toBe(200);
			const j: any = await res.json();
			expect(Array.isArray(j.dataPoints)).toBe(true);
			expect(j.totalAlerts).toBe(3);
			expect(typeof j.mttr).toBe('number');
			expect(typeof j.resolutionRate).toBe('number');
		});

		it('calculates resolution rate as 0-1 decimal', async () => {
			queryResults = [alerts3];
			const res = await app.request('/api/alert-analytics/trends', authHeaders(token), mockEnv);
			const j: any = await res.json();
			expect(j.resolutionRate).toBe(0.67);
		});

		it('accepts period parameter', async () => {
			queryResults = [alerts3];
			const res = await app.request('/api/alert-analytics/trends?period=7d', authHeaders(token), mockEnv);
			expect(res.status).toBe(200);
		});

		it('rejects invalid period', async () => {
			const res = await app.request('/api/alert-analytics/trends?period=999d', authHeaders(token), mockEnv);
			expect(res.status).toBe(400);
		});

		it('includes severity counts in each dataPoint', async () => {
			queryResults = [alerts3];
			const res = await app.request('/api/alert-analytics/trends', authHeaders(token), mockEnv);
			const j: any = await res.json();
			if (j.dataPoints.length > 0) {
				const dp = j.dataPoints[0];
				for (const key of ['critical', 'high', 'medium', 'low', 'total']) {
					expect(typeof dp[key]).toBe('number');
				}
			}
		});

		it('handles empty result set', async () => {
			queryResults = [[]];
			const res = await app.request('/api/alert-analytics/trends', authHeaders(token), mockEnv);
			const j: any = await res.json();
			expect(j.totalAlerts).toBe(0);
			expect(j.resolutionRate).toBe(0);
			expect(j.mttr).toBe(0);
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/alert-analytics/trends', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /distribution', () => {
		it('returns byType, bySeverity, and topCategories', async () => {
			queryResults = [alerts3];
			const res = await app.request('/api/alert-analytics/distribution', authHeaders(token), mockEnv);
			expect(res.status).toBe(200);
			const j: any = await res.json();
			expect(Array.isArray(j.byType)).toBe(true);
			expect(Array.isArray(j.bySeverity)).toBe(true);
			expect(Array.isArray(j.topCategories)).toBe(true);
		});

		it('counts types correctly', async () => {
			queryResults = [alerts3];
			const res = await app.request('/api/alert-analytics/distribution', authHeaders(token), mockEnv);
			const j: any = await res.json();
			expect(j.byType.find((t: any) => t.type === 'security')?.count).toBe(1);
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/alert-analytics/distribution', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /recurring', () => {
		it('detects recurring alerts (same type + resource)', async () => {
			queryResults = [[
				{ type: 'security', resourceId: 'user-1', createdAt: twoDaysAgo.toISOString() },
				{ type: 'security', resourceId: 'user-1', createdAt: yesterday.toISOString() },
				{ type: 'security', resourceId: 'user-1', createdAt: now.toISOString() },
				{ type: 'compliance', resourceId: 'policy-1', createdAt: now.toISOString() },
			]];
			const res = await app.request('/api/alert-analytics/recurring', authHeaders(token), mockEnv);
			expect(res.status).toBe(200);
			const j: any = await res.json();
			expect(j.recurring).toHaveLength(1);
			expect(j.recurring[0].alertType).toBe('security');
			expect(j.recurring[0].resourceId).toBe('user-1');
			expect(j.recurring[0].count).toBe(3);
		});

		it('returns empty array when no recurring alerts', async () => {
			queryResults = [[
				{ type: 'security', resourceId: 'user-1', createdAt: now.toISOString() },
				{ type: 'compliance', resourceId: 'policy-1', createdAt: now.toISOString() },
			]];
			const res = await app.request('/api/alert-analytics/recurring', authHeaders(token), mockEnv);
			const j: any = await res.json();
			expect(j.recurring).toHaveLength(0);
		});

		it('sorts by count descending', async () => {
			queryResults = [[
				{ type: 'a', resourceId: 'r1', createdAt: now.toISOString() },
				{ type: 'a', resourceId: 'r1', createdAt: yesterday.toISOString() },
				{ type: 'b', resourceId: 'r2', createdAt: now.toISOString() },
				{ type: 'b', resourceId: 'r2', createdAt: yesterday.toISOString() },
				{ type: 'b', resourceId: 'r2', createdAt: twoDaysAgo.toISOString() },
			]];
			const res = await app.request('/api/alert-analytics/recurring', authHeaders(token), mockEnv);
			const j: any = await res.json();
			expect(j.recurring[0].count).toBeGreaterThan(j.recurring[1].count);
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/alert-analytics/recurring', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
