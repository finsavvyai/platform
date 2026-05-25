import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { handleAdminConsent } from './auth-admin-consent';

// Pure-DB mock: chainable .prepare().bind().first() / .run().
function createMockDb() {
	const first = vi.fn();
	const run = vi.fn().mockResolvedValue({});
	const bind = vi.fn(() => ({ first, run }));
	const prepare = vi.fn(() => ({ bind }));
	return { db: { prepare } as any, prepare, bind, first, run };
}

function createMockKV(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		store,
		kv: {
			get: vi.fn((key: string, format?: string) => {
				const v = store.get(key);
				if (!v) return Promise.resolve(null);
				return Promise.resolve(format === 'json' ? JSON.parse(v) : v);
			}),
			put: vi.fn((key: string, value: string) => {
				store.set(key, value);
				return Promise.resolve();
			}),
			delete: vi.fn((key: string) => {
				store.delete(key);
				return Promise.resolve();
			}),
		} as unknown as KVNamespace,
	};
}

describe('handleAdminConsent', () => {
	let app: Hono<AppEnv>;
	let mock: ReturnType<typeof createMockDb>;
	let kvWrap: ReturnType<typeof createMockKV>;

	beforeEach(() => {
		app = new Hono<AppEnv>();
		mock = createMockDb();
		kvWrap = createMockKV();

		app.get('/api/auth/callback', async (c) => {
			return handleAdminConsent(c, 'azure-tid-xyz', 'https://app.tenantiq.app', c.req.query('state'));
		});
	});

	it('inserts a tenant row when stash resolves to an orgId and tenant is new', async () => {
		const state = 'state-1';
		kvWrap.store.set(`auth:onboard:${state}`, JSON.stringify({ orgId: 'org-A', userSub: 'u-1' }));
		mock.first.mockResolvedValueOnce(null);

		const res = await app.request(`/api/auth/callback?state=${state}`, {}, {
			DB: mock.db, KV: kvWrap.kv,
		} as any);

		expect(res.status).toBe(200);
		const insertCall = mock.prepare.mock.calls.find((c) => String(c[0]).startsWith('INSERT INTO tenants'));
		expect(insertCall).toBeDefined();
		expect(kvWrap.store.has(`auth:onboard:${state}`)).toBe(false); // consumed
	});

	it('does NOT insert when no stash exists (state expired or missing)', async () => {
		mock.first.mockResolvedValueOnce(null);

		const res = await app.request('/api/auth/callback', {}, {
			DB: mock.db, KV: kvWrap.kv,
		} as any);

		expect(res.status).toBe(200);
		const insertCall = mock.prepare.mock.calls.find((c) => String(c[0]).startsWith('INSERT INTO tenants'));
		expect(insertCall).toBeUndefined();
	});

	it('marks consent on existing tenant row instead of inserting a duplicate', async () => {
		const state = 'state-2';
		kvWrap.store.set(`auth:onboard:${state}`, JSON.stringify({ orgId: 'org-A', userSub: 'u-1' }));
		mock.first.mockResolvedValueOnce({ id: 'tenant-existing', organization_id: 'org-A' });

		await app.request(`/api/auth/callback?state=${state}`, {}, {
			DB: mock.db, KV: kvWrap.kv,
		} as any);

		const insertCall = mock.prepare.mock.calls.find((c) => String(c[0]).startsWith('INSERT INTO tenants'));
		expect(insertCall).toBeUndefined();
		expect(kvWrap.kv.put).toHaveBeenCalledWith('consent:tenant-existing', 'true');
	});

	it('renders an HTML page with auto-redirect to the frontend onboarded URL', async () => {
		mock.first.mockResolvedValueOnce(null);
		const res = await app.request('/api/auth/callback', {}, {
			DB: mock.db, KV: kvWrap.kv,
		} as any);
		const body = await res.text();
		expect(res.headers.get('content-type')).toMatch(/html/);
		expect(body).toContain('Permissions granted');
		expect(body).toContain('https://app.tenantiq.app?onboarded=azure-tid-xyz');
		expect(body).toContain('window.location.replace');
		// meta-refresh fallback ensures redirect even if JS is blocked
		expect(body).toMatch(/<meta http-equiv="refresh"/);
	});
});
