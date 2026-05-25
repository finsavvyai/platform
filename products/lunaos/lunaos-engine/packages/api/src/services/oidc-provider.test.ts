/**
 * OidcProvider — PKCE flow, state HMAC, JWKS cache, ID-token verify pipeline.
 * Exercises: buildAuthorizationUrl, signState/verifyState, verifyIdToken rejects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OidcProvider, signState, verifyState, b64urlEncode, b64urlDecode } from './oidc-provider';
import { __resetVaultCacheForTests } from './secret-vault';

// ─── TestEnv factory ─────────────────────────────────────────────────────────

function makeEnv(overrides: Record<string, unknown> = {}) {
    const kvStore = new Map<string, string>();
    return {
        SESSION_SECRET: 'test-session-secret-32-bytes-long!!',
        SSO_VAULT_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(0xCC))),
        OIDC_REDIRECT_URI: 'https://app.lunaos.ai/v1/sso/oidc/callback',
        SP_ENTITY_ID: 'lunaos.ai',
        SP_ACS_URL: 'https://app.lunaos.ai/v1/sso/saml/callback',
        DB: { prepare: vi.fn() },
        KV: {
            get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
            put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
            delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
        },
        JWT_SECRET: 'jwt-secret',
        ...overrides,
    };
}

function makeIdp(overrides: Record<string, unknown> = {}) {
    return {
        id: 'idp-1',
        orgId: 'org-1',
        type: 'oidc' as const,
        name: 'Test IdP',
        enabled: true,
        emailDomain: 'acme.com',
        jitEnabled: true,
        defaultRole: 'member',
        oidcIssuer: 'https://accounts.example.com',
        oidcClientId: 'client-id-test',
        oidcClientSecret: null,
        oidcDiscoveryUrl: 'https://accounts.example.com/.well-known/openid-configuration',
        oidcScopes: 'openid email profile',
        samlEntityId: null,
        samlSsoUrl: null,
        samlCertificate: null,
        samlSloUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// Mock decryptSecret so exchangeCode doesn't need real vault
vi.mock('./secret-vault', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./secret-vault')>();
    return {
        ...actual,
        decryptSecret: vi.fn(async () => 'decrypted-client-secret'),
    };
});

// ─── signState / verifyState ──────────────────────────────────────────────────

describe('signState / verifyState', () => {
    const SECRET = 'test-hmac-secret-needs-to-be-long';

    it('verifyState accepts a freshly signed state', async () => {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            idpId: 'idp-1', returnPath: '/dashboard', codeVerifier: 'cv',
            nonce: 'nc', iat: now, exp: now + 600,
        };
        const token = await signState(payload, SECRET);
        const result = await verifyState(token, SECRET);
        expect(result.idpId).toBe('idp-1');
        expect(result.returnPath).toBe('/dashboard');
    });

    it('verifyState throws state_bad_sig when HMAC tampered', async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await signState(
            { idpId: 'i', returnPath: '/', codeVerifier: 'c', nonce: 'n', iat: now, exp: now + 600 },
            SECRET,
        );
        const [body, sig] = token.split('.');
        const badToken = `${body}.${sig.slice(0, -2)}XX`;
        await expect(verifyState(badToken, 'wrong-secret-entirely')).rejects.toThrow('state_bad_sig');
    });

    it('verifyState throws state_expired when exp is in the past', async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await signState(
            { idpId: 'i', returnPath: '/', codeVerifier: 'c', nonce: 'n', iat: now - 700, exp: now - 1 },
            SECRET,
        );
        await expect(verifyState(token, SECRET)).rejects.toThrow('state_expired');
    });

    it('verifyState throws state_malformed for token without dot', async () => {
        await expect(verifyState('nodot', SECRET)).rejects.toThrow('state_malformed');
    });
});

// ─── b64url helpers ───────────────────────────────────────────────────────────

describe('b64urlEncode / b64urlDecode', () => {
    it('round-trips a Uint8Array', () => {
        const bytes = new Uint8Array([1, 2, 3, 255, 128]);
        const encoded = b64urlEncode(bytes);
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        const decoded = b64urlDecode(encoded);
        expect(Array.from(decoded)).toEqual([1, 2, 3, 255, 128]);
    });

    it('round-trips a string', () => {
        const s = 'hello world';
        const encoded = b64urlEncode(s);
        const decoded = new TextDecoder().decode(b64urlDecode(encoded));
        expect(decoded).toBe(s);
    });
});

// ─── OidcProvider.buildAuthorizationUrl ──────────────────────────────────────

describe('OidcProvider.buildAuthorizationUrl', () => {
    beforeEach(() => {
        __resetVaultCacheForTests();
    });

    it('returns a URL with code_challenge_method=S256 and state', async () => {
        const env = makeEnv();
        const idp = makeIdp();
        // Mock KV miss then put (discovery URL fetch)
        (env.KV.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                issuer: idp.oidcIssuer,
                authorization_endpoint: 'https://accounts.example.com/auth',
                token_endpoint: 'https://accounts.example.com/token',
                jwks_uri: 'https://accounts.example.com/jwks',
            }),
        } as Response);

        const provider = new OidcProvider(env as any);
        const { url } = await provider.buildAuthorizationUrl(idp, '/dashboard');
        const parsed = new URL(url);
        expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
        expect(parsed.searchParams.get('response_type')).toBe('code');
        expect(parsed.searchParams.has('state')).toBe(true);
        expect(parsed.searchParams.has('nonce')).toBe(true);
        expect(parsed.searchParams.get('client_id')).toBe('client-id-test');
    });

    it('uses KV cache on second call (no extra fetch)', async () => {
        const env = makeEnv();
        const idp = makeIdp();
        const cachedMeta = JSON.stringify({
            issuer: idp.oidcIssuer,
            authorization_endpoint: 'https://accounts.example.com/auth',
            token_endpoint: 'https://accounts.example.com/token',
            jwks_uri: 'https://accounts.example.com/jwks',
        });
        (env.KV.get as ReturnType<typeof vi.fn>).mockResolvedValue(cachedMeta);
        global.fetch = vi.fn();

        const provider = new OidcProvider(env as any);
        await provider.buildAuthorizationUrl(idp, '/dashboard');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws idp_misconfigured when oidcDiscoveryUrl missing', async () => {
        const env = makeEnv();
        const idp = makeIdp({ oidcDiscoveryUrl: null });
        (env.KV.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const provider = new OidcProvider(env as any);
        await expect(provider.buildAuthorizationUrl(idp, '/dashboard')).rejects.toThrow('idp_misconfigured');
    });

    it('throws issuer_mismatch when discovered issuer != configured issuer', async () => {
        const env = makeEnv();
        const idp = makeIdp();
        (env.KV.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                issuer: 'https://wrong-issuer.com',
                authorization_endpoint: 'https://accounts.example.com/auth',
                token_endpoint: 'https://accounts.example.com/token',
                jwks_uri: 'https://accounts.example.com/jwks',
            }),
        } as Response);
        const provider = new OidcProvider(env as any);
        await expect(provider.buildAuthorizationUrl(idp, '/dashboard')).rejects.toThrow('issuer_mismatch');
    });
});

// ─── OidcProvider.verifyIdToken — rejection matrix ───────────────────────────

describe('OidcProvider.verifyIdToken — rejects unsafe tokens', () => {
    const env = makeEnv();
    let provider: OidcProvider;

    beforeEach(() => {
        __resetVaultCacheForTests();
        provider = new OidcProvider(env as any);
    });

    function makeJwtParts(header: object, payload: object): [string, string] {
        const enc = (o: object) => b64urlEncode(JSON.stringify(o));
        return [enc(header), enc(payload)];
    }

    it('rejects alg=none', async () => {
        const [h, p] = makeJwtParts({ alg: 'none', kid: 'k1' }, {});
        const token = `${h}.${p}.sig`;
        await expect(provider.verifyIdToken(makeIdp(), token, 'nonce')).rejects.toThrow('idtoken_alg_rejected');
    });

    it('rejects missing alg field', async () => {
        const [h, p] = makeJwtParts({ kid: 'k1' }, {});
        const token = `${h}.${p}.sig`;
        await expect(provider.verifyIdToken(makeIdp(), token, 'nonce')).rejects.toThrow('idtoken_alg_rejected');
    });

    it('rejects HS256 (symmetric)', async () => {
        const [h, p] = makeJwtParts({ alg: 'HS256', kid: 'k1' }, {});
        const token = `${h}.${p}.sig`;
        await expect(provider.verifyIdToken(makeIdp(), token, 'nonce')).rejects.toThrow('idtoken_alg_rejected');
    });

    it('rejects malformed token (missing segments)', async () => {
        await expect(provider.verifyIdToken(makeIdp(), 'only.two', 'nonce')).rejects.toThrow('idtoken_malformed');
    });

    it('rejects unknown kid (not in JWKS)', async () => {
        const idp = makeIdp();
        // Both KV miss and force-fetch return empty keys
        (env.KV.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ keys: [] }));
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ keys: [] }),
        } as Response);

        const [h, p] = makeJwtParts({ alg: 'RS256', kid: 'unknown-kid' }, {});
        const token = `${h}.${p}.fakesig`;
        await expect(provider.verifyIdToken(idp, token, 'nonce')).rejects.toThrow('idtoken_kid_unknown');
    });
});

// ─── JWKS cache logic ─────────────────────────────────────────────────────────

describe('OidcProvider.getJwks — cache hit / miss / force-refresh', () => {
    it('uses KV cache on cache hit', async () => {
        const env = makeEnv();
        const idp = makeIdp();
        const cachedJwks = JSON.stringify({ keys: [{ kid: 'k1', kty: 'RSA' }] });
        // getJwks checks KV directly first (before getMetadata) — return cachedJwks immediately
        (env.KV.get as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(cachedJwks);  // getJwks cache hit (first call)
        global.fetch = vi.fn();
        const provider = new OidcProvider(env as any);
        const jwks = await provider.getJwks(idp);
        expect(Array.isArray(jwks.keys)).toBe(true);
        expect(jwks.keys[0].kid).toBe('k1');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches when force=true bypasses KV cache', async () => {
        const env = makeEnv();
        const idp = makeIdp();
        const cachedMeta = JSON.stringify({
            issuer: idp.oidcIssuer,
            authorization_endpoint: '',
            token_endpoint: '',
            jwks_uri: 'https://example.com/jwks',
        });
        (env.KV.get as ReturnType<typeof vi.fn>).mockResolvedValue(cachedMeta);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ keys: [{ kid: 'fresh-k', kty: 'RSA' }] }),
        } as Response);

        const provider = new OidcProvider(env as any);
        const jwks = await provider.getJwks(idp, true);
        expect(jwks.keys[0].kid).toBe('fresh-k');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
