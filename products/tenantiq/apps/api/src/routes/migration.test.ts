import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { migrationRoutes } from './migration';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockQueue = { send: vi.fn() };
const mockEnv = {
	DB: { prepare: mockPrepare } as any, KV: mockKV as any,
	SCAN_QUEUE: mockQueue as any, JWT_SECRET, ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

function post(app: Hono<AppEnv>, path: string, body: any, token: string) {
	return app.request(path, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}, mockEnv);
}

describe('Migration Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/migration', migrationRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantIds: ['t1', 't2'], role: 'admin',
		});
	});

	describe('POST /api/migration/plan', () => {
		it('creates a migration plan with valid tenants', async () => {
			mockFirst
				.mockResolvedValueOnce({ id: 't1', organization_id: 'org1', display_name: 'Source' })
				.mockResolvedValueOnce({ id: 't2', organization_id: 'org1', display_name: 'Target' });

			const res = await post(app, '/api/migration/plan', {
				sourceTenantId: 't1', targetTenantId: 't2', scope: ['users', 'groups'],
			}, token);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.plan.planId).toBeDefined();
			expect(json.plan.items.length).toBeGreaterThan(0);
			expect(json.plan.estimatedDuration).toBeDefined();
			expect(mockKV.put).toHaveBeenCalled();
		});

		it('returns 400 with missing fields', async () => {
			const res = await post(app, '/api/migration/plan', { sourceTenantId: 't1' }, token);
			expect(res.status).toBe(400);
		});

		it('returns 404 when tenant not found', async () => {
			mockFirst
				.mockResolvedValueOnce({ id: 't1', organization_id: 'org1', display_name: 'Source' })
				.mockResolvedValueOnce(null);
			const res = await post(app, '/api/migration/plan', {
				sourceTenantId: 't1', targetTenantId: 't2', scope: ['users'],
			}, token);
			expect(res.status).toBe(404);
		});

		it('returns 403 when tenants belong to different orgs', async () => {
			mockFirst
				.mockResolvedValueOnce({ id: 't1', organization_id: 'org1', display_name: 'Source' })
				.mockResolvedValueOnce({ id: 't2', organization_id: 'org2', display_name: 'Target' });
			const res = await post(app, '/api/migration/plan', {
				sourceTenantId: 't1', targetTenantId: 't2', scope: ['users'],
			}, token);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/migration/plan', { method: 'POST' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/migration/execute', () => {
		it('queues migration for async processing', async () => {
			mockKV.get.mockResolvedValue(JSON.stringify({ items: [{ type: 'users', name: 'test', action: 'create' }] }));
			mockQueue.send.mockResolvedValue(undefined);
			const res = await post(app, '/api/migration/execute', { planId: 'plan-123' }, token);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.migrationId).toBeDefined();
			expect(json.status).toBe('queued');
			expect(mockQueue.send).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'migration', planId: 'plan-123' }),
			);
		});

		it('returns 404 when plan not found', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await post(app, '/api/migration/execute', { planId: 'nonexistent' }, token);
			expect(res.status).toBe(404);
		});

		it('returns 400 without planId', async () => {
			const res = await post(app, '/api/migration/execute', {}, token);
			expect(res.status).toBe(400);
		});
	});

	describe('GET /api/migration/:id/status', () => {
		it('returns migration status', async () => {
			mockKV.get.mockResolvedValue(JSON.stringify({
				status: 'running', progress: 50, itemsProcessed: 3, errors: [],
			}));
			const res = await app.request('/api/migration/mig-123/status', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.status).toBe('running');
			expect(json.progress).toBe(50);
			expect(json.itemsProcessed).toBe(3);
		});

		it('returns 404 for unknown migration', async () => {
			mockKV.get.mockResolvedValue(null);
			const res = await app.request('/api/migration/unknown/status', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('requires auth', async () => {
			const res = await app.request('/api/migration/mig-123/status', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
