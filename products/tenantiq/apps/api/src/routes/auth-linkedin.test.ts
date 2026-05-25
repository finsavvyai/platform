import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from './auth';
import type { AppEnv } from '../index';
import { AppError } from '../lib/errors';

vi.mock('../lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@tenantiq/db', () => ({
	getTenantsByOrganization: vi.fn(() => Promise.resolve([])),
	getPlatformUserByAzureOid: vi.fn(() =>
		Promise.resolve({
			id: 'u-1',
			email: 'x@test',
			name: 'X',
			organization_id: 'org-1',
			role: 'admin',
			status: 'active',
		}),
	),
}));

// Azure verifier stub is required by auth-callback.ts even when exercising
// only the LinkedIn routes, since the module is loaded at import time.
vi.mock('../lib/azure-id-token', () => ({
	verifyAzureIdToken: vi.fn(),
}));

function createMockDb() {
	const chain = {
		bind: vi.fn(() => chain),
		first: vi.fn(() => Promise.resolve(null)),
		all: vi.fn(() => Promise.resolve({ results: [] })),
		run: vi.fn(() => Promise.resolve({ success: true })),
	};
	return { prepare: vi.fn(() => chain), _chain: chain };
}

describe('LinkedIn OAuth', () => {
	let app: Hono<AppEnv>;
	let env: AppEnv['Bindings'];
	let kv: Map<string, string>;
	let db: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		app = new Hono<AppEnv>();
		app.route('/api/auth', authRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});
		kv = new Map();
		db = createMockDb();
		env = {
			ENVIRONMENT: 'test',
			JWT_SECRET: 'x'.repeat(32),
			AZURE_CLIENT_ID: 'az',
			LINKEDIN_CLIENT_ID: 'li-client',
			LINKEDIN_CLIENT_SECRET: 'li-secret',
			DB: db as any,
			KV: {
				get: vi.fn((k: string) => Promise.resolve(kv.get(k) ?? null)),
				put: vi.fn((k: string, v: string) => {
					kv.set(k, v);
					return Promise.resolve();
				}),
				delete: vi.fn((k: string) => {
					kv.delete(k);
					return Promise.resolve();
				}),
				list: vi.fn(),
				getWithMetadata: vi.fn(),
			} as unknown as KVNamespace,
		} as AppEnv['Bindings'];
		vi.clearAllMocks();
		kv.clear();
	});

	describe('GET /api/auth/login/linkedin', () => {
		it('redirects to LinkedIn authorize with required params', async () => {
			const res = await app.request('/api/auth/login/linkedin', {}, env);
			expect(res.status).toBe(302);
			const loc = res.headers.get('Location')!;
			expect(loc).toContain('linkedin.com/oauth/v2/authorization');
			expect(loc).toContain('client_id=li-client');
			expect(loc).toContain('response_type=code');
			expect(loc).toContain('scope=openid+profile+email');
			expect(loc).toContain('state=');
			const stateKeys = [...kv.keys()].filter((k) => k.startsWith('auth:state:linkedin:'));
			expect(stateKeys.length).toBe(1);
		});

		it('returns 503 when LINKEDIN_CLIENT_ID is missing', async () => {
			const cleanEnv = { ...env, LINKEDIN_CLIENT_ID: undefined };
			const res = await app.request('/api/auth/login/linkedin', {}, cleanEnv);
			expect(res.status).toBe(503);
		});
	});

	describe('GET /api/auth/callback/linkedin', () => {
		it('redirects to error when code is missing', async () => {
			const res = await app.request('/api/auth/callback/linkedin', {}, env);
			expect(res.status).toBe(302);
			expect(res.headers.get('Location')!).toContain('/auth/callback?error=');
		});

		it('rejects unknown state', async () => {
			const res = await app.request(
				'/api/auth/callback/linkedin?code=c&state=unknown',
				{},
				env,
			);
			expect(res.status).toBe(400);
		});

		it('happy path: provisions user and returns signed session', async () => {
			const state = 'valid-state-123';
			kv.set(`auth:state:linkedin:${state}`, '1');

			global.fetch = vi
				.fn()
				// token exchange
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({ access_token: 'at', expires_in: 3600 }),
				})
				// /userinfo
				.mockResolvedValueOnce({
					ok: true,
					json: () =>
						Promise.resolve({
							sub: 'li-12345',
							email: 'test@example.com',
							name: 'Test User',
						}),
				}) as unknown as typeof fetch;

			db._chain.first.mockResolvedValueOnce(null); // no existing user

			const res = await app.request(
				`/api/auth/callback/linkedin?code=c&state=${state}`,
				{},
				env,
			);
			expect(res.status).toBe(302);
			const loc = res.headers.get('Location')!;
			expect(loc).toContain('/auth/callback#token=');
			expect(loc).toContain('&user=');

			const setCookie = res.headers.get('Set-Cookie')!;
			expect(setCookie).toContain('tenantiq_session=');
			expect(setCookie).toContain('HttpOnly');
			expect(setCookie).toContain('Secure');
			expect(setCookie).toContain('SameSite=Lax');

			const inserts = db.prepare.mock.calls.map((c) => c[0] as string);
			expect(inserts.some((q) => q.includes('INSERT INTO organizations'))).toBe(true);
			expect(inserts.some((q) => q.includes("INSERT INTO platform_users"))).toBe(true);
		});

		it('returns error redirect when userinfo fetch fails', async () => {
			const state = 'bad-userinfo';
			kv.set(`auth:state:linkedin:${state}`, '1');

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve({ access_token: 'at', expires_in: 3600 }),
				})
				.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('x') }) as unknown as typeof fetch;

			const res = await app.request(
				`/api/auth/callback/linkedin?code=c&state=${state}`,
				{},
				env,
			);
			expect(res.status).toBe(302);
			expect(res.headers.get('Location')!).toContain('/auth/callback?error=');
		});
	});
});
