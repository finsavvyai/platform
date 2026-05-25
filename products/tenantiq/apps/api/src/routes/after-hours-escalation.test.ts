import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { afterHoursRoutes } from './after-hours-escalation';

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

describe('After-Hours Escalation Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/after-hours', afterHoursRoutes);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantIds: ['t1'], role: 'admin' });
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/after-hours/evaluate', () => {
		it('evaluates after-hours escalation', async () => {
			const res = await app.request('/api/after-hours/evaluate', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ severity: 'medium', timestamp: '2026-03-28T22:00:00Z' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.context).toBeDefined();
			expect(json.routing).toBeDefined();
		});

		it('requires auth', async () => {
			const res = await app.request('/api/after-hours/evaluate', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/after-hours/config', () => {
		it('returns default config', async () => {
			const res = await app.request('/api/after-hours/config', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.config.startHour).toBe(8);
			expect(json.config.endHour).toBe(18);
		});
	});

	describe('PUT /api/after-hours/config', () => {
		it('validates hours range', async () => {
			const res = await app.request('/api/after-hours/config', {
				method: 'PUT',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ timezone: 'UTC', startHour: 25, endHour: 18, workDays: [1, 2, 3, 4, 5] }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('saves valid config', async () => {
			const res = await app.request('/api/after-hours/config', {
				method: 'PUT',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ timezone: 'US/Eastern', startHour: 9, endHour: 17, workDays: [1, 2, 3, 4, 5] }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
		});
	});
});
