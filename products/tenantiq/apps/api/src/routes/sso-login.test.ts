// RED: implementation not yet created
import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
// Import from implementation file that does not yet exist — this is intentional RED state
import { handleSsoLogin } from './sso-login';

const mockGetAuthorizationUrl = vi.hoisted(() =>
	vi.fn().mockReturnValue('https://api.workos.com/sso/authorize?state=test'),
);
vi.mock('@workos-inc/node', () => ({
	WorkOS: class {
		sso = { getAuthorizationUrl: mockGetAuthorizationUrl };
	},
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockKVGet = vi.fn().mockResolvedValue(null);
const mockKVPut = vi.fn();
const mockKVDelete = vi.fn();

const mockEnv = {
	DB: { prepare: mockPrepare } as unknown as D1Database,
	KV: { get: mockKVGet, put: mockKVPut, delete: mockKVDelete } as unknown as KVNamespace,
	JWT_SECRET,
	ENVIRONMENT: 'test',
	FRONTEND_URL: 'https://app.tenantiq.io',
	WORKOS_API_KEY: 'sk_test_workos_key',
} as unknown as AppEnv['Bindings'];

async function createToken(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(secret);
}

describe('SSO Login Handler — SSO-03 + SSO-06', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.get('/api/sso/login/:domain', handleSsoLogin);
		token = await createToken({
			sub: 'u1',
			email: 'admin@example.com',
			name: 'Admin',
			orgId: 'org1',
			tenantIds: ['t1'],
			role: 'admin',
		});
	});

	describe('SSO-03: Login initiation for OIDC connection', () => {
		it('redirects to IdP URL when domain has an active OIDC connection', async () => {
			mockFirst.mockResolvedValueOnce({
				id: 'conn1',
				org_id: 'org1',
				provider: 'oidc',
				status: 'active',
				issuer_url: 'https://idp.example.com',
				client_id: 'client-abc',
				domain: 'example.com',
			});

			const res = await app.request(
				'/api/sso/login/example.com',
				{ method: 'GET', headers: { Authorization: `Bearer ${token}` } },
				mockEnv,
			);

			expect(res.status).toBe(302);
			const location = res.headers.get('Location');
			expect(location).toBeTruthy();
			expect(location).toContain('https://');
		});

		it('returns 404 when domain has no SSO connection', async () => {
			mockFirst.mockResolvedValueOnce(null);

			const res = await app.request(
				'/api/sso/login/unknown.com',
				{ method: 'GET', headers: { Authorization: `Bearer ${token}` } },
				mockEnv,
			);

			expect(res.status).toBe(404);
		});

		it('returns 404 when connection exists but is inactive', async () => {
			mockFirst.mockResolvedValueOnce({
				id: 'conn2',
				org_id: 'org1',
				provider: 'oidc',
				status: 'inactive',
				domain: 'inactive.com',
			});

			const res = await app.request(
				'/api/sso/login/inactive.com',
				{ method: 'GET', headers: { Authorization: `Bearer ${token}` } },
				mockEnv,
			);

			expect(res.status).toBe(404);
		});

		it('builds redirect to WorkOS authorization URL for SAML connection', async () => {
			mockFirst.mockResolvedValueOnce({
				id: 'conn3',
				org_id: 'org1',
				provider: 'saml',
				status: 'active',
				domain: 'saml.example.com',
				metadata_url: 'https://idp.saml.example.com/metadata',
			});

			const res = await app.request(
				'/api/sso/login/saml.example.com',
				{ method: 'GET', headers: { Authorization: `Bearer ${token}` } },
				mockEnv,
			);

			// SAML redirects via WorkOS authorization URL
			expect(res.status).toBe(302);
			const location = res.headers.get('Location');
			expect(location).toBeTruthy();
		});
	});

	describe('SSO-06: Nonce TTL enforcement', () => {
		it('calls KV.put with key sso:state:{nonce} and expirationTtl of 300', async () => {
			mockFirst.mockResolvedValueOnce({
				id: 'conn1',
				org_id: 'org1',
				provider: 'oidc',
				status: 'active',
				issuer_url: 'https://idp.example.com',
				client_id: 'client-abc',
				domain: 'example.com',
			});

			await app.request(
				'/api/sso/login/example.com',
				{ method: 'GET', headers: { Authorization: `Bearer ${token}` } },
				mockEnv,
			);

			expect(mockKVPut).toHaveBeenCalledOnce();
			const [key, _value, options] = mockKVPut.mock.calls[0];
			expect(key).toMatch(/^sso:state:/);
			expect((options as { expirationTtl: number }).expirationTtl).toBe(300);
		});
	});
});
