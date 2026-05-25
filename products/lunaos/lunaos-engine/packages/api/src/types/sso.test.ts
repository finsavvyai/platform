/**
 * sso.ts — Zod schema validation tests.
 * Verifies: CreateIdpInput discriminated union, UpdateIdpInput partial,
 * IdentityProviderSchema, SsoSessionSchema field constraints.
 */
import { describe, it, expect } from 'vitest';
import {
    CreateIdpInput,
    UpdateIdpInput,
    IdentityProviderSchema,
    SsoSessionSchema,
} from './sso';

// ─── helpers ──────────────────────────────────────────────────────────────────

const VALID_OIDC_INPUT = {
    type: 'oidc' as const,
    orgId: 'org-1',
    name: 'Okta Dev',
    enabled: true,
    emailDomain: 'acme.com',
    jitEnabled: true,
    defaultRole: 'member',
    oidcIssuer: 'https://dev.okta.com',
    oidcClientId: 'client123',
    oidcClientSecret: 'super-secret',
    oidcDiscoveryUrl: 'https://dev.okta.com/.well-known/openid-configuration',
    oidcScopes: 'openid email profile',
};

const VALID_SAML_INPUT = {
    type: 'saml' as const,
    orgId: 'org-1',
    name: 'Okta SAML',
    enabled: true,
    emailDomain: 'acme.com',
    jitEnabled: false,
    defaultRole: 'member',
    samlEntityId: 'https://app.lunaos.ai/saml/metadata',
    samlSsoUrl: 'https://dev.okta.com/sso/saml',
    samlCertificate:
        '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(100) + '\n-----END CERTIFICATE-----',
};

describe('CreateIdpInput — OIDC branch', () => {
    it('accepts a valid OIDC input', () => {
        expect(() => CreateIdpInput.parse(VALID_OIDC_INPUT)).not.toThrow();
    });

    it('rejects OIDC missing oidcDiscoveryUrl', () => {
        const { oidcDiscoveryUrl, ...bad } = VALID_OIDC_INPUT;
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects OIDC missing oidcClientSecret', () => {
        const { oidcClientSecret, ...bad } = VALID_OIDC_INPUT;
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects OIDC missing oidcClientId', () => {
        const { oidcClientId, ...bad } = VALID_OIDC_INPUT;
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects non-https oidcIssuer', () => {
        const bad = { ...VALID_OIDC_INPUT, oidcIssuer: 'http://insecure.com' };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects non-https oidcDiscoveryUrl', () => {
        const bad = { ...VALID_OIDC_INPUT, oidcDiscoveryUrl: 'http://insecure.com' };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });
});

describe('CreateIdpInput — SAML branch', () => {
    it('accepts a valid SAML input', () => {
        expect(() => CreateIdpInput.parse(VALID_SAML_INPUT)).not.toThrow();
    });

    it('rejects SAML missing samlCertificate', () => {
        const { samlCertificate, ...bad } = VALID_SAML_INPUT;
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects SAML certificate missing PEM header', () => {
        const bad = { ...VALID_SAML_INPUT, samlCertificate: 'AAAA'.repeat(20) };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects SAML missing samlSsoUrl', () => {
        const { samlSsoUrl, ...bad } = VALID_SAML_INPUT;
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects SAML non-https samlSsoUrl', () => {
        const bad = { ...VALID_SAML_INPUT, samlSsoUrl: 'http://sso.example.com' };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('accepts SAML input without optional samlSloUrl', () => {
        const { samlSloUrl, ...input } = { ...VALID_SAML_INPUT, samlSloUrl: undefined };
        expect(() => CreateIdpInput.parse(input)).not.toThrow();
    });
});

describe('CreateIdpInput — common field validation', () => {
    it('rejects missing orgId', () => {
        const bad = { ...VALID_OIDC_INPUT, orgId: '' };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('rejects name longer than 120 chars', () => {
        const bad = { ...VALID_OIDC_INPUT, name: 'x'.repeat(121) };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('defaults enabled to true when omitted', () => {
        const { enabled, ...input } = VALID_OIDC_INPUT;
        const r = CreateIdpInput.parse(input);
        expect(r.enabled).toBe(true);
    });

    it('defaults jitEnabled to true when omitted', () => {
        const { jitEnabled, ...input } = VALID_OIDC_INPUT;
        const r = CreateIdpInput.parse(input);
        expect(r.jitEnabled).toBe(true);
    });

    it('defaults defaultRole to member when omitted', () => {
        const { defaultRole, ...input } = VALID_OIDC_INPUT;
        const r = CreateIdpInput.parse(input);
        expect(r.defaultRole).toBe('member');
    });

    it('rejects invalid emailDomain pattern', () => {
        const bad = { ...VALID_OIDC_INPUT, emailDomain: 'notadomain' };
        const r = CreateIdpInput.safeParse(bad);
        expect(r.success).toBe(false);
    });

    it('accepts null emailDomain', () => {
        const input = { ...VALID_OIDC_INPUT, emailDomain: null };
        expect(() => CreateIdpInput.parse(input)).not.toThrow();
    });
});

describe('UpdateIdpInput — partial patch', () => {
    it('accepts empty object (no-op patch)', () => {
        expect(() => UpdateIdpInput.parse({})).not.toThrow();
    });

    it('accepts partial common fields only', () => {
        const r = UpdateIdpInput.parse({ name: 'New Name', enabled: false });
        expect(r.name).toBe('New Name');
        expect(r.enabled).toBe(false);
    });

    it('accepts provider oidc patch with type discriminator', () => {
        const r = UpdateIdpInput.parse({
            provider: { type: 'oidc', oidcClientId: 'new-client-id' },
        });
        expect(r.provider?.type).toBe('oidc');
    });

    it('accepts provider saml patch with type discriminator', () => {
        const r = UpdateIdpInput.parse({
            provider: { type: 'saml', samlSsoUrl: 'https://new-sso.example.com' },
        });
        expect(r.provider?.type).toBe('saml');
    });
});

describe('IdentityProviderSchema', () => {
    it('parses a minimal valid provider row', () => {
        const now = new Date().toISOString();
        const row = {
            id: 'idp-1', orgId: 'org-1', type: 'oidc', name: 'Test', enabled: true,
            emailDomain: null, jitEnabled: true, defaultRole: 'member',
            oidcIssuer: null, oidcClientId: null, oidcClientSecret: null,
            oidcDiscoveryUrl: null, oidcScopes: null,
            samlEntityId: null, samlSsoUrl: null, samlCertificate: null, samlSloUrl: null,
            createdAt: now, updatedAt: now,
        };
        expect(() => IdentityProviderSchema.parse(row)).not.toThrow();
    });

    it('coerces date strings to Date objects', () => {
        const now = new Date().toISOString();
        const row = IdentityProviderSchema.parse({
            id: 'i', orgId: 'o', type: 'saml', name: 'n', enabled: false,
            emailDomain: null, jitEnabled: false, defaultRole: 'member',
            oidcIssuer: null, oidcClientId: null, oidcClientSecret: null,
            oidcDiscoveryUrl: null, oidcScopes: null,
            samlEntityId: null, samlSsoUrl: null, samlCertificate: null, samlSloUrl: null,
            createdAt: now, updatedAt: now,
        });
        expect(row.createdAt).toBeInstanceOf(Date);
        expect(row.updatedAt).toBeInstanceOf(Date);
    });

    it('rejects unknown type', () => {
        const r = IdentityProviderSchema.safeParse({ type: 'oauth2' });
        expect(r.success).toBe(false);
    });
});

describe('SsoSessionSchema', () => {
    it('parses a valid session row', () => {
        const now = new Date().toISOString();
        const row = {
            id: 'sess-1', userId: 'user-1', orgId: 'org-1', idpId: 'idp-1',
            nameId: 'user@acme.com', sessionIndex: null,
            expiresAt: now, createdAt: now,
        };
        expect(() => SsoSessionSchema.parse(row)).not.toThrow();
    });

    it('requires userId to be non-empty', () => {
        const now = new Date().toISOString();
        const r = SsoSessionSchema.safeParse({
            id: 's', userId: '', orgId: 'o', idpId: 'i',
            nameId: 'n', sessionIndex: null, expiresAt: now, createdAt: now,
        });
        expect(r.success).toBe(false);
    });
});
