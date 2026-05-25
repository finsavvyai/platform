import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';

// Mock the Microsoft API client so tests don't make real network calls.
const mocks = {
	resolveMarketplaceToken: vi.fn(),
	verifyWebhookOperation: vi.fn(),
	acknowledgeOperation: vi.fn(),
};
vi.mock('../lib/marketplace/microsoft-api', () => ({
	resolveMarketplaceToken: (...args: unknown[]) => mocks.resolveMarketplaceToken(...args),
	verifyWebhookOperation: (...args: unknown[]) => mocks.verifyWebhookOperation(...args),
	acknowledgeOperation: (...args: unknown[]) => mocks.acknowledgeOperation(...args),
}));

// Import AFTER mocks are registered.
const { marketplaceRoutes } = await import('./marketplace');

function createMockDb() {
	const c = { bind: vi.fn((): typeof c => c), all: vi.fn(() => Promise.resolve({ results: [] })), first: vi.fn(() => Promise.resolve(null)), run: vi.fn(() => Promise.resolve({ success: true })) };
	return { prepare: vi.fn(() => c), _chain: c };
}

function createMockKV() {
	const store = new Map<string, string>();
	const kv = {
		get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
		put: vi.fn((k: string, v: string) => { store.set(k, v); return Promise.resolve(); }),
		delete: vi.fn((k: string) => { store.delete(k); return Promise.resolve(); }),
		list: vi.fn(({ prefix }: { prefix: string }) => Promise.resolve({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) })),
		getWithMetadata: vi.fn(),
	} as unknown as KVNamespace;
	return { store, kv };
}

function buildEnv(kv: KVNamespace, db: ReturnType<typeof createMockDb>) {
	return { ENVIRONMENT: 'test', JWT_SECRET: 'test-secret', DB: db as unknown as D1Database, KV: kv } as AppEnv['Bindings'];
}

describe('Marketplace Routes', () => {
	let app: Hono<AppEnv>;
	let mockDb: ReturnType<typeof createMockDb>;
	let mockKV: ReturnType<typeof createMockKV>;
	let env: AppEnv['Bindings'];

	beforeEach(() => {
		app = new Hono<AppEnv>();
		app.route('/', marketplaceRoutes);
		mockDb = createMockDb();
		mockKV = createMockKV();
		env = buildEnv(mockKV.kv, mockDb);
		mocks.resolveMarketplaceToken.mockReset();
		mocks.verifyWebhookOperation.mockReset();
		mocks.acknowledgeOperation.mockReset();
		mocks.verifyWebhookOperation.mockResolvedValue(true);
		mocks.acknowledgeOperation.mockResolvedValue(true);
	});

	describe('POST /webhook', () => {
		it('processes ChangePlan event and updates subscription', async () => {
			const subId = 'sub-change-plan';
			mockKV.store.set(`marketplace-sub:${subId}`, JSON.stringify({
				subscriptionId: subId, orgId: 'org-1', planId: 'tenantiq-starter', billingPlan: 'starter', status: 'active',
			}));

			const res = await app.request('/webhook', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'ChangePlan', subscriptionId: subId, planId: 'tenantiq-enterprise', operationId: 'op-1' }),
			}, env);

			expect(res.status).toBe(200);
			expect(mocks.verifyWebhookOperation).toHaveBeenCalled();
			expect(mocks.acknowledgeOperation).toHaveBeenCalled();
			const updated = JSON.parse(mockKV.store.get(`marketplace-sub:${subId}`)!);
			expect(updated.planId).toBe('tenantiq-enterprise');
		});

		it('processes Unsubscribe event and sets cancelled status', async () => {
			const subId = 'sub-unsub';
			mockKV.store.set(`marketplace-sub:${subId}`, JSON.stringify({
				subscriptionId: subId, orgId: 'org-2', planId: 'tenantiq-professional', billingPlan: 'professional', status: 'active',
			}));

			const res = await app.request('/webhook', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'Unsubscribe', subscriptionId: subId }),
			}, env);

			expect(res.status).toBe(200);
			const updated = JSON.parse(mockKV.store.get(`marketplace-sub:${subId}`)!);
			expect(updated.status).toBe('cancelled');
		});

		it('rejects when Microsoft cannot verify the operation', async () => {
			mocks.verifyWebhookOperation.mockResolvedValueOnce(false);
			mockKV.store.set('marketplace-sub:sub-1', JSON.stringify({ subscriptionId: 'sub-1', orgId: 'org-1' }));

			const res = await app.request('/webhook', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'Renew', subscriptionId: 'sub-1', operationId: 'op-spoofed' }),
			}, env);

			expect(res.status).toBe(401);
			expect((await res.json() as { error: string }).error).toContain('not verified');
		});

		it('returns 404 for unknown subscription', async () => {
			const res = await app.request('/webhook', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'Suspend', subscriptionId: 'nonexistent' }),
			}, env);

			expect(res.status).toBe(404);
		});

		it('rejects unknown action', async () => {
			mockKV.store.set('marketplace-sub:sub-x', JSON.stringify({ subscriptionId: 'sub-x', orgId: 'org-x' }));

			const res = await app.request('/webhook', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'InvalidAction', subscriptionId: 'sub-x' }),
			}, env);

			expect(res.status).toBe(400);
			expect((await res.json() as { error: string }).error).toContain('Unknown action');
		});
	});

	describe('POST /activate', () => {
		it('creates subscription and organization', async () => {
			const res = await app.request('/activate', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subscriptionId: 'sub-new', planId: 'tenantiq-core', quantity: 5 }),
			}, env);

			expect(res.status).toBe(200);
			const json = await res.json() as { data: { orgId: string; plan: string; status: string } };
			expect(json.data.plan).toBe('Core');
			expect(mockKV.store.has('marketplace-sub:sub-new')).toBe(true);
			const stored = JSON.parse(mockKV.store.get('marketplace-sub:sub-new')!);
			expect(stored.quantity).toBe(5);
		});

		it('rejects unknown plan ID', async () => {
			const res = await app.request('/activate', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subscriptionId: 'sub-bad', planId: 'invalid-plan' }),
			}, env);

			expect(res.status).toBe(400);
		});
	});

	describe('POST /resolve', () => {
		it('returns subscription details when Microsoft accepts the token', async () => {
			mocks.resolveMarketplaceToken.mockResolvedValueOnce({
				id: 'sub-1', subscriptionName: 'Acme', offerId: 'tenantiq', planId: 'tenantiq-professional', quantity: 5,
				subscription: { id: 'sub-1', saasSubscriptionStatus: 'PendingFulfillmentStart' },
			});

			const res = await app.request('/resolve', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'real-token' }),
			}, env);

			expect(res.status).toBe(200);
			const json = await res.json() as { data: { planId: string } };
			expect(json.data.planId).toBe('tenantiq-professional');
		});

		it('returns 401 when Microsoft rejects the token', async () => {
			mocks.resolveMarketplaceToken.mockResolvedValueOnce(null);
			const res = await app.request('/resolve', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'spoofed' }),
			}, env);

			expect(res.status).toBe(401);
		});

		it('returns 400 when no token supplied', async () => {
			const res = await app.request('/resolve', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
			}, env);

			expect(res.status).toBe(400);
		});
	});
});
