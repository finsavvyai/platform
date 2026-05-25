import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runWebhookRetries } from './webhook-retry';

const { mockDeliver } = vi.hoisted(() => ({
	mockDeliver: vi.fn(async () => ({ success: true, statusCode: 200, responseBody: 'ok', attempts: 1 })),
}));

let queryResults: unknown[] = [];
const mockDbChain: any = {};
for (const method of ['select', 'from', 'where', 'limit', 'update', 'set']) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: (value: unknown) => void) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	and: vi.fn(() => ({})),
	eq: vi.fn(() => ({})),
	lte: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		webhookDeliveries: { id: {}, status: {}, nextRetryAt: {}, webhookConfigId: {} },
		webhookConfigs: {
			id: {}, tenantId: {}, userId: {}, webhookUrl: {}, webhookSecret: {}, enabled: {},
			notificationMode: {}, minSeverity: {}, categories: {}, quietHoursStart: {},
			quietHoursEnd: {}, quietHoursTimezone: {}, createdAt: {}, updatedAt: {},
		},
	},
}));

vi.mock('@tenantiq/webhooks', () => ({
	WebhookDeliveryService: class {
		deliver = mockDeliver;
	},
}));

function eventPayload() {
	return JSON.stringify({
		event: 'alert.created',
		tenant: { id: 'tenant-1', name: 'Tenant' },
		data: { severity: 'high' },
		timestamp: new Date().toISOString(),
	});
}

describe('runWebhookRetries', () => {
	const env = {
		DB: {} as D1Database,
		KV: {} as KVNamespace,
		R2: {} as R2Bucket,
		SCAN_QUEUE: {} as Queue,
		REMEDIATION_QUEUE: {} as Queue,
		NOTIFICATION_QUEUE: {} as Queue,
		TENANT_EVENTS: {} as DurableObjectNamespace,
		JWT_SECRET: 'test',
		ENVIRONMENT: 'test',
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
	});

	it('marks retrying delivery as delivered when retry succeeds', async () => {
		queryResults = [
			[{ id: 'del-1', webhookConfigId: 'cfg-1', attempts: 1, payload: eventPayload(), status: 'retrying' }],
			[{ id: 'cfg-1', tenantId: 'tenant-1', userId: null, webhookUrl: 'https://example.com', webhookSecret: 'secret', enabled: 1, notificationMode: 'realtime', minSeverity: null, categories: '[]', quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: 'UTC', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
			[],
		];

		await runWebhookRetries(env);

		expect(mockDeliver).toHaveBeenCalledTimes(1);
		const updatePayload = mockDbChain.set.mock.calls.at(-1)?.[0];
		expect(updatePayload.status).toBe('delivered');
		expect(updatePayload.attempts).toBe(2);
		expect(updatePayload.nextRetryAt).toBeNull();
		expect(updatePayload.deliveredAt).toBeTruthy();
	});

	it('keeps delivery as retrying when retry fails and attempts remain', async () => {
		mockDeliver.mockResolvedValueOnce({ success: false, statusCode: 500, responseBody: 'err', error: 'timeout', attempts: 1 });
		queryResults = [
			[{ id: 'del-1', webhookConfigId: 'cfg-1', attempts: 1, payload: eventPayload(), status: 'retrying' }],
			[{ id: 'cfg-1', tenantId: 'tenant-1', userId: null, webhookUrl: 'https://example.com', webhookSecret: 'secret', enabled: 1, notificationMode: 'realtime', minSeverity: null, categories: '[]', quietHoursStart: null, quietHoursEnd: null, quietHoursTimezone: 'UTC', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
			[],
		];

		await runWebhookRetries(env);

		const updatePayload = mockDbChain.set.mock.calls.at(-1)?.[0];
		expect(updatePayload.status).toBe('retrying');
		expect(updatePayload.attempts).toBe(2);
		expect(updatePayload.nextRetryAt).toBeTruthy();
		expect(updatePayload.errorMessage).toBe('timeout');
	});

	it('marks delivery failed when config is missing', async () => {
		queryResults = [
			[{ id: 'del-1', webhookConfigId: 'cfg-missing', attempts: 3, payload: eventPayload(), status: 'retrying' }],
			[],
			[],
		];

		await runWebhookRetries(env);

		expect(mockDeliver).not.toHaveBeenCalled();
		const updatePayload = mockDbChain.set.mock.calls.at(-1)?.[0];
		expect(updatePayload.status).toBe('failed');
		expect(updatePayload.nextRetryAt).toBeNull();
	});
});
