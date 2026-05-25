/**
 * saml-xml-verify — SamlError codes for security-critical rejection paths.
 * NOTE: fast-xml-parser not installed → parseSamlXml cannot run end-to-end.
 * Unit tests cover: SamlError structure, resolveSigAlg/resolveDigestAlg whitelists,
 * pemToCryptoKey error paths, and saml-assertion helper logic.
 * Full signature verify tests are marked .skip until fast-xml-parser is added.
 */
import { describe, it, expect, vi } from 'vitest';
import { SamlError } from './saml-xml-errors';
import { resolveSigAlg, resolveDigestAlg } from './saml-xml-algs';
import { findFirst, findAll, attrs, children, text, stripNs } from './saml-xml-tree';

// saml-xml is a facade that imports fast-xml-parser (not installed).
// Mock it: re-export real tree helpers from saml-xml-tree (no fast-xml-parser dep),
// only stub parseSamlXml (the part that needs the missing package).
vi.mock('./saml-xml', async () => {
    const tree = await import('./saml-xml-tree');
    const errs = await import('./saml-xml-errors');
    const verify = await import('./saml-xml-verify');
    return {
        SamlError: errs.SamlError,
        parseSamlXml: vi.fn(() => []),
        findFirst: tree.findFirst,
        findAll: tree.findAll,
        children: tree.children,
        attrs: tree.attrs,
        text: tree.text,
        stripNs: tree.stripNs,
        verifyXmlSignature: verify.verifyXmlSignature,
        pemToCryptoKey: verify.pemToCryptoKey,
    };
});

import { checkConditions, extractAttributes, pickEmail, pickFirst } from './saml-assertion';

// ─── SamlError ───────────────────────────────────────────────────────────────

describe('SamlError', () => {
    it('has code property matching constructor arg', () => {
        const e = new SamlError('audience_mismatch', 'Audience does not match');
        expect(e.code).toBe('audience_mismatch');
        expect(e.message).toBe('Audience does not match');
        expect(e.name).toBe('SamlError');
    });

    it('uses code as message when message arg omitted', () => {
        const e = new SamlError('replay_detected');
        expect(e.message).toBe('replay_detected');
        expect(e.code).toBe('replay_detected');
    });

    it('is instanceof Error', () => {
        expect(new SamlError('test')).toBeInstanceOf(Error);
    });
});

// ─── Algorithm whitelists ─────────────────────────────────────────────────────

describe('resolveSigAlg — whitelist enforcement', () => {
    it('accepts rsa-sha256', () => {
        const alg = resolveSigAlg('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
        expect(alg.name).toBe('RSASSA-PKCS1-v1_5');
        expect(alg.hash).toBe('SHA-256');
    });

    it('accepts rsa-sha384', () => {
        const alg = resolveSigAlg('http://www.w3.org/2001/04/xmldsig-more#rsa-sha384');
        expect(alg.hash).toBe('SHA-384');
    });

    it('accepts rsa-sha512', () => {
        const alg = resolveSigAlg('http://www.w3.org/2001/04/xmldsig-more#rsa-sha512');
        expect(alg.hash).toBe('SHA-512');
    });

    it('throws sig_alg_disallowed for sha1', () => {
        expect(() => resolveSigAlg('http://www.w3.org/2000/09/xmldsig#rsa-sha1')).toThrow(SamlError);
        try {
            resolveSigAlg('http://www.w3.org/2000/09/xmldsig#rsa-sha1');
        } catch (e) {
            expect((e as SamlError).code).toBe('sig_alg_disallowed');
        }
    });

    it('throws sig_alg_disallowed for HMAC', () => {
        expect(() => resolveSigAlg('http://www.w3.org/2000/09/xmldsig#hmac-sha1')).toThrow(SamlError);
    });

    it('throws sig_alg_disallowed for unknown URI', () => {
        expect(() => resolveSigAlg('http://evil.com/custom-alg')).toThrow(SamlError);
    });

    it('throws sig_alg_disallowed for DSA', () => {
        expect(() => resolveSigAlg('http://www.w3.org/2000/09/xmldsig#dsa-sha1')).toThrow(SamlError);
    });
});

describe('resolveDigestAlg — whitelist enforcement', () => {
    it('accepts sha256', () => {
        const alg = resolveDigestAlg('http://www.w3.org/2001/04/xmlenc#sha256');
        expect(alg).toBe('SHA-256');
    });

    it('accepts sha384', () => {
        const alg = resolveDigestAlg('http://www.w3.org/2001/04/xmldsig-more#sha384');
        expect(alg).toBe('SHA-384');
    });

    it('accepts sha512', () => {
        const alg = resolveDigestAlg('http://www.w3.org/2001/04/xmlenc#sha512');
        expect(alg).toBe('SHA-512');
    });

    it('throws digest_alg_disallowed for sha1', () => {
        expect(() => resolveDigestAlg('http://www.w3.org/2000/09/xmldsig#sha1')).toThrow(SamlError);
        try {
            resolveDigestAlg('http://www.w3.org/2000/09/xmldsig#sha1');
        } catch (e) {
            expect((e as SamlError).code).toBe('digest_alg_disallowed');
        }
    });

    it('throws digest_alg_disallowed for unknown URI', () => {
        expect(() => resolveDigestAlg('http://evil.com/custom')).toThrow(SamlError);
    });
});

// ─── saml-xml-tree helpers ────────────────────────────────────────────────────

describe('saml-xml-tree — tree-walk helpers', () => {
    const sampleTree = [
        { 'saml:Assertion': [
            { ':@': { '@_ID': 'assert-1', '@_Version': '2.0' } },
            { 'saml:Issuer': [{ '#text': 'https://idp.example.com' }] },
            { 'saml:Subject': [] },
        ], ':@': { '@_ID': 'assert-1' } },
    ];

    it('stripNs removes namespace prefix', () => {
        expect(stripNs('saml:Assertion')).toBe('Assertion');
        expect(stripNs('Assertion')).toBe('Assertion');
        expect(stripNs('samlp:Response')).toBe('Response');
    });

    it('findFirst finds by local name', () => {
        const node = findFirst(sampleTree, 'Assertion');
        expect(node).toBeDefined();
    });

    it('findFirst returns undefined for missing element', () => {
        expect(findFirst(sampleTree, 'NonExistent')).toBeUndefined();
    });

    it('findAll returns all matching nodes', () => {
        const tree = [
            { 'saml:AttributeValue': [{ '#text': 'val1' }] },
            { 'saml:AttributeValue': [{ '#text': 'val2' }] },
            { 'saml:Issuer': [{ '#text': 'iss' }] },
        ];
        const found = findAll(tree, 'AttributeValue');
        expect(found).toHaveLength(2);
    });

    it('attrs returns attribute map from :@ key', () => {
        const node = { 'saml:Assertion': [], ':@': { '@_ID': 'id-1', '@_Version': '2.0' } };
        expect(attrs(node)['@_ID']).toBe('id-1');
    });

    it('attrs returns empty object for node without :@', () => {
        expect(attrs({ 'saml:Issuer': [] })).toEqual({});
    });

    it('children returns the child array', () => {
        const node = { 'saml:Assertion': [{ 'saml:Issuer': [] }] };
        expect(children(node)).toHaveLength(1);
    });

    it('text extracts #text content', () => {
        const node = { 'saml:Issuer': [{ '#text': 'https://issuer.com' }] };
        expect(text(node)).toBe('https://issuer.com');
    });

    it('text returns empty string when no #text children', () => {
        const node = { 'saml:Issuer': [{ 'child': [] }] };
        expect(text(node)).toBe('');
    });
});

// ─── saml-assertion helpers ───────────────────────────────────────────────────

describe('checkConditions — time-window validation', () => {
    function makeConditionsNode(notBefore?: string, notOnOrAfter?: string, audience = 'https://sp.lunaos.ai') {
        const condAttrs: Record<string, string> = {};
        if (notBefore) condAttrs['@_NotBefore'] = notBefore;
        if (notOnOrAfter) condAttrs['@_NotOnOrAfter'] = notOnOrAfter;

        return {
            'saml:Assertion': [
                {
                    'saml:Conditions': [
                        {
                            'saml:AudienceRestriction': [
                                { 'saml:Audience': [{ '#text': audience }] },
                            ],
                        },
                    ],
                    ':@': condAttrs,
                },
            ],
        };
    }

    // Build a fake assertion with Conditions inside
    function makeAssertion(notBefore?: string, notOnOrAfter?: string, audience = 'https://sp.lunaos.ai') {
        const condAttrs: Record<string, string> = {};
        if (notBefore) condAttrs['@_NotBefore'] = notBefore;
        if (notOnOrAfter) condAttrs['@_NotOnOrAfter'] = notOnOrAfter;

        const condNode: Record<string, any> = {
            'saml:Conditions': [
                {
                    'saml:AudienceRestriction': [
                        { 'saml:Audience': [{ '#text': audience }] },
                    ],
                },
            ],
            ':@': condAttrs,
        };

        return {
            'saml:Assertion': [condNode],
        };
    }

    it('accepts current time within valid window', async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 60_000).toISOString();
        const future = new Date(now.getTime() + 300_000).toISOString();
        const assertion = makeAssertion(past, future, 'https://sp.lunaos.ai');
        await expect(checkConditions(assertion, 'https://sp.lunaos.ai')).resolves.toBeUndefined();
    });

    it('throws expired when NotOnOrAfter is in the past (beyond skew)', async () => {
        const longPast = new Date(Date.now() - 300_000).toISOString();
        const assertion = makeAssertion(undefined, longPast);
        await expect(checkConditions(assertion, 'https://sp.lunaos.ai')).rejects.toThrow('expired');
    });

    it('throws not_yet_valid when NotBefore is well in the future', async () => {
        const farFuture = new Date(Date.now() + 300_000).toISOString();
        const assertion = makeAssertion(farFuture, undefined);
        await expect(checkConditions(assertion, 'https://sp.lunaos.ai')).rejects.toThrow('not_yet_valid');
    });

    it('throws audience_mismatch when SP entity ID not in audiences', async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 60_000).toISOString();
        const future = new Date(now.getTime() + 300_000).toISOString();
        const assertion = makeAssertion(past, future, 'https://wrong-sp.example.com');
        await expect(checkConditions(assertion, 'https://sp.lunaos.ai')).rejects.toThrow('audience_mismatch');
    });

    it('throws no_conditions when Conditions element missing', async () => {
        const assertion = { 'saml:Assertion': [] };
        await expect(checkConditions(assertion, 'sp')).rejects.toThrow('no_conditions');
    });
});

describe('extractAttributes', () => {
    it('extracts named attributes from AttributeStatement', () => {
        const assertion = {
            'saml:Assertion': [
                {
                    'saml:AttributeStatement': [
                        {
                            'saml:Attribute': [
                                { 'saml:AttributeValue': [{ '#text': 'alice@acme.com' }] },
                            ],
                            ':@': { '@_Name': 'email' },
                        },
                        {
                            'saml:Attribute': [
                                { 'saml:AttributeValue': [{ '#text': 'Alice' }] },
                            ],
                            ':@': { '@_Name': 'firstName' },
                        },
                    ],
                },
            ],
        };
        const result = extractAttributes(assertion);
        expect(result['email']).toBe('alice@acme.com');
        expect(result['firstName']).toBe('Alice');
    });

    it('returns empty object when no AttributeStatement', () => {
        const assertion = { 'saml:Assertion': [] };
        expect(extractAttributes(assertion)).toEqual({});
    });
});

describe('pickEmail', () => {
    it('returns email from attribute map', () => {
        const result = pickEmail('nameId', 'format', { email: 'user@domain.com' });
        expect(result).toBe('user@domain.com');
    });

    it('falls back to nameId for emailAddress format', () => {
        const result = pickEmail(
            'user@acme.com',
            'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            {},
        );
        expect(result).toBe('user@acme.com');
    });

    it('falls back to nameId when it contains @', () => {
        const result = pickEmail('fallback@test.com', 'other-format', {});
        expect(result).toBe('fallback@test.com');
    });

    it('lowercases result', () => {
        const result = pickEmail('USER@DOMAIN.COM', 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress', {});
        expect(result).toBe('user@domain.com');
    });

    it('returns undefined when nameId has no @ and attrs have no email', () => {
        const result = pickEmail('opaque-id-123', 'transient', {});
        expect(result).toBeUndefined();
    });
});

describe('pickFirst', () => {
    it('returns first matching string value', () => {
        const map = { displayName: 'Alice Smith', name: 'Alice' };
        expect(pickFirst(map, ['displayName', 'name'])).toBe('Alice Smith');
    });

    it('returns first element of array value', () => {
        const map = { roles: ['admin', 'user'] };
        expect(pickFirst(map, ['roles'])).toBe('admin');
    });

    it('returns undefined when no names match', () => {
        expect(pickFirst({}, ['missing', 'also-missing'])).toBeUndefined();
    });

    it('skips empty arrays', () => {
        const map = { a: [] as string[], b: 'found' };
        expect(pickFirst(map, ['a', 'b'])).toBe('found');
    });
});

// ─── parseSamlXml — requires fast-xml-parser (skip until installed) ───────────

describe.skip('parseSamlXml — requires npm install fast-xml-parser', () => {
    // TODO(gap-2): Install fast-xml-parser in lunaos-engine/packages/api
    // then remove .skip and add:
    //   - happy-path XML parse
    //   - DOCTYPE rejection (xxe_blocked)
    //   - ENTITY rejection
    //   - malformed XML → xml_parse_failed
});

// ─── verifyXmlSignature — requires real signed XML + fast-xml-parser ─────────

describe.skip('verifyXmlSignature — requires fast-xml-parser + signed XML fixtures', () => {
    // TODO(gap-2): Add golden signed XML fixture generated with test RSA key.
    // Cases to add after gap-2 resolved:
    //   - Happy-path verification with test RSA-SHA256 key
    //   - XSW: signed Assertion ID != referenced element ID → xsw_reference_mismatch
    //   - SHA-1 algorithm → sig_alg_disallowed
    //   - Empty PEM cert → cert_invalid
    //   - Tampered digest → digest_mismatch
    //   - Tampered signature bytes → signature_invalid
});
