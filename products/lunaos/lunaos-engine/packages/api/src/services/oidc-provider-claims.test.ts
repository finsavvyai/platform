/**
 * verifyIdToken claim-validation tests — FIND-011 fixes.
 *
 *   - iat upper bound (now + 300)             — pre-existing
 *   - iat lower bound (now - 300)             — NEW (FIND-011)
 *   - nbf check       (claims.nbf > now + 60) — NEW (FIND-011)
 *
 * We exercise the claim validators by stubbing `getJwks` and the WebCrypto
 * verify call so the path reaches the iat/nbf branches deterministically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock `crypto.subtle.verify` to always return true so we reach claim checks.
beforeEach(() => {
    vi.restoreAllMocks();
});

import { OidcProvider, b64urlEncode } from './oidc-provider';

function buildIdToken(claims: Record<string, unknown>): string {
    const header = b64urlEncode(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
    const payload = b64urlEncode(JSON.stringify(claims));
    const sig = b64urlEncode('signature');
    return `${header}.${payload}.${sig}`;
}

function makeIdp() {
    return {
        id: 'idp-1', orgId: 'org-1', type: 'oidc' as const, name: 'Test',
        enabled: true, jitEnabled: true, defaultRole: 'member',
        emailDomain: null,
        oidcIssuer: 'https://idp.example.com',
        oidcClientId: 'client-id',
        oidcClientSecret: null,
        oidcDiscoveryUrl: 'https://idp.example.com/.well-known',
        oidcScopes: 'openid email',
        samlEntityId: null, samlSsoUrl: null, samlCertificate: null, samlSloUrl: null,
        createdAt: new Date(), updatedAt: new Date(),
    };
}

function makeEnv() {
    return { DB: {} as any, KV: { get: vi.fn(async () => null), put: vi.fn() } as any,
        JWT_SECRET: 'j', SESSION_SECRET: 's', ENVIRONMENT: 'test', AI: {}, VECTORIZE: {} } as any;
}

function stubProvider(p: OidcProvider): void {
    // Bypass JWKS + crypto.verify so we land on the claim validations.
    (p as any).getJwks = vi.fn(async () => ({ keys: [{ kid: 'k1', kty: 'RSA', n: 'x', e: 'AQAB' }] }));
    vi.spyOn(crypto.subtle, 'importKey' as any).mockResolvedValue({} as any);
    vi.spyOn(crypto.subtle, 'verify' as any).mockResolvedValue(true);
}

describe('verifyIdToken — FIND-011 claim validation', () => {
    const idp = makeIdp();
    const now = Math.floor(Date.now() / 1000);

    it('accepts a valid id_token with current iat and matching nonce', async () => {
        const env = makeEnv();
        const p = new OidcProvider(env);
        stubProvider(p);
        const tok = buildIdToken({
            iss: idp.oidcIssuer, aud: idp.oidcClientId,
            iat: now, exp: now + 3600, nonce: 'nc1',
        });
        const claims = await p.verifyIdToken(idp, tok, 'nc1');
        expect(claims.iss).toBe(idp.oidcIssuer);
    });

    it('rejects when iat is too old (lower bound, FIND-011)', async () => {
        const env = makeEnv();
        const p = new OidcProvider(env);
        stubProvider(p);
        const tok = buildIdToken({
            iss: idp.oidcIssuer, aud: idp.oidcClientId,
            iat: now - 3600, exp: now + 3600, nonce: 'nc1',
        });
        await expect(p.verifyIdToken(idp, tok, 'nc1'))
            .rejects.toThrow(/idtoken_iat_too_old/);
    });

    it('rejects when iat is too far in the future (upper bound)', async () => {
        const env = makeEnv();
        const p = new OidcProvider(env);
        stubProvider(p);
        const tok = buildIdToken({
            iss: idp.oidcIssuer, aud: idp.oidcClientId,
            iat: now + 3600, exp: now + 7200, nonce: 'nc1',
        });
        await expect(p.verifyIdToken(idp, tok, 'nc1'))
            .rejects.toThrow(/idtoken_iat_invalid/);
    });

    it('rejects when nbf is in the future beyond the 60s skew (FIND-011)', async () => {
        const env = makeEnv();
        const p = new OidcProvider(env);
        stubProvider(p);
        const tok = buildIdToken({
            iss: idp.oidcIssuer, aud: idp.oidcClientId,
            iat: now, nbf: now + 600, exp: now + 3600, nonce: 'nc1',
        });
        await expect(p.verifyIdToken(idp, tok, 'nc1'))
            .rejects.toThrow(/idtoken_not_yet_valid/);
    });

    it('accepts when nbf is within the 60s skew (FIND-011)', async () => {
        const env = makeEnv();
        const p = new OidcProvider(env);
        stubProvider(p);
        const tok = buildIdToken({
            iss: idp.oidcIssuer, aud: idp.oidcClientId,
            iat: now, nbf: now + 30, exp: now + 3600, nonce: 'nc1',
        });
        const claims = await p.verifyIdToken(idp, tok, 'nc1');
        expect(claims).toBeDefined();
    });

    it('rejects when nonce mismatches (regression)', async () => {
        const env = makeEnv();
        const p = new OidcProvider(env);
        stubProvider(p);
        const tok = buildIdToken({
            iss: idp.oidcIssuer, aud: idp.oidcClientId,
            iat: now, exp: now + 3600, nonce: 'wrong',
        });
        await expect(p.verifyIdToken(idp, tok, 'expected'))
            .rejects.toThrow(/idtoken_nonce_mismatch/);
    });
});
