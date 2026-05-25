import { describe, it, expect, vi } from 'vitest';
import {
	getMarketplaceApiToken,
	resolveMarketplaceToken,
	verifyWebhookOperation,
	acknowledgeOperation,
	type MicrosoftEnv,
} from './microsoft-api';

function makeEnv(overrides: Partial<MicrosoftEnv> = {}): MicrosoftEnv {
	const store = new Map<string, string>();
	return {
		KV: {
			get: vi.fn(async (k: string) => store.get(k) ?? null),
			put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
		} as unknown as KVNamespace,
		MARKETPLACE_PUBLISHER_TENANT_ID: 'pub-tenant-id',
		MARKETPLACE_AAD_APP_ID: 'app-id',
		MARKETPLACE_AAD_APP_SECRET: 'app-secret',
		...overrides,
	};
}

function mockFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown }>): typeof fetch {
	let i = 0;
	return (async () => {
		const r = responses[i++] ?? { ok: false, status: 500 };
		return {
			ok: r.ok,
			status: r.status ?? (r.ok ? 200 : 400),
			json: async () => r.body ?? {},
		} as Response;
	}) as typeof fetch;
}

describe('getMarketplaceApiToken', () => {
	it('returns null when env is not configured', async () => {
		const env = makeEnv({ MARKETPLACE_AAD_APP_ID: undefined });
		const token = await getMarketplaceApiToken(env, mockFetch([]));
		expect(token).toBeNull();
	});

	it('fetches and caches token', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([{ ok: true, body: { access_token: 'abc123', expires_in: 3600 } }]);
		const token = await getMarketplaceApiToken(env, fetchImpl);
		expect(token).toBe('abc123');
		// Second call should hit cache, not fetch
		const cached = await getMarketplaceApiToken(env, mockFetch([]));
		expect(cached).toBe('abc123');
	});

	it('returns null on AAD failure', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([{ ok: false, status: 401 }]);
		const token = await getMarketplaceApiToken(env, fetchImpl);
		expect(token).toBeNull();
	});
});

describe('resolveMarketplaceToken', () => {
	it('returns null when api token unavailable', async () => {
		const env = makeEnv({ MARKETPLACE_AAD_APP_SECRET: undefined });
		const r = await resolveMarketplaceToken(env, 'user-token', mockFetch([]));
		expect(r).toBeNull();
	});

	it('resolves a valid token to subscription details', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([
			{ ok: true, body: { access_token: 'api-tok', expires_in: 3600 } },
			{ ok: true, body: { id: 'sub-1', subscriptionName: 'Acme', offerId: 'tenantiq', planId: 'tenantiq-core', quantity: 1, subscription: { id: 'sub-1', saasSubscriptionStatus: 'PendingFulfillmentStart' } } },
		]);
		const r = await resolveMarketplaceToken(env, 'user-token', fetchImpl);
		expect(r?.id).toBe('sub-1');
		expect(r?.planId).toBe('tenantiq-core');
	});

	it('returns null when Microsoft rejects token', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([
			{ ok: true, body: { access_token: 'api-tok', expires_in: 3600 } },
			{ ok: false, status: 403 },
		]);
		const r = await resolveMarketplaceToken(env, 'bad-token', fetchImpl);
		expect(r).toBeNull();
	});
});

describe('verifyWebhookOperation', () => {
	it('returns true when Microsoft confirms operation exists', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([
			{ ok: true, body: { access_token: 'api-tok' } },
			{ ok: true, body: { id: 'op-1', status: 'InProgress' } },
		]);
		expect(await verifyWebhookOperation(env, 'sub-1', 'op-1', fetchImpl)).toBe(true);
	});

	it('returns false when operation does not exist', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([
			{ ok: true, body: { access_token: 'api-tok' } },
			{ ok: false, status: 404 },
		]);
		expect(await verifyWebhookOperation(env, 'sub-1', 'op-x', fetchImpl)).toBe(false);
	});

	it('returns false when no api token', async () => {
		const env = makeEnv({ MARKETPLACE_AAD_APP_ID: undefined });
		expect(await verifyWebhookOperation(env, 'sub-1', 'op-1', mockFetch([]))).toBe(false);
	});
});

describe('acknowledgeOperation', () => {
	it('PATCHes Microsoft and returns true on success', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([
			{ ok: true, body: { access_token: 'api-tok' } },
			{ ok: true },
		]);
		expect(await acknowledgeOperation(env, 'sub-1', 'op-1', 'tenantiq-core', 1, 'Success', fetchImpl)).toBe(true);
	});

	it('returns false when Microsoft rejects', async () => {
		const env = makeEnv();
		const fetchImpl = mockFetch([
			{ ok: true, body: { access_token: 'api-tok' } },
			{ ok: false, status: 400 },
		]);
		expect(await acknowledgeOperation(env, 'sub-1', 'op-1', 'tenantiq-core', 1, 'Success', fetchImpl)).toBe(false);
	});
});
