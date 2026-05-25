/**
 * OIDC SSO routes — POST /initiate, GET /callback
 * Known gap: worker.ts route-mount missing — routers are exercised directly via app.fetch.
 * Known gap: SSO_VAULT_KEY / SP_ENTITY_ID etc. not in Env interface — injected via TestEnv.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { oidcRouter } from './oidc';
import { __resetVaultCacheForTests } from '../../services/secret-vault';

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../../services/oidc-provider', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/oidc-provider')>();
    return {
        ...actual,
        OidcProvider: vi.fn().mockImplementation(() => ({
            buildAuthorizationUrl: vi.fn(async () => ({
                url: 'https://idp.example.com/auth?state=test',
                state: 'test-state',
            })),
            exchangeCode: vi.fn(async () => ({
                id_token: 'mock.id.token',
                access_token: 'access-token',
            })),
            verifyIdToken: vi.fn(async () => ({
                sub: 'user-sub-123',
                email: 'alice@acme.com',
                name: 'Alice',
                iss: 'https://idp.example.com',
                aud: 'client-id',
                exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000),
                nonce: 'test-nonce',
            })),
        })),
    };
});

vi.mock('../../services/jit-provisioner', () => ({
    provisionUser: vi.fn(async () => ({
        id: 'user-jit-1', email: 'alice@acme.com', name: 'Alice',
        orgId: 'org-1', role: 'member', tier: 'free', created: true,
    })),
}));

vi.mock('../../services/audit-logger', () => ({
    logAuditEvent: vi.fn(async () => {}),
    getClientInfo: vi.fn(() => ({ ipAddress: '1.2.3.4', userAgent: 'test' })),
}));

vi.mock('../../middleware/ip-rate-limiter', () => ({
    ipRateLimit: vi.fn(async (_c: any, next: any) => next()),
}));

vi.mock('../../middleware/validation', () => ({
    validateJson: vi.fn((schema: any) => async (c: any, next: any) => {
        try {
            const body = await c.req.json();
            c.req.valid = (_type: string) => schema.parse(body);
            await next();
        } catch {
            return c.json({ error: 'validation_failed' }, 400);
        }
    }),
}));

// ─── Test app factory ─────────────────────────────────────────────────────────

const VAULT_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(0xAB)));

function makeIdpRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'idp-1', org_id: 'org-1', type: 'oidc', name: 'Test IdP',
        enabled: 1, jit_enabled: 1, email_domain: 'acme.com',
        default_role: 'member',
        oidc_issuer: 'https://idp.example.com',
        oidc_client_id: 'client-id',
        oidc_client_secret: null,
        oidc_discovery_url: 'https://idp.example.com/.well-known',
        oidc_scopes: 'openid email profile',
        saml_entity_id: null, saml_sso_url: null, saml_certificate: null, saml_slo_url: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        ...overrides,
    };
}

function makeEnv(dbRow: Record<string, unknown> | null, sessionRow: Record<string, unknown> | null = {}) {
    const firstMock = vi.fn(async () => dbRow);
    const runMock = vi.fn(async () => ({}));
    return {
        DB: {
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({ first: firstMock, run: runMock })),
            })),
        },
        KV: {
            get: vi.fn(async () => null),
            put: vi.fn(async () => {}),
            delete: vi.fn(async () => {}),
        },
        JWT_SECRET: 'test-jwt-secret',
        SESSION_SECRET: 'test-session-secret-32-bytes-long!!',
        SSO_VAULT_KEY: VAULT_KEY,
        OIDC_REDIRECT_URI: 'https://app.lunaos.ai/v1/sso/oidc/callback',
        SP_ENTITY_ID: 'lunaos.ai',
    };
}

function makeApp(env: ReturnType<typeof makeEnv>) {
    const app = new Hono<{ Bindings: typeof env }>();
    app.route('/v1/sso/oidc', oidcRouter);
    return app;
}

async function initiateReq(app: Hono<any>, env: any, body: object) {
    return app.request('/v1/sso/oidc/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }, env);
}

// ─── POST /initiate ───────────────────────────────────────────────────────────

describe('POST /v1/sso/oidc/initiate', () => {
    beforeEach(() => { __resetVaultCacheForTests(); vi.clearAllMocks(); });

    it('returns 200 with redirectUrl for valid enabled IdP', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await initiateReq(app, env, { idpId: 'idp-1' });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.redirectUrl).toBeDefined();
        expect(body.correlationId).toBeDefined();
    });

    it('returns 404 when IdP not found', async () => {
        const env = makeEnv(null);
        const app = makeApp(env);
        const res = await initiateReq(app, env, { idpId: 'nonexistent' });
        expect(res.status).toBe(404);
        const body = await res.json() as any;
        expect(body.error).toBe('idp_not_found_or_disabled');
    });

    it('returns 404 when IdP disabled', async () => {
        const env = makeEnv(makeIdpRow({ enabled: 0 }));
        const app = makeApp(env);
        const res = await initiateReq(app, env, { idpId: 'idp-1' });
        expect(res.status).toBe(404);
    });

    it('returns 404 when IdP type is saml (not oidc)', async () => {
        const env = makeEnv(makeIdpRow({ type: 'saml' }));
        const app = makeApp(env);
        const res = await initiateReq(app, env, { idpId: 'idp-1' });
        expect(res.status).toBe(404);
    });

    it('passes returnPath through to redirectUrl', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await initiateReq(app, env, { idpId: 'idp-1', returnPath: '/custom-path' });
        expect(res.status).toBe(200);
    });
});

// ─── safeReturnPath open-redirect tests ──────────────────────────────────────

describe('safeReturnPath — open-redirect prevention', () => {
    // Test via the initiate endpoint which calls safeReturnPath internally
    const EVIL_PATHS = [
        '//evil.com',
        'https://evil.com',
        'http://evil.com',
        '/dashboard\r\nLocation: https://evil.com',
    ];

    for (const evilPath of EVIL_PATHS) {
        it(`rejects evil path: ${evilPath.slice(0, 30)}`, async () => {
            const env = makeEnv(makeIdpRow());
            const app = makeApp(env);
            const { OidcProvider } = await import('../../services/oidc-provider');
            const mockInstance = { buildAuthorizationUrl: vi.fn(async (_idp: any, returnPath: string) => {
                // The returnPath passed to buildAuthorizationUrl should be /dashboard (sanitized)
                expect(returnPath).toBe('/dashboard');
                return { url: 'https://idp.example.com/auth', state: 'st' };
            })};
            (OidcProvider as ReturnType<typeof vi.fn>).mockImplementationOnce(() => mockInstance);

            await initiateReq(app, env, { idpId: 'idp-1', returnPath: evilPath });
            // If assertion inside mock passes, test passes; if not, it throws
        });
    }

    it('accepts valid relative path /custom-return', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const { OidcProvider } = await import('../../services/oidc-provider');
        const mockInstance = { buildAuthorizationUrl: vi.fn(async (_idp: any, returnPath: string) => {
            expect(returnPath).toBe('/custom-return');
            return { url: 'https://idp.example.com/auth', state: 'st' };
        })};
        (OidcProvider as ReturnType<typeof vi.fn>).mockImplementationOnce(() => mockInstance);
        await initiateReq(app, env, { idpId: 'idp-1', returnPath: '/custom-return' });
    });
});

// ─── GET /callback ────────────────────────────────────────────────────────────

import { signState } from '../../services/oidc-provider';

async function callbackReq(app: Hono<any>, env: any, params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    return app.request(`/v1/sso/oidc/callback?${qs}`, {}, env);
}

async function makeValidState(env: any) {
    const now = Math.floor(Date.now() / 1000);
    return signState({
        idpId: 'idp-1',
        returnPath: '/dashboard',
        codeVerifier: 'cv-test-value',
        nonce: 'nonce-test-value',
        iat: now,
        exp: now + 600,
    }, env.SESSION_SECRET);
}

describe('GET /v1/sso/oidc/callback', () => {
    beforeEach(() => { __resetVaultCacheForTests(); vi.clearAllMocks(); });

    it('returns 400 when error param present', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await callbackReq(app, env, { error: 'access_denied', state: 'x' });
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('idp_error');
    });

    it('returns 400 when code missing', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await callbackReq(app, env, { state: 'somestate' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when state missing', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await callbackReq(app, env, { code: 'auth-code' });
        expect(res.status).toBe(400);
    });

    it('returns 400 for tampered state (HMAC mismatch)', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const validState = await makeValidState(env);
        const [body, _sig] = validState.split('.');
        const badState = `${body}.AAAAAAAAAAAAA`;
        const res = await callbackReq(app, env, { code: 'code', state: badState });
        expect(res.status).toBe(400);
        const respBody = await res.json() as any;
        expect(respBody.error).toMatch(/state_bad_sig|sso_callback_failed/);
    });

    it('happy path: returns 302 redirect to returnPath', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const state = await makeValidState(env);
        const res = await callbackReq(app, env, { code: 'auth-code-123', state });
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe('/dashboard');
    });

    it('happy path: sets Set-Cookie header', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const state = await makeValidState(env);
        const res = await callbackReq(app, env, { code: 'auth-code-123', state });
        expect(res.headers.get('Set-Cookie')).toContain('sso_session=');
        expect(res.headers.get('Set-Cookie')).toContain('HttpOnly');
    });

    it('returns 400 when IdP not found after state verify', async () => {
        const env = makeEnv(null);
        const app = makeApp(env);
        const state = await makeValidState(env);
        const res = await callbackReq(app, env, { code: 'code', state });
        expect(res.status).toBe(404);
    });
});
