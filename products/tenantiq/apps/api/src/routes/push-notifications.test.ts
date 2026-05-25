import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { pushNotificationRoutes } from './push-notifications';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() };
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET };

async function createTestToken(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

const validSub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } };

describe('Push Notification Routes', () => {
	let app: Hono;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/push', pushNotificationRoutes);
		authToken = await createTestToken({ sub: 'user-1', email: 'admin@test.com', tenantId: 'tenant-1', role: 'admin' });
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
		mockKV.delete.mockResolvedValue(undefined);
	});

	describe('POST /api/push/subscribe', () => {
		it('should save a push subscription', async () => {
			const res = await app.request('/api/push/subscribe', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(validSub)
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.subscriptionId).toBeDefined();
			expect(mockKV.put).toHaveBeenCalledTimes(1);
		});

		it('should reject missing endpoint', async () => {
			const res = await app.request('/api/push/subscribe', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ keys: { p256dh: 'k', auth: 'k' } })
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should reject missing keys', async () => {
			const res = await app.request('/api/push/subscribe', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: 'https://example.com/push' })
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(validSub)
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('DELETE /api/push/unsubscribe', () => {
		it('should remove a push subscription', async () => {
			const res = await app.request('/api/push/unsubscribe', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: validSub.endpoint })
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(mockKV.delete).toHaveBeenCalledTimes(1);
		});

		it('should reject missing endpoint', async () => {
			const res = await app.request('/api/push/unsubscribe', {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/push/unsubscribe', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: 'https://example.com/push' })
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/push/preferences', () => {
		it('should return default preferences when none stored', async () => {
			const res = await app.request('/api/push/preferences', {
				method: 'GET', headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.categories).toEqual({ security: true, backup: true, remediation: true, workflow: true });
		});

		it('should return stored preferences', async () => {
			mockKV.get.mockResolvedValue({ categories: { security: true, remediation: false, backup: true, workflow: false } });
			const res = await app.request('/api/push/preferences', {
				method: 'GET', headers: { Authorization: `Bearer ${authToken}` }
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.categories.remediation).toBe(false);
			expect(json.categories.workflow).toBe(false);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/push/preferences', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('PATCH /api/push/preferences', () => {
		it('should update notification preferences', async () => {
			const res = await app.request('/api/push/preferences', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ categories: { security: false, backup: false } })
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.categories.security).toBe(false);
			expect(json.categories.backup).toBe(false);
			expect(json.categories.remediation).toBe(true);
			expect(json.categories.workflow).toBe(true);
			expect(mockKV.put).toHaveBeenCalledTimes(1);
		});

		it('should reject missing categories object', async () => {
			const res = await app.request('/api/push/preferences', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ invalid: true })
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should ignore invalid category names', async () => {
			const res = await app.request('/api/push/preferences', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ categories: { invalidCategory: true, security: false } })
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.categories.security).toBe(false);
			expect((json.categories as any).invalidCategory).toBeUndefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/push/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ categories: { security: false } })
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
