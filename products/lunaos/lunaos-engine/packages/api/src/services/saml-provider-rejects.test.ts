/**
 * SamlProvider hard-rejects (FIND-006, FIND-007, FIND-008 fail-safes).
 *
 * - FIND-007: <saml:EncryptedAssertion> → 'encrypted_assertion_unsupported'.
 * - FIND-006: <ec:InclusiveNamespaces PrefixList="..."/> with non-empty list
 *             → 'inclusive_namespaces_unsupported'.
 * - FIND-008: replay check happens BEFORE signature verification, allowing
 *             cheap rejection of duplicates.
 */
import { describe, it, expect, vi } from 'vitest';
import { SamlProvider } from './saml-provider';
import { SamlError } from './saml-xml-errors';

function makeIdp() {
    return {
        id: 'idp-1', orgId: 'org-1', type: 'saml' as const, name: 'Okta',
        enabled: true, jitEnabled: true, defaultRole: 'member',
        emailDomain: null, oidcIssuer: null, oidcClientId: null,
        oidcClientSecret: null, oidcDiscoveryUrl: null, oidcScopes: null,
        samlEntityId: 'https://sp.lunaos.ai',
        samlSsoUrl: 'https://idp.okta.com/sso',
        samlCertificate: '-----BEGIN CERTIFICATE-----\nfakecert\n-----END CERTIFICATE-----',
        samlSloUrl: null,
        createdAt: new Date(), updatedAt: new Date(),
    };
}

const env = {
    KV: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
    } as any,
    SP_ENTITY_ID: 'https://sp.lunaos.ai',
    SP_ACS_URL: 'https://app.lunaos.ai/v1/sso/saml/callback',
};

function b64(xml: string): string { return btoa(xml); }

describe('SamlProvider — FIND-007 EncryptedAssertion fail-safe', () => {
    it('rejects Response containing <saml:EncryptedAssertion>', async () => {
        const xml = `<?xml version="1.0"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
            xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="r1">
            <saml:EncryptedAssertion><x/></saml:EncryptedAssertion></samlp:Response>`;
        const p = new SamlProvider();
        await expect(p.parseAndVerifyResponse(makeIdp(), b64(xml), '_req-1', env))
            .rejects.toMatchObject({ code: 'encrypted_assertion_unsupported' });
    });
});

describe('SamlProvider — FIND-006 InclusiveNamespaces fail-safe', () => {
    it('rejects Response containing InclusiveNamespaces with non-empty PrefixList', async () => {
        const xml = `<?xml version="1.0"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
            ID="r1"><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
            <ds:SignedInfo><ec:InclusiveNamespaces xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#"
                PrefixList="xs"/></ds:SignedInfo></ds:Signature></samlp:Response>`;
        const p = new SamlProvider();
        await expect(p.parseAndVerifyResponse(makeIdp(), b64(xml), '_req-1', env))
            .rejects.toMatchObject({ code: 'inclusive_namespaces_unsupported' });
    });
});

describe('SamlProvider — FIND-008 replay check ordering', () => {
    it('rejects replay before reaching signature verification', async () => {
        const xml = `<?xml version="1.0"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
            ID="r1"><dummy/></samlp:Response>`;
        const localEnv = {
            ...env,
            KV: { ...env.KV, get: vi.fn(async (k: string) => k === 'saml:resp:r1' ? '1' : null) } as any,
        };
        const p = new SamlProvider();
        await expect(p.parseAndVerifyResponse(makeIdp(), b64(xml), '_req-1', localEnv))
            .rejects.toMatchObject({ code: 'replay_detected' });
        // Confirm KV was queried with the response-id key (cheap reject path).
        expect((localEnv.KV.get as any).mock.calls.some((c: any[]) =>
            c[0] === 'saml:resp:r1')).toBe(true);
    });
});

describe('SamlError surface', () => {
    it('has expected fields', () => {
        const e = new SamlError('encrypted_assertion_unsupported');
        expect(e.code).toBe('encrypted_assertion_unsupported');
        expect(e).toBeInstanceOf(Error);
    });
});
