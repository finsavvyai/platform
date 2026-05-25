/**
 * FIND-002 regression test — SAML callback MUST pass `jitEnabled` and
 * `emailDomain` into provisionUser so the per-IdP gating works.
 *
 * Pre-fix: callback omitted the field and the cast hid it; every SAML login
 *          failed closed with 'jit_disabled'.
 * Post-fix: jitEnabled/emailDomain forwarded; happy-path SAML login succeeds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../services/saml-provider', () => ({
    SamlProvider: vi.fn().mockImplementation(() => ({
        buildAuthnRequest: vi.fn(() => '<AuthnRequest/>'),
        parseAndVerifyResponse: vi.fn(async () => ({
            nameId: 'alice@acme.com',
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            email: 'alice@acme.com',
            firstName: 'Alice', lastName: 'Smith', displayName: 'Alice Smith',
            sessionIndex: 'sess-idx-1', attributes: {},
        })),
    })),
}));

vi.mock('../../services/saml-xml', () => ({
    SamlError: class extends Error { code: string;
        constructor(code: string) { super(code); this.code = code; this.name = 'SamlError'; } },
}));

vi.mock('../../services/jit-provisioner', () => ({
    provisionUser: vi.fn(async () => ({
        id: 'u-1', email: 'alice@acme.com', name: 'Alice', orgId: 'org-1',
        role: 'member', tier: 'free', created: true,
    })),
}));

vi.mock('../../services/audit-logger', () => ({
    logAuditEvent: vi.fn(async () => {}),
    getClientInfo: vi.fn(() => ({ ipAddress: '1.2.3.4', userAgent: 'test' })),
}));

// Import AFTER mocks
import { samlRouter } from './saml';
import { provisionUser } from '../../services/jit-provisioner';
const provisionUserMock = vi.mocked(provisionUser);

function makeIdpRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'idp-1', org_id: 'org-1', type: 'saml', name: 'Okta',
        enabled: 1, jit_enabled: 1, email_domain: 'acme.com',
        default_role: 'member',
        saml_sso_url: 'https://idp.okta.com/sso',
        saml_entity_id: 'https://app.lunaos.ai',
        saml_certificate: '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(100) + '\n-----END CERTIFICATE-----',
        saml_slo_url: null, oidc_issuer: null, oidc_client_id: null,
        oidc_client_secret: null, oidc_discovery_url: null, oidc_scopes: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        ...overrides,
    };
}

function makeEnv(idpRow: Record<string, unknown>) {
    const kvStore = new Map<string, string>([
        ['saml:relay:test-relay-token', JSON.stringify({
            idpId: 'idp-1', returnPath: '/dashboard',
            requestId: '_test-request-id', exp: Date.now() + 600_000,
        })],
        ['saml:authnreq:_test-request-id', '1'],
    ]);
    return {
        DB: { prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ first: vi.fn(async () => idpRow), run: vi.fn(async () => ({})) })),
        })) },
        KV: {
            get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
            put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v); }),
            delete: vi.fn(async (k: string) => { kvStore.delete(k); }),
        },
        JWT_SECRET: 'j', SESSION_SECRET: 's',
        SP_ENTITY_ID: 'lunaos.ai',
        SP_ACS_URL: 'https://app.lunaos.ai/v1/sso/saml/callback',
    };
}

async function callback(env: any) {
    const app = new Hono<{ Bindings: typeof env }>();
    app.route('/', samlRouter);
    const form = new URLSearchParams({
        SAMLResponse: btoa('<Response/>'),
        RelayState: 'test-relay-token',
    }).toString();
    return app.request('/v1/sso/saml/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
    }, env);
}

describe('FIND-002: SAML callback passes jitEnabled to provisionUser', () => {
    beforeEach(() => provisionUserMock.mockClear());

    it('forwards jitEnabled=true from IdP record to provisionUser', async () => {
        const res = await callback(makeEnv(makeIdpRow({ jit_enabled: 1 })));
        expect(res.status).toBe(302);
        expect(provisionUserMock).toHaveBeenCalledTimes(1);
        const call = (provisionUserMock.mock.calls[0] as unknown as unknown[]);
        const input = call[1] as Record<string, unknown>;
        expect(input.jitEnabled).toBe(true);
        expect(input.orgId).toBe('org-1');
        expect(input.idpId).toBe('idp-1');
    });

    it('forwards emailDomain from IdP record to provisionUser', async () => {
        await callback(makeEnv(makeIdpRow({ email_domain: 'acme.com' })));
        const call = (provisionUserMock.mock.calls[0] as unknown as unknown[]);
        const input = call[1] as Record<string, unknown>;
        expect(input.emailDomain).toBe('acme.com');
    });

    it('client gets generic saml_validation_failed when JIT throws (FIND-009)', async () => {
        provisionUserMock.mockImplementationOnce(async () => {
            throw new Error('jit_disabled');
        });
        const res = await callback(makeEnv(makeIdpRow({ jit_enabled: 0 })));
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        // Internal 'jit_disabled' MUST NOT leak; client sees generic code.
        expect(body.error).toBe('saml_validation_failed');
        expect(JSON.stringify(body)).not.toContain('jit_disabled');
    });
});
