import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import openclawWebhookRoutes from './openclaw';

const { mockDeliver, mockVerifySignature } = vi.hoisted(() => ({
	mockDeliver: vi.fn(async () => ({ success: true, statusCode: 200, attempts: 1 })),
	mockVerifySignature: vi.fn(() => true),
}));

let queryResults: unknown[] = [];
const mockDbChain: any = {};
for (const method of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'values']) mockDbChain[method] = vi.fn(() => mockDbChain);
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: (value: unknown) => void) => resolve(queryResults.shift() ?? []); }, configurable: true,
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})), inArray: vi.fn(() => ({})), desc: vi.fn(() => ({})) }));
vi.mock('../../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		webhookConfigs: { id: {}, tenantId: {}, userId: {}, webhookUrl: {}, webhookSecret: {}, enabled: {}, notificationMode: {}, minSeverity: {}, categories: {}, quietHoursStart: {}, quietHoursEnd: {}, quietHoursTimezone: {}, createdAt: {}, updatedAt: {} },
		webhookDeliveries: { webhookConfigId: {}, createdAt: {}, attempts: {}, status: {} },
	},
}));
vi.mock('../../middleware/auth', () => ({
	authMiddleware: async (c: any, next: () => Promise<void>) => {
		if (c.req.header('authorization') !== 'Bearer good-token') return c.json({ error: 'Unauthorized' }, 401);
		c.set('user', { sub: 'user-1', email: 'user@test.com', name: 'User', orgId: 'org-1', tenantIds: ['tenant-1'], role: 'admin' });
		await next();
	},
}));
vi.mock('../../middleware/tenant', () => ({
	tenantMiddleware: async (c: any, next: () => Promise<void>) => {
		const tenantId = c.req.param('tenantId');
		if (!c.get('user')?.tenantIds?.includes(tenantId)) return c.json({ error: 'Access denied to this tenant' }, 403);
		c.set('tenantId', tenantId);
		await next();
	},
}));
vi.mock('@tenantiq/webhooks', () => ({
	WebhookDeliveryService: class { deliver = mockDeliver; verifySignature = mockVerifySignature; },
}));

describe('OpenClaw Webhook Routes', () => {
	let app: Hono<AppEnv>;
	const baseEnv = {
		JWT_SECRET: 'test-secret', ENVIRONMENT: 'test', KV: {} as KVNamespace, R2: {} as R2Bucket,
		SCAN_QUEUE: {} as Queue, REMEDIATION_QUEUE: {} as Queue, NOTIFICATION_QUEUE: {} as Queue,
		TENANT_EVENTS: {} as DurableObjectNamespace, DB: {} as D1Database,
	} as AppEnv['Bindings'];

	beforeEach(() => { vi.clearAllMocks(); queryResults = []; app = new Hono<AppEnv>(); app.route('/api/webhooks/openclaw', openclawWebhookRoutes); });

	const AUTH_HEADERS = { Authorization: 'Bearer good-token', 'Content-Type': 'application/json' } as const;

	it('rejects /deliver when required fields are missing', async () => {
		// OPENCLAW_SERVICE_KEY must be configured for /deliver to serve at all (fail-closed).
		const env = { ...baseEnv, OPENCLAW_SERVICE_KEY: 'svc-key' } as AppEnv['Bindings'];
		const res = await app.request('/api/webhooks/openclaw/deliver', { method: 'POST', headers: { ...AUTH_HEADERS, 'x-openclaw-service-key': 'svc-key' }, body: JSON.stringify({ tenantId: 'tenant-1' }) }, env);
		expect(res.status).toBe(400);
	});

	it('rejects /deliver when service key is configured but missing', async () => {
		const env = { ...baseEnv, OPENCLAW_SERVICE_KEY: 'svc-key' } as AppEnv['Bindings'];
		const res = await app.request('/api/webhooks/openclaw/deliver', { method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify({ tenantId: 'tenant-1', event: 'alert.created', data: { severity: 'high' } }) }, env);
		expect(res.status).toBe(401);
	});

	it('allows /deliver when valid service key header is provided', async () => {
		queryResults = [[{
			id: 'cfg-1',
			tenantId: 'tenant-1',
			userId: null,
			webhookUrl: 'https://example.com/hook',
			webhookSecret: 'super-secret-token',
			enabled: 1,
			notificationMode: 'realtime',
			minSeverity: null,
			categories: '[]',
			quietHoursStart: null,
			quietHoursEnd: null,
			quietHoursTimezone: 'UTC',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}]];
		const env = { ...baseEnv, OPENCLAW_SERVICE_KEY: 'svc-key' } as AppEnv['Bindings'];
		const res = await app.request(
			'/api/webhooks/openclaw/deliver',
			{
				method: 'POST',
				headers: {
					...AUTH_HEADERS,
					'x-openclaw-service-key': 'svc-key',
				},
				body: JSON.stringify({
					tenantId: 'tenant-1',
					event: 'alert.created',
					data: { severity: 'high', category: 'security' },
				}),
			},
			env
		);

		expect(res.status).toBe(200);
		expect(mockDeliver).toHaveBeenCalledTimes(1);
		expect(await res.json()).toMatchObject({ delivered: 1, total: 1 });
	});

	it('delivers events to enabled webhook configs', async () => {
		queryResults = [[{ id: 'cfg-1', tenantId: 'tenant-1', userId: null, webhookUrl: 'https://example.com/hook', webhookSecret: 'super-secret-token', enabled: 1, notificationMode: 'realtime', minSeverity: null, categories: '[]', quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: 'UTC', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]];
		const env = { ...baseEnv, OPENCLAW_SERVICE_KEY: 'svc-key' } as AppEnv['Bindings'];
		const res = await app.request('/api/webhooks/openclaw/deliver', { method: 'POST', headers: { ...AUTH_HEADERS, 'x-openclaw-service-key': 'svc-key' }, body: JSON.stringify({ tenantId: 'tenant-1', event: 'alert.created', data: { severity: 'high', category: 'security' } }) }, env);
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.delivered).toBe(1);
		expect(json.total).toBe(1);
		expect(mockDeliver).toHaveBeenCalledTimes(1);
		expect(mockDbChain.values).toHaveBeenCalled();
	});

	it('persists failed deliveries as retrying with nextRetryAt', async () => {
		mockDeliver.mockResolvedValueOnce({ success: false, statusCode: 500, responseBody: 'failed', error: 'boom', attempts: 1 });
		queryResults = [[{ id: 'cfg-1', tenantId: 'tenant-1', userId: null, webhookUrl: 'https://example.com/hook', webhookSecret: 'super-secret-token', enabled: 1, notificationMode: 'realtime', minSeverity: null, categories: '[]', quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: 'UTC', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]];
		const env = { ...baseEnv, OPENCLAW_SERVICE_KEY: 'svc-key' } as AppEnv['Bindings'];
		const res = await app.request('/api/webhooks/openclaw/deliver', { method: 'POST', headers: { ...AUTH_HEADERS, 'x-openclaw-service-key': 'svc-key' }, body: JSON.stringify({ tenantId: 'tenant-1', event: 'alert.created', data: { severity: 'high' } }) }, env);
		expect(res.status).toBe(200);
		const persisted = mockDbChain.values.mock.calls.at(-1)?.[0];
		expect(persisted.status).toBe('retrying');
		expect(persisted.nextRetryAt).toBeTruthy();
	});

	it('rejects /receive on invalid webhook signature', async () => {
		queryResults = [[{ id: 'cfg-1', webhookSecret: 'secret', enabled: 1 }]];
		mockVerifySignature.mockReturnValueOnce(false);
		const res = await app.request('/api/webhooks/openclaw/receive', { method: 'POST', headers: { 'x-tenantiq-signature': 'sha256=bad', 'x-tenantiq-event': 'alert.created', 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: 'tenant-1', data: {}, timestamp: new Date().toISOString() }) }, baseEnv);
		expect(res.status).toBe(401);
	});

	it('accepts /receive with a valid webhook signature', async () => {
		queryResults = [[{ id: 'cfg-1', webhookSecret: 'secret', enabled: 1 }]];
		mockVerifySignature.mockReturnValueOnce(true);
		const res = await app.request('/api/webhooks/openclaw/receive', { method: 'POST', headers: { 'x-tenantiq-signature': 'sha256=ok', 'x-tenantiq-event': 'alert.created', 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: 'tenant-1', data: {}, timestamp: new Date().toISOString() }) }, baseEnv);
		expect(res.status).toBe(200);
		expect((await res.json() as any).received).toBe(true);
	});

	it('requires auth on /deliveries/:tenantId and /stats/:tenantId', async () => {
		expect((await app.request('/api/webhooks/openclaw/deliveries/tenant-1', { method: 'GET' }, baseEnv)).status).toBe(401);
		expect((await app.request('/api/webhooks/openclaw/stats/tenant-1', { method: 'GET' }, baseEnv)).status).toBe(401);
	});

	it('returns empty authorized tenant debug views with no configs', async () => {
		queryResults = [[], []];
		const deliveries = await app.request('/api/webhooks/openclaw/deliveries/tenant-1', { method: 'GET', headers: { Authorization: 'Bearer good-token' } }, baseEnv);
		const stats = await app.request('/api/webhooks/openclaw/stats/tenant-1', { method: 'GET', headers: { Authorization: 'Bearer good-token' } }, baseEnv);
		expect(deliveries.status).toBe(200);
		expect(stats.status).toBe(200);
		expect((await deliveries.json() as any).count).toBe(0);
		expect(await stats.json()).toMatchObject({ total: 0, successful: 0, failed: 0, pending: 0, averageAttempts: 0, last24h: 0 });
	});

	it('counts retrying deliveries as pending in stats', async () => {
		queryResults = [[{ id: 'cfg-1' }], [{ status: 'retrying', attempts: 1, createdAt: new Date().toISOString() }]];
		const res = await app.request('/api/webhooks/openclaw/stats/tenant-1', { method: 'GET', headers: { Authorization: 'Bearer good-token' } }, baseEnv);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ total: 1, pending: 1 });
	});
});
