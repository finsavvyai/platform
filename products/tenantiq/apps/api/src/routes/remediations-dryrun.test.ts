import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import remediationsDryRun from './remediations-dryrun';

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
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		alerts: { id: {}, tenantId: {} },
	},
}));

vi.mock('@tenantiq/remediation', () => ({
	getDryRunResult: vi.fn(async (actionType: string) => ({
		changes: [
			{
				resource: 'User Account',
				field: 'accountEnabled',
				currentValue: 'true',
				proposedValue: 'false',
			},
		],
		estimatedDuration: '15-30 seconds',
		reversible: true,
		affectedResources: 1,
	})),
}));

const noAuthMiddleware = async (c: any, next: () => Promise<void>) => {
	// No user set — simulates missing auth
	await next();
};

vi.mock('../middleware/auth.middleware', () => ({
	authMiddleware: async (c: any, next: () => Promise<void>) => {
		const userId = c.req.header('x-user-id');
		if (!userId) {
			return c.json({ error: 'Unauthorized' }, 401);
		}
		c.set('tenantId', c.req.header('x-tenant-id') || 'tenant-1');
		c.set('userId', userId);
		c.set('userRole', c.req.header('x-user-role') || 'admin');
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

describe('Remediations Dry-Run Route', () => {
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
		app.route('/api/remediations', remediationsDryRun);
	});

	it('returns dry-run preview for actionType + targetId', async () => {
		const res = await app.request(
			'/api/remediations/dry-run',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-id': 'user-1',
				},
				body: JSON.stringify({ actionType: 'REM-001', targetId: 'user-123' }),
			},
			env
		);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.data.changes).toHaveLength(1);
		expect(json.data.changes[0].resource).toBe('User Account');
		expect(json.data.reversible).toBe(true);
		expect(json.data.estimatedDuration).toBeDefined();
	});

	it('returns 401 without authentication', async () => {
		const res = await app.request(
			'/api/remediations/dry-run',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actionType: 'REM-001', targetId: 'user-123' }),
			},
			env
		);

		expect(res.status).toBe(401);
	});

	it('returns 400 with invalid input (missing both alertId and actionType)', async () => {
		const res = await app.request(
			'/api/remediations/dry-run',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-id': 'user-1',
				},
				body: JSON.stringify({}),
			},
			env
		);

		expect(res.status).toBe(400);
		const json: any = await res.json();
		expect(json.error).toBe('Bad Request');
	});

	it('returns 404 when alertId does not exist', async () => {
		queryResults = [[]];

		const res = await app.request(
			'/api/remediations/dry-run',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-id': 'user-1',
				},
				body: JSON.stringify({ alertId: 'nonexistent-alert' }),
			},
			env
		);

		expect(res.status).toBe(404);
	});

	it('resolves action type from alert when alertId provided', async () => {
		queryResults = [
			[{
				id: 'alert-1',
				tenantId: 'tenant-1',
				autoRemediationAction: 'REM-001',
				resourceId: 'user-456',
				canAutoRemediate: 1,
			}],
		];

		const res = await app.request(
			'/api/remediations/dry-run',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-user-id': 'user-1',
				},
				body: JSON.stringify({ alertId: 'alert-1' }),
			},
			env
		);

		expect(res.status).toBe(200);
		const json: any = await res.json();
		expect(json.data.changes).toHaveLength(1);
	});
});
