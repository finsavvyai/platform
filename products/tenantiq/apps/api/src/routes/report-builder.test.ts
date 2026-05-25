import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { reportBuilderRoutes } from './report-builder';

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

describe('Report Builder Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/report-builder', reportBuilderRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /api/report-builder/metrics', () => {
		it('returns available metrics with required fields', async () => {
			const res = await app.request('/api/report-builder/metrics', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.metrics.length).toBeGreaterThanOrEqual(10);
			const ids = json.metrics.map((m: any) => m.id);
			expect(ids).toContain('secure_score');
			expect(ids).toContain('monthly_cost');
			for (const m of json.metrics) {
				expect(m).toHaveProperty('id');
				expect(m).toHaveProperty('name');
				expect(m).toHaveProperty('category');
				expect(m).toHaveProperty('type');
			}
		});

		it('requires auth', async () => {
			const res = await app.request('/api/report-builder/metrics', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/report-builder/generate', () => {
		it('generates report with selected metrics', async () => {
			const res = await app.request('/api/report-builder/generate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: ['secure_score', 'total_users'], period: '30d', title: 'My Report' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.title).toBe('My Report');
			expect(json.period).toBe('30d');
			expect(json.generatedAt).toBeDefined();
			expect(json.widgets).toHaveLength(2);
			expect(json.widgets[0].metricId).toBe('secure_score');
			expect(json.widgets[1].metricId).toBe('total_users');
		});

		it('returns default title when none provided', async () => {
			const res = await app.request('/api/report-builder/generate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: ['alert_count'], period: '7d' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.title).toBe('Custom Report');
		});

		it('rejects empty metrics array', async () => {
			const res = await app.request('/api/report-builder/generate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: [], period: '30d' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('rejects unknown metric ids', async () => {
			const res = await app.request('/api/report-builder/generate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: ['nonexistent'], period: '30d' }),
			}, mockEnv);
			expect(res.status).toBe(400);
			const json: any = await res.json();
			expect(json.error).toContain('nonexistent');
		});

		it('returns 400 when no tenant', async () => {
			const noT = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: [], role: 'admin' });
			const res = await app.request('/api/report-builder/generate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${noT}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: ['secure_score'], period: '30d' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/report-builder/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ metrics: ['secure_score'], period: '30d' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/report-builder/templates', () => {
		it('saves a report template', async () => {
			const res = await app.request('/api/report-builder/templates', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Security Overview', metrics: ['secure_score', 'mfa_rate'], period: '30d', layout: 'grid' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.template.name).toBe('Security Overview');
			expect(json.template.id).toBeDefined();
			expect(mockKV.put).toHaveBeenCalled();
		});

		it('rejects missing name', async () => {
			const res = await app.request('/api/report-builder/templates', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: '', metrics: ['secure_score'], period: '30d', layout: 'grid' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/report-builder/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Test', metrics: ['secure_score'], period: '30d', layout: 'grid' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/report-builder/templates', () => {
		it('returns saved templates', async () => {
			const template = { id: 'tpl-1', name: 'Security', metrics: ['secure_score'], period: '30d' };
			mockKV.get.mockImplementation((key: string, format?: string) => {
				if (key.includes('index')) return Promise.resolve(['tpl-1']);
				if (key.includes('tpl-1')) return Promise.resolve(template);
				return Promise.resolve(null);
			});
			const res = await app.request('/api/report-builder/templates', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.templates).toHaveLength(1);
			expect(json.templates[0].name).toBe('Security');
		});

		it('returns empty array when no templates', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/report-builder/templates', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.templates).toHaveLength(0);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/report-builder/templates', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
