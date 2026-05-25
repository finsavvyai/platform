/**
 * Secret Vault — encrypt at-rest secrets (e.g. OIDC client secrets) using
 * AES-GCM-256 via the Web Crypto API. Cloudflare Workers compatible:
 * no node:crypto, no Buffer.
 *
 * Layout v1:  blob = "v1:" + base64url(iv ‖ ciphertext ‖ tag)
 *   - iv:  12 random bytes (per-encryption)
 *   - tag: 16 bytes (AES-GCM auth tag, appended by Web Crypto)
 *
 * Key derivation: HKDF-SHA-256 over env.SSO_VAULT_KEY (base64-encoded 32B IKM)
 *   - salt = utf8('sso-vault-v1')
 *   - info = utf8('idp-secret-v1')
 *
 * Throws (no fallback to plaintext):
 *   - 'secret_vault_missing_key'  — env.SSO_VAULT_KEY absent or wrong length
 *   - 'secret_vault_format'       — blob malformed (bad prefix / base64 / size)
 *   - 'secret_vault_tamper'       — auth-tag mismatch on decrypt
 */

const VERSION_PREFIX = 'v1:';
const HKDF_SALT = new TextEncoder().encode('sso-vault-v1');
const HKDF_INFO = new TextEncoder().encode('idp-secret-v1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BITS = 256;

interface VaultEnv {
    SSO_VAULT_KEY?: string;
}

// Per-isolate cache: HKDF derivation is deterministic, so reuse across requests.
let cachedKey: Promise<CryptoKey> | null = null;
let cachedKeyFingerprint: string | null = null;

// ─── Base64url helpers (no Buffer; Workers-safe) ─────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function base64ToBytes(s: string): Uint8Array {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function bytesToHex(bytes: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

// ─── Key derivation ──────────────────────────────────────────────────────────

async function deriveKey(env: VaultEnv): Promise<CryptoKey> {
    if (!env.SSO_VAULT_KEY) {
        throw new Error('secret_vault_missing_key');
    }
    let ikm: Uint8Array;
    try {
        ikm = base64ToBytes(env.SSO_VAULT_KEY);
    } catch {
        throw new Error('secret_vault_missing_key');
    }
    if (ikm.byteLength !== 32) {
        throw new Error('secret_vault_missing_key');
    }
    // Re-derive if env rotated (cheap fingerprint of IKM length+first/last bytes).
    const fp = `${ikm.byteLength}:${ikm[0]}:${ikm[ikm.byteLength - 1]}`;
    if (cachedKey && cachedKeyFingerprint === fp) return cachedKey;
    cachedKeyFingerprint = fp;

    cachedKey = (async () => {
        const ikmKey = await crypto.subtle.importKey(
            'raw',
            ikm,
            'HKDF',
            false,
            ['deriveKey'],
        );
        return crypto.subtle.deriveKey(
            { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
            ikmKey,
            { name: 'AES-GCM', length: KEY_BITS },
            false,
            ['encrypt', 'decrypt'],
        );
    })();
    return cachedKey;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function encryptSecret(plain: string, env: VaultEnv): Promise<string> {
    const key = await deriveKey(env);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ctAndTag = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(plain),
        ),
    );
    const blob = new Uint8Array(iv.byteLength + ctAndTag.byteLength);
    blob.set(iv, 0);
    blob.set(ctAndTag, iv.byteLength);
    return VERSION_PREFIX + bytesToBase64Url(blob);
}

export async function decryptSecret(blob: string, env: VaultEnv): Promise<string> {
    if (typeof blob !== 'string' || !blob.startsWith(VERSION_PREFIX)) {
        throw new Error('secret_vault_format');
    }
    let raw: Uint8Array;
    try {
        raw = base64UrlToBytes(blob.slice(VERSION_PREFIX.length));
    } catch {
        throw new Error('secret_vault_format');
    }
    if (raw.byteLength < IV_BYTES + TAG_BYTES + 1) {
        throw new Error('secret_vault_format');
    }
    const iv = raw.slice(0, IV_BYTES);
    const ctAndTag = raw.slice(IV_BYTES);
    const key = await deriveKey(env);
    let pt: ArrayBuffer;
    try {
        pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctAndTag);
    } catch {
        // Web Crypto returns OperationError on tag mismatch.
        throw new Error('secret_vault_tamper');
    }
    return new TextDecoder().decode(pt);
}

/**
 * Stable, non-reversible display token for UIs and logs. Does NOT leak
 * plaintext — derived from SHA-256 of the encrypted blob itself.
 */
export async function redactForDisplay(blob: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(blob ?? ''),
    );
    const hex = bytesToHex(new Uint8Array(digest));
    return '••••' + hex.slice(0, 4);
}

/** Test-only: drop the cached derived key (e.g. between unit tests). */
export function __resetVaultCacheForTests(): void {
    cachedKey = null;
    cachedKeyFingerprint = null;
}
