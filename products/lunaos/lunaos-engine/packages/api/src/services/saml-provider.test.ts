/**
 * SamlProvider — buildAuthnRequest + parseAndVerifyResponse (mocked XML layer).
 * NOTE: fast-xml-parser not installed → parseSamlXml cannot be called end-to-end.
 * These tests mock the XML parsing layer to verify the provider's orchestration logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SamlProvider, type SamlEnv } from './saml-provider';
import { SamlError } from './saml-xml-errors';

// ─── Mock all XML / assertion dependencies ────────────────────────────────────
// MUST be before any import that transitively pulls in saml-xml (fast-xml-parser gap).

vi.mock('./saml-xml', () => {
    const SamlErrorCls = class extends Error {
        code: string;
        constructor(code: string, msg?: string) { super(msg || code); this.code = code; this.name = 'SamlError'; }
    };
    return {
        SamlError: SamlErrorCls,
        parseSamlXml: vi.fn(() => []),
        findFirst: vi.fn(),
        findAll: vi.fn(() => []),
        children: vi.fn(() => []),
        attrs: vi.fn(() => ({})),
        text: vi.fn(() => ''),
        b64ToBytes: vi.fn(() => new Uint8Array()),
        bytesToB64: vi.fn(() => ''),
        strToBytes: vi.fn(() => new Uint8Array()),
        verifyXmlSignature: vi.fn(async () => true),
        pemToCryptoKey: vi.fn(async () => ({})),
    };
});

vi.mock('./saml-xml-verify', () => ({
    verifyXmlSignature: vi.fn(async () => true),
    pemToCryptoKey: vi.fn(async () => ({})),
}));

vi.mock('./saml-assertion', () => ({
    checkConditions: vi.fn(async () => {}),
    checkSubjectConfirmation: vi.fn(async () => {}),
    checkReplay: vi.fn(async () => {}),
    extractAttributes: vi.fn(() => ({ email: 'alice@acme.com', firstName: 'Alice' })),
    pickFirst: vi.fn((map: Record<string, unknown>, names: string[]) => {
        for (const n of names) if (map[n]) return map[n];
        return undefined;
    }),
    pickEmail: vi.fn(() => 'alice@acme.com'),
}));

// ─── Capture mocked module refs at module scope (ESM-safe, no require()) ─────
import * as samlXmlMod from './saml-xml';
import * as samlAssertionMod from './saml-assertion';

// ─── IdP / Env factories ──────────────────────────────────────────────────────

function makeIdp(overrides: Record<string, unknown> = {}) {
    return {
        id: 'idp-saml-1', orgId: 'org-1', type: 'saml' as const,
        name: 'Okta SAML', enabled: true,
        emailDomain: 'acme.com', jitEnabled: true, defaultRole: 'member',
        samlEntityId: 'https://app.lunaos.ai/saml/metadata',
        samlSsoUrl: 'https://idp.okta.com/sso/saml',
        samlCertificate:
            '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(100) + '\n-----END CERTIFICATE-----',
        samlSloUrl: null,
        oidcIssuer: null, oidcClientId: null, oidcClientSecret: null,
        oidcDiscoveryUrl: null, oidcScopes: null,
        createdAt: new Date(), updatedAt: new Date(),
        ...overrides,
    };
}

function makeEnv(): SamlEnv {
    const kvStore = new Map<string, string>();
    return {
        KV: {
            get: vi.fn(async (k: string) => kvStore.get(k) ?? null),
            put: vi.fn(async (k: string, v: string) => { kvStore.set(k, v); }),
            delete: vi.fn(async (k: string) => { kvStore.delete(k); }),
        } as unknown as KVNamespace,
        SP_ENTITY_ID: 'https://sp.lunaos.ai',
        SP_ACS_URL: 'https://app.lunaos.ai/v1/sso/saml/callback',
    };
}

// ─── buildAuthnRequest ────────────────────────────────────────────────────────

describe('SamlProvider.buildAuthnRequest', () => {
    const provider = new SamlProvider();

    it('returns XML string containing request ID', () => {
        const xml = provider.buildAuthnRequest(makeIdp(), '_req-123', 'lunaos.ai', 'https://sp.lunaos.ai/acs');
        expect(xml).toContain('_req-123');
    });

    it('contains Issuer element with spEntityId', () => {
        const xml = provider.buildAuthnRequest(makeIdp(), '_id', 'lunaos.ai', 'https://sp.lunaos.ai/acs');
        expect(xml).toContain('lunaos.ai');
    });

    it('contains AssertionConsumerServiceURL', () => {
        const xml = provider.buildAuthnRequest(makeIdp(), '_id', 'sp', 'https://acs.lunaos.ai');
        expect(xml).toContain('https://acs.lunaos.ai');
    });

    it('contains Destination set to IdP SSO URL', () => {
        const idp = makeIdp();
        const xml = provider.buildAuthnRequest(idp, '_id', 'sp', 'https://acs.lunaos.ai');
        expect(xml).toContain(idp.samlSsoUrl ?? '');
    });

    it('includes SAML namespace declarations', () => {
        const xml = provider.buildAuthnRequest(makeIdp(), '_id', 'sp', 'https://acs.lunaos.ai');
        expect(xml).toContain('urn:oasis:names:tc:SAML:2.0:protocol');
    });

    it('uses Version="2.0"', () => {
        const xml = provider.buildAuthnRequest(makeIdp(), '_id', 'sp', 'acs');
        expect(xml).toContain('Version="2.0"');
    });

    it('escapes XML special chars in requestId', () => {
        const xml = provider.buildAuthnRequest(makeIdp(), '_id<">', 'sp', 'acs');
        expect(xml).not.toContain('<">');
    });
});

// ─── parseAndVerifyResponse — configuration guards ───────────────────────────

describe('SamlProvider.parseAndVerifyResponse — config guards', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws config_missing when SP_ACS_URL not set', async () => {
        const provider = new SamlProvider();
        const env = makeEnv();
        (env as any).SP_ACS_URL = undefined;
        try {
            await provider.parseAndVerifyResponse(makeIdp(), btoa('<Response/>'), '_req', env);
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('config_missing');
        }
    });

    it('throws idp_missing_cert when IdP has no certificate', async () => {
        const provider = new SamlProvider();
        const env = makeEnv();
        try {
            await provider.parseAndVerifyResponse(
                makeIdp({ samlCertificate: null }),
                btoa('<Response/>'),
                '_req',
                env,
            );
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('idp_missing_cert');
        }
    });

    it('throws base64_decode_failed for invalid base64', async () => {
        const provider = new SamlProvider();
        const env = makeEnv();
        try {
            await provider.parseAndVerifyResponse(makeIdp(), '!!!invalid base64!!!', '_req', env);
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('base64_decode_failed');
        }
    });
});

// ─── parseAndVerifyResponse — XML structure guards (mocked parseSamlXml) ─────

describe('SamlProvider.parseAndVerifyResponse — XML structure guards', () => {
    beforeEach(() => vi.clearAllMocks());

    // Helper: configure the mocked XML helpers for a given scenario.
    const setupXmlMocks = (config: {
        responseNode?: any;
        statusCode?: string;
        assertions?: any[];
        responseSig?: any;
        assertionSig?: any;
        subject?: any;
        nameId?: any;
        authnStmts?: any[];
    }) => {
        const findFirstMock = vi.mocked(samlXmlMod.findFirst);
        const findAllMock = vi.mocked(samlXmlMod.findAll);
        const childrenMock = vi.mocked(samlXmlMod.children);
        const attrsMock = vi.mocked(samlXmlMod.attrs);
        const textMock = vi.mocked(samlXmlMod.text);

        childrenMock.mockReturnValue([]);
        textMock.mockReturnValue('alice@acme.com');

        attrsMock.mockImplementation((node: any) => {
            if (!node) return {};
            return node._attrs || {};
        });

        const responseNode = config.responseNode ?? {
            _type: 'Response',
            _attrs: { '@_ID': 'resp-1' },
        };
        const statusCode = config.statusCode ?? 'urn:oasis:names:tc:SAML:2.0:status:Success';
        const assertions = config.assertions ?? [{
            _type: 'Assertion',
            _attrs: { '@_ID': 'assert-1' },
        }];

        findFirstMock.mockImplementation((_tree: any, name: string) => {
            if (name === 'Response') return responseNode;
            if (name === 'Status') return { _type: 'Status' };
            if (name === 'StatusCode') return { _attrs: { '@_Value': statusCode } };
            if (name === 'Signature') return config.assertionSig ?? { _type: 'Signature' };
            if (name === 'Subject') return config.subject ?? { _type: 'Subject' };
            if (name === 'NameID') return config.nameId ?? { _type: 'NameID', _attrs: { '@_Format': 'emailAddress' } };
            return undefined;
        });

        findAllMock.mockImplementation((_tree: any, name: string) => {
            if (name === 'Assertion') return assertions;
            if (name === 'AuthnStatement') return config.authnStmts ?? [];
            return [];
        });
    };

    it('throws no_response_element when parseSamlXml returns no Response', async () => {
        vi.mocked(samlXmlMod.findFirst).mockReturnValue(undefined);
        const provider = new SamlProvider();
        try {
            await provider.parseAndVerifyResponse(makeIdp(), btoa('<Resp/>'), '_req', makeEnv());
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('no_response_element');
        }
    });

    it('throws no_assertion when no Assertion elements', async () => {
        setupXmlMocks({ assertions: [] });
        const provider = new SamlProvider();
        try {
            await provider.parseAndVerifyResponse(makeIdp(), btoa('<Response/>'), '_req', makeEnv());
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('no_assertion');
        }
    });

    it('throws multiple_assertions when >1 Assertion in response (XSW guard)', async () => {
        setupXmlMocks({
            assertions: [
                { _type: 'Assertion', _attrs: { '@_ID': 'a1' } },
                { _type: 'Assertion', _attrs: { '@_ID': 'a2' } },
            ],
        });
        const provider = new SamlProvider();
        try {
            await provider.parseAndVerifyResponse(makeIdp(), btoa('<Response/>'), '_req', makeEnv());
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('multiple_assertions');
        }
    });

    it('throws unsigned_response when neither Response nor Assertion has Signature', async () => {
        const findFirstMock = vi.mocked(samlXmlMod.findFirst);
        const findAllMock = vi.mocked(samlXmlMod.findAll);

        findFirstMock.mockImplementation((_tree: any, name: string) => {
            if (name === 'Response') return { _type: 'Response', _attrs: { '@_ID': 'resp-1' } };
            if (name === 'Status') return { _type: 'Status' };
            if (name === 'StatusCode') return { _attrs: { '@_Value': 'urn:oasis:names:tc:SAML:2.0:status:Success' } };
            if (name === 'Signature') return undefined; // No signature on either
            return undefined;
        });
        findAllMock.mockImplementation((_: any, n: string) =>
            n === 'Assertion' ? [{ _type: 'Assertion', _attrs: { '@_ID': 'a1' } }] : [],
        );

        const provider = new SamlProvider();
        try {
            await provider.parseAndVerifyResponse(makeIdp(), btoa('<Response/>'), '_req', makeEnv());
            expect.fail('should have thrown');
        } catch (e: unknown) {
            expect((e as SamlError).code).toBe('unsigned_response');
        }
    });
});
