/**
 * idp-service — DB helpers for identity_providers CRUD + safeIdp redaction.
 * Mocks D1Database; verifies secret encryption on create/patch, redaction on display.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeIdp, createIdp, buildPatchClauses } from './idp-service';
import { __resetVaultCacheForTests } from './secret-vault';

const VAULT_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(0xAB)));
const vaultEnv = { SSO_VAULT_KEY: VAULT_KEY };

beforeEach(() => {
    __resetVaultCacheForTests();
});

// ─── safeIdp ──────────────────────────────────────────────────────────────────

describe('safeIdp', () => {
    it('maps DB columns to camelCase output', async () => {
        const row = {
            id: 'idp-1', org_id: 'org-1', type: 'oidc', name: 'Test',
            enabled: 1, email_domain: 'acme.com', jit_enabled: 1, default_role: 'member',
            oidc_issuer: 'https://iss.com', oidc_client_id: 'cid',
            oidc_client_secret: null,
            oidc_discovery_url: 'https://iss.com/.well-known',
            oidc_scopes: 'openid email',
            saml_entity_id: null, saml_sso_url: null, saml_certificate: null, saml_slo_url: null,
            created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
        };
        const result = await safeIdp(row);
        expect(result.id).toBe('idp-1');
        expect(result.orgId).toBe('org-1');
        expect(result.oidcIssuer).toBe('https://iss.com');
        expect(result.enabled).toBe(true);
        expect(result.jitEnabled).toBe(true);
    });

    it('returns null for oidcClientSecretHint when no secret stored', async () => {
        const row = {
            id: 'i', org_id: 'o', type: 'oidc', name: 'n', enabled: 0,
            email_domain: null, jit_enabled: 0, default_role: 'member',
            oidc_client_secret: null,
            oidc_issuer: null, oidc_client_id: null,
            oidc_discovery_url: null, oidc_scopes: null,
            saml_entity_id: null, saml_sso_url: null, saml_certificate: null, saml_slo_url: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        const result = await safeIdp(row);
        expect(result.oidcClientSecretHint).toBeNull();
    });

    it('returns a ••••XXXX hint when oidc_client_secret is present (non-null)', async () => {
        const row = {
            id: 'i', org_id: 'o', type: 'oidc', name: 'n', enabled: 1,
            email_domain: null, jit_enabled: 0, default_role: 'member',
            oidc_client_secret: 'v1:someencryptedblob',
            oidc_issuer: null, oidc_client_id: null,
            oidc_discovery_url: null, oidc_scopes: null,
            saml_entity_id: null, saml_sso_url: null, saml_certificate: null, saml_slo_url: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        const result = await safeIdp(row);
        expect(result.oidcClientSecretHint).toMatch(/^••••[0-9a-f]{4}$/);
    });

    it('never exposes oidc_client_secret raw value in output', async () => {
        const row = {
            id: 'i', org_id: 'o', type: 'oidc', name: 'n', enabled: 1,
            email_domain: null, jit_enabled: 0, default_role: 'member',
            oidc_client_secret: 'super-secret-raw-value',
            oidc_issuer: null, oidc_client_id: null,
            oidc_discovery_url: null, oidc_scopes: null,
            saml_entity_id: null, saml_sso_url: null, saml_certificate: null, saml_slo_url: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        const result = await safeIdp(row);
        const resultStr = JSON.stringify(result);
        expect(resultStr).not.toContain('super-secret-raw-value');
    });
});

// ─── createIdp ───────────────────────────────────────────────────────────────

describe('createIdp', () => {
    function makeDb() {
        const runMock = vi.fn(async () => ({}));
        const db = {
            prepare: vi.fn(() => ({
                bind: vi.fn(() => ({ run: runMock })),
            })),
        } as unknown as D1Database;
        return { db, runMock };
    }

    it('returns a UUID id on OIDC create', async () => {
        const { db } = makeDb();
        const id = await createIdp(db, vaultEnv, {
            type: 'oidc',
            orgId: 'org-1',
            name: 'Okta Dev',
            enabled: true,
            emailDomain: 'acme.com',
            jitEnabled: true,
            defaultRole: 'member',
            oidcIssuer: 'https://dev.okta.com',
            oidcClientId: 'cid',
            oidcClientSecret: 'raw-secret',
            oidcDiscoveryUrl: 'https://dev.okta.com/.well-known/openid-configuration',
            oidcScopes: 'openid email',
        });
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(10);
    });

    it('encrypts oidcClientSecret before INSERT (not raw)', async () => {
        let capturedBindArgs: unknown[] = [];
        const db = {
            prepare: vi.fn(() => ({
                bind: vi.fn((...args: unknown[]) => {
                    capturedBindArgs = args;
                    return { run: vi.fn(async () => ({})) };
                }),
            })),
        } as unknown as D1Database;

        await createIdp(db, vaultEnv, {
            type: 'oidc',
            orgId: 'org-1',
            name: 'Test',
            enabled: true,
            emailDomain: null,
            jitEnabled: false,
            defaultRole: 'member',
            oidcIssuer: 'https://iss.com',
            oidcClientId: 'cid',
            oidcClientSecret: 'raw-secret-value',
            oidcDiscoveryUrl: 'https://iss.com/.well-known',
            oidcScopes: 'openid',
        });
        // Find the secret in bind args — should be v1: prefix (encrypted), not raw
        const secretArg = capturedBindArgs.find(
            (a) => typeof a === 'string' && (a as string).startsWith('v1:')
        );
        expect(secretArg).toBeDefined();
        expect(capturedBindArgs).not.toContain('raw-secret-value');
    });

    it('stores null for oidcClientSecret on SAML create', async () => {
        let capturedBindArgs: unknown[] = [];
        const db = {
            prepare: vi.fn(() => ({
                bind: vi.fn((...args: unknown[]) => {
                    capturedBindArgs = args;
                    return { run: vi.fn(async () => ({})) };
                }),
            })),
        } as unknown as D1Database;

        await createIdp(db, vaultEnv, {
            type: 'saml',
            orgId: 'org-1',
            name: 'Okta SAML',
            enabled: true,
            emailDomain: null,
            jitEnabled: true,
            defaultRole: 'member',
            samlEntityId: 'https://sp.lunaos.ai',
            samlSsoUrl: 'https://idp.okta.com/sso',
            samlCertificate: '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(100),
        });
        expect(capturedBindArgs).toContain(null); // encrypted secret slot is null for SAML
    });
});

// ─── buildPatchClauses ────────────────────────────────────────────────────────

describe('buildPatchClauses', () => {
    it('returns empty sets/vals for empty input', async () => {
        const result = await buildPatchClauses(vaultEnv, {});
        expect(result.sets).toHaveLength(0);
        expect(result.vals).toHaveLength(0);
        expect(result.diffFields).toHaveLength(0);
    });

    it('builds SET clause for name and enabled', async () => {
        const result = await buildPatchClauses(vaultEnv, { name: 'New Name', enabled: false });
        expect(result.sets).toContain('name = ?');
        expect(result.sets).toContain('enabled = ?');
        expect(result.vals).toContain('New Name');
        expect(result.vals).toContain(0);
        expect(result.diffFields).toContain('name');
        expect(result.diffFields).toContain('enabled');
    });

    it('encrypts oidcClientSecret when provider patch includes it', async () => {
        const result = await buildPatchClauses(vaultEnv, {
            provider: { type: 'oidc', oidcClientSecret: 'new-raw-secret' },
        });
        expect(result.diffFields).toContain('oidcClientSecret');
        const secretVal = result.vals.find(
            (v) => typeof v === 'string' && (v as string).startsWith('v1:')
        );
        expect(secretVal).toBeDefined();
        expect(result.vals).not.toContain('new-raw-secret');
    });

    it('skips oidcClientSecret when provider.oidcClientSecret is undefined (preserve original)', async () => {
        const result = await buildPatchClauses(vaultEnv, {
            provider: { type: 'oidc', oidcClientId: 'new-cid' },
        });
        expect(result.diffFields).not.toContain('oidcClientSecret');
        expect(result.diffFields).toContain('oidcClientId');
    });

    it('handles SAML patch fields', async () => {
        const result = await buildPatchClauses(vaultEnv, {
            provider: { type: 'saml', samlSsoUrl: 'https://new-sso.example.com' },
        });
        expect(result.sets).toContain('saml_sso_url = ?');
        expect(result.vals).toContain('https://new-sso.example.com');
    });
});
