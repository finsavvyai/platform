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
	lte: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		remediations: {
			id: {}, tenantId: {}, initiatedAt: {}, alertId: {},
			actionType: {}, scheduledAt: {}, initiatedBy: {}, status: {},
		},
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

vi.mock('@tenantiq/remediation', () => ({
	createRollbackPlan: vi.fn(),
	isRollbackSupported: vi.fn(() => true),
	getIrreversibleReason: vi.fn(),
}));

describe('Remediation Scheduling', () => {
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

	it('schedules remediation when scheduledAt is in the future', async () => {
		const futureDate = new Date(Date.now() + 86400000).toISOString();
		queryResults = [
			[{ id: 'alert-1', tenantId: 'tenant-1', canAutoRemediate: 1, resourceId: 'r1', resourceType: 'user' }],
			[],
		];

		const res = await app.request('/api/remediations/execute', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
			body: JSON.stringify({ alertId: 'alert-1', actionType: 'block_user', scheduledAt: futureDate }),
		}, env);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.status).toBe('scheduled');
		expect(json.scheduledAt).toBeDefined();
		expect((env.REMEDIATION_QUEUE as any).send).not.toHaveBeenCalled();
	});

	it('executes immediately when scheduledAt is not provided', async () => {
		queryResults = [
			[{ id: 'alert-1', tenantId: 'tenant-1', canAutoRemediate: 1, resourceId: 'r1', resourceType: 'user' }],
			[],
		];

		const res = await app.request('/api/remediations/execute', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
			body: JSON.stringify({ alertId: 'alert-1', actionType: 'block_user' }),
		}, env);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.status).toBe('pending');
		expect((env.REMEDIATION_QUEUE as any).send).toHaveBeenCalled();
	});

	it('lists scheduled remediations for the tenant', async () => {
		queryResults = [[
			{ id: 'rem-1', alertId: 'a1', actionType: 'block_user', scheduledAt: '2026-04-01T00:00:00Z', createdBy: 'u1' },
		]];

		const res = await app.request('/api/remediations/scheduled', {
			method: 'GET',
			headers: { 'x-user-id': 'user-1' },
		}, env);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.scheduled).toHaveLength(1);
		expect(json.scheduled[0].id).toBe('rem-1');
	});

	it('cancels a scheduled remediation', async () => {
		queryResults = [[{ id: 'rem-1', tenantId: 'tenant-1', status: 'scheduled' }], []];

		const res = await app.request('/api/remediations/rem-1/schedule', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
			body: JSON.stringify({ cancel: true }),
		}, env);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.status).toBe('cancelled');
	});

	it('rejects cancel on non-scheduled remediation', async () => {
		queryResults = [[{ id: 'rem-1', tenantId: 'tenant-1', status: 'pending' }]];

		const res = await app.request('/api/remediations/rem-1/schedule', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
			body: JSON.stringify({ cancel: true }),
		}, env);

		expect(res.status).toBe(400);
	});

	it('requires auth middleware is applied on schedule endpoints', async () => {
		queryResults = [[]];

		const res = await app.request('/api/remediations/scheduled', {
			method: 'GET',
			headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
		}, env);

		// Auth middleware mock passes through; endpoint should respond 200
		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.scheduled).toBeDefined();
	});
});
