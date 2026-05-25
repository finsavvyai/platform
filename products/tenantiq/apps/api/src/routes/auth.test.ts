import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from './auth';
import type { AppEnv } from '../index';
import * as jose from 'jose';
import { AppError } from '../lib/errors';

// Mock the db module (used by refresh route via getDb)
const mockDrizzleDb = {};
vi.mock('../lib/db', () => ({
	getDb: () => mockDrizzleDb,
	schema: {},
}));

vi.mock('@tenantiq/db', () => ({
	getTenantsByOrganization: vi.fn(() => Promise.resolve([])),
	getPlatformUserByAzureOid: vi.fn(() =>
		Promise.resolve({
			id: 'azure-user-123',
			email: 'user@example.com',
			name: 'Test User',
			organization_id: 'org-123',
			role: 'admin',
			status: 'active',
		}),
	),
}));

// Stub id_token verification so tests can exercise the callback flow without
// needing to contact Microsoft's real JWKS endpoint. The prod resolver is
// injectable via `microsoftJwksResolver` (see lib/azure-id-token.ts).
vi.mock('../lib/azure-id-token', () => ({
	verifyAzureIdToken: vi.fn(() =>
		Promise.resolve({
			oid: 'azure-user-123',
			email: 'user@example.com',
			name: 'Test User',
			tid: 'azure-tenant-abc',
		}),
	),
}));

import { getTenantsByOrganization, getPlatformUserByAzureOid } from '@tenantiq/db';

function createMockDb() {
	const chainable = {
		bind: vi.fn(() => chainable),
		all: vi.fn(() => Promise.resolve({ results: [] })),
		first: vi.fn(() => Promise.resolve(null)),
		run: vi.fn(() => Promise.resolve({ success: true })),
	};
	return {
		prepare: vi.fn(() => chainable),
		_chain: chainable,
	};
}

describe('Auth Routes', () => {
	let app: Hono<AppEnv>;
	let mockEnv: AppEnv['Bindings'];
	let mockKV: Map<string, string>;
	let mockDb: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		app = new Hono<AppEnv>();
		app.route('/api/auth', authRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});

		mockKV = new Map();
		mockDb = createMockDb();

		mockEnv = {
			ENVIRONMENT: 'test',
			JWT_SECRET: 'test-secret-key-for-testing-only',
			AZURE_CLIENT_ID: 'test-client-id',
			AZURE_CLIENT_SECRET: 'test-client-secret',
			AZURE_TENANT_ID: 'test-tenant',
			ANTHROPIC_API_KEY: 'test-api-key',
			DB: mockDb as any,
			KV: {
				get: vi.fn((key) => Promise.resolve(mockKV.get(key) || null)),
				put: vi.fn((key: string, value: string) => {
					mockKV.set(key, value);
					return Promise.resolve();
				}),
				delete: vi.fn((key: string) => {
					mockKV.delete(key);
					return Promise.resolve();
				}),
				list: vi.fn(),
				getWithMetadata: vi.fn()
			} as unknown as KVNamespace
		} as AppEnv['Bindings'];

		vi.clearAllMocks();
		mockKV.clear();
	});

	describe('GET /api/auth/login', () => {
		it('should redirect to Azure OAuth authorization URL', async () => {
			const res = await app.request('/api/auth/login', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(302);
			const location = res.headers.get('Location')!;
			expect(location).toContain('login.microsoftonline.com');
			expect(location).toContain('client_id=test-client-id');
			expect(location).toContain('response_type=code');
			expect(location).toContain('state=');
		});

		it('should store state in KV for CSRF protection', async () => {
			await app.request('/api/auth/login', {
				method: 'GET'
			}, mockEnv);

			expect(mockEnv.KV.put).toHaveBeenCalled();
			const authStateCalls = vi.mocked(mockEnv.KV.put).mock.calls.filter(
				(call) => (call[0] as string).startsWith('auth:state:')
			);
			expect(authStateCalls.length).toBeGreaterThan(0);
			const callArgs = authStateCalls[0];
			expect(callArgs[0]).toMatch(/^auth:state:/);
			expect(callArgs[2]).toEqual({ expirationTtl: 300 });
		});

		it('should include required OAuth scopes', async () => {
			const res = await app.request('/api/auth/login', {
				method: 'GET'
			}, mockEnv);

			const location = res.headers.get('Location')!;
			const url = new URL(location);
			const scope = url.searchParams.get('scope')!;

			expect(scope).toContain('openid');
			expect(scope).toContain('profile');
			expect(scope).toContain('email');
			expect(scope).toContain('User.Read.All');
			expect(scope).toContain('Group.Read.All');
			expect(scope).toContain('Directory.Read.All');
		});

		it('should use correct redirect URI', async () => {
			const res = await app.request('http://api.tenantiq.com/api/auth/login', {
				method: 'GET'
			}, mockEnv);

			const location = res.headers.get('Location')!;
			const url = new URL(location);
			const redirectUri = url.searchParams.get('redirect_uri');

			expect(redirectUri).toContain('/api/auth/callback');
		});
	});

	describe('GET /api/auth/callback', () => {
		it('should redirect to frontend with error when code is missing', async () => {
			const res = await app.request('/api/auth/callback', {
				method: 'GET'
			}, mockEnv);

			expect(res.status).toBe(302);
			const location = res.headers.get('Location')!;
			expect(location).toContain('/auth/callback?error=');
			expect(decodeURIComponent(location)).toContain('no authorization code');
		});

		it('should return 400 JSON error if state is invalid', async () => {
			const res = await app.request(
				'/api/auth/callback?code=test-code&state=invalid-state',
				{ method: 'GET' },
				mockEnv
			);

			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toBe('Invalid state parameter');
		});

		it('should proceed to token exchange when code is provided without state', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				text: () => Promise.resolve('Token exchange failed')
			});

			const res = await app.request('/api/auth/callback?code=test-code', {
				method: 'GET'
			}, mockEnv);

			// Redirects to frontend with error after failed token exchange
			expect(res.status).toBe(302);
			const location = res.headers.get('Location')!;
			expect(location).toContain('/auth/callback?error=');
			expect(global.fetch).toHaveBeenCalled();
		});

		it('should validate and consume state parameter', async () => {
			const state = 'valid-state-123';
			mockKV.set(`auth:state:${state}`, '1');

			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				text: () => Promise.resolve('Token exchange failed')
			});

			await app.request(`/api/auth/callback?code=test-code&state=${state}`, {
				method: 'GET'
			}, mockEnv);

			expect(mockEnv.KV.delete).toHaveBeenCalledWith(`auth:state:${state}`);
		});

		// id_token verification is stubbed above (see vi.mock('../lib/azure-id-token')).
		// We don't generate a real signed token here because the verifier would
		// normally call Microsoft's JWKS endpoint.
		// Stale: tested old direct-cookie callback contract; current flow uses
		// xcode envelope (callback redirects with ?code=, frontend exchanges
		// at /api/auth/exchange). Functional path covered by cert-prep e2e.
		it.skip('should create new user and organization on first login', async () => {
			const state = 'valid-state';
			mockKV.set(`auth:state:${state}`, 'mock-nonce');

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({
					access_token: 'mock-access-token',
					refresh_token: 'mock-refresh-token',
					id_token: 'stub-id-token',
					expires_in: 3600
				})
			});

			// Mock DB: no existing user (first() returns null)
			mockDb._chain.first.mockResolvedValueOnce(null);

			const res = await app.request(
				`/api/auth/callback?code=auth-code&state=${state}`,
				{ method: 'GET' },
				mockEnv
			);

			// Should redirect to frontend with status=success (cookie-based auth)
			expect(res.status).toBe(302);
			const location = res.headers.get('Location')!;
			expect(location).toContain('/auth/callback?status=success');

			// Verify DB prepare was called for INSERT (org + user)
			const prepareCalls = mockDb.prepare.mock.calls.map(
				(c) => c[0] as string
			);
			expect(prepareCalls.some((q) => q.includes('INSERT INTO organizations'))).toBe(true);
			expect(prepareCalls.some((q) => q.includes('INSERT INTO platform_users'))).toBe(true);
		});

		it.skip('should update existing user on subsequent login', async () => {
			const state = 'valid-state';
			mockKV.set(`auth:state:${state}`, 'mock-nonce');

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({
					access_token: 'mock-access-token',
					refresh_token: 'mock-refresh-token',
					id_token: 'stub-id-token',
					expires_in: 3600
				})
			});

			// Mock DB: existing user found
			mockDb._chain.first.mockResolvedValueOnce({
				id: 'user-123',
				organization_id: 'org-123',
				email: 'user@example.com',
				name: 'Test User',
				role: 'admin',
				azure_oid: 'azure-user-123'
			});
			// Mock tenants query (all returns results)
			mockDb._chain.all.mockResolvedValueOnce({
				results: [{ id: 'tenant-1' }]
			});
			// Mock org lookup for trial date
			mockDb._chain.first.mockResolvedValueOnce({
				created_at: Math.floor(Date.now() / 1000),
				billing_plan: 'trial'
			});

			const res = await app.request(
				`/api/auth/callback?code=auth-code&state=${state}`,
				{ method: 'GET' },
				mockEnv
			);

			expect(res.status).toBe(302);
			const location = res.headers.get('Location')!;
			expect(location).toContain('/auth/callback?status=success');

			// Verify UPDATE was called (not INSERT for org/user)
			const prepareCalls = mockDb.prepare.mock.calls.map(
				(c) => c[0] as string
			);
			expect(
				prepareCalls.some((q) => q.includes('UPDATE platform_users'))
			).toBe(true);
			expect(
				prepareCalls.filter((q) => q.includes('INSERT INTO organizations'))
			).toHaveLength(0);
			expect(
				prepareCalls.filter((q) => q.includes('INSERT INTO platform_users'))
			).toHaveLength(0);
		});

		it.skip('should store session in KV with 24h expiration', async () => {
			const state = 'valid-state';
			mockKV.set(`auth:state:${state}`, 'mock-nonce');

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({
					access_token: 'mock-access-token',
					refresh_token: 'mock-refresh-token',
					id_token: 'stub-id-token',
					expires_in: 3600
				})
			});

			// Mock DB: no existing user
			mockDb._chain.first.mockResolvedValueOnce(null);

			await app.request(
				`/api/auth/callback?code=auth-code&state=${state}`,
				{ method: 'GET' },
				mockEnv
			);

			const sessionCall = vi.mocked(mockEnv.KV.put).mock.calls.find(
				(call) => (call[0] as string).startsWith('session:')
			);

			expect(sessionCall).toBeDefined();
			expect(sessionCall![0]).toBe('session:azure-user-123');
			expect(sessionCall![2]).toEqual({ expirationTtl: 86400 });
		});
	});

	describe('POST /api/auth/exchange (cookie contract)', () => {
		// Regression: the OAuth callback writes a one-time `auth:code:<id>` to
		// KV, then the web /auth/callback page POSTs that id to /api/auth/exchange
		// to get an HttpOnly cookie. The cookie name MUST match what the
		// authMiddleware reads in middleware/auth.ts:SESSION_COOKIE — drift
		// between writer + reader is silent (login looks like it works, then
		// every authed call 401s).
		it('sets Set-Cookie with the canonical session-cookie name', async () => {
			mockKV.set('auth:code:test-code', JSON.stringify({
				jwt: 'fake-jwt-payload',
				user: { id: 'u1', email: 'a@b.com', role: 'admin', organizationId: 'org-1' },
			}));

			const res = await app.request('/api/auth/exchange', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: 'test-code' }),
			}, mockEnv);

			expect(res.status).toBe(200);
			const setCookie = res.headers.get('Set-Cookie') ?? '';
			expect(setCookie).toMatch(/^tenantiq_session=/);
			expect(setCookie).not.toMatch(/^__tenantiq_session=/);
			expect(setCookie).toContain('HttpOnly');
		});

		it('returns 400 when the auth code is missing or expired', async () => {
			const res = await app.request('/api/auth/exchange', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: 'never-stored' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
	});

	describe('POST /api/auth/refresh', () => {
		it('should return error if Authorization header is missing', async () => {
			const res = await app.request('/api/auth/refresh', {
				method: 'POST'
			}, mockEnv);

			expect(res.status).toBe(401);

			const json: any = await res.json();
			expect(json.error.message).toBe('Missing session');
		});

		it('should return error if token is invalid', async () => {
			const res = await app.request('/api/auth/refresh', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer invalid-token'
				}
			}, mockEnv);

			expect(res.status).toBe(401);

			const json: any = await res.json();
			expect(json.error.message).toBe('Invalid or expired token');
		});

		it('should refresh valid token with updated tenant IDs', async () => {
			const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
			const oldToken = await new jose.SignJWT({
				sub: 'azure-user-123',
				email: 'user@example.com',
				name: 'Test User',
				orgId: 'org-123',
				tenantIds: ['tenant-1'],
				role: 'admin'
			})
				.setProtectedHeader({ alg: 'HS256' })
				.setIssuedAt()
				.setExpirationTime('24h')
				.sign(secret);

			// /refresh reads platform_users via raw D1, not the ORM.
			mockDb._chain.first = vi.fn(() => Promise.resolve({
				id: 'azure-user-123',
				azure_oid: 'azure-user-123',
				email: 'user@example.com',
				name: 'Test User',
				organization_id: 'org-123',
				role: 'admin',
				status: 'active',
			}));

			vi.mocked(getTenantsByOrganization).mockResolvedValue([
				{
					id: 'tenant-1',
					organizationId: 'org-123',
					azureTenantId: 'azure-tenant-1',
					displayName: 'Tenant 1',
					domain: 'tenant1.com',
					status: 'active',
					createdAt: new Date().toISOString(),
					lastSyncAt: null
				},
				{
					id: 'tenant-2',
					organizationId: 'org-123',
					azureTenantId: 'azure-tenant-2',
					displayName: 'Tenant 2',
					domain: 'tenant2.com',
					status: 'active',
					createdAt: new Date().toISOString(),
					lastSyncAt: null
				}
			] as any);

			const res = await app.request('/api/auth/refresh', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${oldToken}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.ok).toBe(true);

			// Session stored in KV with updated tenants — verify KV.put was called
			const sessionPut = vi.mocked(mockEnv.KV.put).mock.calls.find(
				(call) => (call[0] as string).startsWith('session:')
			);
			expect(sessionPut).toBeDefined();
		});

		it('should store refreshed session in KV', async () => {
			const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
			const oldToken = await new jose.SignJWT({
				sub: 'azure-user-123',
				email: 'user@example.com',
				name: 'Test User',
				orgId: 'org-123',
				tenantIds: [],
				role: 'admin'
			})
				.setProtectedHeader({ alg: 'HS256' })
				.setIssuedAt()
				.setExpirationTime('24h')
				.sign(secret);

			mockDb._chain.first = vi.fn(() => Promise.resolve({
				id: 'azure-user-123',
				azure_oid: 'azure-user-123',
				email: 'user@example.com',
				name: 'Test User',
				organization_id: 'org-123',
				role: 'admin',
				status: 'active',
			}));

			vi.mocked(getTenantsByOrganization).mockResolvedValue([] as any);

			await app.request('/api/auth/refresh', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${oldToken}`
				}
			}, mockEnv);

			expect(mockEnv.KV.put).toHaveBeenCalledWith(
				'session:azure-user-123',
				expect.any(String),
				{ expirationTtl: 86400 }
			);
		});
	});

	describe('POST /api/auth/logout', () => {
		it('should delete session from KV', async () => {
			const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
			const token = await new jose.SignJWT({
				sub: 'azure-user-123',
				email: 'user@example.com',
				name: 'Test User',
				orgId: 'org-123',
				tenantIds: [],
				role: 'admin'
			})
				.setProtectedHeader({ alg: 'HS256' })
				.setIssuedAt()
				.setExpirationTime('24h')
				.sign(secret);

			const res = await app.request('/api/auth/logout', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`
				}
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.success).toBe(true);

			expect(mockEnv.KV.delete).toHaveBeenCalledWith(
				'session:azure-user-123'
			);
		});

		it('should succeed even without Authorization header', async () => {
			const res = await app.request('/api/auth/logout', {
				method: 'POST'
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.success).toBe(true);
		});

		it('should succeed even with invalid token', async () => {
			const res = await app.request('/api/auth/logout', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer invalid-token'
				}
			}, mockEnv);

			expect(res.status).toBe(200);

			const json = await res.json();
			expect(json.success).toBe(true);
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────
// Onboard-org + personal login coverage
// ─────────────────────────────────────────────────────────────────────────
describe('Auth Routes — onboarding + personal scope', () => {
	let app: Hono<AppEnv>;
	let mockEnv: AppEnv['Bindings'];
	let mockKV: Map<string, string>;

	beforeEach(() => {
		app = new Hono<AppEnv>();
		app.route('/api/auth', authRoutes);
		app.onError((err, c) => {
			if (err instanceof AppError) return c.json(err.toJSON(), err.status as any);
			return c.json({ error: 'Internal error' }, 500);
		});
		mockKV = new Map();
		mockEnv = {
			ENVIRONMENT: 'test',
			JWT_SECRET: 'x'.repeat(32),
			AZURE_CLIENT_ID: 'test-client',
			KV: {
				get: vi.fn((k: string) => Promise.resolve(mockKV.get(k) ?? null)),
				put: vi.fn((k: string, v: string) => { mockKV.set(k, v); return Promise.resolve(); }),
				delete: vi.fn((k: string) => { mockKV.delete(k); return Promise.resolve(); }),
				list: vi.fn(), getWithMetadata: vi.fn(),
			} as unknown as KVNamespace,
			DB: {} as D1Database,
		} as AppEnv['Bindings'];
	});

	it('GET /api/auth/onboard-org redirects unauthenticated requests to /login', async () => {
		// Used to 401 with structured-error JSON, which trapped public-landing
		// visitors who clicked "Onboard your organization". Now bounces them
		// through the sign-in flow — same destination, no error wall.
		const res = await app.request('/api/auth/onboard-org', {}, mockEnv);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toContain('/api/auth/login');
	});

	it('GET /api/auth/onboard-org redirects to Microsoft /adminconsent when authed', async () => {
		const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
		const token = await new jose.SignJWT({
			sub: 'u-1', email: 'a@b.com', orgId: 'org-1', role: 'admin',
		})
			.setProtectedHeader({ alg: 'HS256' })
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(secret);

		const res = await app.request('/api/auth/onboard-org', {
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);

		expect(res.status).toBe(302);
		const loc = res.headers.get('Location')!;
		expect(loc).toContain('login.microsoftonline.com/organizations/adminconsent');
		expect(loc).toContain('client_id=test-client');
		expect(loc).toContain('redirect_uri=');
		// State must be stashed in KV with caller's orgId so the callback can
		// upsert a tenant row for that org.
		const stateMatch = loc.match(/state=([^&]+)/);
		expect(stateMatch).toBeTruthy();
		const stash = mockKV.get(`auth:onboard:${stateMatch![1]}`);
		expect(stash).toBeDefined();
		expect(JSON.parse(stash!).orgId).toBe('org-1');
	});

	it('GET /api/auth/onboard-org returns 503 when AZURE_CLIENT_ID unset', async () => {
		const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
		const token = await new jose.SignJWT({
			sub: 'u-1', email: 'a@b.com', orgId: 'org-1', role: 'admin',
		})
			.setProtectedHeader({ alg: 'HS256' })
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(secret);
		const env = { ...mockEnv, AZURE_CLIENT_ID: undefined };
		const res = await app.request('/api/auth/onboard-org', {
			headers: { Authorization: `Bearer ${token}` },
		}, env);
		expect(res.status).toBe(503);
	});

	it('GET /api/auth/login/personal redirects with reduced scopes', async () => {
		const res = await app.request('/api/auth/login/personal', {}, mockEnv);
		expect(res.status).toBe(302);
		const loc = res.headers.get('Location')!;
		expect(loc).toContain('login.microsoftonline.com');
		// Personal scope set (no .All admin scopes)
		expect(loc).toContain('User.Read');
		expect(loc).toContain('Mail.Read');
		expect(loc).toContain('Files.Read');
		expect(loc).not.toMatch(/User\.Read\.All/);
		expect(loc).not.toMatch(/Directory\.Read\.All/);
		// State recorded with personal:nonce prefix
		const stateKeys = [...mockKV.keys()].filter((k) => k.startsWith('auth:state:'));
		expect(stateKeys.length).toBe(1);
		const stateVal = mockKV.get(stateKeys[0])!;
		expect(stateVal.startsWith('personal:')).toBe(true);
	});

	it('GET /api/auth/login records admin:nonce state', async () => {
		const res = await app.request('/api/auth/login', {}, mockEnv);
		expect(res.status).toBe(302);
		const stateKeys = [...mockKV.keys()].filter((k) => k.startsWith('auth:state:'));
		const stateVal = mockKV.get(stateKeys[0])!;
		expect(stateVal.startsWith('admin:')).toBe(true);
	});
});
