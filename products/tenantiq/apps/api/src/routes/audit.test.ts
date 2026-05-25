import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

let queryResults: any[];

const chainMethods = ['select', 'from', 'where', 'orderBy', 'limit'];
const mockDbChain: any = {};
for (const method of chainMethods) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: any) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._a: any[]) => ({})),
	desc: vi.fn(() => ({})),
	gte: vi.fn(() => ({})),
	lte: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		auditLogs: {
			tenantId: {}, eventType: {}, actorId: {}, timestamp: {},
		},
		reports: {
			tenantId: {}, createdAt: {},
		},
	},
}));

import audit from './audit';

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

describe('Audit Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/audit', audit);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /audit/logs', () => {
		it('returns audit logs with count', async () => {
			const logs = [
				{ id: 'l1', eventType: 'login', actorId: 'u1', timestamp: '2026-03-01' },
				{ id: 'l2', eventType: 'config_change', actorId: 'u1', timestamp: '2026-03-02' },
			];
			queryResults = [logs];

			const res = await app.request('/audit/logs', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.logs).toHaveLength(2);
			expect(json.count).toBe(2);
		});

		it('returns empty when no logs', async () => {
			queryResults = [[]];
			const res = await app.request('/audit/logs', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.logs).toHaveLength(0);
			expect(json.count).toBe(0);
		});

		it('accepts filter parameters', async () => {
			queryResults = [[{ id: 'l1', eventType: 'login' }]];
			const res = await app.request('/audit/logs?eventType=login&actorId=u1', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('accepts date range filters', async () => {
			queryResults = [[]];
			const res = await app.request(
				'/audit/logs?startDate=2026-01-01&endDate=2026-03-01', {
					method: 'GET', headers: { Authorization: `Bearer ${token}` },
				}, mockEnv);
			expect(res.status).toBe(200);
		});

		it('requires auth', async () => {
			const res = await app.request('/audit/logs', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /audit/reports', () => {
		it('returns reports list', async () => {
			queryResults = [[{ id: 'r1', title: 'Monthly Report', tenantId: 't1' }]];

			const res = await app.request('/audit/reports', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.reports).toHaveLength(1);
		});

		it('returns empty when no reports', async () => {
			queryResults = [[]];
			const res = await app.request('/audit/reports', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.reports).toHaveLength(0);
		});

		it('requires auth', async () => {
			const res = await app.request('/audit/reports', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
