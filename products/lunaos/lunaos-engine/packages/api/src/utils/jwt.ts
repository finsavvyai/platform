/**
 * JWT utilities for Cloudflare Workers
 * Uses Web Crypto API (no Node.js deps)
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface JWTPayload {
    sub: string;       // user ID
    email: string;
    tier: string;      // free | pro | team
    iat: number;       // issued at
    exp: number;       // expiration
}

/**
 * Sign a JWT using HMAC-SHA256 (Web Crypto)
 */
export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresInHours = 24): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = {
        ...payload,
        iat: now,
        exp: now + (expiresInHours * 3600),
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(fullPayload));

    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(`${headerB64}.${payloadB64}`)
    );

    const signatureB64 = base64url(signature);
    return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verify and decode a JWT
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;

    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const signatureBuffer = base64urlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBuffer,
        encoder.encode(`${headerB64}.${payloadB64}`)
    );

    if (!valid) throw new Error('Invalid signature');

    const payload: JWTPayload = JSON.parse(decoder.decode(base64urlDecode(payloadB64)));

    if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
    }

    return payload;
}

// --- Base64url helpers ---

function base64url(input: string | ArrayBuffer): string {
    const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): ArrayBuffer {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
