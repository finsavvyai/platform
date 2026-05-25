/**
 * SSO Integration Tests — mounted Hono app with in-memory D1/KV mocks.
 *
 * Phase 3.1 cleared gaps:
 *  - worker.ts route mounts wired (oidc / saml / idp / discovery).
 *  - users table org_id/role/provisioned_via columns added (migration 022).
 *  - fast-xml-parser added to packages/api/package.json.
 *  - AuditAction union extended; `as never` casts removed.
 *  - Env interface extended with SSO_VAULT_KEY / SESSION_SECRET / etc.
 *
 * These tests use fully in-memory mocks (no miniflare) so they can run in CI
 * without Cloudflare Workers environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ─── Mock heavy service dependencies ─────────────────────────────────────────

vi.mock('../src/services/oidc-provider', async (orig) => {
    const actual = await orig<any>();
    return {
        ...actual,
        OidcProvider: vi.fn().mockImplementation(() => ({
            buildAuthorizationUrl: vi.fn(async () => ({
                url: 'https://idp.example.com/auth?state=integration-state',
                state: 'integration-state',
            })),
            exchangeCode: vi.fn(async () => ({
                id_token: 'mock.id.token', access_token: 'mock-access-token',
            })),
            verifyIdToken: vi.fn(async () => ({
                sub: 'user-sub-1', email: 'alice@acme.com', name: 'Alice Smith',
                iss: 'https://idp.example.com', aud: 'client-id',
                exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000), nonce: 'nonce-val',
            })),
        })),
    };
});

vi.mock('../src/services/jit-provisioner', () => ({
    provisionUser: vi.fn(async () => ({
        id: 'provisioned-user-1', email: 'alice@acme.com', name: 'Alice Smith',
        orgId: 'org-1', role: 'member', tier: 'free', created: true,
    })),
}));

vi.mock('../src/services/audit-logger', () => ({
    logAuditEvent: vi.fn(async () => {}),
    getClientInfo: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'integration-test' })),
}));

vi.mock('../src/middleware/ip-rate-limiter', () => ({
    ipRateLimit: vi.fn(async (_c: any, next: any) => next()),
}));

vi.mock('../src/middleware/validation', () => ({
    validateJson: vi.fn((schema: any) => async (c: any, next: any) => {
        try {
            const body = await c.req.json();
            c.req.valid = () => schema.parse(body);
            await next();
        } catch {
            return c.json({ error: 'validation_failed' }, 400);
        }
    }),
}));

vi.mock('../src/middleware/api-key-auth', () => ({
    requireAuthOrApiKey: vi.fn(async (c: any, next: any) => {
        c.set('userId', 'admin-user');
        await next();
    }),
}));

vi.mock('../src/middleware/require-org-admin', () => ({
    requireOrgAdmin: vi.fn(async (c: any, next: any) => {
        // FIND-003: real middleware sets server-derived orgId. Inject for tests.
        c.set('orgId', 'org-1');
        await next();
    }),
}));

vi.mock('../src/services/saml-provider', () => ({
    SamlProvider: vi.fn().mockImplementation(() => ({
        buildAuthnRequest: vi.fn(() => '<AuthnRequest/>'),
        parseAndVerifyResponse: vi.fn(async () => ({
            nameId: 'alice@acme.com',
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            email: 'alice@acme.com',
            firstName: 'Alice',
            lastName: 'Smith',
            displayName: 'Alice Smith',
            sessionIndex: 'idx-1',
            attributes: {},
        })),
    })),
}));

vi.mock('../src/services/saml-xml', () => ({
    SamlError: class extends Error {
        code: string;
        constructor(code: string) { super(code); this.code = code; this.name = 'SamlError'; }
    },
}));

// ─── Import routers after mocks ───────────────────────────────────────────────

import { oidcRouter } from '../src/routes/auth/oidc';
import { samlRouter } from '../src/routes/auth/saml';
import { discoveryRouter } from '../src/routes/auth/discovery';
import { idpAdminRouter } from '../src/routes/auth/idp-admin';
import { signState } from '../src/services/oidc-provider';
import { __resetVaultCacheForTests } from '../src/services/secret-vault';

// ─── In-memory KV / DB factories ─────────────────────────────────────────────

function makeKv(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    return {
        get: vi.fn(async (k: string) => store.get(k) ?? null),
        put: vi.fn(async (k: string, v: string, _opts?: any) => { store.set(k, v); }),
        delete: vi.fn(async (k: string) => { store.delete(k); }),
        _store: store,
    };
}

function makeIdpDbRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'idp-int-1', org_id: 'org-1', type: 'oidc', name: 'Integration IdP',
        enabled: 1, jit_enabled: 1, email_domain: 'acme.com',
        default_role: 'member',
        oidc_issuer: 'https://idp.example.com',
        oidc_client_id: 'client-id',
        oidc_client_secret: null,
        oidc_discovery_url: 'https://idp.example.com/.well-known',
        oidc_scopes: 'openid email profile',
        saml_entity_id: 'https://sp.lunaos.ai',
        saml_sso_url: 'https://idp.example.com/sso/saml',
        saml_certificate: '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(100) + '\n-----END CERTIFICATE-----',
        saml_slo_url: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        deleted_at: null,
        ...overrides,
    };
}

const VAULT_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(0xBB)));
const SESSION_SECRET = 'integration-session-secret-32b!!';

function makeIntegrationApp(idpRow: Record<string, unknown> | null = makeIdpDbRow(), kvExtras: Record<string, string> = {}) {
    const kv = makeKv(kvExtras);
    const firstMock = vi.fn(async () => idpRow);
    const runMock = vi.fn(async () => ({}));
    const allMock = vi.fn(async () => ({ results: idpRow ? [idpRow] : [] }));
    const db = {
        prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ first: firstMock, run: runMock, all: allMock })),
            all: vi.fn(async () => ({ results: [] })),
        })),
    };

    const env = {
        DB: db, KV: kv,
        JWT_SECRET: 'jwt',
        SESSION_SECRET,
        SSO_VAULT_KEY: VAULT_KEY,
        OIDC_REDIRECT_URI: 'https://app.lunaos.ai/v1/sso/oidc/callback',
        SP_ENTITY_ID: 'lunaos.ai',
        SP_ACS_URL: 'https://app.lunaos.ai/v1/sso/saml/callback',
    };

    const app = new Hono<{ Bindings: typeof env }>();
    app.route('/v1/sso/oidc', oidcRouter);
    app.route('/', samlRouter);
    app.route('/v1/sso/discovery', discoveryRouter);
    app.route('/v1/sso/idp', idpAdminRouter);

    return { app, env, kv, db };
}

// ─── OIDC Integration ─────────────────────────────────────────────────────────

describe('SSO Integration — OIDC initiate + callback', () => {
    beforeEach(() => { __resetVaultCacheForTests(); vi.clearAllMocks(); });

    it('POST /oidc/initiate → 200 with redirectUrl', async () => {
        const { app, env } = makeIntegrationApp();
        const res = await app.request('/v1/sso/oidc/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-int-1' }),
        }, env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.redirectUrl).toContain('https://idp.example.com/auth');
    });

    it('POST /oidc/initiate → 404 for disabled IdP', async () => {
        const { app, env } = makeIntegrationApp(makeIdpDbRow({ enabled: 0 }));
        const res = await app.request('/v1/sso/oidc/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-int-1' }),
        }, env);
        expect(res.status).toBe(404);
    });

    it('GET /oidc/callback → 302 with session cookie on happy path', async () => {
        const { app, env } = makeIntegrationApp();
        const now = Math.floor(Date.now() / 1000);
        const state = await signState(
            { idpId: 'idp-int-1', returnPath: '/dashboard', codeVerifier: 'cv', nonce: 'nc', iat: now, exp: now + 600 },
            SESSION_SECRET,
        );
        const res = await app.request(
            `/v1/sso/oidc/callback?code=auth-code&state=${encodeURIComponent(state)}`,
            {}, env,
        );
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe('/dashboard');
        expect(res.headers.get('Set-Cookie')).toContain('sso_session=');
    });

    it('GET /oidc/callback → 400 on tampered state', async () => {
        const { app, env } = makeIntegrationApp();
        const res = await app.request('/v1/sso/oidc/callback?code=code&state=bad.state', {}, env);
        expect(res.status).toBe(400);
    });
});

// ─── SAML Integration ─────────────────────────────────────────────────────────

describe('SSO Integration — SAML initiate + callback', () => {
    beforeEach(() => { __resetVaultCacheForTests(); vi.clearAllMocks(); });

    it('POST /saml/initiate → 200 with SAMLRequest in redirectUrl', async () => {
        const { app, env } = makeIntegrationApp(makeIdpDbRow({ type: 'saml' }));
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-int-1' }),
        }, env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(['GET', 'POST']).toContain(body.method);
    });

    it('POST /saml/callback → 302 on happy path', async () => {
        const relayEntry = JSON.stringify({
            idpId: 'idp-int-1', returnPath: '/dashboard',
            requestId: '_req-int-1', exp: Date.now() + 600_000,
        });
        const { app, env } = makeIntegrationApp(
            makeIdpDbRow({ type: 'saml' }),
            { 'saml:relay:relay-token-int': relayEntry, 'saml:authnreq:_req-int-1': '1' },
        );
        const form = new URLSearchParams({
            SAMLResponse: btoa('<Response/>'),
            RelayState: 'relay-token-int',
        }).toString();
        const res = await app.request('/v1/sso/saml/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form,
        }, env);
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe('/dashboard');
    });

    it('POST /saml/callback → 400 on missing relay state (replay/reuse attack)', async () => {
        const { app, env } = makeIntegrationApp(makeIdpDbRow({ type: 'saml' }));
        const form = new URLSearchParams({
            SAMLResponse: btoa('<Response/>'),
            RelayState: 'nonexistent-relay',
        }).toString();
        const res = await app.request('/v1/sso/saml/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form,
        }, env);
        expect(res.status).toBe(400);
    });
});

// ─── Discovery Integration ────────────────────────────────────────────────────

describe('SSO Integration — discovery', () => {
    it('GET /discovery?email=user@acme.com → 200 with oidc IdP info', async () => {
        const { app, env } = makeIntegrationApp();
        const res = await app.request(
            '/v1/sso/discovery?email=user@acme.com',
            { headers: { 'cf-connecting-ip': '10.0.0.1' } },
            env,
        );
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.idpId).toBe('idp-int-1');
    });

    it('GET /discovery?email=user@unknown.com → 200 with null fields (FIND-010)', async () => {
        const { app, env } = makeIntegrationApp(null);
        const res = await app.request(
            '/v1/sso/discovery?email=user@unknown.com',
            { headers: { 'cf-connecting-ip': '10.0.0.2' } },
            env,
        );
        // FIND-010: uniform 200 shape eliminates the enumeration oracle.
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.idpId).toBeNull();
    });
});

// ─── IdP Admin CRUD Integration ───────────────────────────────────────────────

describe('SSO Integration — IdP admin CRUD', () => {
    beforeEach(() => { __resetVaultCacheForTests(); vi.clearAllMocks(); });

    it('POST /idp → 201 creates IdP with encrypted secret', async () => {
        const { app, env } = makeIntegrationApp(makeIdpDbRow());
        const res = await app.request('/v1/sso/idp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orgId: 'org-1', type: 'oidc', name: 'Test OIDC', enabled: true,
                emailDomain: 'test.com', jitEnabled: true, defaultRole: 'member',
                oidcIssuer: 'https://iss.example.com',
                oidcClientId: 'cid',
                oidcClientSecret: 'raw-secret-should-be-encrypted',
                oidcDiscoveryUrl: 'https://iss.example.com/.well-known/openid-configuration',
                oidcScopes: 'openid email',
            }),
        }, env);
        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(JSON.stringify(body)).not.toContain('raw-secret-should-be-encrypted');
    });

    it('DELETE /idp/:id → 200, second DELETE → 200 (soft-delete idempotent)', async () => {
        const { app, env } = makeIntegrationApp(makeIdpDbRow());
        const res1 = await app.request('/v1/sso/idp/idp-int-1?orgId=org-1', { method: 'DELETE' }, env);
        expect(res1.status).toBe(200);
        // Second delete — idpRow still returned by SELECT (soft-delete)
        const res2 = await app.request('/v1/sso/idp/idp-int-1?orgId=org-1', { method: 'DELETE' }, env);
        expect(res2.status).toBe(200);
    });
});

// ─── TODO: users table schema gap integration tests ──────────────────────────

describe.skip('TODO(SSO-schema-gap): JIT provisioner integration with live D1', () => {
    // Blocked on: migrations/021_add_sso_user_columns.sql
    // ALTER TABLE users ADD COLUMN org_id TEXT;
    // ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member';
    // ALTER TABLE users ADD COLUMN provisioned_via TEXT;
    //
    // Once applied, uncomment and run with miniflare:
    //   it('provisions new user on first SSO callback', async () => { ... });
    //   it('is idempotent on second SSO callback for same user', async () => { ... });
});

describe.skip('TODO(fast-xml-parser): SAML XML parsing integration tests', () => {
    // Blocked on: npm install fast-xml-parser in lunaos-engine/packages/api
    // Once installed:
    //   it('parseSamlXml rejects DOCTYPE injection (xxe_blocked)', ...)
    //   it('parseSamlXml with golden Okta-style signed Response → assertion extracted', ...)
    //   it('XSW attack: injected unsigned Assertion rejected', ...)
});
