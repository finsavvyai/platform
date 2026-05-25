/**
 * SAML SP routes — POST /v1/sso/saml/initiate, POST /v1/sso/saml/callback
 * NOTE: fast-xml-parser not in package.json → saml-xml parsing tests marked .skip.
 * KV / DB / SamlProvider are fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { samlRouter } from './saml';

// ─── Mock service deps ────────────────────────────────────────────────────────

vi.mock('../../services/saml-provider', () => ({
    SamlProvider: vi.fn().mockImplementation(() => ({
        buildAuthnRequest: vi.fn(
            (_idp: any, requestId: string, spEntityId: string, spAcsUrl: string) =>
                `<samlp:AuthnRequest ID="${requestId}" AssertionConsumerServiceURL="${spAcsUrl}"><saml:Issuer>${spEntityId}</saml:Issuer></samlp:AuthnRequest>`,
        ),
        parseAndVerifyResponse: vi.fn(async () => ({
            nameId: 'alice@acme.com',
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            email: 'alice@acme.com',
            firstName: 'Alice',
            lastName: 'Smith',
            displayName: 'Alice Smith',
            sessionIndex: 'sess-idx-1',
            attributes: {},
        })),
    })),
}));

vi.mock('../../services/saml-xml', () => ({
    SamlError: class SamlError extends Error {
        code: string;
        constructor(code: string, msg?: string) { super(msg || code); this.code = code; this.name = 'SamlError'; }
    },
}));

vi.mock('../../services/jit-provisioner', () => ({
    provisionUser: vi.fn(async () => ({
        id: 'user-1', email: 'alice@acme.com', name: 'Alice',
        orgId: 'org-1', role: 'member', tier: 'free', created: false,
    })),
}));

vi.mock('../../services/audit-logger', () => ({
    logAuditEvent: vi.fn(async () => {}),
    getClientInfo: vi.fn(() => ({ ipAddress: '1.2.3.4', userAgent: 'test-agent' })),
}));

// ─── Env / IdP factories ──────────────────────────────────────────────────────

function makeIdpRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'idp-saml-1', org_id: 'org-1', type: 'saml', name: 'Okta SAML',
        enabled: 1, jit_enabled: 1, email_domain: 'acme.com',
        default_role: 'member',
        saml_sso_url: 'https://idp.okta.com/sso/saml',
        saml_entity_id: 'https://app.lunaos.ai/saml/metadata',
        saml_certificate: '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(100) + '\n-----END CERTIFICATE-----',
        saml_slo_url: null,
        oidc_issuer: null, oidc_client_id: null, oidc_client_secret: null,
        oidc_discovery_url: null, oidc_scopes: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        ...overrides,
    };
}

function makeEnv(idpRow: Record<string, unknown> | null = makeIdpRow(), kvOverrides: Partial<{ relayEntry: string }> = {}) {
    const kvStore = new Map<string, string>();
    if (kvOverrides.relayEntry) {
        kvStore.set('saml:relay:test-relay-token', kvOverrides.relayEntry);
        kvStore.set('saml:authnreq:_test-request-id', '1');
    }

    return {
        DB: {
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({
                    first: vi.fn(async () => idpRow),
                    run: vi.fn(async () => ({})),
                })),
            })),
        },
        KV: {
            get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
            put: vi.fn(async (key: string, val: string, _opts?: any) => { kvStore.set(key, val); }),
            delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
        },
        JWT_SECRET: 'jwt-secret',
        SESSION_SECRET: 'session-secret-for-saml-cookies!!',
        SP_ENTITY_ID: 'lunaos.ai',
        SP_ACS_URL: 'https://app.lunaos.ai/v1/sso/saml/callback',
    };
}

function makeApp(env: ReturnType<typeof makeEnv>) {
    const app = new Hono<{ Bindings: typeof env }>();
    // samlRouter mounts its own full paths
    app.route('/', samlRouter);
    return app;
}

// ─── POST /v1/sso/saml/initiate ──────────────────────────────────────────────

describe('POST /v1/sso/saml/initiate', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 200 with redirectUrl for valid SAML IdP (GET binding)', async () => {
        const env = makeEnv();
        const app = makeApp(env);
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(['GET', 'POST']).toContain(body.method);
        if (body.method === 'GET') expect(body.redirectUrl).toContain('SAMLRequest=');
    });

    it('stores relay state in KV', async () => {
        const env = makeEnv();
        const app = makeApp(env);
        await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);
        const kvPutCalls = (env.KV.put as ReturnType<typeof vi.fn>).mock.calls;
        const relayCalls = kvPutCalls.filter((c: any[]) => (c[0] as string).startsWith('saml:relay:'));
        expect(relayCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('stores authnreq ID in KV', async () => {
        const env = makeEnv();
        const app = makeApp(env);
        await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);
        const kvPutCalls = (env.KV.put as ReturnType<typeof vi.fn>).mock.calls;
        const authnCalls = kvPutCalls.filter((c: any[]) => (c[0] as string).startsWith('saml:authnreq:'));
        expect(authnCalls.length).toBe(1);
    });

    it('returns 400 for missing idpId', async () => {
        const env = makeEnv();
        const app = makeApp(env);
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }, env);
        expect(res.status).toBe(400);
    });

    it('returns 400 when IdP not found', async () => {
        const env = makeEnv(null);
        const app = makeApp(env);
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'nonexistent' }),
        }, env);
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('idp_not_available');
    });

    it('returns 400 when IdP disabled', async () => {
        const env = makeEnv(makeIdpRow({ enabled: 0 }));
        const app = makeApp(env);
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);
        expect(res.status).toBe(400);
    });

    it('returns 400 when IdP type is oidc (not saml)', async () => {
        const env = makeEnv(makeIdpRow({ type: 'oidc' }));
        const app = makeApp(env);
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);
        expect(res.status).toBe(400);
    });

    it('returns 500 when SP_ACS_URL not configured', async () => {
        const env = { ...makeEnv(), SP_ACS_URL: undefined } as any;
        const app = makeApp(env);
        const res = await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);
        expect(res.status).toBe(500);
    });
});

// ─── POST /v1/sso/saml/callback ──────────────────────────────────────────────

function makeRelayEntry(requestId = '_test-request-id') {
    return JSON.stringify({
        idpId: 'idp-saml-1',
        returnPath: '/dashboard',
        requestId,
        exp: Date.now() + 600_000,
    });
}

async function callbackReq(app: Hono<any>, env: any, formData: Record<string, string>) {
    const form = new URLSearchParams(formData).toString();
    return app.request('/v1/sso/saml/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
    }, env);
}

const MOCK_SAML_RESPONSE_B64 = btoa('<samlp:Response>mock</samlp:Response>');

describe('POST /v1/sso/saml/callback', () => {
    beforeEach(() => vi.clearAllMocks());

    it('happy path: returns 302 to returnPath from relay', async () => {
        const env = makeEnv(makeIdpRow(), { relayEntry: makeRelayEntry() });
        const app = makeApp(env);
        const res = await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'test-relay-token',
        });
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe('/dashboard');
    });

    it('happy path: sets sso_session cookie', async () => {
        const env = makeEnv(makeIdpRow(), { relayEntry: makeRelayEntry() });
        const app = makeApp(env);
        const res = await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'test-relay-token',
        });
        const cookie = res.headers.get('Set-Cookie') ?? '';
        expect(cookie).toContain('sso_session=');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
    });

    it('returns 400 for missing SAMLResponse', async () => {
        const env = makeEnv(makeIdpRow(), { relayEntry: makeRelayEntry() });
        const app = makeApp(env);
        const res = await callbackReq(app, env, { RelayState: 'test-relay-token' });
        expect(res.status).toBe(400);
    });

    it('returns 400 for missing RelayState', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await callbackReq(app, env, { SAMLResponse: MOCK_SAML_RESPONSE_B64 });
        expect(res.status).toBe(400);
    });

    it('returns 400 for relay state not found in KV', async () => {
        const env = makeEnv(makeIdpRow()); // no relay entry in KV
        const app = makeApp(env);
        const res = await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'nonexistent-relay',
        });
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('invalid_relay');
    });

    it('consumes relay state (deletes from KV after read)', async () => {
        const env = makeEnv(makeIdpRow(), { relayEntry: makeRelayEntry() });
        const app = makeApp(env);
        await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'test-relay-token',
        });
        const deleteCalls = (env.KV.delete as ReturnType<typeof vi.fn>).mock.calls;
        const relayDeleted = deleteCalls.some((c: any[]) => c[0] === 'saml:relay:test-relay-token');
        expect(relayDeleted).toBe(true);
    });

    it('returns 400 on SAML validation failure (SamlError)', async () => {
        const { SamlProvider } = await import('../../services/saml-provider');
        const { SamlError } = await import('../../services/saml-xml');
        (SamlProvider as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
            buildAuthnRequest: vi.fn(),
            parseAndVerifyResponse: vi.fn(async () => { throw new SamlError('audience_mismatch'); }),
        }));
        const env = makeEnv(makeIdpRow(), { relayEntry: makeRelayEntry() });
        const app = makeApp(env);
        const res = await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'test-relay-token',
        });
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('saml_validation_failed');
    });

    it('relay reuse: second callback with same RelayState → 400 (delete-on-read)', async () => {
        const env = makeEnv(makeIdpRow(), { relayEntry: makeRelayEntry() });
        const app = makeApp(env);
        // First call consumes the relay
        await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'test-relay-token',
        });
        // Second call: relay no longer in KV
        const res2 = await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'test-relay-token',
        });
        expect(res2.status).toBe(400);
        const body = await res2.json() as any;
        expect(body.error).toBe('invalid_relay');
    });

    it('returns 400 for overly long RelayState (>80 chars)', async () => {
        const env = makeEnv(makeIdpRow());
        const app = makeApp(env);
        const res = await callbackReq(app, env, {
            SAMLResponse: MOCK_SAML_RESPONSE_B64,
            RelayState: 'x'.repeat(81),
        });
        expect(res.status).toBe(400);
    });
});

// ─── AuthnRequest content ─────────────────────────────────────────────────────

describe('POST /v1/sso/saml/initiate — AuthnRequest content', () => {
    it('AuthnRequest includes Issuer (spEntityId) and ACS URL', async () => {
        const { SamlProvider } = await import('../../services/saml-provider');
        let capturedXml = '';
        (SamlProvider as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
            buildAuthnRequest: vi.fn((idp: any, requestId: string, spEntityId: string, spAcsUrl: string) => {
                capturedXml = `<AuthnRequest ID="${requestId}" ACS="${spAcsUrl}"><Issuer>${spEntityId}</Issuer></AuthnRequest>`;
                return capturedXml;
            }),
            parseAndVerifyResponse: vi.fn(),
        }));

        const env = makeEnv();
        const app = makeApp(env);
        await app.request('/v1/sso/saml/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idpId: 'idp-saml-1' }),
        }, env);

        expect(capturedXml).toContain('lunaos.ai');
        expect(capturedXml).toContain('https://app.lunaos.ai/v1/sso/saml/callback');
    });
});
