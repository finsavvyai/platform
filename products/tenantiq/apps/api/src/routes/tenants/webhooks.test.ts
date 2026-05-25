import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import tenantWebhookRoutes from './webhooks';

let queryResults: unknown[] = [];

const mockDbChain: any = {};
for (const method of ['select', 'from', 'where', 'limit', 'update', 'set', 'insert', 'values', 'delete']) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: (value: unknown) => void) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
}));

vi.mock('../../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		webhookConfigs: {
			id: {},
			tenantId: {},
			createdAt: {},
			updatedAt: {},
		},
	},
}));

vi.mock('../../middleware/auth', () => ({
	authMiddleware: async (c: any, next: () => Promise<void>) => {
		const auth = c.req.header('authorization');
		if (!auth || auth !== 'Bearer good-token') {
			return c.json({ error: 'Unauthorized' }, 401);
		}
		c.set('user', {
			sub: 'user-1',
			email: 'user@test.com',
			name: 'User',
			orgId: 'org-1',
			tenantIds: ['tenant-1'],
			role: 'admin',
		});
		await next();
	},
}));

vi.mock('../../middleware/tenant', () => ({
	tenantMiddleware: async (c: any, next: () => Promise<void>) => {
		const tenantId = c.req.param('tenantId');
		const user = c.get('user');
		if (!user?.tenantIds?.includes(tenantId)) {
			return c.json({ error: 'Access denied to this tenant' }, 403);
		}
		c.set('tenantId', tenantId);
		await next();
	},
}));

describe('Tenant Webhook Routes', () => {
	let app: Hono<AppEnv>;
	const env = {
		JWT_SECRET: 'test-secret',
		ENVIRONMENT: 'test',
		KV: {} as KVNamespace,
		R2: {} as R2Bucket,
		SCAN_QUEUE: {} as Queue,
		REMEDIATION_QUEUE: {} as Queue,
		NOTIFICATION_QUEUE: {} as Queue,
		TENANT_EVENTS: {} as DurableObjectNamespace,
		DB: {} as D1Database,
	} as AppEnv['Bindings'];

	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/tenants/:tenantId/webhooks', tenantWebhookRoutes);
	});

	it('requires auth', async () => {
		const res = await app.request('/api/tenants/tenant-1/webhooks/config', { method: 'GET' }, env);
		expect(res.status).toBe(401);
	});

	it('returns 403 for tenant outside user scope', async () => {
		const res = await app.request(
			'/api/tenants/tenant-2/webhooks/config',
			{ method: 'GET', headers: { Authorization: 'Bearer good-token' } },
			env
		);
		expect(res.status).toBe(403);
	});

	it('creates webhook config and serializes categories', async () => {
		queryResults = [[], []];

		const res = await app.request(
			'/api/tenants/tenant-1/webhooks/config',
			{
				method: 'POST',
				headers: { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' },
				body: JSON.stringify({
					webhookUrl: 'https://example.com/hook',
					webhookSecret: 'very-secret-token-123',
					enabled: true,
					notificationMode: 'realtime',
					categories: ['security', 'compliance'],
				}),
			},
			env
		);

		expect(res.status).toBe(201);
		expect(mockDbChain.values).toHaveBeenCalled();
		const inserted = mockDbChain.values.mock.calls[0][0];
		expect(inserted.tenantId).toBe('tenant-1');
		expect(inserted.enabled).toBe(1);
		expect(inserted.categories).toBe(JSON.stringify(['security', 'compliance']));
		expect(typeof inserted.id).toBe('string');
	});

	it('sends signed payload for webhook test endpoint', async () => {
		queryResults = [[{
			id: 'cfg-1',
			tenantId: 'tenant-1',
			webhookUrl: 'https://example.com/webhook',
			webhookSecret: 'very-secret-token-123',
			enabled: 1,
			categories: '[]',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}]];

		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
		vi.stubGlobal('fetch', fetchMock);

		const res = await app.request(
			'/api/tenants/tenant-1/webhooks/test',
			{ method: 'POST', headers: { Authorization: 'Bearer good-token' } },
			env
		);

		expect(res.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
		expect((requestInit.headers as Record<string, string>)['X-TenantIQ-Signature']).toBeTruthy();
		expect((requestInit.headers as Record<string, string>)['X-TenantIQ-Event']).toBe('webhook.test');
	});
});
