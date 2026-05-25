import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';

vi.mock('../lib/lifecycle/step-handlers', () => ({
	STEP_REGISTRY: {
		disable_account: vi.fn(async () => ({ step: 'disable_account', status: 'success', detail: 'Done' })),
	},
}));

vi.mock('../lib/tenant-selector', () => ({
	getSelectedTenant: vi.fn(() => 'tenant-1'),
}));

vi.mock('../lib/graph-client', () => ({
	GraphClient: vi.fn(() => ({ fetch: vi.fn(async () => ({ value: [] })) })),
}));

import { lifecycleRoutes } from './lifecycle';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

const mockAll = vi.fn(() => Promise.resolve({ results: [] }));
const mockFirst = vi.fn(() => Promise.resolve(null));
const mockRun = vi.fn(() => Promise.resolve());
const mockBind = vi.fn(() => ({ all: mockAll, first: mockFirst, run: mockRun }));
const mockDB = { prepare: vi.fn(() => ({ bind: mockBind })) };
const mockKV = { get: vi.fn(), put: vi.fn() };

const mockEnv = { DB: mockDB as any, KV: mockKV as any, JWT_SECRET } as any;

async function createTestToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Lifecycle Routes', () => {
	let app: Hono<AppEnv>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/lifecycle', lifecycleRoutes);
		authToken = await createTestToken({
			sub: 'user-1', email: 'admin@test.com', orgId: 'org-1', tenantIds: ['tenant-1'], role: 'admin',
		});
	});

	describe('GET /api/lifecycle/templates', () => {
		it('should return list of templates', async () => {
			mockAll.mockResolvedValueOnce({ results: [{ id: 't1', name: 'Offboard' }] });
			const res = await app.request('/api/lifecycle/templates', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.templates).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/lifecycle/templates', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/lifecycle/templates', () => {
		it('should create a new template', async () => {
			const res = await app.request('/api/lifecycle/templates', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Offboard', type: 'offboard', steps: ['disable_account'] }),
			}, mockEnv);
			expect(res.status).toBe(201);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.id).toBeDefined();
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/lifecycle/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Offboard' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /api/lifecycle/execute', () => {
		it('should return 400 if templateId or targetUserId missing', async () => {
			const res = await app.request('/api/lifecycle/execute', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			}, mockEnv);
			expect(res.status).toBe(400);
		});

		it('should return 404 if template not found', async () => {
			mockFirst.mockResolvedValueOnce(null);
			const res = await app.request('/api/lifecycle/execute', {
				method: 'POST',
				headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ templateId: 'missing', targetUserId: 'u1' }),
			}, mockEnv);
			expect(res.status).toBe(404);
		});

		it('should require authentication', async () => {
			const res = await app.request('/api/lifecycle/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ templateId: 't1', targetUserId: 'u1' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /api/lifecycle/executions', () => {
		it('should return execution history', async () => {
			mockAll.mockResolvedValueOnce({ results: [] });
			const res = await app.request('/api/lifecycle/executions', {
				method: 'GET',
				headers: { Authorization: `Bearer ${authToken}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.executions).toBeDefined();
		});
	});
});
