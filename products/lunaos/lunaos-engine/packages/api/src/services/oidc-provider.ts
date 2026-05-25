/** OIDC Provider — discovery, JWKS, auth URL, code exchange, ID-token verify.
 *  Web Crypto only. PKCE S256, nonce required, alg=none rejected.
 *  State: HMAC-SHA256 → `b64url(JSON).b64url(sig)`. */
import type { Env as BaseEnv } from '../worker';
import type { IdentityProvider } from '../types/sso';
import { decryptSecret } from './secret-vault';

/** Env additions owned by SSO; Architect should fold into worker.ts Env. */
export interface SsoEnvExt { SESSION_SECRET: string; SSO_VAULT_KEY?: string; OIDC_REDIRECT_URI?: string }
export type Env = BaseEnv & SsoEnvExt;

const STATE_TTL_SECONDS = 600;
const DISCOVERY_TTL_SECONDS = 86_400;
const JWKS_TTL_SECONDS = 86_400;
const ALLOWED_ALGS = new Set(['RS256', 'ES256', 'PS256']);
const enc = new TextEncoder();

/** Wrap Uint8Array → BufferSource satisfying strict ArrayBuffer typing. */
function buf(u: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(u.byteLength);
    new Uint8Array(out).set(u);
    return out;
}

// ─── base64url helpers + state-token HMAC + JWKS cache + verifyIdToken ──────
export function b64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
    const b = typeof input === 'string' ? enc.encode(input)
        : input instanceof Uint8Array ? input : new Uint8Array(input);
    let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function b64urlDecode(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
function randomBytes(n: number): Uint8Array { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

async function sha256(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf(data)));
}

// ─── HMAC for state token ────────────────────────────────────────────────────
async function hmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw', buf(enc.encode(secret)),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
    );
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

interface StatePayload {
    idpId: string; returnPath: string; codeVerifier: string;
    nonce: string; iat: number; exp: number;
}

export async function signState(payload: StatePayload, secret: string): Promise<string> {
    const body = b64urlEncode(JSON.stringify(payload));
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, buf(enc.encode(body)));
    return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyState(token: string, secret: string): Promise<StatePayload> {
    const [body, sig] = token.split('.');
    if (!body || !sig) throw new Error('state_malformed');
    const key = await hmacKey(secret);
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(enc.encode(body))));
    if (!timingSafeEqual(expected, b64urlDecode(sig))) throw new Error('state_bad_sig');
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as StatePayload;
    if (Math.floor(Date.now() / 1000) >= payload.exp) throw new Error('state_expired');
    return payload;
}

// ─── Discovery + JWKS (cached in KV) ─────────────────────────────────────────
interface OidcMetadata { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
interface Jwk { kid?: string; kty: string; alg?: string; use?: string; n?: string; e?: string; crv?: string; x?: string; y?: string }

async function fetchJson<T>(url: string): Promise<T> {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`fetch_failed_${r.status}`);
    return r.json() as Promise<T>;
}

export class OidcProvider {
    constructor(private env: Env) { }

    async getMetadata(idp: IdentityProvider): Promise<OidcMetadata> {
        const key = `oidc:disco:${idp.id}:v1`;
        const cached = await this.env.KV.get(key);
        if (cached) return JSON.parse(cached) as OidcMetadata;
        if (!idp.oidcDiscoveryUrl || !idp.oidcIssuer) throw new Error('idp_misconfigured');
        const meta = await fetchJson<OidcMetadata>(idp.oidcDiscoveryUrl);
        if (meta.issuer !== idp.oidcIssuer) throw new Error('issuer_mismatch');
        await this.env.KV.put(key, JSON.stringify(meta), { expirationTtl: DISCOVERY_TTL_SECONDS });
        return meta;
    }

    async getJwks(idp: IdentityProvider, force = false): Promise<{ keys: Jwk[] }> {
        const key = `oidc:jwks:${idp.id}:v1`;
        if (!force) {
            const cached = await this.env.KV.get(key);
            if (cached) return JSON.parse(cached) as { keys: Jwk[] };
        }
        const meta = await this.getMetadata(idp);
        const jwks = await fetchJson<{ keys: Jwk[] }>(meta.jwks_uri);
        await this.env.KV.put(key, JSON.stringify(jwks), { expirationTtl: JWKS_TTL_SECONDS });
        return jwks;
    }

    async buildAuthorizationUrl(idp: IdentityProvider, returnPath: string): Promise<{ url: string; state: string }> {
        const meta = await this.getMetadata(idp);
        const codeVerifier = b64urlEncode(randomBytes(64)); // 86 chars, in 43-128 range
        const challenge = b64urlEncode(await sha256(enc.encode(codeVerifier)));
        const nonce = b64urlEncode(randomBytes(32));
        const now = Math.floor(Date.now() / 1000);
        const state = await signState(
            { idpId: idp.id, returnPath, codeVerifier, nonce, iat: now, exp: now + STATE_TTL_SECONDS },
            this.env.SESSION_SECRET,
        );
        const params = new URLSearchParams({
            client_id: idp.oidcClientId ?? '',
            redirect_uri: this.env.OIDC_REDIRECT_URI ?? '',
            response_type: 'code',
            scope: idp.oidcScopes ?? 'openid email profile',
            state,
            nonce,
            code_challenge: challenge,
            code_challenge_method: 'S256',
        });
        return { url: `${meta.authorization_endpoint}?${params.toString()}`, state };
    }

    async exchangeCode(idp: IdentityProvider, code: string, codeVerifier: string): Promise<{ id_token: string; access_token: string }> {
        const meta = await this.getMetadata(idp);
        const clientSecret = await decryptSecret(idp.oidcClientSecret ?? '', { SSO_VAULT_KEY: this.env.SSO_VAULT_KEY });
        const body = new URLSearchParams({
            grant_type: 'authorization_code', code,
            redirect_uri: this.env.OIDC_REDIRECT_URI ?? '',
            client_id: idp.oidcClientId ?? '', client_secret: clientSecret,
            code_verifier: codeVerifier,
        });
        const r = await fetch(meta.token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: body.toString(),
        });
        if (!r.ok) throw new Error('token_exchange_failed');
        const tok = await r.json() as { id_token?: string; access_token?: string };
        if (!tok.id_token || !tok.access_token) throw new Error('token_response_invalid');
        return { id_token: tok.id_token, access_token: tok.access_token };
    }

    async verifyIdToken(idp: IdentityProvider, idToken: string, expectedNonce: string): Promise<Record<string, unknown>> {
        const [hB64, pB64, sB64] = idToken.split('.');
        if (!hB64 || !pB64 || !sB64) throw new Error('idtoken_malformed');
        const header = JSON.parse(new TextDecoder().decode(b64urlDecode(hB64))) as { alg?: string; kid?: string };
        if (!header.alg || !ALLOWED_ALGS.has(header.alg)) throw new Error('idtoken_alg_rejected');
        // JWK lookup; refresh cache once on kid miss.
        let jwks = await this.getJwks(idp);
        let jwk = jwks.keys.find(k => k.kid === header.kid);
        if (!jwk) { jwks = await this.getJwks(idp, true); jwk = jwks.keys.find(k => k.kid === header.kid); }
        if (!jwk) throw new Error('idtoken_kid_unknown');
        const algo = header.alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
            : header.alg === 'PS256' ? { name: 'RSA-PSS', hash: 'SHA-256' }
                : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
        const key = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, algo as any, false, ['verify']);
        const vParams = header.alg === 'PS256' ? { name: 'RSA-PSS', saltLength: 32 }
            : header.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5';
        const ok = await crypto.subtle.verify(vParams as any, key, buf(b64urlDecode(sB64)), buf(enc.encode(`${hB64}.${pB64}`)));
        if (!ok) throw new Error('idtoken_sig_invalid');
        const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(pB64))) as Record<string, unknown>;
        const now = Math.floor(Date.now() / 1000);
        if (claims.iss !== idp.oidcIssuer) throw new Error('idtoken_iss_mismatch');
        const aud = claims.aud;
        const audOk = Array.isArray(aud) ? aud.includes(idp.oidcClientId) : aud === idp.oidcClientId;
        if (!audOk) throw new Error('idtoken_aud_mismatch');
        if (typeof claims.exp !== 'number' || now >= claims.exp) throw new Error('idtoken_expired');
        // FIND-011 fix: enforce both upper and lower bounds on iat.
        // Upper:  iat must not be more than 5 min in the future (clock skew).
        // Lower:  iat must not be more than 5 min in the past — rejects
        //         long-replayed tokens whose exp window is generous.
        if (typeof claims.iat !== 'number') throw new Error('idtoken_iat_invalid');
        if (claims.iat > now + 300) throw new Error('idtoken_iat_invalid');
        if (claims.iat < now - 300) throw new Error('idtoken_iat_too_old');
        // FIND-011 fix: enforce nbf if present (≤ now + 60s skew).
        if (typeof claims.nbf === 'number' && claims.nbf > now + 60) {
            throw new Error('idtoken_not_yet_valid');
        }
        if (claims.nonce !== expectedNonce) throw new Error('idtoken_nonce_mismatch');
        return claims;
    }
}
