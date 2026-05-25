import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('../lib/tenant-selector', () => ({
	getSelectedTenant: vi.fn(() => 'tenant-1'),
}));

vi.mock('../lib/webhook-notify', () => ({
	sendWebhookNotification: vi.fn(async () => ({ sent: true })),
}));

import { webhookConfigRoutes } from './webhook-config';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Webhook Config Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/webhook-config', webhookConfigRoutes);
		authToken = await createTestToken({
			sub: 'user-1', email: 'admin@test.com', orgId: 'org-1', tenantIds: ['tenant-1'], role: 'admin',
		});
	});

	describe('GET /api/webhook-config', () => {
		it('should return webhook config when set', async () => {
			mockKV.get.mockResolvedValueOnce({ url: 'https://hooks.slack.com/test', enabled: true });
			const res = await app.request('/api/webhook-config', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.config).toBeDefined();
			expect(json.config.url).toBe('https://hooks.slack.com/test');
		});

		it('should return default config when not set', async () => {
			mockKV.get.mockResolvedValueOnce(null);
			const res = await app.request('/api/webhook-config', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.config.enabled).toBe(false);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/webhook-config', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/webhook-config', () => {
		it('should save webhook config', async () => {
			const res = await app.request('/api/webhook-config', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: 'https://hooks.slack.com/new', enabled: true }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(mockKV.put).toHaveBeenCalled();
		});

		it('should return 400 when URL missing', async () => {
			const res = await app.request('/api/webhook-config', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: true }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/webhook-config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: 'https://example.com' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/webhook-config/test', () => {
		it('should send test notification', async () => {
			const res = await app.request('/api/webhook-config/test', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.sent).toBe(true);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/webhook-config/test', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
