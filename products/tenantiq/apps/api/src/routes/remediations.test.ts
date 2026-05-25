import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import remediations from './remediations';

let queryResults: any[] = [];

const mockDbChain: any = {};
for (const method of ['select', 'from', 'where', 'orderBy', 'limit', 'insert', 'values', 'update', 'set']) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: (value: any) => unknown) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn(() => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		remediations: { id: {}, tenantId: {}, initiatedAt: {} },
		remediationSteps: { remediationId: {}, stepNumber: {} },
		alerts: { id: {}, tenantId: {} },
	},
}));

vi.mock('../middleware/auth.middleware', () => ({
	authMiddleware: async (c: any, next: () => Promise<void>) => {
		c.set('tenantId', c.req.header('x-tenant-id') || 'tenant-1');
		c.set('userId', c.req.header('x-user-id') || undefined);
		c.set('userRole', c.req.header('x-user-role') || 'admin');
		await next();
	},
	tenantScopingMiddleware: async (_c: any, next: () => Promise<void>) => {
		await next();
	},
	requireRole: () => async (_c: any, next: () => Promise<void>) => {
		await next();
	},
}));

vi.mock('../middleware/rateLimit.middleware', () => ({
	strictRateLimit: async (_c: any, next: () => Promise<void>) => {
		await next();
	},
}));

describe('Remediations Routes', () => {
	let app: Hono<AppEnv>;
	const env = {
		JWT_SECRET: 'test-secret',
		ENVIRONMENT: 'test',
		KV: {} as KVNamespace,
		R2: {} as R2Bucket,
		SCAN_QUEUE: {} as Queue,
		REMEDIATION_QUEUE: { send: vi.fn() } as unknown as Queue,
		NOTIFICATION_QUEUE: {} as Queue,
		TENANT_EVENTS: {} as DurableObjectNamespace,
		DB: {} as D1Database,
	} as AppEnv['Bindings'];

	beforeEach(() => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/remediations', remediations);
	});

	it('returns remediation details with ordered steps', async () => {
		queryResults = [
			[{ id: 'rem-1', tenantId: 'tenant-1', status: 'completed' }],
			[
				{ id: 'step-1', remediationId: 'rem-1', stepNumber: 1 },
				{ id: 'step-2', remediationId: 'rem-1', stepNumber: 2 },
			],
		];

		const res = await app.request(
			'/api/remediations/rem-1',
			{ method: 'GET', headers: { 'x-user-id': 'user-1' } },
			env
		);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.remediation.id).toBe('rem-1');
		expect(json.steps).toHaveLength(2);
	});

	it('rejects execute when user context is missing', async () => {
		const res = await app.request(
			'/api/remediations/execute',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ alertId: 'alert-1', actionType: 'block_user' }),
			},
			env
		);

		expect(res.status).toBe(401);
	});

	it('rejects execute when alert is not auto-remediable', async () => {
		queryResults = [[{ id: 'alert-1', tenantId: 'tenant-1', canAutoRemediate: 0 }]];

		const res = await app.request(
			'/api/remediations/execute',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-id': 'user-1',
				},
				body: JSON.stringify({ alertId: 'alert-1', actionType: 'block_user' }),
			},
			env
		);

		expect(res.status).toBe(400);
	});

	it('queues remediation when alert is eligible', async () => {
		queryResults = [
			[{ id: 'alert-1', tenantId: 'tenant-1', canAutoRemediate: 1, resourceId: 'res-1', resourceType: 'user' }],
			[],
		];

		const res = await app.request(
			'/api/remediations/execute',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-id': 'user-1',
				},
				body: JSON.stringify({ alertId: 'alert-1', actionType: 'disable_account', actionParameters: { reason: 'test' } }),
			},
			env
		);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.status).toBe('pending');
		expect(mockDbChain.values).toHaveBeenCalled();
	});
});
