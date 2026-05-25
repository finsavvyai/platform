// RED: implementation not yet created
import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
// Import from implementation file that does not yet exist — this is intentional RED state
import { handleOidcCallback, handleSamlCallback } from './sso-callback';
import { oktaSampleClaims } from '../test/fixtures/sso/okta-id-token';
import { entraSampleClaims, entraGuestClaims } from '../test/fixtures/sso/entra-id-token';
import { auth0SampleClaims } from '../test/fixtures/sso/auth0-id-token';

const mockGetProfileAndToken = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		profile: { email: 'user@example.com', firstName: 'User', lastName: 'Name' },
	}),
);
vi.mock('@workos-inc/node', () => ({
	WorkOS: class {
		sso = { getProfileAndToken: mockGetProfileAndToken };
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

describe('SSO Callback Handlers — SSO-03 + SSO-06', () => {
	let app: Hono<AppEnv>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.get('/api/sso/callback/oidc', handleOidcCallback);
		app.post('/api/sso/callback/saml', handleSamlCallback);
	});

	describe('SSO-06: OIDC callback state validation', () => {
		it('returns 400 when state param is missing', async () => {
			const res = await app.request(
				'/api/sso/callback/oidc?code=somecode',
				{ method: 'GET' },
				mockEnv,
			);

			expect(res.status).toBe(400);
		});

		it('returns 400 when state is expired or unknown (KV.get returns null)', async () => {
			mockKVGet.mockResolvedValueOnce(null);

			const res = await app.request(
				'/api/sso/callback/oidc?code=somecode&state=expired-nonce',
				{ method: 'GET' },
				mockEnv,
			);

			expect(res.status).toBe(400);
		});

		it('returns 400 when state has already been consumed (replayed nonce)', async () => {
			// KV.get returns null simulating a nonce that was already deleted after first use
			mockKVGet.mockResolvedValueOnce(null);

			const res = await app.request(
				'/api/sso/callback/oidc?code=somecode&state=already-used-nonce',
				{ method: 'GET' },
				mockEnv,
			);

			expect(res.status).toBe(400);
		});
	});

	describe('SSO-03: OIDC callback success flow', () => {
		it('sets session cookie and redirects on valid state and id_token', async () => {
			// Build a real (HS256-signed) id_token with email + name claims
			const idToken = await createToken({
				sub: 'oidc-user-1',
				email: 'user@example.com',
				name: 'User Name',
				iss: 'https://idp.example.com',
				aud: 'client-abc',
			});

			const statePayload = JSON.stringify({
				orgId: 'org1',
				connId: 'conn1',
				redirectTo: '/dashboard',
			});
			mockKVGet.mockResolvedValueOnce(statePayload);

			// DB returns valid connection then user for JIT provisioning
			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'oidc', status: 'active' }) // connection lookup
				.mockResolvedValueOnce({ id: 'u1', email: 'user@example.com', name: 'User' }); // jit existing user

			const res = await app.request(
				`/api/sso/callback/oidc?code=valid-code&state=valid-nonce&id_token=${encodeURIComponent(idToken)}`,
				{ method: 'GET' },
				mockEnv,
			);

			expect(res.status).toBe(302);
			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toBeTruthy();
		});

		it('calls KV.delete exactly once per successful OIDC callback (one-time nonce consumption)', async () => {
			const idToken = await createToken({
				sub: 'oidc-user-2',
				email: 'user@example.com',
				name: 'User',
				iss: 'https://idp.example.com',
				aud: 'client-abc',
			});

			const statePayload = JSON.stringify({
				orgId: 'org1',
				connId: 'conn1',
				redirectTo: '/dashboard',
			});
			mockKVGet.mockResolvedValueOnce(statePayload);

			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'oidc', status: 'active' })
				.mockResolvedValueOnce({ id: 'u1', email: 'user@example.com', name: 'User' });

			await app.request(
				`/api/sso/callback/oidc?code=valid-code&state=valid-nonce&id_token=${encodeURIComponent(idToken)}`,
				{ method: 'GET' },
				mockEnv,
			);

			expect(mockKVDelete).toHaveBeenCalledOnce();
			expect(mockKVDelete).toHaveBeenCalledWith('sso:state:valid-nonce');
		});
	});

	describe('SSO-03: SAML callback success flow', () => {
		it('issues session cookie and redirects on valid WorkOS code', async () => {
			const statePayload = JSON.stringify({
				orgId: 'org1',
				connId: 'conn1',
				redirectTo: '/dashboard',
			});
			mockKVGet.mockResolvedValueOnce(statePayload);

			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'saml', status: 'active' })
				.mockResolvedValueOnce({ id: 'u1', email: 'user@example.com', name: 'User' });

			const res = await app.request(
				'/api/sso/callback/saml',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ code: 'valid-workos-code', state: 'valid-nonce' }),
				},
				mockEnv,
			);

			expect(res.status).toBe(302);
			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toBeTruthy();
		});

		it('calls KV.delete exactly once per successful SAML callback (one-time nonce consumption)', async () => {
			const statePayload = JSON.stringify({ orgId: 'org1', connId: 'conn1' });
			mockKVGet.mockResolvedValueOnce(statePayload);

			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'saml', status: 'active' })
				.mockResolvedValueOnce({ id: 'u1', email: 'user@example.com', name: 'User' });

			await app.request(
				'/api/sso/callback/saml',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ code: 'valid-workos-code', state: 'saml-nonce' }),
				},
				mockEnv,
			);

			expect(mockKVDelete).toHaveBeenCalledOnce();
			expect(mockKVDelete).toHaveBeenCalledWith('sso:state:saml-nonce');
		});
	});

	// Phase A2 — verify decodeJwt + email extraction handles each IdP's claim shape.
	// `decodeJwt` doesn't verify signatures, so any HS256-signed JWT round-trips correctly.
	describe('OIDC: per-IdP claim shapes (Phase A2 fixtures)', () => {
		async function runProvider(idTokenClaims: Record<string, unknown>) {
			const idToken = await createToken(idTokenClaims);
			mockKVGet.mockResolvedValueOnce(JSON.stringify({ orgId: 'org1', connId: 'conn1' }));
			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'oidc', status: 'active' })
				.mockResolvedValueOnce({ id: 'u1', email: idTokenClaims.email });
			return app.request(
				`/api/sso/callback/oidc?state=valid-nonce&id_token=${encodeURIComponent(idToken)}`,
				{ method: 'GET' },
				mockEnv,
			);
		}

		it('Okta: extracts email from standard claim', async () => {
			const claims = oktaSampleClaims();
			const res = await runProvider({ ...claims });
			expect(res.status).toBe(302);
			expect(mockBind).toHaveBeenCalledWith(claims.email, 'org1');
		});

		it('Okta: handles user with multiple groups (groups claim ignored for email)', async () => {
			const claims = oktaSampleClaims({
				email: 'admin@acme-corp.com',
				groups: ['Everyone', 'Engineering', 'Admins', 'TenantIQ-Admins', 'Finance'],
			});
			const res = await runProvider({ ...claims });
			expect(res.status).toBe(302);
			expect(mockBind).toHaveBeenCalledWith('admin@acme-corp.com', 'org1');
		});

		it('Entra ID: extracts email from v2.0 token', async () => {
			const claims = entraSampleClaims();
			const res = await runProvider({ ...claims });
			expect(res.status).toBe(302);
			expect(mockBind).toHaveBeenCalledWith(claims.email, 'org1');
		});

		it('Entra ID: B2B guest without email falls back to preferred_username', async () => {
			const claims = entraGuestClaims();
			const idToken = await createToken({ ...claims });
			mockKVGet.mockResolvedValueOnce(JSON.stringify({ orgId: 'org1', connId: 'conn1' }));
			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'oidc', status: 'active' })
				.mockResolvedValueOnce({ id: 'u1', email: claims.preferred_username });

			const res = await app.request(
				`/api/sso/callback/oidc?state=valid-nonce&id_token=${encodeURIComponent(idToken)}`,
				{ method: 'GET' },
				mockEnv,
			);

			expect(res.status).toBe(302);
			expect(mockBind).toHaveBeenCalledWith(claims.preferred_username, 'org1');
		});

		it('Auth0: extracts email despite namespaced custom claims', async () => {
			const claims = auth0SampleClaims();
			const res = await runProvider({ ...claims });
			expect(res.status).toBe(302);
			expect(mockBind).toHaveBeenCalledWith(claims.email, 'org1');
		});

		it('Auth0: handles social-connection sub format (google-oauth2|...)', async () => {
			const claims = auth0SampleClaims({
				sub: 'google-oauth2|117892345678901234567',
				email: 'social@acme-corp.com',
			});
			const res = await runProvider({ ...claims });
			expect(res.status).toBe(302);
			expect(mockBind).toHaveBeenCalledWith('social@acme-corp.com', 'org1');
		});

		it('All IdPs: name claim populates displayName for jitProvision', async () => {
			const claims = oktaSampleClaims({ name: 'Test Display Name' });
			const idToken = await createToken({ ...claims });
			mockKVGet.mockResolvedValueOnce(JSON.stringify({ orgId: 'org1', connId: 'conn1' }));
			mockFirst
				.mockResolvedValueOnce({ id: 'conn1', org_id: 'org1', provider: 'oidc', status: 'active' })
				.mockResolvedValueOnce({ id: 'u1', email: claims.email, name: 'Test Display Name' });

			const res = await app.request(
				`/api/sso/callback/oidc?state=valid-nonce&id_token=${encodeURIComponent(idToken)}`,
				{ method: 'GET' },
				mockEnv,
			);
			expect(res.status).toBe(302);
		});
	});
});
